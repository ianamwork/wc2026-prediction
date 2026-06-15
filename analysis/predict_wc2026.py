"""
Full 2026 World Cup predictions using M6 (Platt-scaled XGBoost).

Steps:
  1. Build team feature vectors for all 48 qualified teams
  2. Predict all 48 group stage matches
  3. Monte Carlo group simulation (10,000 runs)
  4. Full tournament Monte Carlo (10,000 runs)
"""

import warnings
warnings.filterwarnings("ignore")

import bisect
import itertools
import time
from collections import defaultdict

from pathlib import Path
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import log_loss, accuracy_score
from sklearn.model_selection import StratifiedKFold

BASE = Path(__file__).resolve().parent.parent  # repo root

SEED = 42
rng  = np.random.default_rng(SEED)

# ── Reference date: use data strictly before WC 2026 group stage ─────────────
REF_DATE = pd.Timestamp("2026-06-11")   # WC 2026 kick-off

# ── Canonical group roster (names as in intl_football_results.csv) ────────────
WC_GROUPS = {
    "A": ["Mexico",       "South Korea",  "South Africa", "Czech Republic"],
    "B": ["Canada",       "Switzerland",  "Qatar",        "Bosnia and Herzegovina"],
    "C": ["Brazil",       "Morocco",      "Haiti",        "Scotland"],
    "D": ["United States","Paraguay",     "Australia",    "Turkey"],
    "E": ["Germany",      "Curaçao",      "Ivory Coast",  "Ecuador"],
    "F": ["Netherlands",  "Japan",        "Sweden",       "Tunisia"],
    "G": ["Belgium",      "Egypt",        "Iran",         "New Zealand"],
    "H": ["Spain",        "Cape Verde",   "Saudi Arabia", "Uruguay"],
    "I": ["France",       "Senegal",      "Norway",       "Iraq"],
    "J": ["Argentina",    "Algeria",      "Austria",      "Jordan"],
    "K": ["Portugal",     "Uzbekistan",   "Colombia",     "DR Congo"],
    "L": ["England",      "Ghana",        "Panama",       "Croatia"],
}
ALL_TEAMS = [t for teams in WC_GROUPS.values() for t in teams]
TEAM_GROUP = {t: g for g, ts in WC_GROUPS.items() for t in ts}

# Elo file uses slightly different names for a few teams
ELO_NAME_MAP = {
    "Czech Republic": "Czechia",
    "DR Congo":       "Democratic Republic of Congo",
}
# Squad quality file uses slightly different names for a few teams
SQUAD_NAME_MAP = {
    "United States": "United States",
    "Turkey":        "Turkey",
    "Czech Republic":"Czech Republic",
    "DR Congo":      "DR Congo",
}

print("=" * 70)
print("STEP 1 — Building 2026 team feature vectors")
print("=" * 70)

# ── Load Elo ratings ──────────────────────────────────────────────────────────
elo_raw = pd.read_csv(BASE / "data" / "raw" / "eloratings.csv")
elo_raw["team"] = elo_raw["team"].str.replace("\xa0", " ", regex=False)
# Mixed formats: early entries YYYY-MM-DD, newer M/D/YYYY — parse both
iso_dates  = pd.to_datetime(elo_raw["date"], format="%Y-%m-%d", errors="coerce")
mdy_dates  = pd.to_datetime(elo_raw["date"], format="%m/%d/%Y", errors="coerce")
elo_raw["date"] = iso_dates.fillna(mdy_dates)
elo_recent = (
    elo_raw[elo_raw["date"] < REF_DATE]
    .sort_values("date")
    .groupby("team")
    .last()
    .reset_index()[["team", "rating"]]
    .rename(columns={"rating": "elo"})
)
elo_dict = dict(zip(elo_recent["team"], elo_recent["elo"]))

elo_vals   = [elo_dict.get(ELO_NAME_MAP.get(t, t)) for t in ALL_TEAMS]
elo_median = float(np.nanmedian([v for v in elo_vals if v is not None]))
print(f"  Elo data: {len(elo_dict)} teams.  Global median = {elo_median:.0f}")
for t in ALL_TEAMS:
    key = ELO_NAME_MAP.get(t, t)
    if key not in elo_dict:
        print(f"    Elo MISSING: {t!r} (looked for {key!r}) → using median {elo_median:.0f}")

# ── Load squad quality ────────────────────────────────────────────────────────
sq = pd.read_csv(
    BASE / "data" / "processed" / "squad_quality_2026.csv"
)
sq_dict = dict(zip(sq["nation"], sq["squad_size_top5"]))

sq_vals   = [sq_dict.get(SQUAD_NAME_MAP.get(t, t)) for t in ALL_TEAMS]
sq_median = float(np.nanmedian([v for v in sq_vals if v is not None]))
print(f"  Squad data: {len(sq_dict)} teams.  Global median = {sq_median:.1f}")
for t in ALL_TEAMS:
    key = SQUAD_NAME_MAP.get(t, t)
    if key not in sq_dict:
        print(f"    Squad MISSING: {t!r} (looked for {key!r}) → using 0")

# ── Load intl results for form computation ────────────────────────────────────
raw = pd.read_csv(
    BASE / "data" / "raw" / "intl_football_results.csv",
    parse_dates=["date"],
)
raw = raw.dropna(subset=["home_score", "away_score"]).copy()
raw["home_score"] = raw["home_score"].astype(int)
raw["away_score"]  = raw["away_score"].astype(int)
raw = raw[raw["date"] < REF_DATE].sort_values("date").reset_index(drop=True)
print(f"  Historical matches used for form: {len(raw)}")

# Build per-team history index (same logic as build_form_features.py)
team_hist = defaultdict(list)
for row in raw.itertuples(index=False):
    d  = row.date.toordinal()
    h, a = row.home_team, row.away_team
    hs, as_ = int(row.home_score), int(row.away_score)
    if hs > as_:  h_pts, a_pts = 3, 0
    elif hs == as_: h_pts, a_pts = 1, 1
    else:           h_pts, a_pts = 0, 3
    team_hist[h].append((d, hs, as_, h_pts))
    team_hist[a].append((d, as_, hs, a_pts))

team_date_arr = {}; team_gf_arr = {}; team_ga_arr = {}; team_pts_arr = {}
for team, rows in team_hist.items():
    rows.sort()
    arr = np.array(rows, dtype=np.float64)
    team_date_arr[team] = arr[:, 0].astype(np.int64)
    team_gf_arr[team]   = arr[:, 1]
    team_ga_arr[team]   = arr[:, 2]
    team_pts_arr[team]  = arr[:, 3]

# Build H2H index
h2h_hist = defaultdict(list)
for row in raw.itertuples(index=False):
    d  = row.date.toordinal()
    h, a = row.home_team, row.away_team
    hs, as_ = int(row.home_score), int(row.away_score)
    key = tuple(sorted([h, a]))
    t1  = key[0]
    if hs > as_:   r_t1 = 1 if h == t1 else -1
    elif hs < as_: r_t1 = -1 if h == t1 else 1
    else:          r_t1 = 0
    h2h_hist[key].append((d, r_t1))

h2h_date_arr = {}; h2h_res_arr = {}
for key, rows in h2h_hist.items():
    rows.sort()
    arr = np.array(rows)
    h2h_date_arr[key] = arr[:, 0].astype(np.int64)
    h2h_res_arr[key]  = arr[:, 1]

DAYS_365 = 365

def get_team_form(team, ref_ord):
    out = dict(form_last5=np.nan, goals_conceded_12mo=np.nan,
               goal_diff_12mo=np.nan, days_since_last=np.nan)
    if team not in team_date_arr:
        return out
    dates = team_date_arr[team]
    idx   = bisect.bisect_left(dates, ref_ord)
    if idx == 0:
        return out
    out["days_since_last"] = float(ref_ord - dates[idx - 1])
    pts = team_pts_arr[team]; gf = team_gf_arr[team]; ga = team_ga_arr[team]
    last5 = pts[max(0, idx-5):idx]
    out["form_last5"] = float(last5.sum()) / 15.0
    cutoff = ref_ord - DAYS_365
    start  = bisect.bisect_left(dates, cutoff)
    n12    = idx - start
    if n12 > 0:
        gf12 = gf[start:idx]; ga12 = ga[start:idx]
        out["goals_conceded_12mo"] = float(ga12.mean())
        out["goal_diff_12mo"]      = float((gf12 - ga12).mean())
    return out

def get_h2h(home, away, ref_ord):
    key = tuple(sorted([home, away]))
    if key not in h2h_date_arr:
        return 0.0, 0.0
    dates = h2h_date_arr[key]; res = h2h_res_arr[key]
    idx   = bisect.bisect_left(dates, ref_ord)
    last5 = res[max(0, idx-5):idx]
    net_t1 = float(last5.sum())
    if home == key[0]:
        return net_t1, -net_t1
    return -net_t1, net_t1

# ── Build per-team feature dict ───────────────────────────────────────────────
REF_ORD = REF_DATE.toordinal()

team_features = {}
for team in ALL_TEAMS:
    elo_key   = ELO_NAME_MAP.get(team, team)
    squad_key = SQUAD_NAME_MAP.get(team, team)
    elo_val   = elo_dict.get(elo_key, elo_median)
    sq_val    = sq_dict.get(squad_key, 0.0)   # 0 if not in top-5 leagues
    form      = get_team_form(team, REF_ORD)
    team_features[team] = {
        "elo":                 elo_val,
        "squad_size_top5":     sq_val,
        "form_last5":          form["form_last5"],
        "goals_conceded_12mo": form["goals_conceded_12mo"],
        "goal_diff_12mo":      form["goal_diff_12mo"],
        "days_since_last":     form["days_since_last"],
    }

# ── Print top 10 by Elo ───────────────────────────────────────────────────────
tf_df = pd.DataFrame(team_features).T.reset_index().rename(columns={"index": "team"})
tf_df["group"] = tf_df["team"].map(TEAM_GROUP)
tf_df = tf_df.sort_values("elo", ascending=False).reset_index(drop=True)
tf_df.to_csv(
    BASE / "data" / "processed" / "teams_2026_features.csv",
    index=False,
)

print("\nTop 10 teams by Elo with key features:")
print(f"{'Rank':<5} {'Team':<26} {'Grp':<4} {'Elo':>6} {'Squad':>7} {'Form5':>7} {'GD12':>7} {'DaysSince':>10}")
print("-" * 75)
for i, row in tf_df.head(10).iterrows():
    print(f"  {i+1:<4} {row.team:<26} {row.group:<4} {row.elo:>6.0f}"
          f" {row.squad_size_top5:>7.0f} {row.form_last5:>7.3f}"
          f" {row.goal_diff_12mo:>7.2f} {row.days_since_last:>10.0f}")
print("\nSaved: teams_2026_features.csv")

# ── STEP 2 — Retrain M6 on full training set ──────────────────────────────────
print("\n" + "=" * 70)
print("STEP 2 — Retrain M6 on training data")
print("=" * 70)

df = pd.read_csv(
    BASE / "data" / "processed" / "training_matches_v3.csv",
    parse_dates=["date"],
)
label_map  = {"home_win": 0, "draw": 1, "away_win": 2}
weight_map = {"world_cup": 4, "continental": 3, "nations_league": 2, "qualifier": 1}
df["label"]  = df["result"].map(label_map)
df["weight"] = df["tournament_tier"].map(weight_map).fillna(1)

holdout_mask = (
    df["tournament"].str.contains("FIFA Men's World Cup", na=False)
    & (df["date"].dt.year == 2022)
)
elo_ok    = df["elo_home"].notna() & df["elo_away"].notna()
train_mask = (~holdout_mask) & elo_ok
df_train  = df[train_mask].copy()
df_hold   = df[holdout_mask].copy()
print(f"  Training rows: {len(df_train)}  |  Holdout (2022 WC): {len(df_hold)}")

ELO_FEATS  = ["elo_home", "elo_away", "elo_delta", "elo_avg", "tier_num", "is_neutral"]
FORM_FEATS = ["delta_form_last5", "delta_goals_conceded_12mo", "delta_goal_diff_12mo",
              "home_days_since_last", "away_days_since_last", "delta_h2h_net_wins"]
SQUAD_FEAT = ["delta_squad_size_top5"]
M6_FEATS   = ELO_FEATS + FORM_FEATS + SQUAD_FEAT    # 13 features

X_train = df_train[M6_FEATS].copy()
y_train = df_train["label"].values
w_train = df_train["weight"].values
medians = X_train.median()
X_train = X_train.fillna(medians)

# CV-tune n_estimators and learning_rate (same grid as v4)
REG_PARAMS_BASE = dict(
    objective="multi:softprob", num_class=3, max_depth=3,
    subsample=0.8, colsample_bytree=0.8,
    reg_alpha=1.0, reg_lambda=3.0, min_child_weight=5,
    random_state=SEED, eval_metric="mlogloss", verbosity=0,
)
N_EST_GRID = [100, 200, 300, 400, 500]
LR_GRID    = [0.01, 0.03, 0.05, 0.1]
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

best_cv_ll = np.inf
best_ne, best_lr = 300, 0.05
for ne, lr in itertools.product(N_EST_GRID, LR_GRID):
    fold_lls = []
    params = {**REG_PARAMS_BASE, "n_estimators": ne, "learning_rate": lr}
    for fold_tr, fold_va in skf.split(X_train, y_train):
        m = xgb.XGBClassifier(**params)
        m.fit(X_train.iloc[fold_tr], y_train[fold_tr], sample_weight=w_train[fold_tr])
        pv = m.predict_proba(X_train.iloc[fold_va])
        fold_lls.append(log_loss(y_train[fold_va], pv))
    mean_ll = np.mean(fold_lls)
    if mean_ll < best_cv_ll:
        best_cv_ll, best_ne, best_lr = mean_ll, ne, lr

print(f"  Best CV: n_estimators={best_ne}  lr={best_lr}  cv_ll={best_cv_ll:.4f}")

m6_params = {**REG_PARAMS_BASE, "n_estimators": best_ne, "learning_rate": best_lr}
m6_base   = xgb.XGBClassifier(**m6_params)
m6        = CalibratedClassifierCV(m6_base, cv=5, method="sigmoid")
m6.fit(X_train, y_train, sample_weight=w_train)

# Verify on 2022 WC holdout
X_hold = df_hold[M6_FEATS].fillna(medians)
y_hold = df_hold["label"].values
p_hold = m6.predict_proba(X_hold)
print(f"  M6 holdout (2022 WC): log-loss={log_loss(y_hold,p_hold):.4f}  "
      f"acc={accuracy_score(y_hold,np.argmax(p_hold,1)):.4f}  "
      f"max_p={p_hold.max():.4f}")

# ── Feature vector builder for a specific matchup ─────────────────────────────
def build_match_features(home, away, ref_ord=REF_ORD):
    hf = team_features[home]
    af = team_features[away]
    h_net, a_net = get_h2h(home, away, ref_ord)

    elo_h = hf["elo"]; elo_a = af["elo"]

    row = {
        "elo_home":                  elo_h,
        "elo_away":                  elo_a,
        "elo_delta":                 elo_h - elo_a,
        "elo_avg":                   (elo_h + elo_a) / 2,
        "tier_num":                  1,
        "is_neutral":                1,
        "delta_form_last5":          hf["form_last5"] - af["form_last5"],
        "delta_goals_conceded_12mo": hf["goals_conceded_12mo"] - af["goals_conceded_12mo"],
        "delta_goal_diff_12mo":      hf["goal_diff_12mo"] - af["goal_diff_12mo"],
        "home_days_since_last":      hf["days_since_last"],
        "away_days_since_last":      af["days_since_last"],
        "delta_h2h_net_wins":        h_net - a_net,
        "delta_squad_size_top5":     hf["squad_size_top5"] - af["squad_size_top5"],
    }
    return row

def predict_match(home, away, ref_ord=REF_ORD):
    """Return (p_hw, p_d, p_aw) from M6."""
    row  = build_match_features(home, away, ref_ord)
    X    = pd.DataFrame([row])[M6_FEATS].fillna(medians)
    prob = m6.predict_proba(X)[0]
    return tuple(prob)   # (p_hw, p_d, p_aw)

# ── STEP 2b — Predict all 48 group stage matches ──────────────────────────────
print("\n" + "=" * 70)
print("STEP 2 — Predicting 48 group stage matches")
print("=" * 70)

label_names = {0: "home_win", 1: "draw", 2: "away_win"}
group_match_rows = []

for grp, teams in WC_GROUPS.items():
    print(f"\nGroup {grp}: {', '.join(teams)}")
    for home, away in itertools.combinations(teams, 2):
        p_hw, p_d, p_aw = predict_match(home, away)
        pred = label_names[int(np.argmax([p_hw, p_d, p_aw]))]
        group_match_rows.append({
            "group": grp, "home": home, "away": away,
            "p_home_win": round(p_hw, 4),
            "p_draw":     round(p_d, 4),
            "p_away_win": round(p_aw, 4),
            "predicted_result": pred,
            "max_p": round(max(p_hw, p_d, p_aw), 4),
        })
        print(f"  {home:<22} vs {away:<22}  "
              f"P(HW)={p_hw:.3f}  P(D)={p_d:.3f}  P(AW)={p_aw:.3f}  → {pred}")

gm_df = pd.DataFrame(group_match_rows)
gm_df.to_csv(
    BASE / "models" / "predictions" / "group_stage_predictions.csv",
    index=False,
)
print("\nSaved: group_stage_predictions.csv")

# ── STEP 3 — Monte Carlo group simulation (10,000 runs) ───────────────────────
print("\n" + "=" * 70)
print("STEP 3 — Monte Carlo group stage simulation (10,000 runs)")
print("=" * 70)

rng_groups = np.random.default_rng(SEED)      # isolated RNG for group stage

N_SIM = 10_000

# Pre-compute match probabilities for every unique matchup (both orderings)
match_prob_cache = {}
for home, away in gm_df[["home", "away"]].values:
    match_prob_cache[(home, away)] = (
        gm_df[(gm_df.home == home) & (gm_df.away == away)]
        [["p_home_win", "p_draw", "p_away_win"]].values[0]
    )

def sim_scoreline(result_idx, rng_):
    """Draw a rough scoreline consistent with win/draw/loss."""
    if result_idx == 0:   # home win
        h = int(rng_.poisson(2.1)); a = int(rng_.poisson(0.7))
        if h <= a: h = a + 1
    elif result_idx == 1:  # draw
        x = int(rng_.poisson(1.1)); h = x; a = x
    else:                  # away win
        h = int(rng_.poisson(0.7)); a = int(rng_.poisson(2.1))
        if a <= h: a = h + 1
    return h, a

def simulate_group(teams, match_probs, rng_):
    """
    Simulate one group.  Returns list of (team, pts, gd, gf) sorted by rank.
    """
    pts = {t: 0 for t in teams}
    gd  = {t: 0 for t in teams}
    gf  = {t: 0 for t in teams}

    for home, away in itertools.combinations(teams, 2):
        probs = match_probs[(home, away)]
        probs_norm = np.array(probs, dtype=np.float64)
        probs_norm = probs_norm / probs_norm.sum()
        res   = int(rng_.choice(3, p=probs_norm))
        hs, as_ = sim_scoreline(res, rng_)
        gf[home] += hs; gf[away] += as_
        gd[home] += hs - as_; gd[away] += as_ - hs
        if res == 0:   pts[home] += 3
        elif res == 1: pts[home] += 1; pts[away] += 1
        else:          pts[away] += 3

    # Sort: pts desc, gd desc, gf desc, then random tiebreak
    ranked = sorted(
        teams,
        key=lambda t: (pts[t], gd[t], gf[t], rng_.random()),
        reverse=True,
    )
    return [(t, pts[t], gd[t], gf[t]) for t in ranked]

# Count finishes per team
finish_counts = {t: {1: 0, 2: 0, 3: 0, 4: 0} for t in ALL_TEAMS}

# Track all simulated group stages for tournament MC in step 4
# (store only who finishes 1st, 2nd, 3rd per group)
sim_group_results = []  # list of {group: [1st, 2nd, 3rd, 4th]} per sim

print("  Running simulations...")
t0 = time.time()

for sim_i in range(N_SIM):
    sim_result = {}
    group_ranked_pts = {}

    for grp, teams in WC_GROUPS.items():
        ranked = simulate_group(teams, match_prob_cache, rng_groups)
        sim_result[grp] = ranked  # [(team, pts, gd, gf), ...]
        for pos, (team, pts_val, gd_val, gf_val) in enumerate(ranked, start=1):
            finish_counts[team][pos] += 1
        group_ranked_pts[grp] = ranked

    sim_group_results.append(group_ranked_pts)

print(f"  Done in {time.time()-t0:.1f}s")

# ── Compute advancement probabilities ─────────────────────────────────────────
# Top 2 from each group advance + best 8 3rd-place teams
adv_rows = []
for grp, teams in WC_GROUPS.items():
    for team in teams:
        c = finish_counts[team]
        p1 = c[1] / N_SIM
        p2 = c[2] / N_SIM
        p3 = c[3] / N_SIM
        p4 = c[4] / N_SIM
        adv_rows.append({
            "team": team, "group": grp,
            "p_1st": round(p1, 4), "p_2nd": round(p2, 4),
            "p_3rd": round(p3, 4), "p_4th": round(p4, 4),
        })

adv_df = pd.DataFrame(adv_rows)

# Estimate p_advance: always advance if 1st or 2nd.
# For 3rd place: across simulations, determine which 3rd-place teams advance
# (best 8 of 12 3rd-place teams by points, then GD, then GF).
third_advance_counts = {t: 0 for t in ALL_TEAMS}

for sim_result in sim_group_results:
    # Collect all 3rd-place finishers across 12 groups
    third_place = []
    for grp, ranked in sim_result.items():
        team, pts_val, gd_val, gf_val = ranked[2]
        third_place.append((pts_val, gd_val, gf_val, rng_groups.random(), team))

    # Sort descending (best 3rd-place teams advance)
    third_place.sort(key=lambda x: (x[0], x[1], x[2], x[3]), reverse=True)
    for _, _, _, _, team in third_place[:8]:
        third_advance_counts[team] += 1

adv_df["p_3rd_advance"] = adv_df["team"].map(
    lambda t: round(third_advance_counts[t] / N_SIM, 4)
)
adv_df["p_advance"] = (
    adv_df["p_1st"] + adv_df["p_2nd"] + adv_df["p_3rd_advance"]
).round(4)

adv_df.to_csv(
    BASE / "models" / "predictions" / "group_advancement_probabilities.csv",
    index=False,
)

# Print all 12 groups
print(f"\n{'Grp':<4} {'Team':<24} {'P(1st)':>7} {'P(2nd)':>7} {'P(3rd)':>7} {'P(4th)':>7} {'P(Adv)':>7}")
print("-" * 65)
for grp in sorted(WC_GROUPS.keys()):
    grp_rows = adv_df[adv_df.group == grp].sort_values("p_advance", ascending=False)
    for _, r in grp_rows.iterrows():
        print(f"  {r.group:<4} {r.team:<24} {r.p_1st:>7.3f} {r.p_2nd:>7.3f}"
              f" {r.p_3rd:>7.3f} {r.p_4th:>7.3f} {r.p_advance:>7.3f}")
    print()

print("Saved: group_advancement_probabilities.csv")

# ── STEP 4 — Full tournament Monte Carlo (10,000 runs) ────────────────────────
print("\n" + "=" * 70)
print("STEP 4 — Full tournament Monte Carlo (10,000 runs)")
print("=" * 70)

rng_knockout = np.random.default_rng(SEED + 1)  # isolated RNG for knockout stage

# Match prediction cache for any matchup (computed on demand)
ko_prob_cache = {}
def get_ko_prob(home, away):
    key = (home, away)
    if key not in ko_prob_cache:
        ko_prob_cache[key] = predict_match(home, away)
    return ko_prob_cache[key]

def sim_ko_match(home, away, rng_):
    """Simulate knockout match.  If draw → coin flip (50/50 penalties)."""
    p_hw, p_d, p_aw = get_ko_prob(home, away)
    probs_ko = np.array([p_hw, p_d, p_aw], dtype=np.float64)
    probs_ko /= probs_ko.sum()
    res = int(rng_.choice(3, p=probs_ko))
    if res == 0:   return home
    elif res == 2: return away
    else:          return home if rng_.random() < 0.5 else away

def get_32_qualifiers(sim_result, rng_):
    """
    Returns ordered list of 32 qualifiers:
    - indices 0-23 : group 1st and 2nd finishers (interleaved: 1A,2A,1B,2B...)
    - indices 24-31: best 8 3rd-place teams (by pts/gd/gf)
    Groups in alphabetical order.
    """
    qualifiers = []
    third_place = []
    for grp in sorted(sim_result.keys()):
        ranked = sim_result[grp]
        qualifiers.append(ranked[0][0])   # 1st
        qualifiers.append(ranked[1][0])   # 2nd
        t = ranked[2]
        third_place.append((t[1], t[2], t[3], rng_.random(), t[0]))

    third_place.sort(reverse=True)
    qualifiers += [x[4] for x in third_place[:8]]
    return qualifiers  # 32 teams

# NOTE: Uses snake bracket pairing (seed 1 vs 32, 2 vs 31, etc.) rather than
# the actual FIFA bracket structure. This means seeds 1 and 2 can meet in the
# semifinal, which wouldn't happen in the real draw. This is a known simplification.
# For a more accurate simulation, implement the official FIFA bracket mapping
# where group winners face runners-up from specific other groups.
def run_bracket(qualifiers, rng_):
    """
    Seeded bracket: seed 1 vs 32, 2 vs 31, ..., 16 vs 17.
    Seeds 1-12 = group winners (A-L)
    Seeds 13-24 = group runners-up (A-L)
    Seeds 25-32 = best 8 3rd-place teams
    Returns dict {team: furthest_round} where rounds are 'r32','r16','qf','sf','final','winner'
    """
    rounds = ["r32", "r16", "qf", "sf", "final", "winner"]
    reached = {t: None for t in qualifiers}

    # Pair: position 0 (seed 1) vs position 31 (seed 32), etc.
    bracket = list(qualifiers)   # 32 teams, ordered by seed

    round_names = ["r32", "r16", "qf", "sf", "final"]
    current = bracket[:]

    for rnd in round_names:
        next_round = []
        # Mark all current participants as having reached this round
        for t in current:
            reached[t] = rnd
        # Play matches: pair 0 vs N-1, 1 vs N-2, ...
        n = len(current)
        for i in range(n // 2):
            winner = sim_ko_match(current[i], current[n - 1 - i], rng_)
            next_round.append(winner)
        current = next_round

    # The final winner
    for t in current:
        reached[t] = "winner"

    return reached

# Track stage appearances
stage_counts = {t: {"r32": 0, "r16": 0, "qf": 0, "sf": 0, "final": 0, "winner": 0}
                for t in ALL_TEAMS}
STAGE_ORDER = ["r32", "r16", "qf", "sf", "final", "winner"]

print("  Running tournament simulations...")
t0 = time.time()

for sim_i, sim_result in enumerate(sim_group_results):
    qualifiers = get_32_qualifiers(sim_result, rng_knockout)
    reached    = run_bracket(qualifiers, rng_knockout)

    for team, stage in reached.items():
        if stage is None:
            continue
        # Credit all stages up to and including the reached stage
        sidx = STAGE_ORDER.index(stage)
        for s in STAGE_ORDER[: sidx + 1]:
            stage_counts[team][s] += 1

print(f"  Done in {time.time()-t0:.1f}s")

# ── Build tournament results table ────────────────────────────────────────────
tourn_rows = []
for team in ALL_TEAMS:
    grp = TEAM_GROUP[team]
    sc  = stage_counts[team]
    tourn_rows.append({
        "team":     team,
        "group":    grp,
        "elo":      team_features[team]["elo"],
        "r32_pct":    round(100 * sc["r32"]    / N_SIM, 2),
        "r16_pct":    round(100 * sc["r16"]    / N_SIM, 2),
        "qf_pct":     round(100 * sc["qf"]     / N_SIM, 2),
        "sf_pct":     round(100 * sc["sf"]     / N_SIM, 2),
        "final_pct":  round(100 * sc["final"]  / N_SIM, 2),
        "win_pct":    round(100 * sc["winner"] / N_SIM, 2),
    })

tourn_df = pd.DataFrame(tourn_rows).sort_values("win_pct", ascending=False).reset_index(drop=True)
tourn_df.to_csv(
    BASE / "models" / "predictions" / "tournament_simulation_results.csv",
    index=False,
)

# ── Print top 15 by win probability ──────────────────────────────────────────
print(f"\nTop 15 teams by tournament win probability (10,000 simulations):")
print(f"{'Rank':<5} {'Team':<24} {'Grp':<4} {'Win%':>6} {'Final%':>7} {'SF%':>6} {'QF%':>6} {'R16%':>6} {'R32%':>6}")
print("-" * 72)
for i, r in tourn_df.head(15).iterrows():
    print(f"  {i+1:<4} {r.team:<24} {r.group:<4} "
          f"{r.win_pct:>6.2f} {r.final_pct:>7.2f} {r.sf_pct:>6.2f}"
          f" {r.qf_pct:>6.2f} {r.r16_pct:>6.2f} {r.r32_pct:>6.2f}")

print("\nSaved: tournament_simulation_results.csv")

# ── SHAP on M6 base model ─────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("SHAP — feature importance on M6 base XGBoost (2022 WC holdout)")
print("=" * 70)

explainer  = shap.TreeExplainer(m6.calibrated_classifiers_[0].estimator)
shap_vals  = explainer.shap_values(X_hold)
sv = np.array(shap_vals)
if sv.ndim == 3:
    mean_abs = np.abs(sv).mean(axis=(0, 2))
else:
    mean_abs = np.mean([np.abs(c).mean(axis=0) for c in shap_vals], axis=0)

shap_df = pd.DataFrame({"feature": M6_FEATS, "mean_abs_shap": mean_abs})
shap_df = shap_df.sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
print("\nTop 10 features by mean |SHAP|:")
for _, row in shap_df.head(10).iterrows():
    print(f"  {row['feature']:<34}  {row['mean_abs_shap']:.5f}")

print(f"\n{'='*70}")
print("ALL DONE")
print(f"{'='*70}")
print("Output files:")
print("  data/processed/teams_2026_features.csv")
print("  models/predictions/group_stage_predictions.csv")
print("  models/predictions/group_advancement_probabilities.csv")
print("  models/predictions/tournament_simulation_results.csv")
