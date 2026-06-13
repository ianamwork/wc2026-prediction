# FIFA World Cup 2026 Prediction Model

A full prediction pipeline for the 2026 FIFA World Cup combining a Poisson GLM baseline, Platt-scaled XGBoost (M6), and Wyscout-based X-Factor analysis of tournament-winning behaviors across 3.25 million match events.

**Status: Work in progress** — M6 predictions are live; FBref X-Factor feature integration is in progress.

---

## 2026 Tournament Winner Probabilities

Based on 10,000 Monte Carlo simulations using M6 (Platt-scaled XGBoost, trained on 15,507 international matches).

| Rank | Team | Group | Win% | Final% | SF% | QF% |
|------|------|-------|------|--------|-----|-----|
| 1 | **France** | I | 14.3% | 22.0% | 30.8% | 42.9% |
| 2 | **Spain** | H | 12.2% | 19.4% | 30.9% | 46.4% |
| 3 | **Germany** | E | 11.0% | 17.6% | 25.7% | 48.1% |
| 4 | **Argentina** | J | 10.4% | 17.8% | 33.1% | 46.2% |
| 5 | Belgium | G | 6.1% | 11.3% | 22.5% | 37.4% |
| 6 | Brazil | C | 5.8% | 11.0% | 24.7% | 44.9% |
| 7 | England | L | 5.6% | 11.4% | 16.6% | 33.3% |
| 8 | Norway | I | 4.1% | 9.4% | 16.9% | 29.0% |
| 9 | Netherlands | F | 4.0% | 8.9% | 19.2% | 37.1% |
| 10 | Switzerland | B | 2.9% | 7.3% | 18.2% | 34.1% |

Full results: [`models/predictions/tournament_simulation_results.csv`](models/predictions/tournament_simulation_results.csv)

---

## Model Summary (M6)

| Property | Value |
|----------|-------|
| Model | Platt-scaled XGBoost (`CalibratedClassifierCV`, `method='sigmoid'`) |
| Training data | 15,507 international matches, 1994–2026 |
| Holdout | 2022 FIFA World Cup (64 matches) |
| Holdout log-loss | **0.9898** |
| Holdout accuracy | **56.3%** |
| Max P(any outcome) | **0.826** (down from 0.914 without calibration) |
| Features | 13: Elo (6) + pruned form (6) + squad quality delta (1) |

**Model progression on 2022 WC holdout:**

| Model | Features | Log-loss | Accuracy | Max P |
|-------|----------|----------|----------|-------|
| Poisson GLM | Elo + tier | 1.0195 | 56.2% | — |
| Dixon-Coles | Poisson + draw correction | 1.0237 | 56.2% | — |
| M1 XGBoost | Elo + tier (6 features) | 0.9815 | 54.7% | 0.914 |
| M4 XGBoost | M1 + 6 pruned form + squad | 1.0260 | 56.3% | 0.949 |
| M5 XGBoost | M4 + CV-tuned hyperparams | 1.0177 | 56.3% | 0.932 |
| **M6 XGBoost** | **M5 + Platt scaling** | **0.9898** | **56.3%** | **0.826** |

Full comparison: [`models/model_comparison_summary.txt`](models/model_comparison_summary.txt)  
M6 configuration: [`models/xgboost_m6.py`](models/xgboost_m6.py)

---

## X-Factor Analysis

Six features survived cross-validation across the 2018 FIFA World Cup, UEFA Euro 2016, and all five top European domestic leagues — separating semifinalists from group-stage exits independently of Elo ratings.

| Feature | WC 2018 Delta | Euro 2016 Delta | League Signal |
|---------|--------------|-----------------|---------------|
| Key passes / game | +57% | +81% | +64–114% across 5 leagues |
| Dangerous ball losses / game | −41% | −29% | Consistent across all |
| Counter-attack frequency / game | +32% | +83% | +13–46% across 5 leagues |
| Long ball % *(lower = better)* | −26% | −30% | −28–49% across 5 leagues |
| Goals conceded / game | −41% | −51% | Strongest league signal |
| Final third passes / game | +14% | +53% | Consistent across all |

*Deltas = SF+ teams vs. group-stage exits. Source: Wyscout 2017/18 event data (3.25M events, 1,941 matches).*

Full methodology and findings: [`reports/xfactor_report.md`](reports/xfactor_report.md)

---

## Repo Structure

```
wc2026-prediction/
├── data/
│   ├── raw/
│   │   ├── eloratings.csv              # Historical Elo ratings
│   │   ├── WorldCupMatches.csv         # Kaggle WC dataset (1930–2014)
│   │   └── jfjelstul_matches.csv       # Fjelstul WC database (1930–2022)
│   │   └── wyscout/                    # Wyscout event JSON — not in repo
│   │       └── (download separately — see Data Sources)
│   ├── processed/
│   │   ├── wc_matches_with_elo.csv     # WC matches + Elo ratings
│   │   ├── training_matches_full.csv   # Full 15,507-match training set
│   │   ├── training_matches_v3.csv     # + trailing form + squad features
│   │   ├── team_tournament_features.csv
│   │   └── squad_quality_2026.csv      # 2026 squad depth (top-5 leagues)
│   └── external/
│       └── README.md                   # FBref passing data (planned)
│
├── analysis/
│   ├── explore_dataset.py              # Wyscout dataset audit and feature audit
│   ├── xfactor_analysis.py             # X-Factor separation analysis (requires Wyscout)
│   ├── build_form_features.py          # Trailing form feature builder
│   ├── build_squad_features.py         # Squad quality feature builder
│   ├── train_xgb_v3.py                 # M1/M2/M3 model training + SHAP
│   ├── train_xgb_v4.py                 # M4/M5/M6 training + calibration
│   ├── predict_wc2026.py               # Full 2026 predictions + Monte Carlo
│   └── output/                         # X-Factor output CSVs (requires Wyscout)
│
├── models/
│   ├── poisson_baseline.py             # Poisson GLM + Dixon-Coles correction
│   ├── xgboost_model.py                # XGBoost M1 baseline with SHAP
│   ├── build_features.py               # Feature engineering (form + squad merge)
│   ├── xgboost_m6.py                   # M6 configuration reference
│   ├── model_comparison_summary.txt
│   └── predictions/
│       ├── group_stage_predictions.csv           # 48 group matches, M6 probabilities
│       ├── group_advancement_probabilities.csv   # 48 teams, P(advance)
│       ├── tournament_simulation_results.csv     # Win/Final/SF/QF % for all 48
│       ├── teams_2026_features.csv               # Team feature vectors at tournament start
│       ├── model_v4_predictions_2022.csv         # M1/M4/M5/M6 on 2022 WC holdout
│       └── model_comparison_summary.txt
│
├── reports/
│   ├── xfactor_report.md               # Full X-Factor analysis (Ian · June 2026)
│   ├── xfactor_report.pdf
│   └── project_plan.md                 # Phase tracker
│
├── dashboard/                          # React dashboards (planned)
├── requirements.txt
├── .gitignore
└── README.md
```

---

## How to Run

```bash
pip install -r requirements.txt
```

**1. Rebuild training data with form features**
```bash
python analysis/build_form_features.py    # adds trailing form cols → training_matches_v3.csv
python analysis/build_squad_features.py   # adds squad_size_top5 cols
```

**2. Train models and evaluate on 2022 WC holdout**
```bash
python analysis/train_xgb_v4.py           # trains M4/M5/M6, prints summary table, runs SHAP
```

**3. Generate 2026 predictions and Monte Carlo simulation**
```bash
python analysis/predict_wc2026.py         # all 48 group matches + 10,000 tournament sims
```

**4. X-Factor analysis (requires Wyscout data)**
```bash
# Download Wyscout data — see Data Sources below
python analysis/explore_dataset.py        # audit + feature extraction
python analysis/xfactor_analysis.py       # separation analysis → analysis/output/
```

---

## Data Sources

| Source | Description | Link |
|--------|-------------|------|
| **eloratings.net** | Historical international Elo ratings (1872–present) | https://www.eloratings.net |
| **Fjelstul World Cup Database** | Comprehensive WC match/player/squad data (1930–2022) | https://github.com/jfjelstul/worldcup |
| **Mart Jürisoo** | 49K international results (1872–present) | https://github.com/martj42/international_results |
| **Wyscout Open Data** | Match events: WC 2018, Euro 2016, 5 top leagues (3.25M events) | https://figshare.com/collections/Soccer_match_event_dataset/4415000/5 |
| **FBref / Sports Reference** | Squad-level passing and possession stats (in progress) | https://fbref.com |

> **Note — Wyscout data:** The six JSON files (`events_World_Cup.json`, `events_European_Championship.json`, etc.) total ~1.5GB and are excluded from this repo via `.gitignore`. Download from the Figshare DOI above and place in `data/raw/wyscout/`.

---

## Work in Progress

- **FBref passing layer:** Key passes, progressive passes, miscontrols, and dispossessions per 90 from qualifying campaigns will form the full X-Factor feature set. Collection in progress (manual scrape from FBref Stathead).
- **Neural network extension:** Planned LSTM over Elo time-series as an alternative embedding to static Elo snapshots.
- **React dashboard:** Interactive group-stage explorer and bracket simulator (`dashboard/`).

---

*Ian Work · UC Berkeley Economics · June 2026*
