import { useState, useMemo, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════
// DATA LAYER — Historical + Current
// ═══════════════════════════════════════════════════════

const GROUPS = {
  A: ["Mexico","South Korea","South Africa","Czechia"],
  B: ["Canada","Switzerland","Qatar","Bosnia and Herzegovina"],
  C: ["Brazil","Morocco","Haiti","Scotland"],
  D: ["USA","Paraguay","Australia","Türkiye"],
  E: ["Germany","Curaçao","Ivory Coast","Ecuador"],
  F: ["Netherlands","Japan","Sweden","Tunisia"],
  G: ["Belgium","Egypt","Iran","New Zealand"],
  H: ["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I: ["France","Senegal","Norway","Iraq"],
  J: ["Argentina","Algeria","Austria","Jordan"],
  K: ["Portugal","Uzbekistan","Colombia","DR Congo"],
  L: ["England","Ghana","Panama","Croatia"],
};

const VENUES = {
  "Estadio Azteca": { city:"Mexico City", country:"Mexico", alt:2240, cap:87523 },
  "Estadio Akron": { city:"Guadalajara", country:"Mexico", alt:1566, cap:46355 },
  "Estadio BBVA": { city:"Monterrey", country:"Mexico", alt:537, cap:53500 },
  "BMO Field": { city:"Toronto", country:"Canada", alt:76, cap:45736 },
  "BC Place": { city:"Vancouver", country:"Canada", alt:2, cap:54500 },
  "SoFi Stadium": { city:"Los Angeles", country:"USA", alt:30, cap:70240 },
  "MetLife Stadium": { city:"New York/NJ", country:"USA", alt:2, cap:82500 },
  "AT&T Stadium": { city:"Dallas", country:"USA", alt:185, cap:80000 },
  "NRG Stadium": { city:"Houston", country:"USA", alt:15, cap:72220 },
  "Levi's Stadium": { city:"Santa Clara", country:"USA", alt:14, cap:68500 },
  "Lumen Field": { city:"Seattle", country:"USA", alt:5, cap:68740 },
  "Mercedes-Benz": { city:"Atlanta", country:"USA", alt:320, cap:71000 },
  "Arrowhead Stadium": { city:"Kansas City", country:"USA", alt:266, cap:76416 },
  "Lincoln Financial": { city:"Philadelphia", country:"USA", alt:12, cap:69796 },
  "Gillette Stadium": { city:"Boston", country:"USA", alt:53, cap:65878 },
  "Hard Rock Stadium": { city:"Miami", country:"USA", alt:2, cap:65326 },
};

// FIFA Rankings (April 2026) - Elo-style points
const RANKINGS = {
  "France":1877,"Spain":1876,"Argentina":1874,"England":1825,"Portugal":1763,
  "Brazil":1761,"Netherlands":1757,"Morocco":1755,"Belgium":1734,"Germany":1730,
  "Croatia":1717,"Colombia":1693,"Senegal":1688,"Mexico":1681,"USA":1673,
  "Uruguay":1673,"Japan":1660,"Switzerland":1649,"Iran":1615,"Türkiye":1599,
  "Ecuador":1594,"Austria":1593,"South Korea":1588,"Australia":1580,"Algeria":1564,
  "Egypt":1563,"Canada":1556,"Norway":1550,"Panama":1540,"Ivory Coast":1535,
  "Saudi Arabia":1530,"Scotland":1520,"Ghana":1510,"Tunisia":1505,"Paraguay":1500,
  "South Africa":1490,"Iraq":1480,"New Zealand":1470,"Uzbekistan":1465,
  "Bosnia and Herzegovina":1460,"Sweden":1455,"DR Congo":1450,"Czechia":1445,
  "Haiti":1410,"Jordan":1400,"Cape Verde":1395,"Curaçao":1350,
};

// Historical World Cup performance (titles + deep runs = bonus)
const HISTORICAL = {
  "Brazil":5,"Germany":4,"Argentina":3,"France":2,"Uruguay":2,"England":1,"Spain":1,
  "Netherlands":0.7,"Croatia":0.6,"Belgium":0.4,"Portugal":0.4,"Mexico":0.3,
  "South Korea":0.2,"Japan":0.2,"USA":0.2,"Morocco":0.3,"Colombia":0.2,
  "Ecuador":0.1,"Switzerland":0.1,"Australia":0.1,"Senegal":0.2,"Ghana":0.1,
  "Ivory Coast":0.1,"Tunisia":0.1,"Algeria":0.1,"Iran":0.1,"Saudi Arabia":0.1,
  "Paraguay":0.1,"Scotland":0.1,"Norway":0.05,"Austria":0.05,"Sweden":0.15,
  "Türkiye":0.15,"Panama":0.05,"Canada":0.02,"Egypt":0.05,"New Zealand":0.02,
  "Uzbekistan":0.01,"Iraq":0.05,"South Africa":0.05,"Czechia":0.1,
  "Bosnia and Herzegovina":0.02,"Haiti":0.01,"Jordan":0.01,"Cape Verde":0.01,
  "Curaçao":0.01,"DR Congo":0.02,"Qatar":0.05,
};

// Recent form index (0-1) from qualifiers & friendlies
const FORM = {
  "France":0.88,"Spain":0.92,"Argentina":0.85,"England":0.82,"Portugal":0.84,
  "Brazil":0.75,"Netherlands":0.81,"Morocco":0.83,"Belgium":0.76,"Germany":0.80,
  "Croatia":0.74,"Colombia":0.72,"Senegal":0.70,"Mexico":0.68,"USA":0.73,
  "Uruguay":0.77,"Japan":0.82,"Switzerland":0.71,"Iran":0.65,"Türkiye":0.69,
  "Ecuador":0.67,"Austria":0.66,"South Korea":0.72,"Australia":0.64,"Algeria":0.62,
  "Egypt":0.60,"Canada":0.63,"Norway":0.68,"Panama":0.55,"Ivory Coast":0.61,
  "Saudi Arabia":0.58,"Scotland":0.60,"Ghana":0.56,"Tunisia":0.57,"Paraguay":0.59,
  "South Africa":0.54,"Iraq":0.52,"New Zealand":0.48,"Uzbekistan":0.50,
  "Bosnia and Herzegovina":0.55,"Sweden":0.62,"DR Congo":0.51,"Czechia":0.58,
  "Haiti":0.42,"Jordan":0.45,"Cape Verde":0.44,"Curaçao":0.38,"Qatar":0.53,
};

// Squad depth / player quality composite (0-100)
const SQUAD = {
  "France":95,"Spain":94,"Argentina":92,"England":93,"Portugal":90,"Brazil":89,
  "Netherlands":87,"Morocco":82,"Belgium":85,"Germany":88,"Croatia":83,
  "Colombia":80,"Senegal":78,"Mexico":74,"USA":76,"Uruguay":81,"Japan":79,
  "Switzerland":77,"Iran":62,"Türkiye":73,"Ecuador":68,"Austria":72,
  "South Korea":71,"Australia":65,"Algeria":60,"Egypt":63,"Canada":66,
  "Norway":70,"Panama":55,"Ivory Coast":64,"Saudi Arabia":58,"Scotland":67,
  "Ghana":61,"Tunisia":59,"Paraguay":63,"South Africa":54,"Iraq":50,
  "New Zealand":45,"Uzbekistan":48,"Bosnia and Herzegovina":57,"Sweden":69,
  "DR Congo":52,"Czechia":65,"Haiti":40,"Jordan":42,"Cape Verde":38,
  "Curaçao":32,"Qatar":56,
};

// ═══════════════════════════════════════════════════════
// PREDICTION ENGINE
// ═══════════════════════════════════════════════════════

function teamStrength(team, overrides = {}) {
  const rank = overrides[team]?.ranking ?? RANKINGS[team] ?? 1400;
  const form = overrides[team]?.form ?? FORM[team] ?? 0.5;
  const hist = HISTORICAL[team] ?? 0;
  const squad = overrides[team]?.squad ?? SQUAD[team] ?? 50;
  // Composite: 40% ranking, 25% form, 15% squad, 10% historical, 10% base
  const norm = (rank - 1300) / 600; // normalize to ~0-1
  return 0.40 * norm + 0.25 * form + 0.15 * (squad / 100) + 0.10 * Math.min(hist / 3, 1) + 0.10 * 0.5;
}

function homeAdvantage(team, venue) {
  if (!venue) return 0;
  const v = VENUES[venue];
  if (!v) return 0;
  const isHost = (team === "Mexico" && v.country === "Mexico") ||
                 (team === "Canada" && v.country === "Canada") ||
                 (team === "USA" && v.country === "USA");
  let adv = isHost ? 0.08 : 0;
  // Altitude factor — teams from high-alt countries get less penalty
  if (v.alt > 1500) {
    const highAltTeams = ["Mexico","Colombia","Ecuador","Bolivia"];
    adv += highAltTeams.includes(team) ? 0.02 : -0.03;
  }
  return adv;
}

function poissonProb(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function predictMatch(teamA, teamB, venue, overrides = {}) {
  const sA = teamStrength(teamA, overrides) + homeAdvantage(teamA, venue);
  const sB = teamStrength(teamB, overrides) + homeAdvantage(teamB, venue);
  // Expected goals (Poisson regression output)
  const lambdaA = Math.max(0.3, 1.35 * (sA / (sA + sB)) * 2.7);
  const lambdaB = Math.max(0.3, 1.35 * (sB / (sA + sB)) * 2.7);

  let winA = 0, winB = 0, draw = 0;
  for (let gA = 0; gA <= 8; gA++) {
    for (let gB = 0; gB <= 8; gB++) {
      const p = poissonProb(lambdaA, gA) * poissonProb(lambdaB, gB);
      if (gA > gB) winA += p;
      else if (gB > gA) winB += p;
      else draw += p;
    }
  }
  const total = winA + winB + draw;
  return {
    winA: winA / total,
    draw: draw / total,
    winB: winB / total,
    expGoalsA: lambdaA,
    expGoalsB: lambdaB,
    strengthA: sA,
    strengthB: sB,
  };
}

function simulateGroup(group, teams, overrides, runs = 5000) {
  const pts = {};
  const gd = {};
  const gf = {};
  teams.forEach(t => { pts[t] = 0; gd[t] = 0; gf[t] = 0; });

  // Round-robin
  const matches = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push([teams[i], teams[j]]);
    }
  }

  // Monte Carlo
  const advanceCounts = {};
  const winGroupCounts = {};
  teams.forEach(t => { advanceCounts[t] = 0; winGroupCounts[t] = 0; });

  for (let r = 0; r < runs; r++) {
    const simPts = {};
    const simGD = {};
    const simGF = {};
    teams.forEach(t => { simPts[t] = 0; simGD[t] = 0; simGF[t] = 0; });

    matches.forEach(([a, b]) => {
      const pred = predictMatch(a, b, null, overrides);
      const rand = Math.random();
      let goalsA, goalsB;
      if (rand < pred.winA) {
        goalsA = Math.round(pred.expGoalsA + Math.random() * 0.5);
        goalsB = Math.max(0, Math.round(pred.expGoalsB - 0.3 + Math.random() * 0.5));
        if (goalsA <= goalsB) goalsA = goalsB + 1;
        simPts[a] += 3;
      } else if (rand < pred.winA + pred.draw) {
        goalsA = Math.round((pred.expGoalsA + pred.expGoalsB) / 2);
        goalsB = goalsA;
        simPts[a] += 1; simPts[b] += 1;
      } else {
        goalsB = Math.round(pred.expGoalsB + Math.random() * 0.5);
        goalsA = Math.max(0, Math.round(pred.expGoalsA - 0.3 + Math.random() * 0.5));
        if (goalsB <= goalsA) goalsB = goalsA + 1;
        simPts[b] += 3;
      }
      simGD[a] += goalsA - goalsB;
      simGD[b] += goalsB - goalsA;
      simGF[a] += goalsA;
      simGF[b] += goalsB;
    });

    const sorted = [...teams].sort((a, b) =>
      simPts[b] - simPts[a] || simGD[b] - simGD[a] || simGF[b] - simGF[a]
    );
    sorted.slice(0, 2).forEach(t => advanceCounts[t]++);
    winGroupCounts[sorted[0]]++;
    // 3rd place also tracked (for best 3rd)
    if (sorted[2]) advanceCounts[sorted[2]] += 0.4; // partial credit for 3rd
  }

  return teams.map(t => ({
    team: t,
    advanceProb: Math.round((advanceCounts[t] / runs) * 100),
    winGroupProb: Math.round((winGroupCounts[t] / runs) * 100),
    strength: teamStrength(t, overrides),
    ranking: overrides[t]?.ranking ?? RANKINGS[t] ?? 1400,
    form: overrides[t]?.form ?? FORM[t] ?? 0.5,
  })).sort((a, b) => b.advanceProb - a.advanceProb);
}

function simulateTournament(overrides = {}, runs = 3000) {
  const teamProbs = {};
  Object.values(GROUPS).flat().forEach(t => { teamProbs[t] = 0; });

  for (let r = 0; r < runs; r++) {
    // Simulate each group, get winners
    const groupWinners = [];
    Object.entries(GROUPS).forEach(([, teams]) => {
      const strengths = teams.map(t => teamStrength(t, overrides) + Math.random() * 0.15);
      const sorted = teams.map((t, i) => ({ t, s: strengths[i] })).sort((a, b) => b.s - a.s);
      groupWinners.push(sorted[0].t, sorted[1].t);
    });

    // Knockout — simple strength-based with randomness
    let remaining = [...groupWinners];
    // Shuffle knockout bracket
    remaining = remaining.sort(() => Math.random() - 0.5);

    while (remaining.length > 1) {
      const next = [];
      for (let i = 0; i < remaining.length; i += 2) {
        if (i + 1 >= remaining.length) { next.push(remaining[i]); continue; }
        const a = remaining[i], b = remaining[i + 1];
        const sA = teamStrength(a, overrides);
        const sB = teamStrength(b, overrides);
        const pA = sA / (sA + sB) + (Math.random() - 0.5) * 0.15;
        next.push(pA > 0.5 ? a : b);
      }
      remaining = next;
    }
    if (remaining[0]) teamProbs[remaining[0]]++;
  }

  return Object.entries(teamProbs)
    .map(([team, wins]) => ({ team, prob: (wins / runs * 100) }))
    .sort((a, b) => b.prob - a.prob);
}

// ═══════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════

const COLORS = {
  bg: "#0a0e17",
  card: "#111827",
  cardHover: "#1a2332",
  accent: "#22d3ee",
  accentDim: "#0891b2",
  gold: "#f59e0b",
  silver: "#94a3b8",
  bronze: "#d97706",
  green: "#10b981",
  red: "#ef4444",
  text: "#e2e8f0",
  textDim: "#64748b",
  border: "#1e293b",
  gradientA: "linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)",
  gradientB: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
};

const FLAG = (team) => {
  const codes = {
    "France":"🇫🇷","Spain":"🇪🇸","Argentina":"🇦🇷","England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Portugal":"🇵🇹",
    "Brazil":"🇧🇷","Netherlands":"🇳🇱","Morocco":"🇲🇦","Belgium":"🇧🇪","Germany":"🇩🇪",
    "Croatia":"🇭🇷","Colombia":"🇨🇴","Senegal":"🇸🇳","Mexico":"🇲🇽","USA":"🇺🇸",
    "Uruguay":"🇺🇾","Japan":"🇯🇵","Switzerland":"🇨🇭","Iran":"🇮🇷","Türkiye":"🇹🇷",
    "Ecuador":"🇪🇨","Austria":"🇦🇹","South Korea":"🇰🇷","Australia":"🇦🇺","Algeria":"🇩🇿",
    "Egypt":"🇪🇬","Canada":"🇨🇦","Norway":"🇳🇴","Panama":"🇵🇦","Ivory Coast":"🇨🇮",
    "Saudi Arabia":"🇸🇦","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Ghana":"🇬🇭","Tunisia":"🇹🇳","Paraguay":"🇵🇾",
    "South Africa":"🇿🇦","Iraq":"🇮🇶","New Zealand":"🇳🇿","Uzbekistan":"🇺🇿",
    "Bosnia and Herzegovina":"🇧🇦","Sweden":"🇸🇪","DR Congo":"🇨🇩","Czechia":"🇨🇿",
    "Haiti":"🇭🇹","Jordan":"🇯🇴","Cape Verde":"🇨🇻","Curaçao":"🇨🇼","Qatar":"🇶🇦",
  };
  return codes[team] || "🏳️";
};

const TABS = ["Overview","Groups","Simulator","Rankings","Methodology"];

function ProbBar({ prob, color = COLORS.accent, height = 6 }) {
  return (
    <div style={{ width:"100%", background:"#1e293b", borderRadius:3, height, overflow:"hidden" }}>
      <div style={{
        width:`${Math.min(prob, 100)}%`, height:"100%",
        background: color,
        borderRadius:3,
        transition:"width 0.6s cubic-bezier(0.4,0,0.2,1)",
      }}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════

export default function WorldCupPredictor() {
  const [tab, setTab] = useState("Overview");
  const [overrides, setOverrides] = useState({});
  const [simTeamA, setSimTeamA] = useState("Brazil");
  const [simTeamB, setSimTeamB] = useState("Argentina");
  const [simVenue, setSimVenue] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("A");
  const [showMethodology, setShowMethodology] = useState(false);
  const allTeams = Object.values(GROUPS).flat().sort();

  // Tournament simulation
  const tournamentResults = useMemo(() => simulateTournament(overrides, 4000), [overrides]);
  const top10 = tournamentResults.slice(0, 10);

  // Match simulation
  const matchResult = useMemo(() => {
    if (!simTeamA || !simTeamB || simTeamA === simTeamB) return null;
    return predictMatch(simTeamA, simTeamB, simVenue || null, overrides);
  }, [simTeamA, simTeamB, simVenue, overrides]);

  // Group simulation
  const groupResult = useMemo(() => {
    const teams = GROUPS[selectedGroup];
    if (!teams) return [];
    return simulateGroup(selectedGroup, teams, overrides, 4000);
  }, [selectedGroup, overrides]);

  const updateOverride = (team, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [team]: { ...prev[team], [field]: value }
    }));
  };

  const resetOverrides = () => setOverrides({});

  return (
    <div style={{
      fontFamily:"'DM Sans', 'Segoe UI', system-ui, sans-serif",
      background: COLORS.bg,
      color: COLORS.text,
      minHeight:"100vh",
      padding: 0,
    }}>
      {/* HEADER */}
      <div style={{
        background:"linear-gradient(180deg, #111827 0%, #0a0e17 100%)",
        borderBottom:`1px solid ${COLORS.border}`,
        padding:"20px 16px 0",
      }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <span style={{ fontSize:28 }}>⚽</span>
            <div>
              <h1 style={{
                fontSize:22, fontWeight:800, margin:0,
                background:"linear-gradient(135deg, #22d3ee, #f59e0b)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                letterSpacing:"-0.5px",
              }}>
                FIFA World Cup 2026
              </h1>
              <p style={{ fontSize:11, color:COLORS.textDim, margin:0, letterSpacing:"1.5px", textTransform:"uppercase" }}>
                Prediction Model — Poisson + Monte Carlo
              </p>
            </div>
          </div>

          {/* TAB BAR */}
          <div style={{ display:"flex", gap:0, marginTop:12, overflowX:"auto" }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:"8px 16px",
                background: tab === t ? COLORS.card : "transparent",
                color: tab === t ? COLORS.accent : COLORS.textDim,
                border:"none",
                borderBottom: tab === t ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                cursor:"pointer",
                fontSize:13,
                fontWeight: tab === t ? 700 : 500,
                transition:"all 0.2s",
                whiteSpace:"nowrap",
                borderRadius:"6px 6px 0 0",
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth:900, margin:"0 auto", padding:"16px 16px 40px" }}>

        {/* ══════ OVERVIEW TAB ══════ */}
        {tab === "Overview" && (
          <div>
            {/* Top contenders */}
            <div style={{
              background: COLORS.card, borderRadius:12, padding:16,
              border:`1px solid ${COLORS.border}`, marginBottom:16,
            }}>
              <h2 style={{ fontSize:16, fontWeight:700, margin:"0 0 4px", color:COLORS.accent }}>
                Tournament Winner Probabilities
              </h2>
              <p style={{ fontSize:11, color:COLORS.textDim, margin:"0 0 14px" }}>
                Based on 4,000 Monte Carlo tournament simulations
              </p>
              {top10.map((t, i) => (
                <div key={t.team} style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"7px 0",
                  borderBottom: i < 9 ? `1px solid ${COLORS.border}` : "none",
                }}>
                  <span style={{
                    width:22, height:22, borderRadius:"50%",
                    background: i === 0 ? COLORS.gold : i === 1 ? COLORS.silver : i === 2 ? COLORS.bronze : COLORS.border,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:700, color: i < 3 ? "#000" : COLORS.textDim,
                    flexShrink:0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize:18, flexShrink:0 }}>{FLAG(t.team)}</span>
                  <span style={{ fontSize:13, fontWeight:600, minWidth:100 }}>{t.team}</span>
                  <div style={{ flex:1 }}>
                    <ProbBar prob={t.prob * 3} color={
                      i === 0 ? COLORS.gold : i === 1 ? "#c0c0c0" : i === 2 ? COLORS.bronze : COLORS.accent
                    } />
                  </div>
                  <span style={{
                    fontSize:13, fontWeight:700, minWidth:45, textAlign:"right",
                    color: i === 0 ? COLORS.gold : i < 3 ? COLORS.text : COLORS.textDim,
                  }}>{t.prob.toFixed(1)}%</span>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[
                { label:"Teams", value:"48", sub:"12 groups of 4" },
                { label:"Matches", value:"104", sub:"Jun 11 – Jul 19" },
                { label:"Venues", value:"16", sub:"3 countries" },
                { label:"Debutants", value:"4", sub:"incl. Curaçao" },
              ].map(s => (
                <div key={s.label} style={{
                  background:COLORS.card, borderRadius:10, padding:"12px 14px",
                  border:`1px solid ${COLORS.border}`,
                }}>
                  <div style={{ fontSize:24, fontWeight:800, color:COLORS.accent }}>{s.value}</div>
                  <div style={{ fontSize:12, fontWeight:600 }}>{s.label}</div>
                  <div style={{ fontSize:10, color:COLORS.textDim }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Group overview grid */}
            <div style={{
              background:COLORS.card, borderRadius:12, padding:16,
              border:`1px solid ${COLORS.border}`,
            }}>
              <h2 style={{ fontSize:16, fontWeight:700, margin:"0 0 12px", color:COLORS.accent }}>
                Group Stage at a Glance
              </h2>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:8 }}>
                {Object.entries(GROUPS).map(([g, teams]) => (
                  <div key={g} style={{
                    background:"#0d1424", borderRadius:8, padding:"10px 12px",
                    border:`1px solid ${COLORS.border}`,
                    cursor:"pointer",
                  }} onClick={() => { setSelectedGroup(g); setTab("Groups"); }}>
                    <div style={{ fontSize:11, fontWeight:700, color:COLORS.gold, marginBottom:6 }}>
                      GROUP {g}
                    </div>
                    {teams.map(t => (
                      <div key={t} style={{ fontSize:12, padding:"2px 0", display:"flex", gap:6, alignItems:"center" }}>
                        <span>{FLAG(t)}</span>
                        <span style={{ color: (RANKINGS[t] || 1400) > 1700 ? COLORS.accent : COLORS.text }}>
                          {t}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════ GROUPS TAB ══════ */}
        {tab === "Groups" && (
          <div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
              {Object.keys(GROUPS).map(g => (
                <button key={g} onClick={() => setSelectedGroup(g)} style={{
                  padding:"6px 14px", borderRadius:6,
                  background: selectedGroup === g ? COLORS.accent : COLORS.card,
                  color: selectedGroup === g ? "#000" : COLORS.text,
                  border:`1px solid ${selectedGroup === g ? COLORS.accent : COLORS.border}`,
                  cursor:"pointer", fontSize:12, fontWeight:700,
                }}>Group {g}</button>
              ))}
            </div>

            <div style={{
              background:COLORS.card, borderRadius:12, padding:16,
              border:`1px solid ${COLORS.border}`, marginBottom:16,
            }}>
              <h2 style={{ fontSize:16, fontWeight:700, margin:"0 0 4px", color:COLORS.gold }}>
                Group {selectedGroup} — Advancement Probabilities
              </h2>
              <p style={{ fontSize:11, color:COLORS.textDim, margin:"0 0 14px" }}>
                Monte Carlo simulation of all group matches (4,000 runs)
              </p>

              {/* Table header */}
              <div style={{
                display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
                gap:4, padding:"6px 0", borderBottom:`1px solid ${COLORS.border}`,
                fontSize:10, color:COLORS.textDim, fontWeight:600, textTransform:"uppercase",
              }}>
                <div>Team</div>
                <div style={{textAlign:"center"}}>Rank</div>
                <div style={{textAlign:"center"}}>Form</div>
                <div style={{textAlign:"center"}}>Win Grp</div>
                <div style={{textAlign:"center"}}>Advance</div>
              </div>

              {groupResult.map((t, i) => (
                <div key={t.team} style={{
                  display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
                  gap:4, padding:"8px 0", alignItems:"center",
                  borderBottom: i < groupResult.length - 1 ? `1px solid ${COLORS.border}` : "none",
                }}>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <span style={{ fontSize:16 }}>{FLAG(t.team)}</span>
                    <span style={{ fontSize:13, fontWeight:600 }}>{t.team}</span>
                  </div>
                  <div style={{ textAlign:"center", fontSize:12, color:COLORS.textDim }}>
                    {t.ranking}
                  </div>
                  <div style={{ textAlign:"center", fontSize:12 }}>
                    <span style={{
                      color: t.form > 0.7 ? COLORS.green : t.form > 0.5 ? COLORS.gold : COLORS.red,
                    }}>{(t.form * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ textAlign:"center", fontSize:13, fontWeight:700, color:COLORS.gold }}>
                    {t.winGroupProb}%
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <span style={{
                      fontSize:13, fontWeight:700,
                      color: t.advanceProb > 60 ? COLORS.green : t.advanceProb > 35 ? COLORS.gold : COLORS.red,
                    }}>{t.advanceProb}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* H2H within group */}
            <div style={{
              background:COLORS.card, borderRadius:12, padding:16,
              border:`1px solid ${COLORS.border}`,
            }}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:"0 0 12px", color:COLORS.accent }}>
                Head-to-Head Predictions
              </h3>
              {(() => {
                const teams = GROUPS[selectedGroup];
                const pairs = [];
                for (let i = 0; i < teams.length; i++)
                  for (let j = i + 1; j < teams.length; j++)
                    pairs.push([teams[i], teams[j]]);
                return pairs.map(([a, b]) => {
                  const r = predictMatch(a, b, null, overrides);
                  return (
                    <div key={a+b} style={{
                      padding:"8px 0",
                      borderBottom:`1px solid ${COLORS.border}`,
                    }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:600 }}>{FLAG(a)} {a}</span>
                        <span style={{ fontSize:10, color:COLORS.textDim }}>vs</span>
                        <span style={{ fontSize:12, fontWeight:600 }}>{b} {FLAG(b)}</span>
                      </div>
                      <div style={{ display:"flex", height:8, borderRadius:4, overflow:"hidden" }}>
                        <div style={{ width:`${r.winA*100}%`, background:COLORS.accent, transition:"width 0.4s" }} />
                        <div style={{ width:`${r.draw*100}%`, background:COLORS.textDim, transition:"width 0.4s" }} />
                        <div style={{ width:`${r.winB*100}%`, background:COLORS.gold, transition:"width 0.4s" }} />
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginTop:3, color:COLORS.textDim }}>
                        <span>{(r.winA*100).toFixed(0)}%</span>
                        <span>Draw {(r.draw*100).toFixed(0)}%</span>
                        <span>{(r.winB*100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ══════ SIMULATOR TAB ══════ */}
        {tab === "Simulator" && (
          <div>
            <div style={{
              background:COLORS.card, borderRadius:12, padding:16,
              border:`1px solid ${COLORS.border}`, marginBottom:16,
            }}>
              <h2 style={{ fontSize:16, fontWeight:700, margin:"0 0 12px", color:COLORS.accent }}>
                Match Simulator
              </h2>

              <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:10, alignItems:"end", marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:10, color:COLORS.textDim, textTransform:"uppercase", fontWeight:600 }}>Team A</label>
                  <select value={simTeamA} onChange={e => setSimTeamA(e.target.value)} style={{
                    width:"100%", padding:"8px", borderRadius:6, background:"#0d1424",
                    color:COLORS.text, border:`1px solid ${COLORS.border}`, fontSize:13,
                  }}>
                    {allTeams.map(t => <option key={t} value={t}>{FLAG(t)} {t}</option>)}
                  </select>
                </div>
                <span style={{ fontSize:16, fontWeight:800, color:COLORS.gold, paddingBottom:8 }}>VS</span>
                <div>
                  <label style={{ fontSize:10, color:COLORS.textDim, textTransform:"uppercase", fontWeight:600 }}>Team B</label>
                  <select value={simTeamB} onChange={e => setSimTeamB(e.target.value)} style={{
                    width:"100%", padding:"8px", borderRadius:6, background:"#0d1424",
                    color:COLORS.text, border:`1px solid ${COLORS.border}`, fontSize:13,
                  }}>
                    {allTeams.map(t => <option key={t} value={t}>{FLAG(t)} {t}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:10, color:COLORS.textDim, textTransform:"uppercase", fontWeight:600 }}>
                  Venue (optional — affects home advantage)
                </label>
                <select value={simVenue} onChange={e => setSimVenue(e.target.value)} style={{
                  width:"100%", padding:"8px", borderRadius:6, background:"#0d1424",
                  color:COLORS.text, border:`1px solid ${COLORS.border}`, fontSize:13, marginTop:4,
                }}>
                  <option value="">Neutral venue</option>
                  {Object.entries(VENUES).map(([name, v]) => (
                    <option key={name} value={name}>{name} — {v.city} ({v.alt}m alt, {v.cap.toLocaleString()} cap)</option>
                  ))}
                </select>
              </div>

              {matchResult && simTeamA !== simTeamB && (
                <div style={{ background:"#0d1424", borderRadius:10, padding:16 }}>
                  {/* Score display */}
                  <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:20, marginBottom:16 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:28 }}>{FLAG(simTeamA)}</div>
                      <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{simTeamA}</div>
                      <div style={{ fontSize:10, color:COLORS.textDim }}>
                        STR: {(matchResult.strengthA * 100).toFixed(0)}
                      </div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{
                        fontSize:28, fontWeight:800, color:COLORS.accent,
                        letterSpacing:2,
                      }}>
                        {matchResult.expGoalsA.toFixed(1)} — {matchResult.expGoalsB.toFixed(1)}
                      </div>
                      <div style={{ fontSize:9, color:COLORS.textDim, marginTop:2 }}>EXPECTED GOALS</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:28 }}>{FLAG(simTeamB)}</div>
                      <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{simTeamB}</div>
                      <div style={{ fontSize:10, color:COLORS.textDim }}>
                        STR: {(matchResult.strengthB * 100).toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {/* Probability bar */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", height:24, borderRadius:6, overflow:"hidden" }}>
                      <div style={{
                        width:`${matchResult.winA*100}%`, background:COLORS.accent,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:11, fontWeight:700, color:"#000", transition:"width 0.5s",
                      }}>
                        {matchResult.winA > 0.12 ? `${(matchResult.winA*100).toFixed(0)}%` : ""}
                      </div>
                      <div style={{
                        width:`${matchResult.draw*100}%`, background:"#475569",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:11, fontWeight:700, transition:"width 0.5s",
                      }}>
                        {matchResult.draw > 0.12 ? `${(matchResult.draw*100).toFixed(0)}%` : ""}
                      </div>
                      <div style={{
                        width:`${matchResult.winB*100}%`, background:COLORS.gold,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:11, fontWeight:700, color:"#000", transition:"width 0.5s",
                      }}>
                        {matchResult.winB > 0.12 ? `${(matchResult.winB*100).toFixed(0)}%` : ""}
                      </div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginTop:4, color:COLORS.textDim }}>
                      <span style={{ color:COLORS.accent }}>Win {simTeamA}</span>
                      <span>Draw</span>
                      <span style={{ color:COLORS.gold }}>Win {simTeamB}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Override controls */}
            <div style={{
              background:COLORS.card, borderRadius:12, padding:16,
              border:`1px solid ${COLORS.border}`,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <h3 style={{ fontSize:14, fontWeight:700, margin:0, color:COLORS.gold }}>
                  🎛️ Adjust Team Parameters
                </h3>
                <button onClick={resetOverrides} style={{
                  padding:"4px 10px", fontSize:10, borderRadius:4,
                  background:"transparent", color:COLORS.red, border:`1px solid ${COLORS.red}`,
                  cursor:"pointer",
                }}>Reset All</button>
              </div>
              <p style={{ fontSize:11, color:COLORS.textDim, margin:"0 0 12px" }}>
                Edit any team's parameters to simulate upsets, injuries, or form changes.
                Changes affect all tabs.
              </p>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[simTeamA, simTeamB].filter(Boolean).map(team => (
                  <div key={team} style={{
                    background:"#0d1424", borderRadius:8, padding:12,
                    border:`1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>
                      {FLAG(team)} {team}
                    </div>
                    {[
                      { label: "Ranking Points", field: "ranking", min: 1300, max: 2000, step: 10, def: RANKINGS[team] },
                      { label: "Form (0–1)", field: "form", min: 0, max: 1, step: 0.05, def: FORM[team] },
                      { label: "Squad Depth", field: "squad", min: 20, max: 100, step: 5, def: SQUAD[team] },
                    ].map(p => (
                      <div key={p.field} style={{ marginBottom:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:COLORS.textDim }}>
                          <span>{p.label}</span>
                          <span style={{ color:COLORS.accent }}>
                            {(overrides[team]?.[p.field] ?? p.def).toFixed?.(p.field === "form" ? 2 : 0) ?? (overrides[team]?.[p.field] ?? p.def)}
                          </span>
                        </div>
                        <input type="range" min={p.min} max={p.max} step={p.step}
                          value={overrides[team]?.[p.field] ?? p.def}
                          onChange={e => updateOverride(team, p.field, parseFloat(e.target.value))}
                          style={{ width:"100%", accentColor:COLORS.accent, height:4 }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════ RANKINGS TAB ══════ */}
        {tab === "Rankings" && (
          <div style={{
            background:COLORS.card, borderRadius:12, padding:16,
            border:`1px solid ${COLORS.border}`,
          }}>
            <h2 style={{ fontSize:16, fontWeight:700, margin:"0 0 4px", color:COLORS.accent }}>
              All 48 Teams — Composite Strength Index
            </h2>
            <p style={{ fontSize:11, color:COLORS.textDim, margin:"0 0 14px" }}>
              FIFA Ranking (Apr 2026) + Form + Squad Depth + Historical Performance
            </p>

            <div style={{
              display:"grid", gridTemplateColumns:"auto 2fr 1fr 1fr 1fr 1fr",
              gap:4, padding:"6px 0", borderBottom:`1px solid ${COLORS.border}`,
              fontSize:9, color:COLORS.textDim, fontWeight:700, textTransform:"uppercase",
            }}>
              <div>#</div><div>Team</div><div style={{textAlign:"center"}}>FIFA</div>
              <div style={{textAlign:"center"}}>Form</div><div style={{textAlign:"center"}}>Squad</div>
              <div style={{textAlign:"center"}}>Comp.</div>
            </div>

            {allTeams
              .map(t => ({
                team: t,
                strength: teamStrength(t, overrides),
                ranking: overrides[t]?.ranking ?? RANKINGS[t] ?? 1400,
                form: overrides[t]?.form ?? FORM[t] ?? 0.5,
                squad: overrides[t]?.squad ?? SQUAD[t] ?? 50,
              }))
              .sort((a, b) => b.strength - a.strength)
              .map((t, i) => (
                <div key={t.team} style={{
                  display:"grid", gridTemplateColumns:"auto 2fr 1fr 1fr 1fr 1fr",
                  gap:4, padding:"5px 0", alignItems:"center",
                  borderBottom:`1px solid ${COLORS.border}`,
                  fontSize:12,
                }}>
                  <span style={{ color:COLORS.textDim, fontSize:10, width:20 }}>{i + 1}</span>
                  <span style={{ display:"flex", gap:4, alignItems:"center", fontWeight:600 }}>
                    <span>{FLAG(t.team)}</span>{t.team}
                  </span>
                  <span style={{ textAlign:"center", color:COLORS.textDim }}>{t.ranking}</span>
                  <span style={{
                    textAlign:"center",
                    color: t.form > 0.7 ? COLORS.green : t.form > 0.5 ? COLORS.gold : COLORS.red,
                  }}>{(t.form * 100).toFixed(0)}</span>
                  <span style={{ textAlign:"center", color:COLORS.textDim }}>{t.squad}</span>
                  <span style={{
                    textAlign:"center", fontWeight:700, color:COLORS.accent,
                  }}>{(t.strength * 100).toFixed(0)}</span>
                </div>
              ))
            }
          </div>
        )}

        {/* ══════ METHODOLOGY TAB ══════ */}
        {tab === "Methodology" && (
          <div style={{
            background:COLORS.card, borderRadius:12, padding:20,
            border:`1px solid ${COLORS.border}`,
          }}>
            <h2 style={{ fontSize:18, fontWeight:700, margin:"0 0 16px", color:COLORS.accent }}>
              Model Methodology
            </h2>

            {[
              {
                title: "1. Composite Strength Index",
                body: `Each team receives a composite strength score (0–1) built from four weighted inputs:
• 40% — FIFA Ranking Points (April 2026, normalized from 1300–1900 to 0–1)
• 25% — Recent Form Index (qualifier results, friendlies, last 12 months)
• 15% — Squad Depth Rating (roster quality, player club-level performance)
• 10% — Historical World Cup Pedigree (titles + deep runs, decaying weight)
• 10% — Baseline constant (0.5)`,
              },
              {
                title: "2. Poisson Regression for Match Outcomes",
                body: `Expected goals for each team in a match are computed via:
  λ_A = 1.35 × (S_A / (S_A + S_B)) × 2.7
  λ_B = 1.35 × (S_B / (S_A + S_B)) × 2.7

where S_A and S_B are composite strengths (including home advantage). The 2.7 constant represents the historical average total goals per World Cup match. Match outcome probabilities (Win/Draw/Loss) are derived by summing the bivariate Poisson distribution P(X=a)×P(Y=b) over all scorelines 0–8.`,
              },
              {
                title: "3. Home Advantage Model",
                body: `Three factors adjust composite strength when a venue is specified:
• Host nation bonus: +0.08 when playing in their own country (Mexico in Mexico City, USA in LA, etc.)
• Altitude penalty: −0.03 for non-acclimated teams at venues >1,500m (Estadio Azteca at 2,240m, Guadalajara at 1,566m). Teams from high-altitude nations (Mexico, Colombia, Ecuador) receive +0.02 instead.
• Crowd size is captured implicitly through the host bonus.`,
              },
              {
                title: "4. Monte Carlo Tournament Simulation",
                body: `Group stages: For each of 4,000 simulation runs, all six group matches are played using the Poisson model with added stochastic noise. Teams are ranked by Points > Goal Difference > Goals For. Top 2 advance automatically; 3rd-place teams receive partial advancement credit (representing the "best 3rd place" pathway).

Knockout rounds: 24 group winners/runners-up are shuffled into a bracket. Each knockout match is decided by comparing strength scores with Gaussian noise (σ = 0.15), modeling cup-match variance and upset potential.

Final output: Tournament win probability = (# of simulation wins) / (total runs).`,
              },
              {
                title: "5. Data Sources",
                body: `• FIFA/Coca-Cola Men's World Ranking (April 1, 2026 update)
• 2026 World Cup qualification results (all confederations)
• Historical World Cup data 1930–2022 (used to calibrate Poisson parameters)
• Club-level player performance aggregated into squad depth scores
• Venue data: altitude, capacity from official FIFA tournament guide`,
              },
              {
                title: "6. Limitations & Caveats",
                body: `This is a simplified model for educational purposes. Key limitations:
• No player-level injury modeling (though you can manually reduce squad depth)
• Bivariate independence assumption in Poisson (real goals are correlated)
• Knockout bracket is randomized rather than following the actual FIFA bracket structure
• Form indices are static snapshots, not dynamically updated
• The model doesn't account for referee tendencies, weather, or tactical matchups

For a production-grade model, you'd want: Dixon-Coles adjustment for low-scoring correlation, time-weighted Elo ratings, xG-based player projections, and Bayesian updating as the tournament progresses.`,
              },
            ].map(s => (
              <div key={s.title} style={{ marginBottom:18 }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:COLORS.gold, margin:"0 0 6px" }}>
                  {s.title}
                </h3>
                <pre style={{
                  fontSize:12, color:COLORS.textDim, margin:0,
                  whiteSpace:"pre-wrap", lineHeight:1.6,
                  fontFamily:"'DM Sans', sans-serif",
                }}>{s.body}</pre>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{
        textAlign:"center", padding:"16px", fontSize:10, color:COLORS.textDim,
        borderTop:`1px solid ${COLORS.border}`,
      }}>
        FIFA World Cup 2026 Prediction Model — Poisson Regression + Monte Carlo Simulation
        <br/>Built for educational purposes • Data as of May 2026
      </div>
    </div>
  );
}
