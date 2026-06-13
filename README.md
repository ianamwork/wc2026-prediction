# WC 2026 Prediction Model

A machine learning pipeline for predicting 2026 FIFA World Cup match outcomes, built on Elo ratings, trailing form, and player-level X-Factor features derived from club football performance.

**Status: Work in progress** — baseline models are trained and evaluated; X-Factor feature integration is in progress.

---

## Results (2022 World Cup Holdout — 64 matches)

| Model | Features | Log-loss | Accuracy |
|-------|----------|----------|----------|
| Poisson GLM | Elo + tier + neutral venue | 1.0195 | 56.2% |
| Dixon-Coles | Poisson + draw correction (ρ = −0.029) | 1.0237 | 56.2% |
| **XGBoost** | Elo + tier + neutral venue | **0.9821** | **54.7%** |
| Ensemble (DC 30% + XGB 70%) | — | 0.9848 | 54.7% |

**Baseline to beat: 0.9821** (XGBoost log-loss on 2022 WC holdout)

Key finding: XGBoost using only 6 features (Elo ratings + tournament tier + neutral venue flag) matches betting-market-caliber predictions. Tier is the #2 SHAP feature — knowing *which competition* a match is in matters nearly as much as the Elo gap.

---

## X-Factor Analysis

Pre-tournament club-season features (Wyscout 2017/18 data, WC 2018 + Euro 2016) that separate tournament performance beyond Elo:

| Feature | Description | Signal |
|---------|-------------|--------|
| `squad_key_passes_p90` | Avg key passes per 90 at club level | High — separates QF+ teams |
| `squad_dbl_p90` | Dangerous ball losses per 90 | High — lower = better |
| `squad_prog_passes_p90` | Progressive passes per 90 | Medium |
| `squad_long_ball_pct` | Long ball % (lower = more possession) | Medium |
| `squad_pass_accuracy` | Squad pass completion % | Medium |
| `squad_minutes_played` | Avg club minutes (sharpness proxy) | Low–medium |

Full findings: [`reports/xfactor_report.md`](reports/xfactor_report.md)

---

## Repo Structure

```
wc2026-prediction/
├── data/
│   ├── raw/                    # Original unmodified sources
│   │   ├── eloratings.csv      # Historical Elo ratings (eloratings.net)
│   │   ├── WorldCupMatches.csv # Kaggle WC match dataset (1930–2014)
│   │   └── jfjelstul_matches.csv  # Fjelstul WC database (1930–2022)
│   ├── processed/              # Cleaned & merged datasets
│   │   ├── wc_matches_cleaned.csv        # WC matches 1994–2022
│   │   ├── wc_matches_with_elo.csv       # + Elo ratings joined
│   │   ├── training_matches_full.csv     # Full training set (15,507 matches)
│   │   ├── training_matches_full_v2.csv  # + trailing form features (30+ cols)
│   │   └── team_tournament_features.csv  # Team-tournament feature table
│   └── external/               # FBref qualifying stats (in progress)
│       └── README.md
│
├── models/
│   ├── poisson_baseline.py     # Poisson GLM + Dixon-Coles correction
│   ├── xgboost_model.py        # XGBoost classifier with SHAP analysis
│   ├── build_features.py       # Feature engineering pipeline (trailing form)
│   ├── model_comparison_summary.txt
│   └── predictions/            # Model output CSVs (2022 WC holdout)
│
├── analysis/
│   ├── explore_dataset.py      # Wyscout dataset audit
│   ├── xfactor_analysis.py     # X-Factor separation analysis
│   └── output/                 # Generated analysis CSVs
│
├── reports/
│   ├── xfactor_report.md       # Full X-Factor findings
│   ├── xfactor_report.pdf      # PDF version
│   └── project_plan.md         # Status tracker
│
├── dashboard/                  # React interactive dashboards (planned)
├── requirements.txt
└── README.md
```

---

## How to Run

### Install dependencies
```bash
pip install -r requirements.txt
```

### 1. Poisson GLM + Dixon-Coles baseline
```bash
cd wc2026-prediction
python models/poisson_baseline.py
# Outputs: models/predictions/poisson_baseline_predictions_2022.csv
#          models/predictions/dixon_coles_predictions_2022.csv
```

### 2. XGBoost model
```bash
python models/xgboost_model.py
# Outputs: models/predictions/xgboost_model_predictions_2022.csv
#          models/predictions/ensemble_predictions_2022.csv
#          models/predictions/shap_feature_importance.csv
```

### 3. Build trailing form features + retrain
```bash
python models/build_features.py
# Outputs: data/processed/training_matches_full_v2.csv
#          models/predictions/model_v2_predictions_2022.csv
#          models/predictions/shap_v2_feature_importance.csv
```

### 4. Wyscout X-Factor analysis
```bash
# Requires Wyscout data in data/raw/wyscout/ — see analysis/explore_dataset.py
python analysis/xfactor_analysis.py
```

---

## Data Sources

| Source | Description | Link |
|--------|-------------|------|
| **eloratings.net** | Historical international Elo ratings | https://www.eloratings.net |
| **Fjelstul World Cup Database** | Comprehensive WC match/player/squad data (1930–2022) | https://github.com/jfjelstul/worldcup |
| **Mart Jürisoo** | 49K international results (1872–present) | https://github.com/martj42/international_results |
| **Wyscout Open Data** | Match event data for WC 2018, Euro 2016, 5 top leagues | https://figshare.com/collections/Soccer_match_event_dataset/4415000 |
| **FBref** | Squad-level qualifying stats (in progress) | https://fbref.com |

---

## Known Issues / Limitations

- **Draw underestimation:** The XGBoost model assigns ~15% probability to draws vs. a historical ~22% rate. The Dixon-Coles correction helps in general but the 2022 WC was unusually draw-light (15.6% actual), so it slightly hurt on this specific holdout.
- **Wyscout coverage:** X-Factor features currently only cover WC 2018 and Euro 2016. FBref integration (Part D) will extend coverage to all 8 tournaments in the training window.
- **No injury/availability data:** The model's worst misses (Argentina vs. Saudi Arabia, Cameroon vs. Brazil) are cases where player-level context would move the needle.
- **Qualifier dominance:** 74% of training rows are qualifiers, which have different outcome distributions than WC knockout matches. Sample weighting (WC=4×) partially compensates.

---

*Work in progress — predictions for 2026 coming once FBref feature layer is complete.*
