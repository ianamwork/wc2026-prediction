"""
Live Polymarket value bet scanner for WC 2026 group stage.
Compares M6 model probabilities vs live Polymarket market prices.
"""

from pathlib import Path
import json
import time
import requests
import pandas as pd
import numpy as np

BASE = Path(__file__).resolve().parent.parent  # repo root

HEADERS = {"Accept-Encoding": "gzip, deflate"}

# ── Team name normalisation (Polymarket → our canonical names) ─────────────
POLY_TO_MODEL = {
    "Türkiye":                  "Turkey",
    "USA":                      "United States",
    "United States of America": "United States",
    "Republic of Korea":        "South Korea",
    "Korea Republic":           "South Korea",
    "Czechia":                  "Czech Republic",
    "DR Congo":                 "DR Congo",
    "Democratic Republic of Congo": "DR Congo",
    "Ivory Coast":              "Ivory Coast",
    "Côte d'Ivoire":            "Ivory Coast",
    "Bosnia & Herzegovina":     "Bosnia and Herzegovina",
    "Cape Verde":               "Cape Verde",
    "Saudi Arabia":             "Saudi Arabia",
    "New Zealand":              "New Zealand",
}
def norm(name):
    return POLY_TO_MODEL.get(name, name)

# ── Step 1: collect all WC match event slugs ──────────────────────────────
print("=" * 70)
print("STEP 1 — Fetching WC 2026 match slugs from Polymarket")
print("=" * 70)

all_soccer_events = []
offset = 0
while True:
    r = requests.get(
        "https://gamma-api.polymarket.com/events",
        params={"tag_slug": "soccer", "limit": 100, "offset": offset, "closed": False},
        headers=HEADERS, timeout=20,
    )
    batch = r.json()
    if not batch:
        break
    all_soccer_events.extend(batch)
    if len(batch) < 100:
        break
    offset += 100

import re
# Keep only base match slugs: fifwc-AAA-BBB-YYYY-MM-DD (no extra suffixes)
_BASE_SLUG = re.compile(r'^fifwc-[a-z]+-[a-z]+-\d{4}-\d{2}-\d{2}$')
wc_slugs = sorted(
    set(e["slug"] for e in all_soccer_events
        if _BASE_SLUG.match(e["slug"]) and not e.get("closed"))
)
print(f"  Found {len(wc_slugs)} active WC match markets")
for s in wc_slugs:
    print(f"    {s}")

# ── Step 2: fetch each match event and parse markets ─────────────────────
print(f"\n{'='*70}")
print("STEP 2 — Fetching market prices for each match")
print(f"{'='*70}")

match_markets = []

for slug in wc_slugs:
    r = requests.get(
        "https://gamma-api.polymarket.com/events",
        params={"slug": slug, "limit": 1},
        headers=HEADERS, timeout=20,
    )
    events = r.json()
    if not events:
        print(f"  SKIP (empty): {slug}")
        continue

    event = events[0]
    markets = event.get("markets", [])

    # Identify home-win, draw, away-win markets by groupItemTitle
    home_mkt = draw_mkt = away_mkt = None
    teams_found = []
    for m in markets:
        title = m.get("groupItemTitle", "")
        if "draw" in title.lower():
            draw_mkt = m
        else:
            teams_found.append((title, m))

    if len(teams_found) >= 2:
        home_mkt = teams_found[0][1]
        away_mkt = teams_found[1][1]
        home_name = norm(teams_found[0][0])
        away_name = norm(teams_found[1][0])
    else:
        print(f"  SKIP (can't parse teams): {slug}  teams={[t[0] for t in teams_found]}")
        continue

    def yes_price(mkt):
        if mkt is None:
            return None
        prices = json.loads(mkt["outcomePrices"])
        outcomes = json.loads(mkt["outcomes"])
        idx = outcomes.index("Yes") if "Yes" in outcomes else 0
        return float(prices[idx])

    p_home_raw = yes_price(home_mkt)
    p_draw_raw = yes_price(draw_mkt) if draw_mkt else None
    p_away_raw = yes_price(away_mkt)

    if p_home_raw is None or p_away_raw is None:
        print(f"  SKIP (missing prices): {slug}")
        continue

    # If no draw market, estimate from complement (less accurate)
    if p_draw_raw is None:
        p_draw_raw = max(0, 1.0 - p_home_raw - p_away_raw)

    # Normalise so they sum to 1
    total = p_home_raw + p_draw_raw + p_away_raw
    p_home = p_home_raw / total
    p_draw = p_draw_raw / total
    p_away = p_away_raw / total

    closed = event.get("closed", False)
    liquidity = event.get("liquidity", 0)
    vol_24h = event.get("volume24hr", 0)

    match_markets.append({
        "slug":        slug,
        "event_title": event.get("title", ""),
        "home_poly":   home_name,
        "away_poly":   away_name,
        "mkt_home":    round(p_home, 4),
        "mkt_draw":    round(p_draw, 4),
        "mkt_away":    round(p_away, 4),
        "liquidity":   liquidity,
        "vol_24h":     vol_24h,
        "closed":      closed,
        "overround":   round(total - 1, 4),
    })
    status = "CLOSED" if closed else "open"
    print(f"  [{status}] {home_name:<22} vs {away_name:<22}  "
          f"H={p_home:.3f} D={p_draw:.3f} A={p_away:.3f}  "
          f"liq=${liquidity:,.0f}")
    time.sleep(0.05)   # gentle rate limiting

poly_df = pd.DataFrame(match_markets)
print(f"\n  Parsed {len(poly_df)} match markets")

# ── Step 3: load model predictions and merge ─────────────────────────────
print(f"\n{'='*70}")
print("STEP 3 — Merging with M6 model predictions")
print(f"{'='*70}")

model_df = pd.read_csv(
    BASE / "models" / "predictions" / "group_stage_predictions.csv"
)
model_df = model_df.rename(columns={
    "home": "home_model", "away": "away_model",
    "p_home_win": "mdl_home", "p_draw": "mdl_draw", "p_away_win": "mdl_away",
})

rows = []
unmatched = []

for _, pm in poly_df.iterrows():
    ph, pa = pm["home_poly"], pm["away_poly"]

    # Try both orderings — Polymarket vs our model may list teams differently
    match = model_df[
        (model_df.home_model == ph) & (model_df.away_model == pa)
    ]
    flipped = False
    if match.empty:
        match = model_df[
            (model_df.home_model == pa) & (model_df.away_model == ph)
        ]
        flipped = True

    if match.empty:
        unmatched.append((ph, pa, pm["slug"]))
        continue

    m = match.iloc[0]
    if flipped:
        mdl_h, mdl_d, mdl_a = m.mdl_away, m.mdl_draw, m.mdl_home
    else:
        mdl_h, mdl_d, mdl_a = m.mdl_home, m.mdl_draw, m.mdl_away

    edge_h = mdl_h - pm["mkt_home"]
    edge_d = mdl_d - pm["mkt_draw"]
    edge_a = mdl_a - pm["mkt_away"]

    edges = {"home": edge_h, "draw": edge_d, "away": edge_a}
    best_dir = max(edges, key=lambda k: edges[k])
    best_edge = edges[best_dir]

    # Market probability for best outcome
    mkt_probs = {"home": pm["mkt_home"], "draw": pm["mkt_draw"], "away": pm["mkt_away"]}
    mdl_probs = {"home": mdl_h, "draw": mdl_d, "away": mdl_a}
    mkt_p_best = mkt_probs[best_dir]
    mdl_p_best = mdl_probs[best_dir]

    # Kelly fraction: f = (b*p - q) / b  where b=odds-1, p=mdl_prob, q=1-p
    odds_best = 1 / mkt_p_best if mkt_p_best > 0 else 999
    kelly_full = (mdl_p_best * odds_best - (1 - mdl_p_best)) / odds_best if odds_best > 1 else 0
    kelly_quarter = kelly_full / 4

    # Model favourite vs market favourite
    mdl_fav = ["home", "draw", "away"][[mdl_h, mdl_d, mdl_a].index(max(mdl_h, mdl_d, mdl_a))]
    mkt_fav = ["home", "draw", "away"][[pm["mkt_home"], pm["mkt_draw"], pm["mkt_away"]].index(
        max(pm["mkt_home"], pm["mkt_draw"], pm["mkt_away"]))]
    contrarian = (mdl_fav != mkt_fav)

    rows.append({
        "match":         f"{ph} vs {pa}",
        "home":          ph,
        "away":          pa,
        "group":         m["group"],
        "slug":          pm["slug"],
        "mdl_home":      round(mdl_h, 4),
        "mdl_draw":      round(mdl_d, 4),
        "mdl_away":      round(mdl_a, 4),
        "mkt_home":      pm["mkt_home"],
        "mkt_draw":      pm["mkt_draw"],
        "mkt_away":      pm["mkt_away"],
        "edge_home":     round(edge_h, 4),
        "edge_draw":     round(edge_d, 4),
        "edge_away":     round(edge_a, 4),
        "best_edge":     round(best_edge, 4),
        "best_dir":      best_dir,
        "mdl_best":      round(mdl_p_best, 4),
        "mkt_best":      round(mkt_p_best, 4),
        "kelly_full":    round(kelly_full, 4),
        "kelly_quarter": round(kelly_quarter, 4),
        "contrarian":    contrarian,
        "liquidity":     pm["liquidity"],
        "vol_24h":       pm["vol_24h"],
        "closed":        pm["closed"],
    })

if unmatched:
    print("\n  Unmatched markets (name mismatch — check mappings):")
    for ph, pa, sl in unmatched:
        print(f"    {ph!r} vs {pa!r}  ({sl})")

results_df = pd.DataFrame(rows).sort_values("best_edge", ascending=False).reset_index(drop=True)
print(f"\n  Merged {len(results_df)} matches")

# ── Step 4: Value bet table ───────────────────────────────────────────────
print(f"\n{'='*70}")
print("STEP 4 — Value bet rankings")
print(f"{'='*70}")

label_map = {"home": lambda r: r.home, "draw": lambda r: "Draw", "away": lambda r: r.away}

header = f"{'MATCH':<34} {'BET ON':<22} {'MODEL':>6} {'MARKET':>7} {'EDGE':>7} {'¼KELLY':>7}  FLAGS"
print(f"\n{header}")
print("-" * 95)

for _, r in results_df.iterrows():
    bet_on = label_map[r.best_dir](r)
    strong = "⚡ STRONG" if r.best_edge >= 0.05 else ""
    contra = "↕ CONTRARIAN" if r.contrarian else ""
    closed = "🔒 CLOSED" if r.closed else ""
    flags = "  ".join(f for f in [strong, contra, closed] if f)
    sign = "+" if r.best_edge >= 0 else ""
    match_label = f"{r.home} vs {r.away}"
    print(f"{match_label:<34} {bet_on:<22} {r.mdl_best:>6.1%} {r.mkt_best:>7.1%} "
          f"{sign}{r.best_edge:>5.1%} {max(r.kelly_quarter,0):>7.2%}  {flags}")

# ── Save CSV ─────────────────────────────────────────────────────────────
out_csv = BASE / "models" / "predictions" / "value_bets_live.csv"
results_df.to_csv(out_csv, index=False)
print(f"\nSaved: value_bets_live.csv  ({len(results_df)} rows)")

# ── Step 5: top-10 summary text ───────────────────────────────────────────
top10 = results_df[results_df.best_edge > 0].head(10)
summary_lines = [
    "WC 2026 VALUE BET SCANNER — Top 10",
    f"Generated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}",
    "=" * 80,
    f"{'MATCH':<34} {'BET ON':<22} {'MODEL':>6} {'MARKET':>7} {'EDGE':>7} {'¼KELLY':>7}",
    "-" * 80,
]
for _, r in top10.iterrows():
    bet_on = label_map[r.best_dir](r)
    sign = "+" if r.best_edge >= 0 else ""
    summary_lines.append(
        f"{(r.home + ' vs ' + r.away):<34} {bet_on:<22} "
        f"{r.mdl_best:>6.1%} {r.mkt_best:>7.1%} "
        f"{sign}{r.best_edge:>5.1%} {max(r.kelly_quarter,0):>7.2%}"
    )
summary_lines += ["=" * 80,
    "⚡ = edge ≥ 5%  |  ↕ = model and market disagree on favourite  |  ¼Kelly = conservative sizing"]

summary_path = BASE / "models" / "predictions" / "value_bets_summary.txt"
with open(summary_path, "w") as f:
    f.write("\n".join(summary_lines))
print(f"Saved: value_bets_summary.txt")

# ── Step 6: tournament winner edge analysis ───────────────────────────────
print(f"\n{'='*70}")
print("STEP 6 — Tournament winner edge analysis")
print(f"{'='*70}")

r = requests.get(
    "https://gamma-api.polymarket.com/events",
    params={"slug": "world-cup-winner", "limit": 1},
    headers=HEADERS, timeout=20,
)
wc_winner = r.json()
if wc_winner:
    wev = wc_winner[0]
    print(f"  Event: {wev['title']}  |  markets: {len(wev['markets'])}")

    # This is a multi-outcome market — parse each team's price
    winner_prices = {}
    for m in wev["markets"]:
        team = norm(m.get("groupItemTitle", ""))
        if not team or "outcomePrices" not in m:
            continue
        try:
            prices = json.loads(m["outcomePrices"])
            outcomes = json.loads(m["outcomes"])
            idx = outcomes.index("Yes") if "Yes" in outcomes else 0
            winner_prices[team] = float(prices[idx])
        except Exception:
            continue

    # Normalise
    total = sum(winner_prices.values())
    winner_prices = {t: p / total for t, p in winner_prices.items()}
    print(f"  Found {len(winner_prices)} team prices (normalised sum={total:.3f})")

    # Load model tournament results
    tourn = pd.read_csv(
        BASE / "models" / "predictions" / "tournament_simulation_results.csv"
    )
    tourn["model_win_prob"] = tourn["win_pct"] / 100

    winner_rows = []
    for _, tr in tourn.iterrows():
        team = tr["team"]
        mkt_p = winner_prices.get(team)
        if mkt_p is None:
            continue
        mdl_p = tr["model_win_prob"]
        edge  = mdl_p - mkt_p
        odds  = 1 / mkt_p if mkt_p > 0 else 999
        kelly = (mdl_p * odds - (1 - mdl_p)) / odds if odds > 1 and edge > 0 else 0
        winner_rows.append({
            "team":     team,
            "group":    tr["group"],
            "mdl_win":  round(mdl_p, 4),
            "mkt_win":  round(mkt_p, 4),
            "edge":     round(edge, 4),
            "kelly_q":  round(kelly / 4, 4),
        })

    wdf = pd.DataFrame(winner_rows).sort_values("edge", ascending=False).reset_index(drop=True)

    print(f"\n{'TEAM':<24} {'GRP':<5} {'MODEL':>7} {'MARKET':>7} {'EDGE':>8}  {'¼KELLY':>7}")
    print("-" * 62)
    for _, r in wdf.iterrows():
        sign = "+" if r.edge >= 0 else ""
        flag = " ⚡" if r.edge >= 0.03 else (" ⚠" if r.edge <= -0.03 else "")
        print(f"  {r.team:<22} {r.group:<5} {r.mdl_win:>7.2%} {r.mkt_win:>7.2%} "
              f"{sign}{r.edge:>6.2%}  {max(r.kelly_q,0):>7.2%}{flag}")
else:
    print("  Could not fetch tournament winner market.")
