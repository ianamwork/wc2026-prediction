// FIFA World Cup 2026 — Group Stage Schedule
// Results current as of June 15, 2026
// status: "completed" | "live" | "upcoming"
// modelSlug: links to MATCH_PREDICTIONS entry for edge data

export const MATCH_SCHEDULE = [
  // ── JUNE 11 (Thursday) — Matchday 1 ─────────────────────────────
  {
    id: "A1a", group: "A", home: "Mexico", away: "South Africa",
    date: "2026-06-11", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-11T19:00:00Z",
    venue: "Estadio Azteca, Mexico City",
    status: "completed", score: { home: 2, away: 0 },
    modelCorrect: true, // Model: Mexico 65.8% — ✅ Mexico won
    modelNote: "Mexico 65.8% · Draw 22.2% · S.Africa 12.0%",
  },
  {
    id: "A1b", group: "A", home: "South Korea", away: "Czech Republic",
    date: "2026-06-11", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-11T22:00:00Z",
    venue: "MetLife Stadium, East Rutherford",
    status: "completed", score: { home: 2, away: 1 },
    modelCorrect: null, // Czech Republic slight edge in Elo — upset
    modelNote: "Czech Republic ~52% · Draw 22% · S.Korea ~26% (Elo-based)",
  },
  // ── JUNE 12 (Friday) ─────────────────────────────────────────────
  {
    id: "B1a", group: "B", home: "Canada", away: "Bosnia and Herzegovina",
    date: "2026-06-12", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-12T19:00:00Z",
    venue: "BMO Field, Toronto",
    status: "completed", score: { home: 1, away: 1 },
    modelCorrect: null,
    modelNote: "Canada ~52% · Draw 22% · Bosnia ~26%",
  },
  {
    id: "D1a", group: "D", home: "United States", away: "Paraguay",
    date: "2026-06-12", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-13T01:00:00Z",
    venue: "SoFi Stadium, Los Angeles",
    status: "completed", score: { home: 4, away: 1 },
    modelCorrect: true,
    modelNote: "USA ~53% · Draw 23% · Paraguay ~24%",
  },
  // ── JUNE 13 (Saturday) ───────────────────────────────────────────
  {
    id: "B1b", group: "B", home: "Switzerland", away: "Qatar",
    date: "2026-06-13", time: "12:00 PM", timezone: "ET", kickoffUTC: "2026-06-13T16:00:00Z",
    venue: "AT&T Stadium, Dallas",
    status: "completed", score: { home: 1, away: 1 },
    modelCorrect: false, // Switzerland ~75% favorites
    modelNote: "Switzerland ~75% · Draw 16% · Qatar ~9%",
  },
  {
    id: "C1a", group: "C", home: "Brazil", away: "Morocco",
    date: "2026-06-13", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-13T19:00:00Z",
    venue: "AT&T Stadium, Dallas",
    status: "completed", score: { home: 1, away: 1 },
    modelCorrect: false, // Brazil ~70% favorites
    modelNote: "Brazil ~70% · Draw 18% · Morocco ~12%",
  },
  {
    id: "C1b", group: "C", home: "Haiti", away: "Scotland",
    date: "2026-06-13", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-13T22:00:00Z",
    venue: "Levi's Stadium, San Jose",
    status: "completed", score: { home: 0, away: 1 },
    modelCorrect: true, // Scotland favorites
    modelNote: "Scotland ~56% · Draw 22% · Haiti ~22%",
  },
  {
    id: "D1b", group: "D", home: "Australia", away: "Turkey",
    date: "2026-06-13", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-14T01:00:00Z",
    venue: "Rose Bowl, Los Angeles",
    status: "completed", score: { home: 2, away: 0 },
    modelCorrect: null, // Turkey favored in model per value_bets
    modelNote: "Turkey ~42% · Draw 27% · Australia ~31% (contrarian signal)",
  },
  // ── JUNE 14 (Sunday) — first model matches ────────────────────────
  {
    id: "E1a", group: "E", home: "Germany", away: "Curaçao",
    date: "2026-06-14", time: "12:00 PM", timezone: "ET", kickoffUTC: "2026-06-14T16:00:00Z",
    venue: "NRG Stadium, Houston",
    status: "completed", score: { home: 7, away: 1 },
    modelSlug: "fifwc-ger-kor-2026-06-14",
    modelCorrect: true, // Germany won as predicted
    modelNote: "Germany 76.6% · Draw 15.4% · Curaçao 8.0% — market had Germany at 99.9%!",
  },
  {
    id: "E1b", group: "E", home: "Ivory Coast", away: "Ecuador",
    date: "2026-06-14", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-14T19:00:00Z",
    venue: "Lumen Field, Seattle",
    status: "completed", score: { home: 1, away: 0 },
    modelSlug: "fifwc-civ-ecu-2026-06-14",
    modelCorrect: false, // Model had Ecuador 60.9% — WRONG
    modelNote: "Ecuador 60.9% · Draw 15.1% · Ivory Coast 23.9% — upset! ❌",
  },
  {
    id: "F1a", group: "F", home: "Netherlands", away: "Japan",
    date: "2026-06-14", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-14T22:00:00Z",
    venue: "Gillette Stadium, Boston",
    status: "completed", score: { home: 2, away: 2 },
    modelSlug: "fifwc-nld-jpn-2026-06-14",
    modelCorrect: false, // Model had Netherlands 72.8% — drew
    modelNote: "Netherlands 72.8% · Draw 15.9% · Japan 23.0% — draw was right call",
  },
  {
    id: "F1b", group: "F", home: "Sweden", away: "Tunisia",
    date: "2026-06-14", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-15T01:00:00Z",
    venue: "Arrowhead Stadium, Kansas City",
    status: "completed", score: { home: 5, away: 1 },
    modelSlug: "fifwc-swe-tun-2026-06-14",
    modelCorrect: true, // Sweden 49.9% most likely — won
    modelNote: "Sweden 49.9% · Draw 24.0% · Tunisia 26.1%",
  },
  // ── JUNE 15 (Monday) — TODAY ──────────────────────────────────────
  {
    id: "H1a", group: "H", home: "Spain", away: "Cape Verde",
    date: "2026-06-15", time: "12:00 PM", timezone: "ET", kickoffUTC: "2026-06-15T16:00:00Z",
    venue: "Arrowhead Stadium, Kansas City",
    status: "completed", score: { home: 0, away: 0 },
    modelCorrect: false,
    modelNote: "Spain ~87% favorites — draw surprise ❌",
  },
  {
    id: "G1a", group: "G", home: "Belgium", away: "Egypt",
    date: "2026-06-15", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-15T19:00:00Z",
    venue: "Lincoln Financial Field, Philadelphia",
    status: "completed", score: { home: 1, away: 1 },
    modelCorrect: false, // Model: Belgium 72.5% — drew
    modelSlug: "fifwc-bel-egy-2026-06-15",
  },
  {
    id: "H1b", group: "H", home: "Saudi Arabia", away: "Uruguay",
    date: "2026-06-15", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-15T22:00:00Z",
    venue: "Estadio Akron, Zapopan",
    status: "upcoming", score: null,
    modelSlug: "fifwc-ksa-ury-2026-06-15",
  },
  {
    id: "G1b", group: "G", home: "Iran", away: "New Zealand",
    date: "2026-06-15", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-16T01:00:00Z",
    venue: "Lumen Field, Seattle",
    status: "upcoming", score: null,
    modelSlug: "fifwc-irn-nzl-2026-06-15",
  },
  // ── JUNE 16 (Tuesday) ────────────────────────────────────────────
  {
    id: "I1a", group: "I", home: "France", away: "Senegal",
    date: "2026-06-16", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-16T19:00:00Z",
    venue: "MetLife Stadium, East Rutherford",
    status: "upcoming", score: null,
    modelSlug: "fifwc-fra-sen-2026-06-16",
  },
  {
    id: "I1b", group: "I", home: "Iraq", away: "Norway",
    date: "2026-06-16", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-16T22:00:00Z",
    venue: "Empower Field, Denver",
    status: "upcoming", score: null,
    modelSlug: "fifwc-irq-nor-2026-06-16",
  },
  {
    id: "J1a", group: "J", home: "Algeria", away: "Argentina",
    date: "2026-06-16", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-17T01:00:00Z",
    venue: "Rose Bowl, Los Angeles",
    status: "upcoming", score: null,
    modelSlug: "fifwc-arg-alg-2026-06-16",
  },
  // ── JUNE 17 (Wednesday) ──────────────────────────────────────────
  {
    id: "L1a", group: "L", home: "Ghana", away: "Panama",
    date: "2026-06-17", time: "12:00 PM", timezone: "ET", kickoffUTC: "2026-06-17T16:00:00Z",
    venue: "Hard Rock Stadium, Miami",
    status: "upcoming", score: null,
    modelSlug: "fifwc-gha-pan-2026-06-17",
  },
  {
    id: "L1b", group: "L", home: "Croatia", away: "England",
    date: "2026-06-17", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-17T19:00:00Z",
    venue: "AT&T Stadium, Dallas",
    status: "upcoming", score: null,
    modelSlug: "fifwc-eng-hrv-2026-06-17",
  },
  {
    id: "K1a", group: "K", home: "Uzbekistan", away: "Colombia",
    date: "2026-06-17", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-17T22:00:00Z",
    venue: "Empower Field, Denver",
    status: "upcoming", score: null,
    modelSlug: "fifwc-uzb-col-2026-06-17",
  },
  {
    id: "K1b", group: "K", home: "DR Congo", away: "Portugal",
    date: "2026-06-17", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-18T01:00:00Z",
    venue: "Levi's Stadium, San Jose",
    status: "upcoming", score: null,
    modelSlug: "fifwc-prt-cdr-2026-06-17",
  },
  {
    id: "J1b", group: "J", home: "Austria", away: "Jordan",
    date: "2026-06-17", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-18T01:00:00Z",
    venue: "SoFi Stadium, Los Angeles",
    status: "upcoming", score: null,
    modelSlug: "fifwc-aut-jor-2026-06-17",
  },
  // ── JUNE 18 (Thursday) ───────────────────────────────────────────
  {
    id: "A2a", group: "A", home: "South Korea", away: "Mexico",
    date: "2026-06-18", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-18T19:00:00Z",
    venue: "SoFi Stadium, Los Angeles",
    status: "upcoming", score: null,
    modelSlug: "fifwc-mex-kr-2026-06-18",
  },
  {
    id: "A2b", group: "A", home: "Czech Republic", away: "South Africa",
    date: "2026-06-18", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-18T22:00:00Z",
    venue: "Gillette Stadium, Boston",
    status: "upcoming", score: null,
    modelSlug: "fifwc-cze-rsa-2026-06-18",
  },
  {
    id: "B2a", group: "B", home: "Canada", away: "Qatar",
    date: "2026-06-18", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-19T01:00:00Z",
    venue: "BMO Field, Toronto",
    status: "upcoming", score: null,
    modelSlug: "fifwc-can-qat-2026-06-18",
  },
  // ── JUNE 19 (Friday) ─────────────────────────────────────────────
  {
    id: "D2a", group: "D", home: "Australia", away: "United States",
    date: "2026-06-19", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-19T19:00:00Z",
    venue: "NRG Stadium, Houston",
    status: "upcoming", score: null,
    modelSlug: "fifwc-usa-aus-2026-06-19",
  },
  {
    id: "D2b", group: "D", home: "Turkey", away: "Paraguay",
    date: "2026-06-19", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-19T22:00:00Z",
    venue: "AT&T Stadium, Dallas",
    status: "upcoming", score: null,
    modelSlug: "fifwc-tur-par-2026-06-19",
  },
  {
    id: "C2a", group: "C", home: "Scotland", away: "Morocco",
    date: "2026-06-19", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-20T01:00:00Z",
    venue: "MetLife Stadium, East Rutherford",
    status: "upcoming", score: null,
    modelSlug: "fifwc-sco-mar-2026-06-19",
  },
  {
    id: "C2b", group: "C", home: "Brazil", away: "Haiti",
    date: "2026-06-19", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-20T01:00:00Z",
    venue: "Rose Bowl, Los Angeles",
    status: "upcoming", score: null,
    modelSlug: "fifwc-bra-hai-2026-06-19",
  },
  // ── JUNE 20 (Saturday) ───────────────────────────────────────────
  {
    id: "E2a", group: "E", home: "Germany", away: "Ivory Coast",
    date: "2026-06-20", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-20T19:00:00Z",
    venue: "NRG Stadium, Houston",
    status: "upcoming", score: null,
    modelSlug: "fifwc-ger-civ-2026-06-20",
  },
  {
    id: "E2b", group: "E", home: "Curaçao", away: "Ecuador",
    date: "2026-06-20", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-20T22:00:00Z",
    venue: "Lumen Field, Seattle",
    status: "upcoming", score: null,
    modelSlug: "fifwc-ecu-kor-2026-06-20",
  },
  {
    id: "F2b", group: "F", home: "Tunisia", away: "Japan",
    date: "2026-06-20", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-20T22:00:00Z",
    venue: "Gillette Stadium, Boston",
    status: "upcoming", score: null,
    modelSlug: "fifwc-tun-jpn-2026-06-21",
  },
  {
    id: "F2a", group: "F", home: "Netherlands", away: "Sweden",
    date: "2026-06-20", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-21T01:00:00Z",
    venue: "Arrowhead Stadium, Kansas City",
    status: "upcoming", score: null,
    modelSlug: "fifwc-nld-swe-2026-06-20",
  },
  // ── JUNE 21 (Sunday) ─────────────────────────────────────────────
  {
    id: "H2a", group: "H", home: "Spain", away: "Saudi Arabia",
    date: "2026-06-21", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-21T19:00:00Z",
    venue: "Estadio Akron, Zapopan",
    status: "upcoming", score: null,
    modelSlug: "fifwc-esp-ksa-2026-06-21",
  },
  {
    id: "G2a", group: "G", home: "New Zealand", away: "Egypt",
    date: "2026-06-21", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-22T01:00:00Z",
    venue: "Lincoln Financial Field, Philadelphia",
    status: "upcoming", score: null,
    modelSlug: "fifwc-nzl-egy-2026-06-21",
  },
  // ── JUNE 22 (Monday) ─────────────────────────────────────────────
  {
    id: "J2a", group: "J", home: "Austria", away: "Argentina",
    date: "2026-06-22", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-22T19:00:00Z",
    venue: "Hard Rock Stadium, Miami",
    status: "upcoming", score: null,
    modelSlug: "fifwc-arg-aut-2026-06-22",
  },
  {
    id: "I2a", group: "I", home: "Senegal", away: "Norway",
    date: "2026-06-22", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-22T22:00:00Z",
    venue: "Empower Field, Denver",
    status: "upcoming", score: null,
    modelSlug: "fifwc-nor-sen-2026-06-22",
  },
  {
    id: "I2b", group: "I", home: "Iraq", away: "France",
    date: "2026-06-22", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-23T01:00:00Z",
    venue: "BMO Field, Toronto",
    status: "upcoming", score: null,
    modelSlug: "fifwc-fra-irq-2026-06-22",
  },
  {
    id: "J2b", group: "J", home: "Jordan", away: "Algeria",
    date: "2026-06-22", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-23T01:00:00Z",
    venue: "Levi's Stadium, San Jose",
    status: "upcoming", score: null,
    modelSlug: "fifwc-jor-alg-2026-06-22",
  },
  // ── JUNE 23 (Tuesday) ────────────────────────────────────────────
  {
    id: "L2a", group: "L", home: "Croatia", away: "Panama",
    date: "2026-06-23", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-23T19:00:00Z",
    venue: "AT&T Stadium, Dallas",
    status: "upcoming", score: null,
    modelSlug: "fifwc-pan-hrv-2026-06-23",
  },
  {
    id: "K2a", group: "K", home: "Colombia", away: "DR Congo",
    date: "2026-06-23", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-23T22:00:00Z",
    venue: "NRG Stadium, Houston",
    status: "upcoming", score: null,
    modelSlug: "fifwc-col-cdr-2026-06-23",
  },
  {
    id: "K2b", group: "K", home: "Portugal", away: "Uzbekistan",
    date: "2026-06-23", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-24T01:00:00Z",
    venue: "Rose Bowl, Los Angeles",
    status: "upcoming", score: null,
    modelSlug: "fifwc-prt-uzb-2026-06-23",
  },
  {
    id: "L2b", group: "L", home: "Ghana", away: "England",
    date: "2026-06-23", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-24T01:00:00Z",
    venue: "MetLife Stadium, East Rutherford",
    status: "upcoming", score: null,
    modelSlug: "fifwc-eng-gha-2026-06-23",
  },
  // ── JUNE 24 (Wednesday) ──────────────────────────────────────────
  {
    id: "A3a", group: "A", home: "Mexico", away: "Czech Republic",
    date: "2026-06-24", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-24T19:00:00Z",
    venue: "Estadio Azteca, Mexico City",
    status: "upcoming", score: null,
    modelSlug: "fifwc-cze-mex-2026-06-24",
  },
  {
    id: "C3a", group: "C", home: "Scotland", away: "Brazil",
    date: "2026-06-24", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-24T19:00:00Z",
    venue: "Levi's Stadium, San Jose",
    status: "upcoming", score: null,
    modelSlug: "fifwc-sco-bra-2026-06-24",
  },
  {
    id: "C3b", group: "C", home: "Morocco", away: "Haiti",
    date: "2026-06-24", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-24T22:00:00Z",
    venue: "SoFi Stadium, Los Angeles",
    status: "upcoming", score: null,
    modelSlug: "fifwc-mar-hai-2026-06-24",
  },
  {
    id: "B3a", group: "B", home: "Switzerland", away: "Canada",
    date: "2026-06-24", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-24T22:00:00Z",
    venue: "Gillette Stadium, Boston",
    status: "upcoming", score: null,
    modelSlug: "fifwc-che-can-2026-06-24",
  },
  {
    id: "A3b", group: "A", home: "South Africa", away: "South Korea",
    date: "2026-06-24", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-25T01:00:00Z",
    venue: "Empower Field, Denver",
    status: "upcoming", score: null,
    modelSlug: "fifwc-rsa-kr-2026-06-24",
  },
  // ── JUNE 25 (Thursday) ───────────────────────────────────────────
  {
    id: "D3a", group: "D", home: "Turkey", away: "United States",
    date: "2026-06-25", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-25T19:00:00Z",
    venue: "Arrowhead Stadium, Kansas City",
    status: "upcoming", score: null,
    modelSlug: "fifwc-tur-usa-2026-06-25",
  },
  {
    id: "F3a", group: "F", home: "Japan", away: "Sweden",
    date: "2026-06-25", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-25T19:00:00Z",
    venue: "Lincoln Financial Field, Philadelphia",
    status: "upcoming", score: null,
    modelSlug: "fifwc-jpn-swe-2026-06-25",
  },
  {
    id: "E3a", group: "E", home: "Curaçao", away: "Ivory Coast",
    date: "2026-06-25", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-25T22:00:00Z",
    venue: "Hard Rock Stadium, Miami",
    status: "upcoming", score: null,
    modelSlug: "fifwc-kor-civ-2026-06-25",
  },
  {
    id: "E3b", group: "E", home: "Ecuador", away: "Germany",
    date: "2026-06-25", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-25T22:00:00Z",
    venue: "BMO Field, Toronto",
    status: "upcoming", score: null,
    modelSlug: "fifwc-ecu-ger-2026-06-25",
  },
  {
    id: "F3b", group: "F", home: "Tunisia", away: "Netherlands",
    date: "2026-06-25", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-26T01:00:00Z",
    venue: "Lumen Field, Seattle",
    status: "upcoming", score: null,
    modelSlug: "fifwc-tun-nld-2026-06-25",
  },
  {
    id: "D3b", group: "D", home: "Australia", away: "Paraguay",
    date: "2026-06-25", time: "9:00 PM", timezone: "ET", kickoffUTC: "2026-06-26T01:00:00Z",
    venue: "AT&T Stadium, Dallas",
    status: "upcoming", score: null,
    modelSlug: "fifwc-par-aus-2026-06-25",
  },
  // ── JUNE 26 (Friday) ─────────────────────────────────────────────
  {
    id: "I3a", group: "I", home: "Norway", away: "France",
    date: "2026-06-26", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-26T19:00:00Z",
    venue: "Empower Field, Denver",
    status: "upcoming", score: null,
    modelSlug: "fifwc-nor-fra-2026-06-26",
  },
  {
    id: "H3a", group: "H", home: "Uruguay", away: "Spain",
    date: "2026-06-26", time: "3:00 PM", timezone: "ET", kickoffUTC: "2026-06-26T19:00:00Z",
    venue: "Estadio Akron, Zapopan",
    status: "upcoming", score: null,
    modelSlug: "fifwc-ury-esp-2026-06-26",
  },
  {
    id: "G3a", group: "G", home: "Belgium", away: "New Zealand",
    date: "2026-06-26", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-26T22:00:00Z",
    venue: "Lincoln Financial Field, Philadelphia",
    status: "upcoming", score: null,
    modelSlug: "fifwc-nzl-bel-2026-06-26",
  },
  {
    id: "I3b", group: "I", home: "Senegal", away: "Iraq",
    date: "2026-06-26", time: "6:00 PM", timezone: "ET", kickoffUTC: "2026-06-26T22:00:00Z",
    venue: "BMO Field, Toronto",
    status: "upcoming", score: null,
    modelSlug: "fifwc-sen-irq-2026-06-26",
  },
  // ── JUNE 27 (Saturday) — Final group matches ──────────────────────
  {
    id: "L3a", group: "L", home: "Croatia", away: "Ghana",
    date: "2026-06-27", time: "5:00 PM", timezone: "ET", kickoffUTC: "2026-06-27T21:00:00Z",
    venue: "NRG Stadium, Houston",
    status: "upcoming", score: null,
    modelSlug: "fifwc-hrv-gha-2026-06-27",
  },
  {
    id: "L3b", group: "L", home: "England", away: "Panama",
    date: "2026-06-27", time: "5:00 PM", timezone: "ET", kickoffUTC: "2026-06-27T21:00:00Z",
    venue: "MetLife Stadium, East Rutherford",
    status: "upcoming", score: null,
    modelSlug: "fifwc-pan-eng-2026-06-27",
  },
  {
    id: "K3a", group: "K", home: "Colombia", away: "Portugal",
    date: "2026-06-27", time: "7:30 PM", timezone: "ET", kickoffUTC: "2026-06-27T23:30:00Z",
    venue: "Rose Bowl, Los Angeles",
    status: "upcoming", score: null,
    modelSlug: "fifwc-col-prt-2026-06-27",
  },
  {
    id: "K3b", group: "K", home: "DR Congo", away: "Uzbekistan",
    date: "2026-06-27", time: "7:30 PM", timezone: "ET", kickoffUTC: "2026-06-27T23:30:00Z",
    venue: "SoFi Stadium, Los Angeles",
    status: "upcoming", score: null,
    modelSlug: "fifwc-cdr-uzb-2026-06-27",
  },
  {
    id: "J3a", group: "J", home: "Algeria", away: "Austria",
    date: "2026-06-27", time: "10:00 PM", timezone: "ET", kickoffUTC: "2026-06-28T02:00:00Z",
    venue: "Levi's Stadium, San Jose",
    status: "upcoming", score: null,
    modelSlug: "fifwc-alg-aut-2026-06-27",
  },
  {
    id: "J3b", group: "J", home: "Argentina", away: "Jordan",
    date: "2026-06-27", time: "10:00 PM", timezone: "ET", kickoffUTC: "2026-06-28T02:00:00Z",
    venue: "Hard Rock Stadium, Miami",
    status: "upcoming", score: null,
    modelSlug: "fifwc-jor-arg-2026-06-27",
  },
];

// Unique dates in order
export const SCHEDULE_DATES = [...new Set(MATCH_SCHEDULE.map(m => m.date))].sort();

export const TODAY = "2026-06-15";

export const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00');
  const isToday = dateStr === TODAY;
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  const label = d.toLocaleDateString('en-US', opts);
  return isToday ? `${label} — TODAY` : label;
};

// Model scorecard from completed matches with model predictions
export const MODEL_SCORECARD = {
  total: 4,    // Matches we had model predictions for that completed (Jun 14)
  correct: 2,  // Germany win ✅, Sweden win ✅
  wrong: 2,    // Ivory Coast upset ❌, Netherlands draw ❌
  upsets: 1,   // Ivory Coast over Ecuador
  accuracy: 50.0,
};
