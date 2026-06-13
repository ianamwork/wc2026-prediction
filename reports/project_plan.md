# WC 2026 Prediction Model — Project Plan

## Overview
Build a predictive model for the 2026 FIFA World Cup that beats standard Elo-based baselines by incorporating player-level X-Factor features derived from club football performance.

---

## Status

| Phase | Task | Status |
|-------|------|--------|
| **Data** | Download Fjelstul WC database | ✅ Done |
| **Data** | Download Mart Jürisoo international results (49K matches) | ✅ Done |
| **Data** | Merge Elo ratings into WC matches | ✅ Done |
| **Data** | Build full training set (15,507 matches, 1994–2026) | ✅ Done |
| **Data** | Build team-tournament feature table | ✅ Done |
| **Data** | Collect FBref qualifying stats (2014/18/22/26 cycles) | 🔄 In progress (manual) |
| **Modeling** | Poisson GLM baseline | ✅ Done — log-loss 1.0195 |
| **Modeling** | Dixon-Coles draw correction | ✅ Done — log-loss 1.0237 |
| **Modeling** | XGBoost classifier (Elo + tier features) | ✅ Done — log-loss 0.9821 |
| **Modeling** | Trailing form features (form_last5/10, 12mo stats, H2H) | ✅ Built — not yet evaluated |
| **Modeling** | Retrain XGBoost with trailing form features | ⏳ Pending (run build_features.py) |
| **Modeling** | Add FBref X-Factor features | ⏳ Pending FBref data upload |
| **Modeling** | Neural network comparison | 💭 Under consideration |
| **Analysis** | Wyscout X-Factor separation analysis | ✅ Done — see reports/xfactor_report.md |
| **Analysis** | SHAP feature importance | ✅ Done |
| **Dashboard** | React predictor UI | ⏳ Planned |
| **Deployment** | 2026 WC predictions | ⏳ Pending final model |

---

## Baseline to Beat

| Model | Features | Log-loss | Accuracy |
|-------|----------|----------|----------|
| Poisson GLM | Elo + tier + neutral | 1.0195 | 56.2% |
| Dixon-Coles | Poisson + ρ correction | 1.0237 | 56.2% |
| **XGBoost** | Elo + tier + neutral | **0.9821** | **54.7%** |
| Ensemble (DC+XGB) | — | 0.9848 | 54.7% |

**Target:** Beat 0.9821 log-loss on the 2022 WC holdout with X-Factor features.

---

## Next Steps

1. **Run `models/build_features.py`** — retrains XGBoost with 30+ trailing form features
2. **Upload FBref CSVs** → `data/external/` — merge qualifying campaign stats
3. **Evaluate X-Factor model** on 2022 WC holdout
4. **Build 2026 predictions** once squad data is available

---

## Key Design Decisions

- **Holdout:** 2022 FIFA World Cup (64 matches) — completely excluded from training
- **Sample weights:** WC=4, continental=3, nations league=2, qualifiers=1
- **Tier filter:** Only keep world_cup, continental, nations_league, qualifier matches — no friendlies
- **Elo source:** eloratings.net — as-of join (most recent rating on or before match date)
- **Draw underestimation:** Known issue — model assigns ~15% to draws vs ~22% historical rate. Dixon-Coles helps slightly but the 2022 WC was unusually draw-light (15.6% actual).
