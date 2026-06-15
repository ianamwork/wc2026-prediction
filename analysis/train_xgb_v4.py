"""
Train four XGBoost models with aggressive feature pruning and regularization.
Holdout: 2022 FIFA Men's World Cup (64 matches).

Models:
  M1 — Elo + tier + neutral (6 features) — baseline
  M4 — M1 + 6 pruned form features + delta_squad_size_top5 (regularized)
  M5 — M4 features + 5-fold CV hyper-search (n_estimators, learning_rate)
  M6 — M5 features + Platt scaling calibration

Key regularization: max_depth=3, reg_alpha=1.0, reg_lambda=3.0, min_child_weight=5
"""

import warnings
warnings.filterwarnings("ignore")

from pathlib import Path
import itertools
import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from sklearn.metrics import log_loss, accuracy_score
from sklearn.model_selection import StratifiedKFold
from sklearn.calibration import CalibratedClassifierCV

BASE = Path(__file__).resolve().parent.parent  # repo root

SEED = 42

# ── load data ─────────────────────────────────────────────────────────────────
print("Loading data...")
df = pd.read_csv(
    BASE / "data" / "processed" / "training_matches_v3.csv",
    parse_dates=["date"],
)
print(f"  Full dataset: {df.shape}")

label_map  = {"home_win": 0, "draw": 1, "away_win": 2}
df["label"] = df["result"].map(label_map)

weight_map = {"world_cup": 4, "continental": 3, "nations_league": 2, "qualifier": 1}
df["weight"] = df["tournament_tier"].map(weight_map).fillna(1)

holdout_mask = (
    df["tournament"].str.contains("FIFA Men's World Cup", na=False)
    & (df["date"].dt.year == 2022)
)
elo_ok     = df["elo_home"].notna() & df["elo_away"].notna()
train_mask = (~holdout_mask) & elo_ok

df_train = df[train_mask].copy()
df_hold  = df[holdout_mask].copy()
print(f"  Training rows: {len(df_train)}  |  Holdout (2022 WC): {len(df_hold)}")

# ── Step 1: correlation matrix of all 24 form features ───────────────────────
ALL_FORM_FEATS = [
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

available_form = [f for f in ALL_FORM_FEATS if f in df_train.columns]
form_train = df_train[available_form].fillna(df_train[available_form].median())

print(f"\n{'='*70}")
print(f"STEP 1 — Correlation matrix of {len(available_form)} form features (training set)")
print(f"{'='*70}")

corr = form_train.corr().round(2)

# Print full matrix
pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)
pd.set_option("display.float_format", "{:.2f}".format)
print(corr.to_string())

# Highlight highly-correlated pairs (|r| > 0.7)
print("\nHighly correlated pairs  |r| > 0.70:")
print("-" * 50)
pairs_shown = set()
for i, c1 in enumerate(corr.columns):
    for j, c2 in enumerate(corr.columns):
        if i >= j:
            continue
        r = corr.loc[c1, c2]
        if abs(r) > 0.70:
            key = tuple(sorted([c1, c2]))
            if key not in pairs_shown:
                pairs_shown.add(key)
                print(f"  {c1:<34} ↔  {c2:<34}  r = {r:+.2f}")

# ── feature sets ─────────────────────────────────────────────────────────────
ELO_FEATS = ["elo_home", "elo_away", "elo_delta", "elo_avg", "tier_num", "is_neutral"]

PRUNED_FORM_FEATS = [
    "delta_form_last5",
    "delta_goals_conceded_12mo",
    "delta_goal_diff_12mo",
    "home_days_since_last",
    "away_days_since_last",
    "delta_h2h_net_wins",
]
PRUNED_FORM_FEATS = [f for f in PRUNED_FORM_FEATS if f in df.columns]

SQUAD_DELTA = [f for f in ["delta_squad_size_top5"] if f in df.columns]

M4_FEATS = ELO_FEATS + PRUNED_FORM_FEATS + SQUAD_DELTA

print(f"\n{'='*70}")
print(f"STEP 2 — Feature sets")
print(f"{'='*70}")
print(f"  M1  ({len(ELO_FEATS)} features): {ELO_FEATS}")
print(f"  M4  ({len(M4_FEATS)} features): {M4_FEATS}")
print(f"  M5  same features as M4, CV-tuned hyperparams")
print(f"  M6  same features as M5, + Platt scaling calibration")

# ── regularized base hyperparams ─────────────────────────────────────────────
REG_PARAMS = dict(
    objective="multi:softprob",
    num_class=3,
    max_depth=3,
    n_estimators=300,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=1.0,
    reg_lambda=3.0,
    min_child_weight=5,
    random_state=SEED,
    eval_metric="mlogloss",
    verbosity=0,
)

BASE_PARAMS = dict(
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

# ── helpers ───────────────────────────────────────────────────────────────────
label_names = {0: "home_win", 1: "draw", 2: "away_win"}

def per_match_logloss(proba, y):
    eps = 1e-15
    return -np.log(np.clip(proba[np.arange(len(y)), y], eps, 1 - eps))

def eval_metrics(proba, y):
    pred  = np.argmax(proba, axis=1)
    ll    = log_loss(y, proba)
    acc   = accuracy_score(y, pred)
    avg_d = proba[:, 1].mean()
    max_p = proba.max()
    return ll, acc, avg_d, max_p

def impute(X_tr, X_ho):
    meds = X_tr.median()
    return X_tr.fillna(meds), X_ho.fillna(meds)

# ── M1 baseline ───────────────────────────────────────────────────────────────
print(f"\n{'='*70}")
print("TRAINING M1 — Elo baseline (6 features)")
print(f"{'='*70}")

X_tr_m1, X_ho_m1 = impute(df_train[ELO_FEATS].copy(), df_hold[ELO_FEATS].copy())
y_train = df_train["label"].values
y_hold  = df_hold["label"].values
w_train = df_train["weight"].values

m1 = xgb.XGBClassifier(**BASE_PARAMS)
m1.fit(X_tr_m1, y_train, sample_weight=w_train)
proba_m1 = m1.predict_proba(X_ho_m1)
ll_m1, acc_m1, adraw_m1, maxp_m1 = eval_metrics(proba_m1, y_hold)
print(f"  Log-loss={ll_m1:.4f}  Acc={acc_m1:.4f}  Avg P(Draw)={adraw_m1:.4f}  Max P={maxp_m1:.4f}")

# ── M4 regularized ───────────────────────────────────────────────────────────
print(f"\n{'='*70}")
print(f"TRAINING M4 — {len(M4_FEATS)} features, regularized")
print(f"{'='*70}")

X_tr_m4, X_ho_m4 = impute(df_train[M4_FEATS].copy(), df_hold[M4_FEATS].copy())
meds_m4 = df_train[M4_FEATS].median()

m4 = xgb.XGBClassifier(**REG_PARAMS)
m4.fit(X_tr_m4, y_train, sample_weight=w_train)
proba_m4 = m4.predict_proba(X_ho_m4)
ll_m4, acc_m4, adraw_m4, maxp_m4 = eval_metrics(proba_m4, y_hold)
print(f"  Log-loss={ll_m4:.4f}  Acc={acc_m4:.4f}  Avg P(Draw)={adraw_m4:.4f}  Max P={maxp_m4:.4f}")

# ── M5 — 5-fold CV hyper-search ───────────────────────────────────────────────
print(f"\n{'='*70}")
print("TRAINING M5 — CV hyper-search (n_estimators × learning_rate)")
print(f"{'='*70}")

N_EST_GRID = [100, 200, 300, 400, 500]
LR_GRID    = [0.01, 0.03, 0.05, 0.1]

skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
best_cv_ll = np.inf
best_ne, best_lr = 300, 0.05

cv_results = []
for ne, lr in itertools.product(N_EST_GRID, LR_GRID):
    fold_lls = []
    params = {**REG_PARAMS, "n_estimators": ne, "learning_rate": lr}
    for fold_tr, fold_va in skf.split(X_tr_m4, y_train):
        xf = xgb.XGBClassifier(**params)
        xf.fit(
            X_tr_m4.iloc[fold_tr], y_train[fold_tr],
            sample_weight=w_train[fold_tr],
        )
        pv = xf.predict_proba(X_tr_m4.iloc[fold_va])
        fold_lls.append(log_loss(y_train[fold_va], pv))
    mean_ll = np.mean(fold_lls)
    cv_results.append((ne, lr, mean_ll))
    if mean_ll < best_cv_ll:
        best_cv_ll = mean_ll
        best_ne, best_lr = ne, lr

print(f"\n  CV grid results (n_estimators × lr → mean log-loss):")
for ne, lr, cll in sorted(cv_results, key=lambda x: x[2]):
    mark = " ← best" if (ne == best_ne and lr == best_lr) else ""
    print(f"    n={ne:3d}  lr={lr:.2f}  cv_ll={cll:.4f}{mark}")

print(f"\n  Best: n_estimators={best_ne}  learning_rate={best_lr}  cv_ll={best_cv_ll:.4f}")

m5_params = {**REG_PARAMS, "n_estimators": best_ne, "learning_rate": best_lr}
m5 = xgb.XGBClassifier(**m5_params)
m5.fit(X_tr_m4, y_train, sample_weight=w_train)
proba_m5 = m5.predict_proba(X_ho_m4)
ll_m5, acc_m5, adraw_m5, maxp_m5 = eval_metrics(proba_m5, y_hold)
print(f"  Holdout: Log-loss={ll_m5:.4f}  Acc={acc_m5:.4f}  Avg P(Draw)={adraw_m5:.4f}  Max P={maxp_m5:.4f}")

# ── M6 — Platt scaling calibration ───────────────────────────────────────────
print(f"\n{'='*70}")
print("TRAINING M6 — Platt scaling (CalibratedClassifierCV, cv=5)")
print(f"{'='*70}")

m6_base = xgb.XGBClassifier(**m5_params)
m6 = CalibratedClassifierCV(m6_base, cv=5, method="sigmoid")
m6.fit(X_tr_m4, y_train, sample_weight=w_train)
proba_m6 = m6.predict_proba(X_ho_m4)
ll_m6, acc_m6, adraw_m6, maxp_m6 = eval_metrics(proba_m6, y_hold)
print(f"  Holdout: Log-loss={ll_m6:.4f}  Acc={acc_m6:.4f}  Avg P(Draw)={adraw_m6:.4f}  Max P={maxp_m6:.4f}")

# ── Summary table ─────────────────────────────────────────────────────────────
print(f"\n\n{'='*80}")
print(f"{'Model':<8} {'Features':<38} {'Log-loss':>9} {'Accuracy':>9} {'Avg P(Draw)':>12} {'Max P':>8}")
print(f"{'-'*80}")

rows = [
    ("M1", "Elo + tier + neutral (6)",          ll_m1, acc_m1, adraw_m1, maxp_m1),
    ("M4", f"M1 + 6 pruned form + squad ({len(M4_FEATS)})", ll_m4, acc_m4, adraw_m4, maxp_m4),
    ("M5", "M4 + CV-tuned hyperparams",         ll_m5, acc_m5, adraw_m5, maxp_m5),
    ("M6", "M5 + Platt scaling",                ll_m6, acc_m6, adraw_m6, maxp_m6),
]
for name, label, ll, acc, adraw, maxp in rows:
    print(f"{name:<8} {label:<38} {ll:>9.4f} {acc:>9.4f} {adraw:>12.4f} {maxp:>8.4f}")
print(f"{'='*80}")

# ── pick best model by log-loss ───────────────────────────────────────────────
best_idx = np.argmin([ll_m1, ll_m4, ll_m5, ll_m6])
best_name, best_proba = [
    ("M1", proba_m1), ("M4", proba_m4), ("M5", proba_m5), ("M6", proba_m6)
][best_idx]
print(f"\n  Best model by log-loss: {best_name}")

# ── SHAP on best XGBoost model (use M5 for interpretability) ─────────────────
shap_model = m5
shap_feats = M4_FEATS
X_shap = X_ho_m4

print(f"\n\n{'='*70}")
print("SHAP — M5 (best XGBoost, 2022 WC holdout)")
print(f"{'='*70}")

explainer = shap.TreeExplainer(shap_model)
shap_vals = explainer.shap_values(X_shap)

sv = np.array(shap_vals)
if sv.ndim == 3:
    mean_abs_shap = np.abs(sv).mean(axis=(0, 2))
else:
    mean_abs_shap = np.mean([np.abs(c).mean(axis=0) for c in shap_vals], axis=0)

shap_df = pd.DataFrame({
    "feature":       shap_feats,
    "mean_abs_shap": mean_abs_shap,
}).sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)

print("\nTop 10 features by mean |SHAP| (M5, 2022 WC holdout):")
print("-" * 50)
for _, row in shap_df.head(10).iterrows():
    print(f"  {row['feature']:<34}  {row['mean_abs_shap']:.5f}")

# ── 10 worst misses ───────────────────────────────────────────────────────────
miss_df = df_hold[["date", "home_team", "away_team", "result",
                   "home_score", "away_score"]].copy().reset_index(drop=True)
miss_df["true_label"] = y_hold

for tag, proba in [("m1", proba_m1), ("m5", proba_m5)]:
    miss_df[f"{tag}_pred"]    = np.argmax(proba, axis=1)
    miss_df[f"{tag}_logloss"] = per_match_logloss(proba, y_hold)
    miss_df[f"{tag}_correct"] = (miss_df[f"{tag}_pred"] == miss_df["true_label"]).astype(int)
    miss_df[f"{tag}_pred_str"]= miss_df[f"{tag}_pred"].map(label_names)
miss_df["logloss_delta"] = miss_df["m5_logloss"] - miss_df["m1_logloss"]

worst10 = miss_df.nlargest(10, "m1_logloss").copy()

print(f"\n\n{'='*95}")
print("10 WORST MISSES by M1 log-loss  (M5 log-loss in parens / Δ = M5 − M1)")
print(f"{'='*95}")
fmt = "{:<12} {:<22} {:<22} {:>5} {:>8} {:>8} {:>8}  {}"
print(fmt.format("Date", "Home", "Away", "Score", "M1-LL", "M5-LL", "Δ", "Flip?"))
print("-" * 95)
for _, r in worst10.iterrows():
    score = f"{int(r.home_score)}-{int(r.away_score)}"
    if r.m1_correct == 0 and r.m5_correct == 1:
        flip = "✓ FIXED"
    elif r.m1_correct == 1 and r.m5_correct == 0:
        flip = "✗ BROKE"
    elif r.m1_correct == 0 and r.m5_correct == 0:
        flip = f"still wrong ({'better' if r.logloss_delta < 0 else 'worse'})"
    else:
        flip = "both correct"
    print(fmt.format(
        str(r.date)[:10], r.home_team[:21], r.away_team[:21], score,
        f"{r.m1_logloss:.3f}", f"{r.m5_logloss:.3f}", f"{r.logloss_delta:+.3f}", flip,
    ))

# ── Spotlight matches ─────────────────────────────────────────────────────────
SPOTLIGHTS = [("Argentina", "Saudi Arabia"), ("Morocco", "Belgium"), ("Cameroon", "Brazil")]
print(f"\n\n{'='*95}")
print("SPOTLIGHT MATCHES")
print(f"{'='*95}")

for home, away in SPOTLIGHTS:
    row = miss_df[
        (miss_df["home_team"] == home) & (miss_df["away_team"] == away)
    ]
    if len(row) == 0:
        row = miss_df[
            (miss_df["home_team"] == away) & (miss_df["away_team"] == home)
        ]
    if len(row) == 0:
        print(f"  {home} vs {away} — NOT FOUND")
        continue
    r = row.iloc[0]
    idx = r.name
    score = f"{int(r.home_score)}-{int(r.away_score)}"

    p_m1 = proba_m1[idx]
    p_m5 = proba_m5[idx]
    p_m6 = proba_m6[idx]

    if r.m1_correct == 0 and r.m5_correct == 1:
        flip = "✓ FIXED"
    elif r.m1_correct == 1 and r.m5_correct == 0:
        flip = "✗ BROKE"
    elif r.m1_correct == 0 and r.m5_correct == 0:
        flip = f"still wrong ({'better' if r.logloss_delta < 0 else 'worse'})"
    else:
        flip = "both correct"

    print(f"\n  {r.home_team} vs {r.away_team}  ({score})  —  actual: {r.result}")
    print(f"  M1  P(HW/D/AW): {p_m1[0]:.3f} / {p_m1[1]:.3f} / {p_m1[2]:.3f}   pred: {r.m1_pred_str}   LL: {r.m1_logloss:.3f}")
    print(f"  M5  P(HW/D/AW): {p_m5[0]:.3f} / {p_m5[1]:.3f} / {p_m5[2]:.3f}   pred: {r.m5_pred_str}   LL: {r.m5_logloss:.3f}")
    print(f"  M6  P(HW/D/AW): {p_m6[0]:.3f} / {p_m6[1]:.3f} / {p_m6[2]:.3f}")
    print(f"  Δ LL = {r.logloss_delta:+.3f}   {flip}")

# ── Save predictions ──────────────────────────────────────────────────────────
pred_df = df_hold[["date", "home_team", "away_team", "result",
                   "home_score", "away_score", "tournament"]].copy().reset_index(drop=True)

for tag, proba in [("M1", proba_m1), ("M4", proba_m4), ("M5", proba_m5), ("M6", proba_m6)]:
    pred_df[f"{tag}_p_home_win"] = proba[:, 0]
    pred_df[f"{tag}_p_draw"]     = proba[:, 1]
    pred_df[f"{tag}_p_away_win"] = proba[:, 2]
    pred_df[f"{tag}_pred"]       = [label_names[i] for i in np.argmax(proba, axis=1)]
    pred_df[f"{tag}_logloss"]    = per_match_logloss(proba, y_hold)

out_path = BASE / "models" / "predictions" / "model_v4_predictions_2022.csv"
pred_df.to_csv(out_path, index=False)
print(f"\n\nSaved: model_v4_predictions_2022.csv  ({pred_df.shape})")
