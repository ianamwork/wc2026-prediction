"""
build_features_v2.py
====================
Adds trailing form features to training_matches_full.csv and retrains
the XGBoost model. Saves:
  - training_matches_full_v2.csv       (all matches + new features)
  - model_v2_predictions_2022.csv      (2022 WC holdout predictions)
  - shap_v2_feature_importance.csv     (SHAP values)

Run: python3 models/build_features.py
"""

from pathlib import Path
import pandas as pd
import numpy as np
import warnings, time
warnings.filterwarnings('ignore')

from scipy.stats import poisson
from xgboost import XGBClassifier
from sklearn.metrics import log_loss
import shap

t_start = time.time()
DOWNLOADS = Path.home() / "Downloads"

# ═══════════════════════════════════════════════════════════════════════════
# LOAD
# ═══════════════════════════════════════════════════════════════════════════
df = pd.read_csv(DOWNLOADS / 'training_matches_full.csv')
df['date'] = pd.to_datetime(df['date'])
df = df.sort_values('date').reset_index(drop=True)   # index = match_idx 0..N-1
print(f"Loaded {len(df):,} matches  ({df.date.min().date()} – {df.date.max().date()})")

# ═══════════════════════════════════════════════════════════════════════════
# PART A — TRAILING FORM FEATURES
# ═══════════════════════════════════════════════════════════════════════════

# ── 1. Build team-match panel ──────────────────────────────────────────────
def make_panel(df):
    def pts(gf, ga): return np.where(gf>ga, 3, np.where(gf==ga, 1, 0))
    home = pd.DataFrame({
        'match_idx': df.index, 'date': df['date'],
        'team': df['home_team'], 'opponent': df['away_team'],
        'gf': df['home_score'], 'ga': df['away_score'],
        'pts': pts(df['home_score'].values, df['away_score'].values),
        'win': (df['home_score'] > df['away_score']).astype(int),
        'is_home': 1,
    })
    away = pd.DataFrame({
        'match_idx': df.index, 'date': df['date'],
        'team': df['away_team'], 'opponent': df['home_team'],
        'gf': df['away_score'], 'ga': df['home_score'],
        'pts': pts(df['away_score'].values, df['home_score'].values),
        'win': (df['away_score'] > df['home_score']).astype(int),
        'is_home': 0,
    })
    panel = pd.concat([home, away], ignore_index=True)
    return panel.sort_values(['team', 'date', 'match_idx']).reset_index(drop=True)

print("Building team-match panel...", end=' ', flush=True)
panel = make_panel(df)
print(f"{len(panel):,} rows, {panel['team'].nunique()} teams")

# ── 2. Per-team trailing stats ─────────────────────────────────────────────
STAT_COLS = ['form_last5', 'form_last10', 'goals_scored_12mo',
             'goals_conceded_12mo', 'goal_diff_12mo',
             'win_rate_12mo', 'days_since_last_match']

def compute_team_stats(grp):
    grp = grp.sort_values('date').reset_index(drop=True)
    n       = len(grp)
    pts_arr = grp['pts'].values.astype(float)
    gf_arr  = grp['gf'].values.astype(float)
    ga_arr  = grp['ga'].values.astype(float)
    win_arr = grp['win'].values.astype(float)
    dates_ns = grp['date'].values.astype(np.int64)
    day_ns   = 86_400 * 10**9

    cum_pts  = np.concatenate([[0.], np.cumsum(pts_arr)])
    cum_gf   = np.concatenate([[0.], np.cumsum(gf_arr)])
    cum_ga   = np.concatenate([[0.], np.cumsum(ga_arr)])
    cum_win  = np.concatenate([[0.], np.cumsum(win_arr)])

    form5 = form10 = gf12 = ga12 = win12 = np.full(n, np.nan)
    days_since = np.full(n, np.nan)
    form5  = np.full(n, np.nan)
    form10 = np.full(n, np.nan)
    gf12   = np.full(n, np.nan)
    ga12   = np.full(n, np.nan)
    win12  = np.full(n, np.nan)

    for i in range(1, n):
        k5  = min(i, 5);  form5[i]  = (cum_pts[i]-cum_pts[i-k5])  / (3.*k5)
        k10 = min(i, 10); form10[i] = (cum_pts[i]-cum_pts[i-k10]) / (3.*k10)

        cutoff = dates_ns[i] - 365 * day_ns
        left   = int(np.searchsorted(dates_ns[:i], cutoff, side='left'))
        n12    = i - left
        if n12 > 0:
            gf12[i]  = (cum_gf[i]  - cum_gf[left])  / n12
            ga12[i]  = (cum_ga[i]  - cum_ga[left])   / n12
            win12[i] = (cum_win[i] - cum_win[left])  / n12

        days_since[i] = (dates_ns[i] - dates_ns[i-1]) / day_ns

    return pd.DataFrame({
        'match_idx':             grp['match_idx'].values,
        'is_home':               grp['is_home'].values,
        'form_last5':            form5,
        'form_last10':           form10,
        'goals_scored_12mo':     gf12,
        'goals_conceded_12mo':   ga12,
        'goal_diff_12mo':        gf12 - ga12,
        'win_rate_12mo':         win12,
        'days_since_last_match': days_since,
    })

print("Computing per-team trailing stats...", end=' ', flush=True)
stats_parts = [compute_team_stats(g) for _, g in panel.groupby('team', sort=False)]
all_stats = pd.concat(stats_parts, ignore_index=True)
print(f"done  ({time.time()-t_start:.1f}s)")

# ── 3. Join home + away features back to match df ─────────────────────────
home_feat = (all_stats[all_stats['is_home'] == 1]
             .set_index('match_idx')[STAT_COLS]
             .rename(columns={c: f'home_{c}' for c in STAT_COLS}))
away_feat = (all_stats[all_stats['is_home'] == 0]
             .set_index('match_idx')[STAT_COLS]
             .rename(columns={c: f'away_{c}' for c in STAT_COLS}))

df = df.join(home_feat).join(away_feat)

# Delta features (home minus away)
for col in ['form_last5', 'form_last10', 'goals_scored_12mo',
            'goals_conceded_12mo', 'goal_diff_12mo', 'win_rate_12mo']:
    df[f'delta_{col}'] = df[f'home_{col}'] - df[f'away_{col}']

# ── 4. Head-to-head record (last 5 meetings, home team perspective) ────────
print("Computing H2H records...", end=' ', flush=True)
df['_pair'] = [
    '_'.join(sorted([h, a]))
    for h, a in zip(df['home_team'], df['away_team'])
]
df['_home_net'] = np.where(df['home_score'] > df['away_score'],  1,
                  np.where(df['home_score'] < df['away_score'], -1, 0))

h2h = np.full(len(df), np.nan)
for pair_key, grp in df.groupby('_pair'):
    idx     = grp.index.values
    t0_name = pair_key.split('_')[0]
    # net from pair[0]'s perspective
    net = np.where(grp['home_team'].values == t0_name,
                   grp['_home_net'].values,
                  -grp['_home_net'].values).astype(float)
    cum = np.concatenate([[0.], np.cumsum(net)])
    for j in range(1, len(idx)):
        k    = min(j, 5)
        raw  = cum[j] - cum[j - k]
        sign = 1 if grp['home_team'].iloc[j] == t0_name else -1
        h2h[idx[j]] = sign * raw

df['h2h_record'] = h2h
df.drop(columns=['_pair', '_home_net'], inplace=True)
print(f"done  ({time.time()-t_start:.1f}s)")

# ── 5. Part B stubs (Wyscout/FBref — no data on this machine yet) ──────────
WYSCOUT_COLS = ['squad_key_passes_p90', 'squad_dbl_p90', 'squad_prog_passes_p90',
                'squad_long_ball_pct', 'squad_pass_accuracy', 'squad_minutes_played']
for c in WYSCOUT_COLS:
    df[c] = np.nan

# ── 6. Coverage report ────────────────────────────────────────────────────
print("\nTrailing feature coverage (% non-null):")
check_cols = [f'home_{c}' for c in STAT_COLS] + ['h2h_record']
for c in check_cols:
    pct = df[c].notna().mean() * 100
    print(f"  {c:<38} {pct:5.1f}%")

# Save v2
out_path = DOWNLOADS / 'training_matches_full_v2.csv'
df.to_csv(out_path, index=False)
print(f"\nSaved → {out_path}  ({len(df):,} rows × {len(df.columns)} cols)")

# ═══════════════════════════════════════════════════════════════════════════
# PART C — RETRAIN XGBOOST WITH NEW FEATURES
# ═══════════════════════════════════════════════════════════════════════════
TIER_MAP = {'world_cup':1,'continental':2,'nations_league':3,'qualifier':4}
df['tier_num']   = df['tournament_tier'].map(TIER_MAP)
df['is_neutral'] = df['is_neutral'].fillna(0).astype(int)
df = df.dropna(subset=['elo_home','elo_away'])

mask_test = (df['tournament_tier']=='world_cup') & (df['date'].dt.year == 2022)
test  = df[mask_test].copy().reset_index(drop=True)
train = df[~mask_test].copy().reset_index(drop=True)
print(f"\nTrain: {len(train):,}  |  Test (2022 WC): {len(test)}")

RESULT_MAP   = {'home_win':0,'draw':1,'away_win':2}
RESULT_NAMES = {0:'home_win',1:'draw',2:'away_win'}
y_train = train['result'].map(RESULT_MAP)
y_test  = test['result'].map(RESULT_MAP)
actual  = y_test.values

BASE_FEATS = ['elo_home','elo_away','elo_delta','elo_avg','tier_num','is_neutral']
FORM_FEATS = (
    [f'home_{c}' for c in STAT_COLS] +
    [f'away_{c}' for c in STAT_COLS] +
    ['h2h_record',
     'delta_form_last5','delta_form_last10','delta_goals_scored_12mo',
     'delta_goals_conceded_12mo','delta_goal_diff_12mo','delta_win_rate_12mo']
)
ALL_FEATS = BASE_FEATS + FORM_FEATS

WEIGHT_MAP = {'world_cup':4,'continental':3,'nations_league':2,'qualifier':1}
sw = train['tournament_tier'].map(WEIGHT_MAP).values

# ── Old XGBoost (Elo only, for comparison) ────────────────────────────────
print("\nFitting OLD XGBoost (Elo + tier + neutral)...", end=' ', flush=True)
xgb_old = XGBClassifier(objective='multi:softprob', num_class=3, max_depth=3,
                         n_estimators=200, learning_rate=0.05, subsample=0.8,
                         colsample_bytree=0.8, eval_metric='mlogloss',
                         random_state=42, verbosity=0)
xgb_old.fit(train[BASE_FEATS], y_train, sample_weight=sw, verbose=False)
old_probs = xgb_old.predict_proba(test[BASE_FEATS])
old_ll    = log_loss(actual, old_probs)
old_acc   = np.mean(np.argmax(old_probs,axis=1) == actual)
print(f"log-loss={old_ll:.4f}  acc={old_acc:.1%}")

# ── New XGBoost (Elo + trailing form) ────────────────────────────────────
# Drop rows where ALL form features are null (teams with <1 prior match)
train_v2 = train[ALL_FEATS + ['result']].copy()
test_v2  = test[ALL_FEATS].copy()

print("Fitting NEW XGBoost (Elo + trailing form)...", end=' ', flush=True)
xgb_new = XGBClassifier(objective='multi:softprob', num_class=3, max_depth=3,
                         n_estimators=200, learning_rate=0.05, subsample=0.8,
                         colsample_bytree=0.8, eval_metric='mlogloss',
                         random_state=42, verbosity=0)
xgb_new.fit(train_v2.drop(columns=['result']), y_train,
            sample_weight=sw, verbose=False)
new_probs = xgb_new.predict_proba(test_v2)
new_ll    = log_loss(actual, new_probs)
new_acc   = np.mean(np.argmax(new_probs,axis=1) == actual)
print(f"log-loss={new_ll:.4f}  acc={new_acc:.1%}")

# ── Side-by-side comparison ───────────────────────────────────────────────
print("\n" + "═"*60)
print("MODEL COMPARISON — 2022 WC holdout (n=64)")
print("═"*60)
print(f"  {'Model':<35} {'Features':>8} {'Log-loss':>10} {'Accuracy':>10}")
print(f"  {'─'*65}")
print(f"  {'Old XGBoost':<35} {'6':>8} {old_ll:>10.4f} {old_acc:>10.1%}")
print(f"  {'New XGBoost (+ trailing form)':<35} {len(ALL_FEATS):>8} {new_ll:>10.4f} {new_acc:>10.1%}")
delta = old_ll - new_ll
print(f"\n  Δ log-loss: {delta:+.4f}  ({'improved' if delta > 0 else 'regressed'})")

# ── SHAP analysis ─────────────────────────────────────────────────────────
print("\nRunning SHAP...", end=' ', flush=True)
explainer  = shap.TreeExplainer(xgb_new)
shap_expl  = explainer(test_v2)
sv         = shap_expl.values  # (64, n_features, 3)
mean_abs   = np.abs(sv).mean(axis=(0, 2)) if sv.ndim == 3 else np.abs(sv).mean(axis=0)
shap_df    = pd.DataFrame({'feature': ALL_FEATS, 'mean_abs_shap': mean_abs})
shap_df    = shap_df.sort_values('mean_abs_shap', ascending=False).reset_index(drop=True)
print("done")

print("\nSHAP Feature Importance (top 20):")
print(f"  {'Rank':<5} {'Feature':<38} {'Mean |SHAP|':>12}   Bar")
print("  " + "─"*70)
for rank, row in shap_df.head(20).iterrows():
    bar = '█' * max(1, int(row['mean_abs_shap'] * 120))
    print(f"  {rank+1:<5} {row['feature']:<38} {row['mean_abs_shap']:>12.4f}   {bar}")

# ── Save model v2 predictions ─────────────────────────────────────────────
SAVE_COLS = ['date','home_team','away_team','home_score','away_score',
             'tournament','result','elo_home','elo_away','elo_delta']
pred_out = test[SAVE_COLS].copy()
pred_out['p_home_win']   = new_probs[:,0].round(4)
pred_out['p_draw']       = new_probs[:,1].round(4)
pred_out['p_away_win']   = new_probs[:,2].round(4)
pred_out['predicted']    = [RESULT_NAMES[i] for i in np.argmax(new_probs, axis=1)]

eps = 1e-9
act_enc = np.eye(3)[actual]
pred_out['match_logloss'] = (-np.sum(act_enc * np.log(new_probs+eps), axis=1)).round(4)
pred_out.to_csv(DOWNLOADS / 'model_v2_predictions_2022.csv', index=False)

shap_df.to_csv(DOWNLOADS / 'shap_v2_feature_importance.csv', index=False)

total_time = time.time() - t_start
print(f"\nSaved → model_v2_predictions_2022.csv")
print(f"Saved → shap_v2_feature_importance.csv")
print(f"\nTotal runtime: {total_time:.1f}s")
print(f"\n{'═'*60}")
print(f"  Baseline to beat:  0.9821")
print(f"  New XGBoost:       {new_ll:.4f}  (Δ = {delta:+.4f})")
print(f"{'═'*60}")
