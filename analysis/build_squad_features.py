"""
Build squad quality features from FBref top-5-league player data.
Produces squad_quality_2026.csv and training_matches_v3.csv.
"""

import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
# Nation code → training-data team name mapping
# ---------------------------------------------------------------------------
NAT_MAP = {
    # Explicitly listed by user
    "USA": "United States",
    "FRA": "France",
    "ARG": "Argentina",
    "KOR": "South Korea",
    "CRC": "Costa Rica",
    "KSA": "Saudi Arabia",
    "CIV": "Ivory Coast",
    "IRN": "Iran",
    "TUR": "Turkey",
    "CRO": "Croatia",
    "BIH": "Bosnia and Herzegovina",
    "ALG": "Algeria",
    "MAR": "Morocco",
    "CMR": "Cameroon",
    "GHA": "Ghana",
    "NGA": "Nigeria",
    "SEN": "Senegal",
    "TUN": "Tunisia",
    "MEX": "Mexico",
    "PAR": "Paraguay",
    "URU": "Uruguay",
    "COL": "Colombia",
    "ECU": "Ecuador",
    "BRA": "Brazil",
    "JPN": "Japan",
    "AUS": "Australia",
    # Europe — standard FIFA names used in intl_football_results.csv
    "ENG": "England",
    "ESP": "Spain",
    "GER": "Germany",
    "ITA": "Italy",
    "NED": "Netherlands",
    "POR": "Portugal",
    "BEL": "Belgium",
    "SCO": "Scotland",
    "WAL": "Wales",
    "NIR": "Northern Ireland",
    "SWE": "Sweden",
    "NOR": "Norway",
    "DEN": "Denmark",
    "AUT": "Austria",
    "SUI": "Switzerland",
    "CZE": "Czech Republic",
    "POL": "Poland",
    "HUN": "Hungary",
    "ROU": "Romania",
    "BUL": "Bulgaria",
    "GRE": "Greece",
    "SRB": "Serbia",
    "SVK": "Slovakia",
    "SVN": "Slovenia",
    "MKD": "North Macedonia",
    "ALB": "Albania",
    "MNE": "Montenegro",
    "GEO": "Georgia",
    "UKR": "Ukraine",
    "RUS": "Russia",
    "ISL": "Iceland",
    "IRL": "Republic of Ireland",
    "FIN": "Finland",
    "EST": "Estonia",
    "LVA": "Latvia",
    "LTU": "Lithuania",
    "KVX": "Kosovo",
    "ISR": "Israel",
    "CYP": "Cyprus",
    "LUX": "Luxembourg",
    "ARM": "Armenia",
    "FRO": "Faroe Islands",
    # Africa
    "MLI": "Mali",
    "GUI": "Guinea",
    "CGO": "Congo",
    "COD": "DR Congo",
    "BFA": "Burkina Faso",
    "GAB": "Gabon",
    "GAM": "Gambia",
    "EGY": "Egypt",
    "KEN": "Kenya",
    "RSA": "South Africa",
    "ANG": "Angola",
    "BEN": "Benin",
    "TOG": "Togo",
    "ZIM": "Zimbabwe",
    "ZAM": "Zambia",
    "TAN": "Tanzania",
    "MOZ": "Mozambique",
    "MTN": "Mauritania",
    "SLE": "Sierra Leone",
    "COM": "Comoros",
    "CPV": "Cape Verde",
    "GNB": "Guinea-Bissau",
    "NIG": "Niger",
    "EQG": "Equatorial Guinea",
    "LBY": "Libya",
    "MAD": "Madagascar",
    "CTA": "Central African Republic",
    "BDI": "Burundi",
    # Americas
    "CAN": "Canada",
    "VEN": "Venezuela",
    "PER": "Peru",
    "CHI": "Chile",
    "DOM": "Dominican Republic",
    "JAM": "Jamaica",
    "HAI": "Haiti",
    "SUR": "Suriname",
    "TRI": "Trinidad and Tobago",
    "PAN": "Panama",
    "HON": "Honduras",
    "GLP": "Guadeloupe",
    "GUF": "French Guiana",
    "MTQ": "Martinique",
    "BRB": "Barbados",
    # Asia / Oceania
    "JOR": "Jordan",
    "IDN": "Indonesia",
    "THA": "Thailand",
    "NZL": "New Zealand",
    "MAS": "Malaysia",
    "UZB": "Uzbekistan",
}

# ---------------------------------------------------------------------------
# Load FBref player data (header on row 2 → header=1 in pandas)
# ---------------------------------------------------------------------------
print("Loading FBref player data...")
path = (
    "/Users/ianwork/Downloads/"
    "team stats for 2022 world cup and 2026 qualifiers - top 5 league players.csv"
)
raw = pd.read_csv(path, header=1)
print(f"Raw shape: {raw.shape}")

# Parse numeric columns (Min has commas; stat cols are stored as strings)
raw["Min"] = raw["Min"].astype(str).str.replace(",", "").apply(pd.to_numeric, errors="coerce")
for col in ["90s", "Gls.1", "Ast.1", "CrdY", "CrdR", "MP"]:
    raw[col] = pd.to_numeric(raw[col], errors="coerce")

# Extract 3-letter uppercase nation code from "xx XXX" format
raw["nat_code"] = raw["Nation"].astype(str).str.extract(r"([A-Z]{2,4})$")

# Map to training-data team names
raw["team_name"] = raw["nat_code"].map(NAT_MAP)

# ---------------------------------------------------------------------------
# Print unmapped codes with player counts
# ---------------------------------------------------------------------------
unmapped = raw[raw["team_name"].isna() & raw["nat_code"].notna()]
if len(unmapped) > 0:
    print("\n⚠  Unmapped nation codes (with player counts):")
    print(unmapped["nat_code"].value_counts().to_string())
else:
    print("\nAll nation codes mapped successfully.")

# ---------------------------------------------------------------------------
# Filter: 450+ minutes played
# ---------------------------------------------------------------------------
df = raw[raw["Min"] >= 450].copy()
print(f"\nPlayers with 450+ minutes: {len(df)} (from {raw['Min'].notna().sum()} with valid Min)")

# Derived per-90 G+A
df["ga_per90"] = df["Gls.1"].fillna(0) + df["Ast.1"].fillna(0)
df["cards_per90"] = df["CrdY"].fillna(0)

# Position helpers
df["is_fw"] = df["Pos"].astype(str).str.contains("FW", na=False)
df["is_df"] = df["Pos"].astype(str).str.contains("DF", na=False)

# ---------------------------------------------------------------------------
# Aggregate by national team
# ---------------------------------------------------------------------------
print("Aggregating by national team...")


def squad_agg(grp):
    n = len(grp)
    ga = grp["ga_per90"].sort_values(ascending=False)
    top3 = ga.head(3)
    rest = ga.iloc[3:]

    top3_avg = top3.mean() if len(top3) > 0 else np.nan
    rest_avg = rest.mean() if len(rest) > 0 else np.nan
    star_gap = top3_avg - rest_avg if (not np.isnan(top3_avg) and not np.isnan(rest_avg)) else np.nan

    fw = grp[grp["is_fw"]]
    df_players = grp[grp["is_df"]]

    return pd.Series(
        {
            "squad_size_top5": n,
            "squad_avg_ga_per90": grp["ga_per90"].mean(),
            "squad_top3_ga_per90": top3_avg,
            "squad_star_gap": star_gap,
            "squad_avg_minutes": grp["Min"].mean(),
            "squad_avg_cards_per90": grp["cards_per90"].mean(),
            "squad_fwd_ga_per90": fw["ga_per90"].mean() if len(fw) > 0 else np.nan,
            "squad_def_count": len(df_players),
        }
    )


# Only aggregate teams that have a valid mapping
mapped = df[df["team_name"].notna()].copy()
squad = mapped.groupby("team_name").apply(squad_agg).reset_index()
squad.rename(columns={"team_name": "nation"}, inplace=True)
squad = squad.sort_values("squad_size_top5", ascending=False).reset_index(drop=True)

print(f"Nations with squad data: {len(squad)}")

# ---------------------------------------------------------------------------
# Save squad_quality_2026.csv
# ---------------------------------------------------------------------------
out_squad = "/Users/ianwork/wc2026-prediction/data/processed/squad_quality_2026.csv"
squad.to_csv(out_squad, index=False)
print(f"Saved: {out_squad}")

# ---------------------------------------------------------------------------
# Top 15 / Bottom 15 by squad_size_top5
# ---------------------------------------------------------------------------
print("\n=== TOP 15 nations by squad_size_top5 ===")
print(squad.head(15)[["nation", "squad_size_top5", "squad_avg_ga_per90", "squad_top3_ga_per90"]].to_string(index=False))

print("\n=== BOTTOM 15 nations by squad_size_top5 ===")
print(squad.tail(15)[["nation", "squad_size_top5", "squad_avg_ga_per90", "squad_top3_ga_per90"]].to_string(index=False))

# ---------------------------------------------------------------------------
# Build training_matches_v3.csv
# Add squad_size_top5 for home and away teams (time-invariant proxy)
# ---------------------------------------------------------------------------
print("\nBuilding training_matches_v3.csv...")
train = pd.read_csv(
    "/Users/ianwork/wc2026-prediction/data/processed/training_matches_v2.csv",
    parse_dates=["date"],
)

squad_lookup = squad.set_index("nation")["squad_size_top5"]

train["home_squad_size_top5"] = train["home_team"].map(squad_lookup)
train["away_squad_size_top5"] = train["away_team"].map(squad_lookup)
train["delta_squad_size_top5"] = train["home_squad_size_top5"] - train["away_squad_size_top5"]

out_train = "/Users/ianwork/wc2026-prediction/data/processed/training_matches_v3.csv"
train.to_csv(out_train, index=False)

print(f"Saved: {out_train}")
print(f"Shape: {train.shape}")

# Coverage check
n_home = train["home_squad_size_top5"].notna().sum()
n_away = train["away_squad_size_top5"].notna().sum()
print(f"home_squad_size_top5 coverage: {n_home}/{len(train)} ({100*n_home/len(train):.1f}%)")
print(f"away_squad_size_top5 coverage: {n_away}/{len(train)} ({100*n_away/len(train):.1f}%)")

# ---------------------------------------------------------------------------
# Sample: 5 recent FIFA Men's World Cup matches with new columns
# ---------------------------------------------------------------------------
print("\n=== Sample: 5 recent FIFA Mens World Cup matches ===")
pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)
pd.set_option("display.float_format", "{:.2f}".format)

wc = train[train["tournament"].str.contains("FIFA Men's World Cup", na=False)]
cols = [
    "date", "home_team", "away_team", "home_score", "away_score",
    "home_squad_size_top5", "away_squad_size_top5", "delta_squad_size_top5",
    "home_form_last5", "away_form_last5",
]
print(wc.tail(5)[cols].to_string(index=False))
