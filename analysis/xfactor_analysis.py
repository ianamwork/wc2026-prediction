"""
xfactor_analysis.py
===================
X-Factor separation analysis using Wyscout club-season data (2017/18).

For each World Cup 2018 and Euro 2016 team, aggregates squad-level passing
and ball-progression metrics from club football and tests whether they
separate tournament performance (group exit vs. knockout vs. winner).

Key findings documented in reports/xfactor_report.md.

# TODO: refactor from notebook
# Analysis was conducted interactively against the Wyscout 5-league dataset.
# Output CSVs are already saved in analysis/output/.

Expected inputs:
  data/raw/wyscout/events_World_Cup.json
  data/raw/wyscout/events_European_Championship.json
  data/raw/wyscout/players.json
  data/raw/wyscout/teams.json
  data/processed/team_tournament_features.csv
  [5-league event files — too large for repo, see explore_dataset.py]

Output CSVs (already generated, see analysis/output/):
  wc2018_separation.csv    — per-team X-Factor scores vs WC 2018 exit stage
  euro2016_separation.csv  — same for Euro 2016
  league_crossval.csv      — cross-validation of X-Factor features across leagues

X-Factor features:
  squad_key_passes_p90      — avg key passes per 90 across squad's club season
  squad_dbl_p90             — dangerous ball losses per 90
  squad_prog_passes_p90     — progressive passes per 90
  squad_long_ball_pct       — long ball percentage
  squad_pass_accuracy       — pass completion %
  squad_minutes_played      — avg minutes at club level (fitness/sharpness proxy)

Usage:
  python analysis/xfactor_analysis.py
"""

# TODO: refactor from notebook
# Placeholder — clean implementation in progress.
print("xfactor_analysis.py: implementation in progress.")
print("See reports/xfactor_report.md for current findings.")
print("See analysis/output/ for generated CSVs.")
