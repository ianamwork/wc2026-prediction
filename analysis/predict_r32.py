"""
predict_r32.py - Round of 32 predictions for WC 2026.

Key difference from original predict_wc2026.py:
  REF_DATE = 2026-06-29 (post group stage) so that form_last5,
  goal_diff_12mo, and goals_conceded_12mo incorporate actual WC
  group stage results from the martj42 dataset.

Does NOT modify predict_wc2026.py or touch group-stage logic.
"""

import bisect
import itertools
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

# Post-group-stage reference: picks up all scored WC matches (June 12–25
# have real scores; June 26–27 have NA and are auto-dropped by dropna).
REF_DATE = pd.Timestamp("2026-06-29")
REF_ORD  = REF_DATE.toordinal()

DAYS_365 = 365

# ── 16 R32 matchups ───────────────────────────────────────────────────────────
# (matchNum, date, venue, home, away)
# Names match FLAGS dict in teamMapping.js exactly.
R32_MATCHES = [
    (73, "2026-06-28", "Los Angeles",   "South Africa",         "Canada"),
    (74, "2026-06-29", "Boston",        "Germany",              "Paraguay"),
    (75, "2026-06-29", "Monterrey",     "Netherlands",          "Morocco"),
    (76, "2026-06-29", "Houston",       "Brazil",               "Japan"),
    (77, "2026-06-30", "New York",      "France",               "Sweden"),
    (78, "2026-06-30", "Dallas",        "Ivory Coast",          "Norway"),
    (79, "2026-06-30", "Mexico City",   "Mexico",               "Ecuador"),
    (80, "2026-07-01", "Atlanta",       "England",              "DR Congo"),
    (81, "2026-07-01", "San Francisco", "United States",        "Bosnia and Herzegovina"),
    (82, "2026-07-01", "Seattle",       "Belgium",              "Senegal"),
    (83, "2026-07-02", "Toronto",       "Portugal",             "Croatia"),
    (84, "2026-07-02", "Los Angeles",   "Spain",                "Austria"),
    (85, "2026-07-02", "Vancouver",     "Switzerland",          "Algeria"),
    (86, "2026-07-03", "Miami",         "Argentina",            "Cape Verde"),
    (87, "2026-07-03", "Kansas City",   "Colombia",             "Ghana"),
    (88, "2026-07-03", "Dallas",        "Australia",            "Egypt"),
]

R32_TEAMS = list({t for _, _, _, h, a in R32_MATCHES for t in (h, a)})

# Name maps for Elo file (which uses different spellings for some countries)
ELO_NAME_MAP = {
    "DR Congo": "Democratic Republic of Congo",
}
# Squad quality file uses same canonical names — no mapping needed

print("=" * 70)
print("STEP 1 — Building Elo + squad feature dicts")
print("=" * 70)

# ── Elo ratings ───────────────────────────────────────────────────────────────
elo_raw = pd.read_csv(BASE / "data" / "raw" / "eloratings.csv")
elo_raw["team"] = elo_raw["team"].str.replace("\xa0", " ", regex=False)
iso_dates = pd.to_datetime(elo_raw["date"], format="%Y-%m-%d", errors="coerce")
mdy_dates = pd.to_datetime(elo_raw["date"], format="%m/%d/%Y", errors="coerce")
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

elo_vals   = [elo_dict.get(ELO_NAME_MAP.get(t, t)) for t in R32_TEAMS]
elo_median = float(np.nanmedian([v for v in elo_vals if v is not None]))
print(f"  Elo: {len(elo_dict)} teams in file.  R32 median = {elo_median:.0f}")
for t in R32_TEAMS:
    key = ELO_NAME_MAP.get(t, t)
    if key not in elo_dict:
        print(f"    Elo MISSING: {t!r} → using median {elo_median:.0f}")

# ── Squad quality ─────────────────────────────────────────────────────────────
sq = pd.read_csv(BASE / "data" / "processed" / "squad_quality_2026.csv")
sq_dict = dict(zip(sq["nation"], sq["squad_size_top5"]))

sq_vals   = [sq_dict.get(t) for t in R32_TEAMS]
sq_median = float(np.nanmedian([v for v in sq_vals if v is not None]))
print(f"  Squad: {len(sq_dict)} teams in file.  R32 median = {sq_median:.1f}")
for t in R32_TEAMS:
    if t not in sq_dict:
        print(f"    Squad MISSING: {t!r} → using 0")

print("\n" + "=" * 70)
print("STEP 2 — Computing form features (REF_DATE = 2026-06-29, post group stage)")
print("=" * 70)

# June 26-27 results not yet in the martj42 dataset (NA rows) — patch manually.
# Safe to leave in place once the dataset updates: the dedup step below removes
# any row whose (date, home_team, away_team) key already appears in raw with a
# real score, so we'll never double-count.
MANUAL_RESULTS = [
    # (date,        home_team,    away_team,      hs, as_)
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

raw = pd.read_csv(
    BASE / "data" / "raw" / "intl_football_results.csv",
    parse_dates=["date"],
)
# dropna removes the NA-scored June 26-27 rows (replaced by MANUAL_RESULTS above)
raw = raw.dropna(subset=["home_score", "away_score"]).copy()
raw["home_score"] = raw["home_score"].astype(int)
raw["away_score"]  = raw["away_score"].astype(int)
raw = raw[raw["date"] < REF_DATE].sort_values("date").reset_index(drop=True)

# Inject manual results, deduplicating against anything already scored in raw
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

wc_2026_matches = raw[raw["tournament"].fillna("") == "FIFA World Cup"]
wc_2026_matches = wc_2026_matches[wc_2026_matches["date"] >= pd.Timestamp("2026-06-11")]
print(f"  Historical matches (scored, pre-{REF_DATE.date()}): {len(raw)}")
print(f"  WC 2026 group stage matches (incl. manual patch):  {len(wc_2026_matches) + len(patch_df)}")

# Build per-team history
team_hist = defaultdict(list)
for row in raw.itertuples(index=False):
    d   = row.date.toordinal()
    h, a = row.home_team, row.away_team
    hs, as_ = int(row.home_score), int(row.away_score)
    if hs > as_:   h_pts, a_pts = 3, 0
    elif hs == as_: h_pts, a_pts = 1, 1
    else:            h_pts, a_pts = 0, 3
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
    cutoff = ref_ord - DAYS_365
    start  = bisect.bisect_left(dates, cutoff)
    n12    = idx - start
    if n12 > 0:
        gf12 = gf[start:idx]; ga12 = ga[start:idx]
        out["goals_conceded_12mo"] = float(ga12.mean())
        out["goal_diff_12mo"]      = float((gf12 - ga12).mean())
    return out

# Build H2H index
h2h_hist = defaultdict(list)
for row in raw.itertuples(index=False):
    d   = row.date.toordinal()
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

def get_h2h(home, away, ref_ord):
    key = tuple(sorted([home, away]))
    if key not in h2h_date_arr:
        return 0.0, 0.0
    dates = h2h_date_arr[key]; res = h2h_res_arr[key]
    idx   = bisect.bisect_left(dates, ref_ord)
    last5 = res[max(0, idx - 5):idx]
    net_t1 = float(last5.sum())
    if home == key[0]:
        return net_t1, -net_t1
    return -net_t1, net_t1

# Build team_features for all R32 teams
team_features = {}
for team in R32_TEAMS:
    elo_key = ELO_NAME_MAP.get(team, team)
    elo_val = elo_dict.get(elo_key, elo_median)
    sq_val  = sq_dict.get(team, 0.0)
    form    = get_team_form(team, REF_ORD)
    team_features[team] = {
        "elo":                 elo_val,
        "squad_size_top5":     sq_val,
        "form_last5":          form["form_last5"],
        "goals_conceded_12mo": form["goals_conceded_12mo"],
        "goal_diff_12mo":      form["goal_diff_12mo"],
        "days_since_last":     form["days_since_last"],
    }

# Print R32 team features for transparency
print(f"\n  {'Team':<28} {'Elo':>6} {'Squad':>6} {'Form5':>7} {'GD12':>6} {'DaysSince':>10}")
print("  " + "-" * 65)
for team in sorted(R32_TEAMS, key=lambda t: -team_features[t]["elo"]):
    f = team_features[team]
    print(f"  {team:<28} {f['elo']:>6.0f} {f['squad_size_top5']:>6.0f}"
          f" {f['form_last5']:>7.3f} {f['goal_diff_12mo']:>6.2f}"
          f" {f['days_since_last']:>10.0f}")

print("\n" + "=" * 70)
print("STEP 3 — Retraining M6 (Platt-scaled XGBoost)")
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
elo_ok     = df["elo_home"].notna() & df["elo_away"].notna()
train_mask = (~holdout_mask) & elo_ok
df_train   = df[train_mask].copy()
print(f"  Training rows: {len(df_train)}")

ELO_FEATS  = ["elo_home", "elo_away", "elo_delta", "elo_avg", "tier_num", "is_neutral"]
FORM_FEATS = ["delta_form_last5", "delta_goals_conceded_12mo", "delta_goal_diff_12mo",
              "home_days_since_last", "away_days_since_last", "delta_h2h_net_wins"]
SQUAD_FEAT = ["delta_squad_size_top5"]
M6_FEATS   = ELO_FEATS + FORM_FEATS + SQUAD_FEAT    # 13 features

X_train = df_train[M6_FEATS].copy()
y_train = df_train["label"].values
w_train = df_train["weight"].values.astype(np.float32)  # float32 required by sklearn calibration
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

print("  CV tuning hyperparameters...")
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
print("  M6 trained.")

# ── Feature builder and predict_match ─────────────────────────────────────────

def build_match_features(home, away, ref_ord=REF_ORD):
    hf = team_features[home]
    af = team_features[away]
    h_net, a_net = get_h2h(home, away, ref_ord)
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

def predict_match(home, away, ref_ord=REF_ORD):
    row  = build_match_features(home, away, ref_ord)
    X    = pd.DataFrame([row])[M6_FEATS].fillna(medians)
    prob = m6.predict_proba(X)[0]
    return tuple(prob)   # (p_hw, p_d, p_aw)

# ── STEP 4 — Predict all 16 R32 matchups ──────────────────────────────────────

print("\n" + "=" * 70)
print("STEP 4 — R32 match predictions (M6, form updated through WC group stage)")
print("=" * 70)
print(f"\n{'#':<4} {'Match':<42} {'P(H)':>6} {'P(D)':>6} {'P(A)':>6}  {'Adj_H':>6} {'Adj_A':>6}  Favored")
print("-" * 96)

results = []
for match_num, date, venue, home, away in R32_MATCHES:
    p_hw, p_d, p_aw = predict_match(home, away)
    adj_h = round(p_hw + 0.5 * p_d, 4)
    adj_a = round(p_aw + 0.5 * p_d, 4)
    favored = home if adj_h > adj_a else away
    print(
        f"{match_num:<4} {home:<20} vs {away:<20}  "
        f"{p_hw:>6.3f} {p_d:>6.3f} {p_aw:>6.3f}  "
        f"{adj_h:>6.3f} {adj_a:>6.3f}  {favored}"
    )
    results.append({
        "match_num": match_num,
        "date":      date,
        "venue":     venue,
        "home":      home,
        "away":      away,
        "p_hw":      round(p_hw, 4),
        "p_d":       round(p_d,  4),
        "p_aw":      round(p_aw, 4),
        "adj_h":     adj_h,
        "adj_a":     adj_a,
        "favored":   favored,
    })

# ── STEP 5 — Write knockoutPredictions.js ────────────────────────────────────

print("\n" + "=" * 70)
print("STEP 5 — Writing dashboard-app/src/data/knockoutPredictions.js")
print("=" * 70)

lines = [
    "// R32 knockout predictions — generated by analysis/predict_r32.py",
    "// Model: M6 Platt-scaled XGBoost",
    "// Features updated through WC 2026 group stage (REF_DATE: 2026-06-29)",
    "// adj_home / adj_away = p_win + 0.5*p_draw (draws → penalties convention)",
    "// mkt_home / mkt_away = null placeholder (no Polymarket data this pass)",
    "",
    "export const KNOCKOUT_PREDICTIONS = [",
]

for r in results:
    h3 = r["home"].lower().replace(" ", "_")[:3]
    a3 = r["away"].lower().replace(" ", "_")[:3]
    slug = f"r32-{r['match_num']}-{h3}-{a3}"
    line = (
        f"  {{ matchNum: {r['match_num']}, match: \"{r['home']} vs {r['away']}\","
        f" home: \"{r['home']}\", away: \"{r['away']}\","
        f" date: \"{r['date']}\", venue: \"{r['venue']}\", round: \"R32\","
        f" slug: \"{slug}\","
        f" mdl_home: {r['p_hw']}, mdl_draw: {r['p_d']}, mdl_away: {r['p_aw']},"
        f" adj_home: {r['adj_h']}, adj_away: {r['adj_a']},"
        f" favored: \"{r['favored']}\","
        f" mkt_home: null, mkt_away: null }},"
    )
    lines.append(line)

lines.append("];")
lines.append("")

out_path = BASE / "dashboard-app" / "src" / "data" / "knockoutPredictions.js"
out_path.write_text("\n".join(lines))
print(f"  Written: {out_path}")
print("\nDone. Sanity-check the predictions above, then proceed to React changes.")
