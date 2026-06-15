"""
Build trailing form features for training_matches_full.csv.

For each match, computes features using only matches STRICTLY before the match date
from the full intl_football_results.csv history (1872-present).

Features (8 per team, 16 total, plus 8 delta columns):
  form_last5        - points earned in last 5 matches / 15
  form_last10       - points earned in last 10 matches / 30
  goals_scored_12mo - avg goals scored per game, trailing 12 months
  goals_conceded_12mo - avg goals conceded per game, trailing 12 months
  goal_diff_12mo    - avg goal difference per game, trailing 12 months
  win_rate_12mo     - win rate, trailing 12 months
  days_since_last   - days since previous match
  h2h_net_wins      - net wins vs opponent in last 5 H2H meetings (from each team's perspective)
"""

from pathlib import Path
import pandas as pd
import numpy as np
from collections import defaultdict
import bisect
import time

BASE = Path(__file__).resolve().parent.parent  # repo root

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
print("Loading data...")
train = pd.read_csv(
    BASE / "data" / "processed" / "training_matches_full.csv",
    parse_dates=["date"],
)
raw = pd.read_csv(
    BASE / "data" / "raw" / "intl_football_results.csv",
    parse_dates=["date"],
)

# Drop rows with missing scores in raw (shouldn't be many)
raw = raw.dropna(subset=["home_score", "away_score"]).copy()
raw["home_score"] = raw["home_score"].astype(int)
raw["away_score"] = raw["away_score"].astype(int)
raw = raw.sort_values("date").reset_index(drop=True)

print(f"Training matches: {len(train)}")
print(f"Raw history rows: {len(raw)}")

# ---------------------------------------------------------------------------
# Build per-team history index
# team_hist[team] = list of (date_ordinal, goals_for, goals_against, points)
#                   sorted ascending by date_ordinal
# ---------------------------------------------------------------------------
print("Building team history index...")

team_hist = defaultdict(list)

for row in raw.itertuples(index=False):
    d = row.date.toordinal()
    h, a = row.home_team, row.away_team
    hs, as_ = row.home_score, row.away_score

    if hs > as_:
        h_pts, a_pts = 3, 0
    elif hs == as_:
        h_pts, a_pts = 1, 1
    else:
        h_pts, a_pts = 0, 3

    team_hist[h].append((d, hs, as_, h_pts))
    team_hist[a].append((d, as_, hs, a_pts))

# Convert to numpy arrays keyed by team for fast binary search
team_date_arr = {}
team_gf_arr = {}
team_ga_arr = {}
team_pts_arr = {}

for team, rows in team_hist.items():
    rows.sort()
    arr = np.array(rows, dtype=np.float64)  # (N, 4)
    team_date_arr[team] = arr[:, 0].astype(np.int64)
    team_gf_arr[team] = arr[:, 1]
    team_ga_arr[team] = arr[:, 2]
    team_pts_arr[team] = arr[:, 3]

# ---------------------------------------------------------------------------
# Build head-to-head history index
# h2h_hist[frozenset] -> list of (date_ordinal, home_team, result_for_first_sorted_team)
# Store as: (date_ord, net: +1 if t1 wins, -1 if t2 wins, 0 draw)
# where t1, t2 = sorted(home_team, away_team)
# ---------------------------------------------------------------------------
print("Building H2H history index...")

h2h_hist = defaultdict(list)

for row in raw.itertuples(index=False):
    d = row.date.toordinal()
    h, a = row.home_team, row.away_team
    hs, as_ = row.home_score, row.away_score
    key = tuple(sorted([h, a]))
    t1 = key[0]
    if hs > as_:
        result_t1 = 1 if h == t1 else -1
    elif hs < as_:
        result_t1 = -1 if h == t1 else 1
    else:
        result_t1 = 0
    h2h_hist[key].append((d, result_t1))

h2h_date_arr = {}
h2h_res_arr = {}

for key, rows in h2h_hist.items():
    rows.sort()
    arr = np.array(rows)  # (N, 2)
    h2h_date_arr[key] = arr[:, 0].astype(np.int64)
    h2h_res_arr[key] = arr[:, 1]

# ---------------------------------------------------------------------------
# Feature computation helpers
# ---------------------------------------------------------------------------
DAYS_365 = 365


def get_team_features(team, match_date_ord):
    """Return dict of form features for a team strictly before match_date_ord."""
    out = {
        "form_last5": np.nan,
        "form_last10": np.nan,
        "goals_scored_12mo": np.nan,
        "goals_conceded_12mo": np.nan,
        "goal_diff_12mo": np.nan,
        "win_rate_12mo": np.nan,
        "days_since_last": np.nan,
    }

    if team not in team_date_arr:
        return out

    dates = team_date_arr[team]
    # strict: idx = number of matches before match_date_ord
    idx = bisect.bisect_left(dates, match_date_ord)
    if idx == 0:
        return out

    # Days since last match
    out["days_since_last"] = float(match_date_ord - dates[idx - 1])

    # Last 5 / last 10
    pts = team_pts_arr[team]
    gf = team_gf_arr[team]
    ga = team_ga_arr[team]

    last5 = pts[max(0, idx - 5) : idx]
    last10 = pts[max(0, idx - 10) : idx]
    out["form_last5"] = float(last5.sum()) / 15.0
    out["form_last10"] = float(last10.sum()) / 30.0

    # Trailing 12 months
    cutoff_12mo = match_date_ord - DAYS_365
    start_12mo = bisect.bisect_left(dates, cutoff_12mo)
    n12 = idx - start_12mo
    if n12 > 0:
        gf12 = gf[start_12mo:idx]
        ga12 = ga[start_12mo:idx]
        pts12 = pts[start_12mo:idx]
        out["goals_scored_12mo"] = float(gf12.mean())
        out["goals_conceded_12mo"] = float(ga12.mean())
        out["goal_diff_12mo"] = float((gf12 - ga12).mean())
        out["win_rate_12mo"] = float((pts12 == 3).mean())

    return out


def get_h2h_net_wins(home_team, away_team, match_date_ord):
    """
    Net wins for home_team vs away_team in last 5 H2H meetings before match_date_ord.
    Positive = home_team won more; negative = away_team won more.
    """
    key = tuple(sorted([home_team, away_team]))
    if key not in h2h_date_arr:
        return 0.0, 0.0  # (home_net, away_net)

    dates = h2h_date_arr[key]
    res = h2h_res_arr[key]  # +1 means key[0] won, -1 means key[1] won

    idx = bisect.bisect_left(dates, match_date_ord)
    last5 = res[max(0, idx - 5) : idx]

    # net from key[0]'s perspective
    net_t1 = float(last5.sum())  # wins - losses for t1

    if home_team == key[0]:
        home_net = net_t1
        away_net = -net_t1
    else:
        home_net = -net_t1
        away_net = net_t1

    return home_net, away_net


# ---------------------------------------------------------------------------
# Main loop over training matches
# ---------------------------------------------------------------------------
print("Computing form features for all training matches...")
t0 = time.time()

home_feats = []
away_feats = []
h2h_home_list = []
h2h_away_list = []

for i, row in enumerate(train.itertuples(index=False)):
    d = row.date.toordinal()
    hf = get_team_features(row.home_team, d)
    af = get_team_features(row.away_team, d)
    h_net, a_net = get_h2h_net_wins(row.home_team, row.away_team, d)
    home_feats.append(hf)
    away_feats.append(af)
    h2h_home_list.append(h_net)
    h2h_away_list.append(a_net)

    if (i + 1) % 3000 == 0:
        elapsed = time.time() - t0
        print(f"  {i+1}/{len(train)} rows  ({elapsed:.1f}s)")

print(f"Done in {time.time()-t0:.1f}s")

# ---------------------------------------------------------------------------
# Assemble output dataframe
# ---------------------------------------------------------------------------
print("Assembling output dataframe...")

feat_cols = [
    "form_last5",
    "form_last10",
    "goals_scored_12mo",
    "goals_conceded_12mo",
    "goal_diff_12mo",
    "win_rate_12mo",
    "days_since_last",
]

home_df = pd.DataFrame(home_feats, columns=feat_cols).add_prefix("home_")
away_df = pd.DataFrame(away_feats, columns=feat_cols).add_prefix("away_")

out = train.copy()
for col in feat_cols:
    out[f"home_{col}"] = home_df[f"home_{col}"].values
for col in feat_cols:
    out[f"away_{col}"] = away_df[f"away_{col}"].values

out["home_h2h_net_wins"] = h2h_home_list
out["away_h2h_net_wins"] = h2h_away_list

# Delta columns (home minus away)
delta_cols = feat_cols + ["h2h_net_wins"]
for col in delta_cols:
    out[f"delta_{col}"] = out[f"home_{col}"] - out[f"away_{col}"]

# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------
out_path = BASE / "data" / "processed" / "training_matches_v2.csv"
out.to_csv(out_path, index=False)
print(f"\nSaved to {out_path}")
print(f"Shape: {out.shape}")

# ---------------------------------------------------------------------------
# Verification: 5 recent World Cup matches
# ---------------------------------------------------------------------------
print("\n--- Sample: 5 recent World Cup matches with new features ---")
new_cols = (
    [f"home_{c}" for c in delta_cols]
    + [f"away_{c}" for c in delta_cols]
    + [f"delta_{c}" for c in delta_cols]
)
wc = out[out["tournament"].str.contains("FIFA World Cup", case=False, na=False)].copy()
sample = wc.tail(5)[
    ["date", "home_team", "away_team", "home_score", "away_score"] + new_cols
]
pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)
pd.set_option("display.float_format", "{:.3f}".format)
print(sample.to_string(index=False))
