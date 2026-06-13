"""
explore_dataset.py
==================
Wyscout dataset audit script — inspect event data structure, coverage,
and player/team linkage across the 5 top European leagues (2017/18 season)
and the World Cup 2018 / Euro 2016 datasets.

# TODO: refactor from notebook
# This script was prototyped interactively. The findings are documented in
# reports/xfactor_report.md. A clean standalone version is in progress.

Expected data location: data/raw/wyscout/
  - events_World_Cup.json
  - events_European_Championship.json
  - matches_World_Cup.json
  - matches_European_Championship.json
  - players.json
  - teams.json

Note: The 5-league event files (events_England.json, events_Spain.json, etc.)
are too large (~500MB total) to include in the repo. Download them from the
Wyscout Open Data repository: https://figshare.com/collections/Soccer_match_event_dataset/4415000

Usage:
  python analysis/explore_dataset.py
"""

import json
import pandas as pd
from pathlib import Path

DATA_DIR = Path('data/raw/wyscout')

def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        print(f"  MISSING: {path}")
        return None
    with open(path) as f:
        data = json.load(f)
    print(f"  Loaded {filename}: {len(data)} records")
    return data


def main():
    print("=== Wyscout Dataset Audit ===\n")

    players = load_json('players.json')
    teams   = load_json('teams.json')
    wc_matches  = load_json('matches_World_Cup.json')
    wc_events   = load_json('events_World_Cup.json')
    eu_matches  = load_json('matches_European_Championship.json')
    eu_events   = load_json('events_European_Championship.json')

    if players:
        df_p = pd.DataFrame(players)
        print(f"\nPlayers: {len(df_p)} total")
        print(f"  Columns: {list(df_p.columns)}")

    if wc_events:
        df_e = pd.DataFrame(wc_events)
        print(f"\nWC Events: {len(df_e)} total")
        print(f"  Event types: {df_e['eventName'].value_counts().to_dict()}")
        print(f"  Columns: {list(df_e.columns)}")

    # TODO: cross-reference WC 2018 squad player IDs with club-season event data
    # TODO: compute per-player key passes, progressive passes, dbl per 90
    # TODO: aggregate to team level and merge with WC 2018 match outcomes


if __name__ == '__main__':
    main()
