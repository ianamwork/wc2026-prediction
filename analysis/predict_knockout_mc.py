"""
predict_knockout_mc.py - Post-group-stage Monte Carlo for WC 2026 knockout.

32 teams are now fixed (actual group stage results).
Uses the REAL FIFA bracket (match-number keyed, not snake seeding).
REF_DATE = 2026-06-29 so all 60 group stage matches are in form features.

Outputs:
  - Console: R32 win% from MC vs direct predict_match() adj values
  - File:    Updated TOURNAMENT_PREDICTIONS in modelPredictions.js
"""

import bisect
import itertools
import re
import time
import warnings
warnings.filterwarnings("ignore")

from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import log_loss
from sklearn.model_selection import StratifiedKFold

BASE = Path(__file__).resolve().parent.parent
SEED = 42
N_SIM = 10_000
REF_DATE = pd.Timestamp("2026-06-29")
REF_ORD  = REF_DATE.toordinal()
DAYS_365 = 365

# ── Real FIFA bracket ─────────────────────────────────────────────────────────
# (matchNum, home, away, group_home, group_away)
R32_MATCHES = [
    (73,  "South Africa",           "Canada",                 "A", "B"),
    (74,  "Germany",                "Paraguay",               "E", "D"),
    (75,  "Netherlands",            "Morocco",                "F", "C"),
    (76,  "Brazil",                 "Japan",                  "C", "F"),
    (77,  "France",                 "Sweden",                 "I", "F"),
    (78,  "Ivory Coast",            "Norway",                 "E", "I"),
    (79,  "Mexico",                 "Ecuador",                "A", "E"),
    (80,  "England",                "DR Congo",               "L", "K"),
    (81,  "United States",          "Bosnia and Herzegovina", "D", "B"),
    (82,  "Belgium",                "Senegal",                "G", "I"),
    (83,  "Portugal",               "Croatia",                "K", "L"),
    (84,  "Spain",                  "Austria",                "H", "J"),
    (85,  "Switzerland",            "Algeria",                "B", "J"),
    (86,  "Argentina",              "Cape Verde",             "J", "H"),
    (87,  "Colombia",               "Ghana",                  "K", "L"),
    (88,  "Australia",              "Egypt",                  "D", "G"),
]

# R16 pairings: (r32_match_a, r32_match_b) — winner of a plays winner of b.
# Order matches App.jsx R32_BRACKET pairs[] exactly (left half first, then right).
R16_PAIRS = [
    (74, 77),   # R16-0 → Philadelphia  (left,  July 4)
    (73, 75),   # R16-1 → Houston       (left,  July 4)
    (83, 84),   # R16-2 → Dallas        (left,  July 6)
    (81, 82),   # R16-3 → Seattle       (left,  July 6)
    (76, 78),   # R16-4 → New York      (right, July 5)
    (79, 80),   # R16-5 → Mexico City   (right, July 5)
    (86, 88),   # R16-6 → Atlanta       (right, July 7)
    (85, 87),   # R16-7 → Vancouver     (right, July 7)
]

# QF pairings: (r16_idx_a, r16_idx_b).
# Adjacent R16 pairs within each bracket half — App.jsx pairs[0,1] → QF-0,
# pairs[2,3] → QF-1 (left); pairs[4,5] → QF-2, pairs[6,7] → QF-3 (right).
QF_PAIRS = [
    (0, 1),   # QF-0: win(R16-PHL) vs win(R16-HOU)  ← left half
    (2, 3),   # QF-1: win(R16-DAL) vs win(R16-SEA)  ← left half
    (4, 5),   # QF-2: win(R16-NYC) vs win(R16-MEX)  ← right half
    (6, 7),   # QF-3: win(R16-ATL) vs win(R16-VAN)  ← right half
]

# SF pairings: (qf_idx_a, qf_idx_b).
SF_PAIRS = [
    (0, 1),   # SF-L: win(QF-0) vs win(QF-1) → Dallas,  July 14
    (2, 3),   # SF-R: win(QF-2) vs win(QF-3) → Atlanta, July 15
]

R32_TEAMS = list({t for *_, h, a, _gh, _ga in R32_MATCHES for t in (h, a)})

TEAM_GROUP = {}
for _, home, away, gh, ga in R32_MATCHES:
    TEAM_GROUP[home] = gh
    TEAM_GROUP[away] = ga

ELO_NAME_MAP = {"DR Congo": "Democratic Republic of Congo"}

STAGE_ORDER = ["r32", "r16", "qf", "sf", "final", "winner"]

# ── June 26-27 manual patches (NA in martj42 dataset until it updates) ────────
MANUAL_RESULTS = [
    ("2026-06-26", "Egypt",       "Iran",          1, 1),
    ("2026-06-26", "New Zealand", "Belgium",       1, 5),
    ("2026-06-26", "Cape Verde",  "Saudi Arabia",  0, 0),
    ("2026-06-26", "Uruguay",     "Spain",         0, 1),
    ("2026-06-26", "Norway",      "France",        1, 4),
    ("2026-06-26", "Senegal",     "Iraq",          5, 0),
    ("2026-06-27", "Algeria",     "Austria",       3, 3),
    ("2026-06-27", "Jordan",      "Argentina",     1, 3),
    ("2026-06-27", "Colombia",    "Portugal",      0, 0),
    ("2026-06-27", "DR Congo",    "Uzbekistan",    3, 1),
    ("2026-06-27", "Panama",      "England",       0, 2),
    ("2026-06-27", "Croatia",     "Ghana",         2, 1),
]

# ─────────────────────────────────────────────────────────────────────────────
print("=" * 70)
print("STEP 1 — Elo + squad features")
print("=" * 70)

elo_raw = pd.read_csv(BASE / "data" / "raw" / "eloratings.csv")
elo_raw["team"] = elo_raw["team"].str.replace("\xa0", " ", regex=False)
iso = pd.to_datetime(elo_raw["date"], format="%Y-%m-%d", errors="coerce")
mdy = pd.to_datetime(elo_raw["date"], format="%m/%d/%Y", errors="coerce")
elo_raw["date"] = iso.fillna(mdy)
elo_recent = (
    elo_raw[elo_raw["date"] < REF_DATE]
    .sort_values("date").groupby("team").last()
    .reset_index()[["team", "rating"]].rename(columns={"rating": "elo"})
)
elo_dict = dict(zip(elo_recent["team"], elo_recent["elo"]))
elo_vals   = [elo_dict.get(ELO_NAME_MAP.get(t, t)) for t in R32_TEAMS]
elo_median = float(np.nanmedian([v for v in elo_vals if v is not None]))
print(f"  Elo: {len(elo_dict)} teams.  R32 median = {elo_median:.0f}")

sq = pd.read_csv(BASE / "data" / "processed" / "squad_quality_2026.csv")
sq_dict = dict(zip(sq["nation"], sq["squad_size_top5"]))
sq_vals   = [sq_dict.get(t) for t in R32_TEAMS]
sq_median = float(np.nanmedian([v for v in sq_vals if v is not None]))
print(f"  Squad: {len(sq_dict)} teams.  R32 median = {sq_median:.1f}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("STEP 2 — Form features  (REF_DATE = 2026-06-29, post group stage)")
print("=" * 70)

raw = pd.read_csv(
    BASE / "data" / "raw" / "intl_football_results.csv",
    parse_dates=["date"],
)
raw = raw.dropna(subset=["home_score", "away_score"]).copy()
raw["home_score"] = raw["home_score"].astype(int)
raw["away_score"]  = raw["away_score"].astype(int)
raw = raw[raw["date"] < REF_DATE].sort_values("date").reset_index(drop=True)

patch_df = pd.DataFrame([
    {"date": pd.Timestamp(d), "home_team": h, "away_team": a,
     "home_score": hs, "away_score": as_}
    for d, h, a, hs, as_ in MANUAL_RESULTS
])
patch_keys = set(zip(patch_df["date"], patch_df["home_team"], patch_df["away_team"]))
raw = raw[~raw.apply(
    lambda r: (r["date"], r["home_team"], r["away_team"]) in patch_keys, axis=1
)]
raw = pd.concat([raw, patch_df], ignore_index=True).sort_values("date").reset_index(drop=True)
print(f"  Historical matches (scored, pre-{REF_DATE.date()}): {len(raw)}")

team_hist = defaultdict(list)
for row in raw.itertuples(index=False):
    d = row.date.toordinal()
    h, a = row.home_team, row.away_team
    hs, as_ = int(row.home_score), int(row.away_score)
    h_pts, a_pts = (3, 0) if hs > as_ else ((1, 1) if hs == as_ else (0, 3))
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
    last5 = pts[max(0, idx - 5):idx]
    out["form_last5"] = float(last5.sum()) / 15.0
    cutoff = ref_ord - DAYS_365; start = bisect.bisect_left(dates, cutoff)
    n12 = idx - start
    if n12 > 0:
        gf12 = gf[start:idx]; ga12 = ga[start:idx]
        out["goals_conceded_12mo"] = float(ga12.mean())
        out["goal_diff_12mo"]      = float((gf12 - ga12).mean())
    return out

h2h_hist = defaultdict(list)
for row in raw.itertuples(index=False):
    d = row.date.toordinal()
    h, a = row.home_team, row.away_team
    hs, as_ = int(row.home_score), int(row.away_score)
    key = tuple(sorted([h, a])); t1 = key[0]
    r_t1 = (1 if h == t1 else -1) if hs > as_ else ((-1 if h == t1 else 1) if hs < as_ else 0)
    h2h_hist[key].append((d, r_t1))

h2h_date_arr = {}; h2h_res_arr = {}
for key, rows in h2h_hist.items():
    rows.sort(); arr = np.array(rows)
    h2h_date_arr[key] = arr[:, 0].astype(np.int64)
    h2h_res_arr[key]  = arr[:, 1]

def get_h2h(home, away, ref_ord):
    key = tuple(sorted([home, away]))
    if key not in h2h_date_arr:
        return 0.0, 0.0
    dates = h2h_date_arr[key]; res = h2h_res_arr[key]
    idx   = bisect.bisect_left(dates, ref_ord)
    last5 = res[max(0, idx - 5):idx]; net_t1 = float(last5.sum())
    return (net_t1, -net_t1) if home == key[0] else (-net_t1, net_t1)

team_features = {}
for team in R32_TEAMS:
    elo_key = ELO_NAME_MAP.get(team, team)
    elo_val = elo_dict.get(elo_key, elo_median)
    form    = get_team_form(team, REF_ORD)
    team_features[team] = {
        "elo":                 elo_val,
        "squad_size_top5":     sq_dict.get(team, 0.0),
        "form_last5":          form["form_last5"],
        "goals_conceded_12mo": form["goals_conceded_12mo"],
        "goal_diff_12mo":      form["goal_diff_12mo"],
        "days_since_last":     form["days_since_last"],
    }

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("STEP 3 — Retrain M6 (Platt-scaled XGBoost)")
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
elo_ok = df["elo_home"].notna() & df["elo_away"].notna()
df_train = df[(~holdout_mask) & elo_ok].copy()
print(f"  Training rows: {len(df_train)}")

ELO_FEATS  = ["elo_home", "elo_away", "elo_delta", "elo_avg", "tier_num", "is_neutral"]
FORM_FEATS = ["delta_form_last5", "delta_goals_conceded_12mo", "delta_goal_diff_12mo",
              "home_days_since_last", "away_days_since_last", "delta_h2h_net_wins"]
SQUAD_FEAT = ["delta_squad_size_top5"]
M6_FEATS   = ELO_FEATS + FORM_FEATS + SQUAD_FEAT

X_train = df_train[M6_FEATS].copy()
y_train = df_train["label"].values
w_train = df_train["weight"].values.astype(np.float32)
medians = X_train.median()
X_train = X_train.fillna(medians)

REG_PARAMS_BASE = dict(
    objective="multi:softprob", num_class=3, max_depth=3,
    subsample=0.8, colsample_bytree=0.8,
    reg_alpha=1.0, reg_lambda=3.0, min_child_weight=5,
    random_state=SEED, eval_metric="mlogloss", verbosity=0,
)
N_EST_GRID = [100, 200, 300, 400, 500]
LR_GRID    = [0.01, 0.03, 0.05, 0.1]
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

print("  CV tuning...")
best_cv_ll = np.inf; best_ne, best_lr = 300, 0.05
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
m6_base = xgb.XGBClassifier(**{**REG_PARAMS_BASE, "n_estimators": best_ne, "learning_rate": best_lr})
m6      = CalibratedClassifierCV(m6_base, cv=5, method="sigmoid")
m6.fit(X_train, y_train, sample_weight=w_train)
print("  M6 trained.")

# ── predict_match and sim_ko_match ────────────────────────────────────────────

def build_match_features(home, away):
    hf = team_features[home]; af = team_features[away]
    h_net, a_net = get_h2h(home, away, REF_ORD)
    elo_h = hf["elo"]; elo_a = af["elo"]
    return {
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

_prob_cache = {}
def get_prob(home, away):
    if (home, away) not in _prob_cache:
        row = build_match_features(home, away)
        X   = pd.DataFrame([row])[M6_FEATS].fillna(medians)
        _prob_cache[(home, away)] = tuple(m6.predict_proba(X)[0])
    return _prob_cache[(home, away)]

def predict_match(home, away):
    return get_prob(home, away)

def sim_ko_match(home, away, rng_):
    p_hw, p_d, p_aw = get_prob(home, away)
    probs = np.array([p_hw, p_d, p_aw], dtype=np.float64)
    probs /= probs.sum()
    res = int(rng_.choice(3, p=probs))
    if res == 0:   return home
    elif res == 2: return away
    else:          return home if rng_.random() < 0.5 else away

# Pre-warm cache for all possible match pairings in the bracket
# R32 pairs are known. R16/QF/SF/Final pairs depend on simulation outcomes.
# For now just warm R32; deeper rounds are cached on demand.
print("\n  Pre-warming probability cache for R32...")
for _, home, away, *_ in R32_MATCHES:
    get_prob(home, away)
    get_prob(away, home)  # also cache reversed for potential deeper round clashes

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("STEP 4 — Monte Carlo bracket simulation  (N = {:,})".format(N_SIM))
print("=" * 70)

# stage_counts[team][stage] = number of sims where team reached that stage
stage_counts = {team: {s: 0 for s in STAGE_ORDER}
                for _, home, away, *_ in R32_MATCHES
                for team in (home, away)}

rng = np.random.default_rng(SEED + 2)
t0  = time.time()

# Track R32 match win counts separately for sanity-check output
r32_home_wins = {num: 0 for num, *_ in R32_MATCHES}

for _ in range(N_SIM):
    # ── R32 ──────────────────────────────────────────────────────────────────
    r32_winner = {}   # match_num → winner
    for num, home, away, *_ in R32_MATCHES:
        w = sim_ko_match(home, away, rng)
        r32_winner[num] = w
        if w == home:
            r32_home_wins[num] += 1

    # ── R16 ──────────────────────────────────────────────────────────────────
    r16_winner = []
    for ma, mb in R16_PAIRS:
        r16_winner.append(sim_ko_match(r32_winner[ma], r32_winner[mb], rng))

    # ── QF ───────────────────────────────────────────────────────────────────
    qf_winner = []
    for ia, ib in QF_PAIRS:
        qf_winner.append(sim_ko_match(r16_winner[ia], r16_winner[ib], rng))

    # ── SF ───────────────────────────────────────────────────────────────────
    sf_winner = []
    for ia, ib in SF_PAIRS:
        sf_winner.append(sim_ko_match(qf_winner[ia], qf_winner[ib], rng))

    # ── Final ─────────────────────────────────────────────────────────────────
    champion = sim_ko_match(sf_winner[0], sf_winner[1], rng)

    # ── Credit stages ─────────────────────────────────────────────────────────
    # Collect furthest stage reached per team this sim
    reached = {}
    for _, home, away, *_ in R32_MATCHES:
        reached[home] = "r32"; reached[away] = "r32"
    for w in r32_winner.values():
        reached[w] = "r16"
    for w in r16_winner:
        reached[w] = "qf"
    for w in qf_winner:
        reached[w] = "sf"
    for w in sf_winner:
        reached[w] = "final"
    reached[champion] = "winner"

    for team, stage in reached.items():
        sidx = STAGE_ORDER.index(stage)
        for s in STAGE_ORDER[:sidx + 1]:
            stage_counts[team][s] += 1

print(f"  Done in {time.time() - t0:.1f}s")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("STEP 5 — Sanity check: MC R32 win% vs direct predict_match() adj values")
print("=" * 70)
print(f"\n  {'#':<4} {'Home':<24} {'Away':<24}  {'MC_H':>6} {'Adj_H':>6}  {'MC_A':>6} {'Adj_A':>6}  {'|ΔH|':>6}")
print("  " + "-" * 90)

for num, home, away, *_ in R32_MATCHES:
    p_hw, p_d, p_aw = predict_match(home, away)
    adj_h = p_hw + 0.5 * p_d
    adj_a = p_aw + 0.5 * p_d
    mc_h  = r32_home_wins[num] / N_SIM
    mc_a  = 1.0 - mc_h
    delta = abs(mc_h - adj_h)
    flag  = " *** FLAG" if delta > 0.02 else ""
    print(f"  {num:<4} {home:<24} {away:<24}  "
          f"{mc_h:>6.3f} {adj_h:>6.3f}  {mc_a:>6.3f} {adj_a:>6.3f}  {delta:>6.3f}{flag}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("STEP 6 — Tournament results table")
print("=" * 70)
print(f"\n  {'Team':<28} {'Win%':>6} {'Final':>7} {'SF':>6} {'QF':>6} {'R16':>6} {'R32':>6}")
print("  " + "-" * 70)

tourn_rows = []
for _, home, away, gh, ga in R32_MATCHES:
    for team, grp in ((home, gh), (away, ga)):
        if team in (t for t, *_ in tourn_rows):
            continue
        sc = stage_counts[team]
        elo_key = ELO_NAME_MAP.get(team, team)
        elo_val = round(elo_dict.get(elo_key, elo_median))
        tourn_rows.append((
            team,
            grp,
            elo_val,
            round(100 * sc["r32"]    / N_SIM, 2),
            round(100 * sc["r16"]    / N_SIM, 2),
            round(100 * sc["qf"]     / N_SIM, 2),
            round(100 * sc["sf"]     / N_SIM, 2),
            round(100 * sc["final"]  / N_SIM, 2),
            round(100 * sc["winner"] / N_SIM, 2),
        ))

# Deduplicate (each team appears once per R32 match, but Sweden is in F so may appear twice if both sides of a match share a group — shouldn't happen here but guard anyway)
seen = set()
tourn_rows_dedup = []
for row in tourn_rows:
    if row[0] not in seen:
        seen.add(row[0]); tourn_rows_dedup.append(row)
tourn_rows = tourn_rows_dedup

tourn_rows.sort(key=lambda r: -r[8])  # sort by win%
for team, grp, elo, r32, r16, qf, sf, final, win in tourn_rows:
    print(f"  {team:<28} {win:>6.2f} {final:>7.2f} {sf:>6.2f} {qf:>6.2f} {r16:>6.2f} {r32:>6.2f}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("STEP 7 — Updating modelPredictions.js  (TOURNAMENT_PREDICTIONS only)")
print("=" * 70)

js_path = BASE / "dashboard-app" / "src" / "data" / "modelPredictions.js"
with open(js_path) as f:
    content = f.read()

# Build new JS array
lines = ["export const TOURNAMENT_PREDICTIONS = [\n"]
for team, grp, elo, r32, r16, qf, sf, final, win in tourn_rows:
    lines.append(
        f"  {{ team: \"{team}\", group: \"{grp}\", elo: {elo},"
        f" r32: {r32}, r16: {r16}, qf: {qf}, sf: {sf}, final: {final}, win: {win} }},\n"
    )
lines.append("];\n")
new_block = "".join(lines)

# Replace the existing TOURNAMENT_PREDICTIONS block
pattern = r"export const TOURNAMENT_PREDICTIONS = \[.*?\];\n"
new_content = re.sub(pattern, new_block, content, flags=re.DOTALL)
if new_content == content:
    print("  ERROR: regex did not match — modelPredictions.js unchanged")
else:
    with open(js_path, "w") as f:
        f.write(new_content)
    print(f"  Written: {js_path}")
    print(f"  {len(tourn_rows)} teams in updated TOURNAMENT_PREDICTIONS")
