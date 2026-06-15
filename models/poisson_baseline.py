"""
poisson_baseline.py
===================
Poisson GLM baseline + Dixon-Coles (1997) draw correction.

Two GLMs are fit (one for home goals, one for away goals) using Elo ratings,
tournament tier, and neutral-venue flag as predictors. The Dixon-Coles
correction adjusts probabilities for low-scoring scorelines (0-0, 1-0, 0-1,
1-1) via a learned correlation parameter rho estimated by MLE on the training
set.

Holdout: 2022 FIFA World Cup (64 matches).

Results (2022 WC holdout):
  Poisson baseline  log-loss = 1.0195  accuracy = 56.2%
  Dixon-Coles       log-loss = 1.0237  accuracy = 56.2%
  avg predicted draw P (Poisson): 22.4%  (DC: 23.0%  actual: 15.6%)

Usage:
  python models/poisson_baseline.py

Outputs:
  models/predictions/poisson_baseline_predictions_2022.csv
  models/predictions/dixon_coles_predictions_2022.csv
"""

import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

from scipy.stats import poisson
from scipy.optimize import minimize_scalar
import statsmodels.api as sm
from sklearn.metrics import log_loss

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

RESULT_MAP   = {'home_win':0,'draw':1,'away_win':2}
RESULT_NAMES = {0:'home_win',1:'draw',2:'away_win'}
actual = test['result'].map(RESULT_MAP).values

# ── Poisson GLMs ──────────────────────────────────────────────────────────
FEATS = ['elo_home','elo_away','tier_num','is_neutral']

def add_const(d):
    return pd.concat([pd.Series(1.0, index=d.index, name='const'), d], axis=1)

Xp_tr = add_const(train[FEATS])
Xp_te = add_const(test[FEATS])

glm_home = sm.GLM(train['home_score'], Xp_tr, family=sm.families.Poisson()).fit()
glm_away = sm.GLM(train['away_score'], Xp_tr, family=sm.families.Poisson()).fit()

print("HOME model:"); print(glm_home.summary())
print("AWAY model:"); print(glm_away.summary())

lam_h_train = glm_home.predict(Xp_tr).values
lam_a_train = glm_away.predict(Xp_tr).values
lam_h_test  = glm_home.predict(Xp_te).values
lam_a_test  = glm_away.predict(Xp_te).values

# ── Bivariate Poisson probabilities ──────────────────────────────────────
def match_probs_indep(lh, la, mg=8):
    ph = poisson.pmf(np.arange(mg+1), lh)
    pa = poisson.pmf(np.arange(mg+1), la)
    g  = np.outer(ph, pa)
    hw = float(np.tril(g,-1).sum())
    d  = float(np.trace(g))
    aw = float(np.triu(g, 1).sum())
    tot = hw + d + aw
    return hw/tot, d/tot, aw/tot

poi_arr = np.array([match_probs_indep(h,a) for h,a in zip(lam_h_test,lam_a_test)])
poi_ll  = log_loss(actual, poi_arr)
poi_acc = np.mean(np.argmax(poi_arr,axis=1) == actual)
print(f"\nPoisson log-loss={poi_ll:.4f}  acc={poi_acc:.1%}")

# ── Dixon-Coles correction ────────────────────────────────────────────────
def tau(x, y, lh, la, rho):
    if   x==0 and y==0: return 1.0 - lh * la * rho
    elif x==1 and y==0: return 1.0 + la * rho
    elif x==0 and y==1: return 1.0 + lh * rho
    elif x==1 and y==1: return 1.0 - rho
    return 1.0

home_g = train['home_score'].values.astype(int)
away_g = train['away_score'].values.astype(int)

def neg_dc_loglik(rho):
    eps = 1e-9
    total = 0.0
    for i in range(len(home_g)):
        x, y = home_g[i], away_g[i]
        lh, la = lam_h_train[i], lam_a_train[i]
        t = tau(x, y, lh, la, rho)
        if t <= 0: return 1e9
        term = poisson.logpmf(x, lh) + poisson.logpmf(y, la) + np.log(t + eps)
        if np.isfinite(term):
            total += term
    return -total

result   = minimize_scalar(neg_dc_loglik, bounds=(-0.99,0.0), method='bounded')
rho_opt  = result.x
print(f"Optimal rho = {rho_opt:.6f}")

def match_probs_dc(lh, la, rho, mg=8):
    scores = np.arange(mg+1)
    grid   = np.outer(poisson.pmf(scores,lh), poisson.pmf(scores,la))
    for x in range(2):
        for y in range(2):
            grid[x,y] *= tau(x, y, lh, la, rho)
    grid /= grid.sum()
    return float(np.tril(grid,-1).sum()), float(np.trace(grid)), float(np.triu(grid,1).sum())

dc_arr = np.array([match_probs_dc(h,a,rho_opt) for h,a in zip(lam_h_test,lam_a_test)])
dc_ll  = log_loss(actual, dc_arr)
dc_acc = np.mean(np.argmax(dc_arr,axis=1) == actual)
print(f"Dixon-Coles log-loss={dc_ll:.4f}  acc={dc_acc:.1%}")

# ── Save predictions ──────────────────────────────────────────────────────
SAVE = ['date','home_team','away_team','home_score','away_score',
        'tournament','result','elo_home','elo_away','elo_delta']

for label, arr, lams in [
    ('poisson_baseline', poi_arr, (lam_h_test, lam_a_test)),
    ('dixon_coles',      dc_arr,  (lam_h_test, lam_a_test)),
]:
    out = test[SAVE].copy()
    out['lambda_home'] = lams[0].round(4)
    out['lambda_away'] = lams[1].round(4)
    out['p_home_win']  = arr[:,0].round(4)
    out['p_draw']      = arr[:,1].round(4)
    out['p_away_win']  = arr[:,2].round(4)
    out['predicted']   = [RESULT_NAMES[i] for i in np.argmax(arr,axis=1)]
    if label == 'dixon_coles':
        out['rho'] = round(rho_opt, 6)
    out.to_csv(f'{PRED_DIR}{label}_predictions_2022.csv', index=False)
    print(f"Saved {label}_predictions_2022.csv")
