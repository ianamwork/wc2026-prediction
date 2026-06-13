"""
Train three XGBoost models on training_matches_v3.csv.
Holdout: 2022 FIFA Men's World Cup (64 matches).
Training: everything else with Elo present.

Sample weights: world_cup=4, continental=3, nations_league=2, qualifier=1
"""

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from sklearn.metrics import log_loss, accuracy_score

# ── reproducibility ─────────────────────────────────────────────────────────
SEED = 42

# ── load data ────────────────────────────────────────────────────────────────
print("Loading data...")
df = pd.read_csv(
    "/Users/ianwork/wc2026-prediction/data/processed/training_matches_v3.csv",
    parse_dates=["date"],
)
print(f"  Full dataset: {df.shape}")

# ── encode target ────────────────────────────────────────────────────────────
label_map = {"home_win": 0, "draw": 1, "away_win": 2}
df["label"] = df["result"].map(label_map)

# ── sample weights ───────────────────────────────────────────────────────────
weight_map = {"world_cup": 4, "continental": 3, "nations_league": 2, "qualifier": 1}
df["weight"] = df["tournament_tier"].map(weight_map).fillna(1)

# ── holdout: 2022 FIFA Men's World Cup ──────────────────────────────────────
holdout_mask = (
    df["tournament"].str.contains("FIFA Men's World Cup", na=False)
    & (df["date"].dt.year == 2022)
)
# Training: drop Elo-missing rows too
elo_ok = df["elo_home"].notna() & df["elo_away"].notna()
train_mask = (~holdout_mask) & elo_ok

df_train = df[train_mask].copy()
df_hold  = df[holdout_mask].copy()
print(f"  Training rows: {len(df_train)}  |  Holdout (2022 WC): {len(df_hold)}")

# ── feature sets ─────────────────────────────────────────────────────────────
ELO_FEATS = ["elo_home", "elo_away", "elo_delta", "elo_avg", "tier_num", "is_neutral"]

FORM_FEATS = [
    "home_form_last5",    "home_form_last10",
    "home_goals_scored_12mo", "home_goals_conceded_12mo",
    "home_goal_diff_12mo",    "home_win_rate_12mo",
    "home_days_since_last",   "home_h2h_net_wins",
    "away_form_last5",    "away_form_last10",
    "away_goals_scored_12mo", "away_goals_conceded_12mo",
    "away_goal_diff_12mo",    "away_win_rate_12mo",
    "away_days_since_last",   "away_h2h_net_wins",
    "delta_form_last5",   "delta_form_last10",
    "delta_goals_scored_12mo","delta_goals_conceded_12mo",
    "delta_goal_diff_12mo",   "delta_win_rate_12mo",
    "delta_days_since_last",  "delta_h2h_net_wins",
]

SQUAD_FEATS = [
    "home_squad_size_top5",
    "away_squad_size_top5",
    "delta_squad_size_top5",
]

FEATURE_SETS = {
    "M1_baseline": ELO_FEATS,
    "M2_form":     ELO_FEATS + FORM_FEATS,
    "M3_squad":    ELO_FEATS + FORM_FEATS + SQUAD_FEATS,
}

# ── XGBoost hyperparams ──────────────────────────────────────────────────────
XGB_PARAMS = dict(
    objective="multi:softprob",
    num_class=3,
    max_depth=3,
    n_estimators=200,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=SEED,
    eval_metric="mlogloss",
    verbosity=0,
)

# ── train + evaluate helper ───────────────────────────────────────────────────
def train_and_eval(name, feat_cols):
    print(f"\n{'='*60}")
    print(f"  {name}  ({len(feat_cols)} features)")
    print(f"{'='*60}")

    X_train = df_train[feat_cols].copy()
    y_train = df_train["label"].values
    w_train = df_train["weight"].values

    X_hold  = df_hold[feat_cols].copy()
    y_hold  = df_hold["label"].values

    # Impute NaNs with training-set medians (no holdout leakage)
    medians = X_train.median()
    X_train = X_train.fillna(medians)
    X_hold  = X_hold.fillna(medians)

    model = xgb.XGBClassifier(**XGB_PARAMS)
    model.fit(X_train, y_train, sample_weight=w_train, verbose=False)

    proba = model.predict_proba(X_hold)       # (64, 3)  cols: home_win, draw, away_win
    pred  = np.argmax(proba, axis=1)

    ll    = log_loss(y_hold, proba)
    acc   = accuracy_score(y_hold, pred)
    avg_draw = proba[:, 1].mean()

    print(f"  Log-loss : {ll:.4f}")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  Avg P(Draw): {avg_draw:.4f}")

    return model, proba, pred, medians, ll, acc, avg_draw


results    = {}
models     = {}
all_probas = {}
medians_   = {}

for name, feats in FEATURE_SETS.items():
    m, proba, pred, meds, ll, acc, adraw = train_and_eval(name, feats)
    results[name]    = {"ll": ll, "acc": acc, "avg_draw": adraw}
    models[name]     = m
    all_probas[name] = proba
    medians_[name]   = meds

# ── summary table ─────────────────────────────────────────────────────────────
print("\n")
print("=" * 65)
print(f"{'Model':<14} {'Features':<22} {'Log-loss':>9} {'Accuracy':>9} {'Avg P(Draw)':>12}")
print("-" * 65)
rows_info = [
    ("M1_baseline", "Elo + tier + neutral"),
    ("M2_form",     "+ 24 trailing form"),
    ("M3_squad",    "+ squad_size_top5"),
]
for key, label in rows_info:
    r = results[key]
    print(f"{key:<14} {label:<22} {r['ll']:>9.4f} {r['acc']:>9.4f} {r['avg_draw']:>12.4f}")
print("=" * 65)

# ── SHAP on Model 3 ───────────────────────────────────────────────────────────
print("\n\nRunning SHAP on M3_squad (holdout)...")

feats_m3   = FEATURE_SETS["M3_squad"]
X_hold_m3  = df_hold[feats_m3].fillna(medians_["M3_squad"])
X_train_m3 = df_train[feats_m3].fillna(medians_["M3_squad"])

explainer  = shap.TreeExplainer(models["M3_squad"])
shap_vals  = explainer.shap_values(X_hold_m3)   # (n_samples, n_features, n_classes)

# Mean |SHAP| across samples and classes → shape (n_features,)
sv = np.array(shap_vals)
if sv.ndim == 3:
    # New SHAP / XGBoost format: (samples, features, classes)
    mean_abs_shap = np.abs(sv).mean(axis=(0, 2))
else:
    # Old format: list of (samples, features) per class
    mean_abs_shap = np.mean([np.abs(c).mean(axis=0) for c in shap_vals], axis=0)

shap_df = pd.DataFrame({
    "feature":       feats_m3,
    "mean_abs_shap": mean_abs_shap,
}).sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)

print("\nTop 15 features by mean |SHAP value| (M3, 2022 WC holdout):")
print("-" * 48)
for _, row in shap_df.head(15).iterrows():
    print(f"  {row['feature']:<34}  {row['mean_abs_shap']:.5f}")

shap_df.to_csv(
    "/Users/ianwork/wc2026-prediction/data/processed/shap_v3_feature_importance.csv",
    index=False,
)
print("\nSaved: shap_v3_feature_importance.csv")

# ── Per-match loss contributions ─────────────────────────────────────────────
y_hold = df_hold["label"].values

def per_match_logloss(proba, y):
    """Scalar log-loss for each individual match (clipped for stability)."""
    eps = 1e-15
    return -np.log(np.clip(proba[np.arange(len(y)), y], eps, 1 - eps))

ll_m1 = per_match_logloss(all_probas["M1_baseline"], y_hold)
ll_m3 = per_match_logloss(all_probas["M3_squad"],    y_hold)

miss_df = df_hold[["date", "home_team", "away_team", "result",
                    "home_score", "away_score"]].copy()
miss_df["true_label"]   = y_hold
miss_df["m1_pred"]      = np.argmax(all_probas["M1_baseline"], axis=1)
miss_df["m3_pred"]      = np.argmax(all_probas["M3_squad"],    axis=1)
miss_df["m1_logloss"]   = ll_m1
miss_df["m3_logloss"]   = ll_m3
miss_df["logloss_delta"]= ll_m3 - ll_m1   # negative = M3 improved
miss_df["m1_correct"]   = (miss_df["m1_pred"] == miss_df["true_label"]).astype(int)
miss_df["m3_correct"]   = (miss_df["m3_pred"] == miss_df["true_label"]).astype(int)

label_names = {0: "home_win", 1: "draw", 2: "away_win"}
miss_df["m1_pred_str"] = miss_df["m1_pred"].map(label_names)
miss_df["m3_pred_str"] = miss_df["m3_pred"].map(label_names)

# Worst 10 by M1 log-loss
worst10 = miss_df.nlargest(10, "m1_logloss").copy()

print("\n\n" + "=" * 90)
print("10 WORST MISSES by M1 log-loss  (M3 log-loss in parentheses / Δ = M3 − M1)")
print("=" * 90)
fmt = "{:<12} {:<22} {:<22} {:>5} {:>8} {:>8} {:>8}  {}"
print(fmt.format("Date", "Home", "Away", "Score", "M1-LL", "M3-LL", "Δ", "Flip?"))
print("-" * 90)
for _, r in worst10.iterrows():
    score  = f"{int(r.home_score)}-{int(r.away_score)}"
    flip   = ""
    if r.m1_correct == 0 and r.m3_correct == 1:
        flip = "✓ FIXED"
    elif r.m1_correct == 1 and r.m3_correct == 0:
        flip = "✗ BROKE"
    elif r.m1_correct == 0 and r.m3_correct == 0:
        delta_sign = "better" if r.logloss_delta < 0 else "worse"
        flip = f"still wrong ({delta_sign})"
    else:
        flip = "both correct"
    print(fmt.format(
        str(r.date)[:10], r.home_team[:21], r.away_team[:21],
        score,
        f"{r.m1_logloss:.3f}", f"{r.m3_logloss:.3f}", f"{r.logloss_delta:+.3f}",
        flip,
    ))

# ── Spotlight matches ─────────────────────────────────────────────────────────
SPOTLIGHTS = [
    ("Argentina",   "Saudi Arabia"),
    ("Morocco",     "Belgium"),
    ("Cameroon",    "Brazil"),
]
print("\n\n" + "=" * 90)
print("SPOTLIGHT MATCHES")
print("=" * 90)
for home, away in SPOTLIGHTS:
    row = miss_df[
        (miss_df["home_team"] == home) & (miss_df["away_team"] == away)
    ]
    if len(row) == 0:
        row = miss_df[
            (miss_df["home_team"] == away) & (miss_df["away_team"] == home)
        ]
    if len(row) == 0:
        print(f"  {home} vs {away} — NOT FOUND in holdout")
        continue
    r = row.iloc[0]
    score = f"{int(r.home_score)}-{int(r.away_score)}"

    # Get raw probabilities
    idx = df_hold.index.get_loc(r.name)
    p_m1 = all_probas["M1_baseline"][idx]
    p_m3 = all_probas["M3_squad"][idx]

    flip = ""
    if r.m1_correct == 0 and r.m3_correct == 1:
        flip = "✓ FIXED"
    elif r.m1_correct == 1 and r.m3_correct == 0:
        flip = "✗ BROKE"
    elif r.m1_correct == 0 and r.m3_correct == 0:
        delta_sign = "better" if r.logloss_delta < 0 else "worse"
        flip = f"still wrong ({delta_sign})"
    else:
        flip = "both correct"

    print(f"\n  {r.home_team} vs {r.away_team}  ({score})  —  actual: {r.result}")
    print(f"  M1  P(HW/D/AW): {p_m1[0]:.3f} / {p_m1[1]:.3f} / {p_m1[2]:.3f}   pred: {r.m1_pred_str}   LL: {r.m1_logloss:.3f}")
    print(f"  M3  P(HW/D/AW): {p_m3[0]:.3f} / {p_m3[1]:.3f} / {p_m3[2]:.3f}   pred: {r.m3_pred_str}   LL: {r.m3_logloss:.3f}")
    print(f"  Δ LL = {r.logloss_delta:+.3f}   {flip}")

# ── Save full predictions ─────────────────────────────────────────────────────
pred_df = df_hold[["date", "home_team", "away_team", "result",
                    "home_score", "away_score", "tournament"]].copy()

for name, proba in all_probas.items():
    pred_df[f"{name}_p_home_win"] = proba[:, 0]
    pred_df[f"{name}_p_draw"]     = proba[:, 1]
    pred_df[f"{name}_p_away_win"] = proba[:, 2]
    pred_df[f"{name}_pred"]       = [label_names[i] for i in np.argmax(proba, axis=1)]
    pred_df[f"{name}_logloss"]    = per_match_logloss(proba, y_hold)

pred_df.to_csv(
    "/Users/ianwork/wc2026-prediction/models/predictions/model_v3_predictions_2022.csv",
    index=False,
)
print("\n\nSaved: model_v3_predictions_2022.csv")
print(f"Prediction file shape: {pred_df.shape}")
