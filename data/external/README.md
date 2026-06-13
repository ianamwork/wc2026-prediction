# External Data (In Progress)

This directory will contain team-level stats from FBref for World Cup qualifying campaigns.

## Planned Files

| File | Status |
|------|--------|
| `fbref_qualifiers_2014.csv` | ⏳ Pending manual collection |
| `fbref_qualifiers_2018.csv` | ⏳ Pending manual collection |
| `fbref_qualifiers_2022.csv` | ⏳ Pending manual collection |
| `fbref_qualifiers_2026.csv` | ⏳ Pending manual collection |

## Columns (per file)

```
team, qualifying_cycle, confederation,
key_passes_p90, prog_passes_p90, long_pass_pct,
miscontrols_p90, dispossessions_p90,
goals_conceded_p90, passes_final_third_p90
```

## Source

FBref (Sports Reference) — https://fbref.com/en/comps/

Navigate to: Stathead → International → FIFA World Cup Qualifying → [Year] → Squad Stats

## Status

Manual collection from FBref in progress. These features are the "X-Factor layer" intended
to capture team tactical quality beyond what Elo ratings encode.

Once uploaded here, run `models/build_features.py` to merge them into the training pipeline.
