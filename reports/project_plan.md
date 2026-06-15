# FIFA World Cup 2026 — Prediction Model Project Plan

**Author:** Ian
**Status:** ✅ Complete — 2026 predictions generated, ready for tournament
**Last updated:** June 13, 2026
**Stack:** Python (pandas, scikit-learn, XGBoost, statsmodels) + React dashboard
**Final model:** M6 — Platt-scaled XGBoost (log-loss 0.9898 on 2022 holdout, max P capped at 82.5%)
**Prediction:** France 14.3% | Spain 12.2% | Germany 11.0% | Argentina 10.4%

---

## Project summary

Build a match-level prediction model for all 104 games in the 2026 FIFA World Cup (48 teams, 16 venues across USA/Canada/Mexico). The model combines traditional predictors (Elo, form, head-to-head) with empirically derived "X-Factor" features discovered through analysis of 3.25 million spatio-temporal match events from the Wyscout dataset. Final output is an interactive dashboard with match simulator, group-stage probabilities, and tournament winner odds via Monte Carlo simulation.

**Core modeling insight:** Train on *matches*, not tournament winners. The X-Factor analysis tells us *which features* to include — tournament winner probabilities emerge downstream from simulating the bracket using match-level predictions.

---

## What we've done so far

### 1. Built initial prediction dashboard (React)
- Poisson regression engine for match outcome probabilities (Win/Draw/Loss)
- Monte Carlo tournament simulator (4,000 runs)
- All 48 teams with 2026 group draw, FIFA rankings (April 2026), form indices, squad depth ratings
- Home advantage model incorporating venue altitude (Estadio Azteca at 2,240m) and host-nation bonuses
- Interactive match simulator with editable team parameters
- **File:** `world_cup_2026_predictor.jsx`

### 2. X-Factor tournament DNA analysis
- Catalogued 54 major tournament winners: Champions League (2000–2025), World Cup (1994–2022), Euro (1996–2024), Copa América (1995–2024)
- Identified 7 recurring X-Factors of champions: transcendent star at peak form, defensive solidity, squad age sweet spot (26.5–28.0), comeback gene, tactical identity, penalty readiness, narrative momentum
- Built composite X-Factor rankings for all 48 qualified teams
- **File:** `world_cup_2026_xfactor.jsx`

### 3. Wyscout dataset exploration (the breakthrough)
- Pulled and explored the Pappalardo et al. (2019) Wyscout dataset: 3.25M events across 1,941 matches (Premier League, La Liga, Serie A, Bundesliga, Ligue 1 17/18 + World Cup 2018 + Euro 2016)
- Ran statistical separation analysis: which on-pitch metrics distinguish semifinalists from group-stage exits?
- Cross-validated findings against Euro 2016 AND all five top European leagues (top-4 vs bottom-4 finishers)
- **File:** `wyscout_exploration.jsx`

### 4. Phase 1 complete — training dataset assembled
- Fjelstul World Cup database (1,248 matches, 1930–2022, 27 relational tables including goals, squads, bookings, penalties)
- Elo ratings merged by closest-date-before-match (93% coverage)
- Kaggle international results added: Euros, Copa América, AFCON, Gold Cup, AFC Asian Cup, Nations League, qualifiers
- **Final training set:** `training_matches_full.csv` — 15,507 matches (1994–2022) across 4 tiers
- Tier breakdown: 758 World Cup, 2,046 continental, 1,148 Nations League, 11,555 qualifier

### 5. Phase 3 baseline — Poisson + XGBoost trained
- Holdout: 2022 World Cup (64 matches). Training: everything else (1994–2018/2021).
- Poisson GLM: home/away Elo both highly significant (p<0.001). Neutral venue suppresses home goals by 10.7%, increases away goals by 32%.
- XGBoost: best config depth=3, n_estimators=200. Shallow trees won decisively — deeper models overfit the qualifier-heavy data.
- **Results on 2022 holdout:** Poisson log-loss = 1.0195, XGBoost log-loss = 0.9821. XGBoost wins on calibration.
- SHAP: elo_delta (#1), tier_num (#2), elo_away (#3), elo_home (#4), is_neutral (#5)
- Key finding: model systematically underestimates draws (assigns 12–16% where actual rate is ~25%). Dixon-Coles correction is next.

### 6. Team-tournament feature analysis
- Built `team_tournament_features.csv` — 248 rows (8 tournaments, 1994–2022), 27 features per team-tournament
- Spearman correlations: avg_elo (ρ = +0.497) is the strongest non-leaky predictor. Win %, goals/game are strong but leak (computed in-tournament).
- Core continuity (ρ = −0.06) and late-game goals (ρ = +0.107) not significant — the Fjelstul data is too coarse for X-Factor features.
- Confirmed: X-Factor edge must come from FBref/Wyscout event-level data, not match-level aggregates.

### Empirically validated X-Factor features (ranked by cross-validation consistency)

| Rank | Feature | WC 2018 Δ | Euro 2016 Δ | League avg Δ | What it measures |
|------|---------|-----------|-------------|--------------|------------------|
| 1 | Key passes / game | +57% | +81% | +84% | Chance creation — passes directly leading to shots |
| 2 | Dangerous ball losses / game | −41% | −29% | −12% | Risk management — catastrophic turnovers |
| 3 | Counter-attack frequency / game | +32% | +83% | +37% | Transition effectiveness — pouncing on turnovers |
| 4 | Long ball % of passes (inverse) | −26% | −30% | −37% | Build-up patience — fewer bypasses of midfield |
| 5 | Goals conceded / game | −41% | −51% | −43% | Defensive solidity — non-negotiable for champions |
| 6 | Final 3rd passes / game | +14% | +53% | +30% | Territorial control in attacking zone |

**How to compute from Wyscout event data:**
- Key passes: `tags ∩ {201, 301, 302}` on Pass events, divided by match count
- Dangerous ball losses: `tag 2001` on any event, per match
- Counter-attacks: `tag 1901` on any event, per match
- Long ball %: `subEvent ∈ {High pass, Launch}` / total passes × 100
- Final 3rd passes: Pass events with destination `x ≥ 66` AND `tag 1801` (accurate)
- Progressive passes: Pass events where `x_end − x_start ≥ 25`

---

## The build pipeline

### Phase 1: Historical match dataset ⬅️ YOU ARE HERE

**Goal:** Assemble the training set. One row = one international match with outcome + features for both teams *at the time of the match.*

**Data sources to collect:**

| Source | What it gives you | URL / Access | Priority |
|--------|-------------------|--------------|----------|
| Kaggle International Results | All int'l matches 1872–present (date, teams, score, tournament, venue) | `kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017` (updated versions exist) | 🔴 Critical |
| World Football Elo Ratings | Historical Elo for every team at any date (better than FIFA ranking for modeling) | `eloratings.net` | 🔴 Critical |
| FBref / StatsBomb | Aggregate team stats per tournament: pass %, progressive passes, PPDA, xG, xGA | `fbref.com/en/comps/` | 🟡 Important |
| Wyscout (already downloaded) | Event-level data for WC 2018, Euro 2016, 5 leagues 17/18 | Local: `/home/claude/wyscout_data/` | ✅ Done |
| Transfermarkt | Squad market values, player ages, club affiliations, injuries | `transfermarkt.com` | 🟡 Important |
| FIFA Rankings Archive | Official FIFA points at time of each match | `fifa.com/fifa-world-ranking` | 🟢 Nice to have (Elo is better) |

**Output:** `training_matches.csv` with columns: `date, team_a, team_b, score_a, score_b, tournament, stage, neutral_venue, elo_a, elo_b, form_a, form_b, [x-factor features]`

**Your action items for Phase 1:**
- [x] Download the Kaggle international results dataset and filter to 1994–present
- [x] Filter to competitive matches only (World Cup, Euro, Copa América, qualifiers, Nations League)
- [x] Merge historical Elo ratings — joined by closest date before match, 93% coverage
- [x] Decided: include qualifiers in training with `tournament_tier` feature + sample weighting (WC=4, continental=3, NL=2, qualifier=1)

---

### Phase 2: Feature engineering

**Goal:** For each match in the training set, compute features for both teams. Everything must be computed using only data *available before that match* (no leakage).

**Layer 1 — Fundamentals (compute for all matches 1994–present):**
- Elo rating for each team on match date
- Elo delta (Team A − Team B)
- Goal-scoring rate: trailing 12-month goals per game
- Goals conceded rate: trailing 12-month
- Win % over last 10 matches
- Head-to-head record (last 5 meetings)
- Home/away/neutral venue indicator
- Confederation of each team (categorical)
- Match stage (group / R16 / QF / SF / Final)
- Days rest since last match (if available)

**Layer 2 — Squad composition (compute for matches 2006+ where data exists):**
- % of squad in top-5 European league
- Squad average age
- Squad average caps
- Transfermarkt total squad market value
- Key player availability (binary: are the top 3 players fit?)

**Layer 3 — X-Factors (compute for matches 2014+ where FBref data exists, or WC 2018/Euro 2016 from Wyscout):**
- Key passes per game (trailing tournament or qualifying campaign)
- Dangerous ball losses per game
- Counter-attack frequency per game
- Long ball % of total passes
- Goals conceded per game (already in Layer 1 but also here as a tactical indicator)
- Final third passes per game
- Progressive passes per game
- Shot conversion rate (shots on target / total shots)

**Your action items for Phase 2:**
- [ ] Write a Python function that, given a team and a date, returns their Elo rating on that date
- [ ] Write a function that computes trailing 12-month goal-scoring/conceding rates from the match dataset
- [ ] Decide how to handle the X-Factor features for matches before 2014 (options: leave as NaN and let the model handle missingness, or train separate models for pre/post-2014)
- [ ] For Wyscout-covered matches (WC 2018, Euro 2016): compute exact X-Factor features from event data using the formulas above
- [ ] For other recent tournaments: scrape FBref aggregate stats as proxies

---

### Phase 3: Model training

**Goal:** Train match-level prediction models. Two approaches, then ensemble.

**Model A — Poisson regression (interpretable baseline):** ✅ Trained
- Predict expected goals for each team: `λ_A = f(elo_home, elo_away, tournament_tier, is_neutral)`
- Derive Win/Draw/Loss probabilities by summing over the bivariate Poisson distribution
- **Result:** Log-loss 1.0195 on 2022 holdout. Systematic draw underestimation (12–16% predicted vs ~25% actual).
- **Next:** Dixon-Coles correction to fix draw underweighting

**Model B — XGBoost classifier (flexible, nonlinear):** ✅ Trained
- Multiclass (home_win / draw / away_win), depth=3, n_estimators=200
- Sample-weighted: WC=4, continental=3, NL=2, qualifier=1
- **Result:** Log-loss 0.9821 on 2022 holdout. Better calibration than Poisson.
- SHAP: elo_delta dominates, tier_num is #2 feature

**Model C — Ensemble:**
- Weighted average of Poisson and XGBoost probabilities
- Calibrate weights using cross-validation (leave-one-tournament-out)

**Evaluation strategy:**
- Leave-one-tournament-out cross-validation: train on all data *except* WC 2022, predict WC 2022 results, measure accuracy
- Metrics: log-loss (primary), Brier score, accuracy of predicted outcomes vs actual
- Compare: (1) Elo-only baseline, (2) Elo + fundamentals, (3) full model with X-Factors — does each layer actually improve predictions?

**Your action items for Phase 3:**
- [ ] Start with the Poisson regression using just Layer 1 features — get a working baseline before adding complexity
- [ ] Add Layer 2 and 3 features incrementally, checking if each layer improves CV log-loss
- [ ] Run SHAP analysis on the XGBoost model to validate X-Factor feature importance
- [ ] Write up the model comparison results — this is the "was the X-Factor worth it?" answer

---

### Phase 4: Compute 2026 team features

**Goal:** For all 48 qualified teams, compute the same features used in training, using current (May/June 2026) data.

**Data needed:**
- Current Elo ratings (April 2026 update)
- Recent form: results from 2025–2026 qualifying campaigns, friendlies, Nations League
- Squad composition from announced/projected 26-man rosters
- X-Factor metrics from qualifying campaigns (FBref has this for UEFA, CONMEBOL, CONCACAF qualifiers)

**Your action items for Phase 4:**
- [ ] Pull current Elo ratings for all 48 teams
- [ ] Compile recent results (last 12–18 months) for form calculation
- [ ] For each team, compute the 6 X-Factor metrics from their qualifying campaign stats on FBref
- [ ] Flag data gaps (some teams from smaller confederations may have limited stats)

---

### Phase 5: Predict every match

**Goal:** Feed each of the 104 World Cup matchups through the trained model.

- Group stage: 48 matches (each team plays 3)
- Round of 32: 16 matches
- Round of 16: 8 matches
- Quarterfinals: 4 matches
- Semifinals: 2 matches
- Third-place playoff + Final: 2 matches

For each match: P(Win A), P(Draw), P(Win B), Expected goals A, Expected goals B

---

### Phase 6: Monte Carlo tournament simulation

**Goal:** Simulate the full tournament bracket 10,000+ times using the match-level probabilities.

- For each simulation run: play all group matches stochastically, determine group standings, advance teams to knockout, play knockout matches (with penalties for draws)
- Track how often each team wins the tournament, reaches the final, reaches the semis, etc.
- Output: tournament winner probability for each team

---

## Dataset inventory

| Dataset | Status | Location | Size | Coverage |
|---------|--------|----------|------|----------|
| Wyscout match events | ✅ Downloaded | `data/raw/wyscout/` | 3.25M events | WC 2018, Euro 2016, 5 leagues 17/18 |
| Wyscout players + teams | ✅ Downloaded | `data/raw/wyscout/` | 3,603 players, 143 teams | Same as above |
| Fjelstul World Cup DB | ✅ Downloaded | `jfjelstul-worldcup/` | 27 CSVs | 1930–2022 |
| Kaggle int'l results | ✅ Merged | `data/processed/training_matches_full.csv` | 15,507 matches | 1994–present |
| Historical Elo ratings | ✅ Merged | `data/raw/eloratings.csv` | 6,678 snapshots, 270 teams | 1872–2025 |
| FBref player stats (top 5 leagues) | ✅ Downloaded | `data/raw/` | 2,952 players | 2025/26 season |
| Training set v3 | ✅ Built | `data/processed/training_matches_v3.csv` | 15,507 × 45 cols | 1994–2022 with Elo + form + squad |
| Team-tournament features | ✅ Built | `data/processed/team_tournament_features.csv` | 248 × 27 | WC 1994–2022 |
| Squad quality 2026 | ✅ Built | `data/processed/squad_quality_2026.csv` | 105 nations × 9 | Current season |
| 2026 team features | ✅ Built | `models/predictions/teams_2026_features.csv` | 48 teams | All features for prediction |
| 2026 group predictions | ✅ Generated | `models/predictions/group_stage_predictions.csv` | 48 matches | All group stage matchups |
| Tournament simulation | ✅ Generated | `models/predictions/tournament_simulation_results.csv` | 48 teams | 10K Monte Carlo runs |
| 2026 WC group draw | ✅ Compiled | In predictor app | 48 teams, 12 groups | Confirmed draw |
| 2026 venue data | ✅ Compiled | In predictor app | 16 venues | Altitude, capacity |

---

## Wyscout event schema reference

For working with the raw event data:

**Event types:** Pass (56K in WC), Duel (26K), Others on the ball (9K), Free Kick (6K), Foul (2K), Shot (1.4K), Save attempt (560), Goalkeeper leaving line (212), Offside (172)

**Key sub-events:** Simple pass, Smart pass, Cross, High pass, Launch, Head pass, Ground attacking duel, Ground defending duel, Air duel, Ground loose ball duel, Shot, Corner, Free kick shot, Clearance, Acceleration, Touch

**Critical tags:** 1801 = Accurate, 1802 = Not accurate, 101 = Goal, 102 = Own goal, 301 = Assist, 302 = Key pass, 703 = Duel won, 701 = Duel lost, 1901 = Counter-attack, 2001 = Dangerous ball lost, 1401 = Interception, 401/402/403 = Left foot / Right foot / Head

**Spatial coordinates:** x, y on 0–100 scale. x=0 is defending goal line, x=100 is attacking goal line. y=0 is left touchline, y=100 is right touchline. Final third = x ≥ 66. Progressive pass = x_end − x_start ≥ 25.

---

## Technical decisions log

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Training target | Match outcome (W/D/L) + scoreline | Much larger sample than "who won the tournament" — enables real ML |
| Historical cutoff | 1994 for matches, 2014+ for X-Factors | 1994 = modern World Cup era (32+ teams). X-Factor data only reliable from 2014+ via FBref |
| Elo vs FIFA ranking | Elo preferred | Elo updates after every match and is better calibrated than FIFA points for prediction |
| Include friendlies? | Excluded | Friendlies add noise without clear signal. Kept competitive matches only (WC, continental, NL, qualifiers) |
| Club data in training? | No — international only | Club football has different dynamics. Used CL/league data for feature selection only, not training |
| Qualifier weighting | XGBoost sample_weight: WC=4, continental=3, NL=2, qualifier=1 | Prevents 74% qualifier share from swamping tournament-match signal |
| Feature pruning | 24 trailing form → 6 features | 27 pairs exceeded \|r\| > 0.70. More features hurt calibration through overconfidence on 64-match holdout |
| Regularization | depth=3, lr=0.05–0.1, L1=1.0, L2=3.0 | Shallow trees + strong regularization prevents overconfidence. depth=3 won decisively in CV |
| Calibration | Platt scaling (CalibratedClassifierCV) | Caps max predicted probability at 82.5% vs 91.4% uncalibrated. Critical for tournament football where upsets happen |
| Deployed model | M6 (Platt-scaled XGBoost) | Best calibration + accuracy combination. Trades 0.008 log-loss vs M1 for 82.5% max P and +1.6% accuracy |
| Dixon-Coles | Keep in toolkit, don't deploy as primary | ρ = −0.0289 is theoretically correct but hurt log-loss on a low-draw-rate 2022 holdout. Would help on typical years |
| Squad quality proxy | squad_size_top5 (count of players in top-5 European leagues) | Full X-Factor passing stats (key passes, progressive passes) unavailable for international data. Player count is a robust time-invariant proxy |
| Neural network | Deferred | Data is too small (14K training, 64 holdout). XGBoost's depth=3 preference confirms shallow structure. Bottleneck is features, not architecture |

---

## Model results

### Full model evolution (2022 WC holdout, 64 matches)

| Model | Features | Log-loss | Accuracy | Avg P(Draw) | Max P |
|-------|----------|----------|----------|-------------|-------|
| M1 baseline | Elo + tier + neutral (6) | **0.9815** | 54.7% | 13.2% | 91.4% |
| Poisson GLM | Elo + tier + neutral | 1.0195 | 56.2% | 22.4% | — |
| Dixon-Coles | Poisson + ρ correction | 1.0237 | 56.2% | 23.0% | — |
| M2 + 24 form | All trailing form features | 1.0574 | 56.3% | 16.1% | — |
| M3 + squad | + squad_size_top5 | 1.0752 | 54.7% | 17.1% | — |
| M4 pruned | 6 pruned form + squad (13) | 1.0260 | 56.3% | 15.7% | 94.9% |
| M5 CV-tuned | M4 + auto-tuned hyperparams | 1.0177 | 56.3% | 16.3% | 93.2% |
| **M6 Platt** | **M5 + Platt scaling** | **0.9898** | **56.3%** | **16.8%** | **82.5%** |

**M6 is the deployed model.** It trades 0.008 log-loss vs M1 for meaningfully better calibration (max confidence capped at 82.5% vs 91.4%) and higher accuracy (56.3% vs 54.7%). In a 48-team World Cup with more upset potential, the calibration advantage matters more than the marginal log-loss difference.

### Key modeling findings

**1. Elo dominates everything.** SHAP analysis across all models consistently showed `elo_delta` as the #1 feature (mean |SHAP| = 0.31), nearly double the next feature. No amount of feature engineering changed this.

**2. Feature engineering improved accuracy but hurt calibration.** Adding 24 trailing form features pushed accuracy from 54.7% to 56.3% (+3 correct predictions) but increased overconfidence, worsening log-loss. The fix was aggressive pruning (24 → 6 features) + regularization + Platt scaling.

**3. Squad depth is a real signal.** `delta_squad_size_top5` ranked as the 4th most important feature in SHAP, confirming that "how many of your players compete in top European leagues" adds information beyond Elo.

**4. Dixon-Coles was theoretically correct but unlucky.** ρ = −0.0289 correctly inflated draw probabilities, but the 2022 WC had an unusually low draw rate (15.6% vs historical ~21%). The correction would likely help on a typical tournament year.

**5. The 64-match holdout is too small.** The log-loss difference between M1 (0.9815) and M6 (0.9898) is statistically indistinguishable at n=64. One flipped result changes the ranking.

### 10 worst misses (M1 baseline on 2022 WC)

| Match | Actual | P(HW) | P(D) | P(AW) | Type |
|-------|--------|-------|------|-------|------|
| Argentina vs Saudi Arabia | away_win | 0.833 | 0.122 | 0.045 | UPSET |
| Cameroon vs Brazil | home_win | 0.074 | 0.035 | 0.891 | UPSET |
| Denmark vs Tunisia | draw | 0.711 | 0.127 | 0.163 | draw surprise |
| Croatia vs Belgium | draw | 0.322 | 0.137 | 0.541 | draw surprise |
| Spain vs Germany | draw | 0.527 | 0.146 | 0.328 | draw surprise |
| Morocco vs Croatia | draw | 0.303 | 0.150 | 0.547 | draw surprise |
| USA vs Wales | draw | 0.446 | 0.155 | 0.399 | close call |
| Mexico vs Poland | draw | 0.440 | 0.161 | 0.399 | close call |
| Belgium vs Morocco | away_win | 0.707 | 0.125 | 0.168 | UPSET |
| England vs USA | draw | 0.593 | 0.174 | 0.233 | draw surprise |

**Pattern:** 3 true upsets + 5 draw surprises + 2 close calls. Argentina-Saudi Arabia remains unpredictable across all model variants (M6 assigns 80.6% to Argentina — still wrong but less catastrophically overconfident than M3's 95.1%).

---

## 2026 World Cup Predictions (M6)

### Tournament winner probabilities (10,000 Monte Carlo simulations)

| Rank | Team | Group | Win% | Final% | SF% | QF% |
|------|------|-------|------|--------|-----|-----|
| 1 | France | I | 14.3% | 22.0% | 30.8% | 42.9% |
| 2 | Spain | H | 12.2% | 19.4% | 30.9% | 46.4% |
| 3 | Germany | E | 11.0% | 17.6% | 25.7% | 48.1% |
| 4 | Argentina | J | 10.4% | 17.8% | 33.1% | 46.2% |
| 5 | Belgium | G | 6.1% | 11.3% | 22.5% | 37.4% |
| 6 | Brazil | C | 5.8% | 11.0% | 24.7% | 44.9% |
| 7 | England | L | 5.6% | 11.4% | 16.6% | 33.3% |
| 8 | Norway | I | 4.1% | 9.4% | 16.9% | 29.0% |
| 9 | Netherlands | F | 4.0% | 8.9% | 19.2% | 37.1% |
| 10 | Switzerland | B | 2.9% | 7.3% | 18.2% | 34.1% |

### Key storylines

- **France leads** despite not having the highest Elo — superior squad depth (208 top-5 league players) and strong form (0.80 last 5) push them over Spain
- **Argentina has the highest SF%** (33.1%) but faces France or Spain in the bracket — easy group, hard path
- **Norway at #8** is a potential model artifact — strong form and Elo but lacks tournament pedigree. X-Factor features would likely adjust this downward.
- **USA (Group D)** has a tough path — Australia (52% advancement) is a sneaky 3rd-place threat

---

## Completed milestones

1. ~~Download the Kaggle international results dataset.~~ ✅ 15,507 matches merged
2. ~~Get historical Elo ratings.~~ ✅ 93% coverage
3. ~~Build the Poisson baseline model.~~ ✅ Log-loss 1.0195
4. ~~Train XGBoost.~~ ✅ Log-loss 0.9815
5. ~~Implement Dixon-Coles draw correction.~~ ✅ ρ = −0.0289, mechanically correct but didn't help on 2022 holdout (low draw rate year)
6. ~~Build trailing form features.~~ ✅ 24 features from 49K match history, pruned to 6 for regularization
7. ~~Build squad quality features from FBref player data.~~ ✅ 2,952 players → 105 nations profiled, squad_size_top5 added
8. ~~Retrain with features + Platt scaling.~~ ✅ M6 deployed (log-loss 0.9898, accuracy 56.3%, max P 82.5%)
9. ~~Generate 2026 predictions.~~ ✅ All 48 group matches predicted, 10,000 tournament simulations run
10. ~~Push to GitHub.~~ ⬅️ NOW

## Potential future improvements

- **FBref passing/possession tables:** If player-level progressive passes, key passes, miscontrols, and dispossessions become available, recompute squad-level X-Factor features and retrain. This is the most likely path to breaking below 0.95 log-loss.
- **Neural network with Dirichlet output:** A small MLP (64→32→16) with Dirichlet output layer could improve draw calibration. Worth trying once feature set is finalized.
- **Live updating during tournament:** As group stage results come in, update Elo ratings and trailing form in real-time, retrain, and re-simulate the knockout bracket.
- **Knockout-specific model:** Train a separate model on knockout matches only, where draw dynamics are different (extra time + penalties).

---

## Project timeline

| Week | Focus | Deliverable | Status |
|------|-------|-------------|--------|
| 1 | Data collection + cleaning | `training_matches_full.csv` with Elo (15,507 matches) | ✅ Done |
| 2 | Team-tournament features + baseline | Poisson + XGBoost baseline, SHAP analysis | ✅ Done |
| 3 | Dixon-Coles + feature engineering | Dixon-Coles ρ, trailing form features (24→6 pruned), squad quality | ✅ Done |
| 4 | Model optimization | Regularization tuning, Platt scaling, M6 deployed | ✅ Done |
| 5 | 2026 predictions | Group stage predictions, Monte Carlo tournament simulation (10K runs) | ✅ Done |
| 6 | Polish + deploy | GitHub repo, X-Factor report, project documentation | ✅ Done |

---

## References

- Pappalardo, L., et al. (2019). A public data set of spatio-temporal match events in soccer competitions. *Nature Scientific Data*, 6, 236. DOI: 10.1038/s41597-019-0247-7
- Dixon, M. J., & Coles, S. G. (1997). Modelling association football scores and inefficiencies in the football betting market. *Journal of the Royal Statistical Society*, 46(2), 265–280.
- Groll, A., et al. (2019). Prediction of the FIFA World Cup 2018 — A random forest approach with an emphasis on estimated team ability parameters. *Journal of Quantitative Analysis in Sports*, 15(2), 97–110.
