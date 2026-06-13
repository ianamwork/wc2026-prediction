"""
xgboost_model.py
================
XGBoost multiclass classifier for international football match outcomes
(home_win / draw / away_win).

Features:
  - elo_home, elo_away, elo_delta, elo_avg  (Elo ratings)
  - tier_num                                 (1=WC, 2=continental, 3=NL, 4=qualifier)
  - is_neutral                               (neutral venue flag)

Sample weights: world_cup=4, continental=3, nations_league=2, qualifier=1

Hyperparameters (selected via 5-fold CV grid search):
  max_depth=3, n_estimators=200, learning_rate=0.05,
  subsample=0.8, colsample_bytree=0.8

Holdout: 2022 FIFA World Cup (64 matches)

Results (2022 WC holdout):
  log-loss = 0.9821   accuracy = 54.7% (35/64)

CV grid (log-loss, 5-fold):
  depth=3  n=100: 0.8422  n=200: 0.8411*  n=300: 0.8421
  depth=4  n=100: 0.8415  n=200: 0.8426   n=300: 0.8452
  depth=5  n=100: 0.8424  n=200: 0.8460   n=300: 0.8509
  depth=6  n=100: 0.8442  n=200: 0.8507   n=300: 0.8590

SHAP feature importance (ranked by mean |SHAP| on 2022 WC test set):
  1. elo_delta     0.3036
  2. tier_num      0.1975
  3. elo_away      0.1178
  4. elo_home      0.1081
  5. is_neutral    0.1050
  6. elo_avg       0.0483

Usage:
  python models/xgboost_model.py

Outputs:
  models/predictions/xgboost_model_predictions_2022.csv
  models/predictions/ensemble_predictions_2022.csv
  models/model_comparison_summary.txt
"""

import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

from xgboost import XGBClassifier
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import log_loss
import shap

DATA_PATH = 'data/processed/training_matches_full.csv'
PRED_DIR  = 'models/predictions/'

# ── Load & split ──────────────────────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
TIER_MAP = {'world_cup':1,'continental':2,'nations_league':3,'qualifier':4}
df['tier_num']   = df['tournament_tier'].map(TIER_MAP)
df['is_neutral'] = df['is_neutral'].fillna(0).astype(int)
df['date']       = pd.to_datetime(df['date'])
df = df.dropna(subset=['elo_home','elo_away'])

mask_test = (df['tournament_tier']=='world_cup') & (df['date'].dt.year == 2022)
test  = df[mask_test].copy().reset_index(drop=True)
train = df[~mask_test].copy().reset_index(drop=True)

print(f"Train: {len(train):,}  |  Test (2022 WC): {len(test)}")

FEATURES     = ['elo_home','elo_away','elo_delta','elo_avg','tier_num','is_neutral']
RESULT_MAP   = {'home_win':0,'draw':1,'away_win':2}
RESULT_NAMES = {0:'home_win',1:'draw',2:'away_win'}

X_train = train[FEATURES]
X_test  = test[FEATURES]
y_train = train['result'].map(RESULT_MAP)
y_test  = test['result'].map(RESULT_MAP)
actual  = y_test.values

WEIGHT_MAP = {'world_cup':4,'continental':3,'nations_league':2,'qualifier':1}
sw = train['tournament_tier'].map(WEIGHT_MAP).values

# ── CV tuning (set RUN_CV=True to re-run the full grid search) ────────────
RUN_CV = False

if RUN_CV:
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    best_ll, best_params = np.inf, {}
    for depth in [3,4,5,6]:
        for n_est in [100,200,300]:
            xgb = XGBClassifier(
                objective='multi:softprob', num_class=3, max_depth=depth,
                n_estimators=n_est, learning_rate=0.05, subsample=0.8,
                colsample_bytree=0.8, eval_metric='mlogloss',
                random_state=42, verbosity=0
            )
            fold_ll = []
            for tr_i, val_i in cv.split(X_train, y_train):
                xgb.fit(X_train.iloc[tr_i], y_train.iloc[tr_i],
                        sample_weight=sw[tr_i], verbose=False)
                fold_ll.append(log_loss(y_train.iloc[val_i],
                                        xgb.predict_proba(X_train.iloc[val_i])))
            cv_ll = np.mean(fold_ll)
            print(f"  depth={depth}  n={n_est}  cv_ll={cv_ll:.4f}")
            if cv_ll < best_ll:
                best_ll = cv_ll; best_params = {'max_depth':depth,'n_estimators':n_est}
    print(f"Best: {best_params}  CV ll={best_ll:.4f}")
else:
    best_params = {'max_depth':3,'n_estimators':200}
    print(f"Using pre-tuned params: {best_params}")

# ── Train final model ─────────────────────────────────────────────────────
xgb = XGBClassifier(
    objective='multi:softprob', num_class=3,
    max_depth=best_params['max_depth'],
    n_estimators=best_params['n_estimators'],
    learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
    eval_metric='mlogloss', random_state=42, verbosity=0
)
xgb.fit(X_train, y_train, sample_weight=sw, verbose=False)
xgb_probs = xgb.predict_proba(X_test)
xgb_ll    = log_loss(actual, xgb_probs)
xgb_acc   = np.mean(np.argmax(xgb_probs,axis=1) == actual)
print(f"XGBoost  log-loss={xgb_ll:.4f}  acc={xgb_acc:.1%}")

# ── SHAP ──────────────────────────────────────────────────────────────────
explainer = shap.TreeExplainer(xgb)
shap_expl = explainer(X_test)
sv        = shap_expl.values
mean_abs  = np.abs(sv).mean(axis=(0,2)) if sv.ndim==3 else np.abs(sv).mean(axis=0)
shap_df   = pd.DataFrame({'feature':FEATURES,'mean_abs_shap':mean_abs})
shap_df   = shap_df.sort_values('mean_abs_shap',ascending=False).reset_index(drop=True)
print("\nSHAP ranking:"); print(shap_df.to_string(index=False))

# ── Ensemble (DC=0.3 + XGB=0.7 — requires dixon_coles_predictions_2022.csv) ─
try:
    dc_df   = pd.read_csv(f'{PRED_DIR}dixon_coles_predictions_2022.csv')
    dc_arr  = dc_df[['p_home_win','p_draw','p_away_win']].values
    ens     = 0.3 * dc_arr + 0.7 * xgb_probs
    ens_ll  = log_loss(actual, ens)
    ens_acc = np.mean(np.argmax(ens,axis=1) == actual)
    print(f"Ensemble log-loss={ens_ll:.4f}  acc={ens_acc:.1%}")
    has_ensemble = True
except FileNotFoundError:
    print("Dixon-Coles predictions not found — run poisson_baseline.py first for ensemble.")
    has_ensemble = False

# ── Save ──────────────────────────────────────────────────────────────────
SAVE = ['date','home_team','away_team','home_score','away_score',
        'tournament','result','elo_home','elo_away','elo_delta']
eps     = 1e-9
act_enc = np.eye(3)[actual]

xgb_out = test[SAVE].copy()
xgb_out['p_home_win']   = xgb_probs[:,0].round(4)
xgb_out['p_draw']       = xgb_probs[:,1].round(4)
xgb_out['p_away_win']   = xgb_probs[:,2].round(4)
xgb_out['predicted']    = [RESULT_NAMES[i] for i in np.argmax(xgb_probs,axis=1)]
xgb_out['match_logloss']= (-np.sum(act_enc*np.log(xgb_probs+eps),axis=1)).round(4)
xgb_out.to_csv(f'{PRED_DIR}xgboost_model_predictions_2022.csv', index=False)
print("Saved xgboost_model_predictions_2022.csv")

if has_ensemble:
    ens_out = test[SAVE].copy()
    ens_out['p_home_win_xgb'] = xgb_probs[:,0].round(4)
    ens_out['p_draw_xgb']     = xgb_probs[:,1].round(4)
    ens_out['p_away_win_xgb'] = xgb_probs[:,2].round(4)
    ens_out['p_home_win_dc']  = dc_arr[:,0].round(4)
    ens_out['p_draw_dc']      = dc_arr[:,1].round(4)
    ens_out['p_away_win_dc']  = dc_arr[:,2].round(4)
    ens_out['p_home_win_ens'] = ens[:,0].round(4)
    ens_out['p_draw_ens']     = ens[:,1].round(4)
    ens_out['p_away_win_ens'] = ens[:,2].round(4)
    ens_out['predicted']      = [RESULT_NAMES[i] for i in np.argmax(ens,axis=1)]
    ens_out.to_csv(f'{PRED_DIR}ensemble_predictions_2022.csv', index=False)
    print("Saved ensemble_predictions_2022.csv")

shap_df.to_csv(f'{PRED_DIR}shap_feature_importance.csv', index=False)
print("Saved shap_feature_importance.csv")
