"""
M6 — Platt-scaled XGBoost classifier (final production model).

Training data : 14,404 international matches (1994–2022, excluding 2022 WC holdout)
Holdout       : 64 matches, 2022 FIFA World Cup
Holdout metrics: log-loss 0.9898 | accuracy 56.3% | max P(any outcome) 0.8255

Sample weights
--------------
world_cup      = 4
continental    = 3
nations_league = 2
qualifier      = 1

Hyperparameters (selected by 5-fold CV on training set, minimizing log-loss)
-----------------------------------------------------------------------------
objective       = multi:softprob
num_class       = 3          # home_win / draw / away_win
max_depth       = 3
n_estimators    = 100        # CV best (grid: 100–500)
learning_rate   = 0.1        # CV best (grid: 0.01, 0.03, 0.05, 0.1)
subsample       = 0.8
colsample_bytree= 0.8
reg_alpha       = 1.0        # L1 — pushes weak features toward zero
reg_lambda      = 3.0        # L2 — penalizes large predictions
min_child_weight= 5          # prevents splits on small sub-groups

Calibration
-----------
CalibratedClassifierCV(base_estimator, cv=5, method='sigmoid')  # Platt scaling
Applied after XGBoost training on the full training set.
Reduces max predicted probability from ~0.93 to ~0.83 on the holdout.

Features (13 total)
-------------------
Elo (6):
  elo_home, elo_away, elo_delta, elo_avg, tier_num, is_neutral

Trailing form — pruned 6 (from 24, selected by correlation analysis):
  delta_form_last5          : (home_form_last5 - away_form_last5), where form = pts / 15
  delta_goals_conceded_12mo : avg goals conceded diff, trailing 12 months
  delta_goal_diff_12mo      : avg goal diff diff, trailing 12 months
  home_days_since_last      : days since home team's last competitive match
  away_days_since_last      : days since away team's last competitive match
  delta_h2h_net_wins        : net wins in last 5 H2H meetings (home perspective)

Squad quality (1):
  delta_squad_size_top5     : (home - away) player count in top-5 European leagues

Missing values: imputed with training-set medians (no holdout leakage).

To retrain and generate 2026 predictions, run:
  python analysis/predict_wc2026.py
"""

# This file documents the M6 configuration.
# The full training + prediction pipeline is in analysis/predict_wc2026.py.
# Earlier model iterations (M1–M5) are in analysis/train_xgb_v3.py and train_xgb_v4.py.
