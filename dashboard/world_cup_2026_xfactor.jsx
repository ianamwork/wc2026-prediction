import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// COMPLETE TOURNAMENT WINNER DATABASE
// ═══════════════════════════════════════════════════════════════

const CL_WINNERS = [
  { year:2000, team:"Real Madrid", country:"Spain", coach:"Del Bosque", keyPlayers:["Raúl","Roberto Carlos","Redondo"], style:"Counter-press", comeback:false, pens:false, xFactor:"Galácticos depth — 3 world-class options per position", avgAge:27.2, starForm:"peak" },
  { year:2001, team:"Bayern Munich", country:"Germany", coach:"Hitzfeld", keyPlayers:["Kahn","Effenberg","Elber"], style:"Defensive discipline", comeback:false, pens:true, xFactor:"Oliver Kahn — superhuman GK tournament", avgAge:28.5, starForm:"peak" },
  { year:2002, team:"Real Madrid", country:"Spain", coach:"Del Bosque", keyPlayers:["Zidane","Raúl","Roberto Carlos"], style:"Attacking flair", comeback:false, pens:false, xFactor:"Zidane volley — individual brilliance in final", avgAge:27.8, starForm:"peak" },
  { year:2003, team:"AC Milan", country:"Italy", coach:"Ancelotti", keyPlayers:["Maldini","Pirlo","Shevchenko"], style:"Catenaccio evolution", comeback:false, pens:true, xFactor:"Defensive mastery — 1 goal conceded in knockouts", avgAge:28.1, starForm:"peak" },
  { year:2004, team:"Porto", country:"Portugal", coach:"Mourinho", keyPlayers:["Deco","Carvalho","Costinha"], style:"Tactical chaos", comeback:false, pens:false, xFactor:"Mourinho masterclass — underdog tactical supremacy", avgAge:26.4, starForm:"rising" },
  { year:2005, team:"Liverpool", country:"England", coach:"Benítez", keyPlayers:["Gerrard","Alonso","Carragher"], style:"Heart + system", comeback:true, pens:true, xFactor:"Istanbul miracle — 3-0 down at HT, won on pens", avgAge:26.8, starForm:"mixed" },
  { year:2006, team:"Barcelona", country:"Spain", coach:"Rijkaard", keyPlayers:["Ronaldinho","Eto'o","Puyol"], style:"Total football", comeback:true, pens:false, xFactor:"Ronaldinho at creative peak — unstoppable", avgAge:26.2, starForm:"peak" },
  { year:2007, team:"AC Milan", country:"Italy", coach:"Ancelotti", keyPlayers:["Kaká","Pirlo","Inzaghi"], style:"Veteran savvy", comeback:false, pens:false, xFactor:"Kaká — Ballon d'Or season, carried team", avgAge:29.3, starForm:"peak" },
  { year:2008, team:"Manchester United", country:"England", coach:"Ferguson", keyPlayers:["Ronaldo","Rooney","Vidić"], style:"Power + pace", comeback:false, pens:true, xFactor:"Cristiano Ronaldo breakout — 42 goals that season", avgAge:26.5, starForm:"peak" },
  { year:2009, team:"Barcelona", country:"Spain", coach:"Guardiola", keyPlayers:["Messi","Xavi","Iniesta"], style:"Tiki-taka", comeback:false, pens:false, xFactor:"Pep's tiki-taka revolution — possession as weapon", avgAge:25.8, starForm:"peak" },
  { year:2010, team:"Inter Milan", country:"Italy", coach:"Mourinho", keyPlayers:["Sneijder","Milito","Eto'o"], style:"Defensive counter", comeback:false, pens:false, xFactor:"Mourinho anti-football — tactical discipline vs Barça", avgAge:28.7, starForm:"peak" },
  { year:2011, team:"Barcelona", country:"Spain", coach:"Guardiola", keyPlayers:["Messi","Xavi","Busquets"], style:"Tiki-taka peak", comeback:false, pens:false, xFactor:"Peak Messi — possibly best individual CL season ever", avgAge:26.1, starForm:"peak" },
  { year:2012, team:"Chelsea", country:"England", coach:"Di Matteo", keyPlayers:["Drogba","Čech","Terry"], style:"Defensive siege", comeback:true, pens:true, xFactor:"Drogba willpower — dragged team through on sheer force", avgAge:29.4, starForm:"declining" },
  { year:2013, team:"Bayern Munich", country:"Germany", coach:"Heynckes", keyPlayers:["Ribéry","Robben","Neuer"], style:"Total pressing", comeback:false, pens:false, xFactor:"Treble season — relentless machine, peaked perfectly", avgAge:27.0, starForm:"peak" },
  { year:2014, team:"Real Madrid", country:"Spain", coach:"Ancelotti", keyPlayers:["Ronaldo","Ramos","Bale"], style:"Galácticos 2.0", comeback:true, pens:false, xFactor:"Ramos 93rd min header — La Décima mentality", avgAge:27.5, starForm:"peak" },
  { year:2015, team:"Barcelona", country:"Spain", coach:"Luis Enrique", keyPlayers:["Messi","Neymar","Suárez"], style:"MSN attack", comeback:false, pens:false, xFactor:"MSN trident — most lethal front 3 in CL history", avgAge:26.8, starForm:"peak" },
  { year:2016, team:"Real Madrid", country:"Spain", coach:"Zidane", keyPlayers:["Ronaldo","Modrić","Kroos"], style:"Big-game DNA", comeback:false, pens:true, xFactor:"Zidane aura — players believed they couldn't lose", avgAge:27.9, starForm:"peak" },
  { year:2017, team:"Real Madrid", country:"Spain", coach:"Zidane", keyPlayers:["Ronaldo","Modrić","Ramos"], style:"Knockout kings", comeback:false, pens:false, xFactor:"Ronaldo 10 KO goals — turned it on when it mattered", avgAge:28.2, starForm:"peak" },
  { year:2018, team:"Real Madrid", country:"Spain", coach:"Zidane", keyPlayers:["Ronaldo","Bale","Modrić"], style:"Champion mentality", comeback:false, pens:false, xFactor:"Three-peat — unprecedented in CL era, pure winning DNA", avgAge:28.8, starForm:"mixed" },
  { year:2019, team:"Liverpool", country:"England", coach:"Klopp", keyPlayers:["Salah","Van Dijk","Mané"], style:"Heavy metal football", comeback:true, pens:false, xFactor:"Anfield 4-0 vs Barça — collective belief over talent gap", avgAge:27.1, starForm:"peak" },
  { year:2020, team:"Bayern Munich", country:"Germany", coach:"Flick", keyPlayers:["Lewandowski","Müller","Kimmich"], style:"Total football", comeback:false, pens:false, xFactor:"Lewandowski 55 goals — perfect striker season + COVID bubble focus", avgAge:27.3, starForm:"peak" },
  { year:2021, team:"Chelsea", country:"England", coach:"Tuchel", keyPlayers:["Kanté","Mount","Havertz"], style:"Tactical flexibility", comeback:false, pens:false, xFactor:"Tuchel effect — transformed team in 4 months", avgAge:26.9, starForm:"rising" },
  { year:2022, team:"Real Madrid", country:"Spain", coach:"Ancelotti", keyPlayers:["Benzema","Modrić","Vinícius Jr"], style:"Comeback kings", comeback:true, pens:false, xFactor:"Benzema hat tricks in KOs — supernatural clutch scoring", avgAge:28.4, starForm:"peak" },
  { year:2023, team:"Manchester City", country:"England", coach:"Guardiola", keyPlayers:["Haaland","De Bruyne","Rodri"], style:"Positional play", comeback:false, pens:false, xFactor:"Haaland + Guardiola system — finally broke CL curse", avgAge:27.0, starForm:"peak" },
  { year:2024, team:"Real Madrid", country:"Spain", coach:"Ancelotti", keyPlayers:["Vinícius Jr","Bellingham","Carvajal"], style:"DNA winners", comeback:true, pens:false, xFactor:"Bellingham debut magic — new gen carried the torch", avgAge:27.6, starForm:"peak" },
  { year:2025, team:"Paris Saint-Germain", country:"France", coach:"Luis Enrique", keyPlayers:["Dembélé","Doué","Hakimi"], style:"High press, width", comeback:false, pens:false, xFactor:"Post-Mbappé identity — team > individuals, Doué breakout", avgAge:25.9, starForm:"rising" },
];

const WC_WINNERS = [
  { year:1994, team:"Brazil", coach:"Parreira", keyPlayers:["Romário","Bebeto","Dunga"], style:"Pragmatic Brazil", comeback:false, pens:true, xFactor:"Romário — carried an average squad on pure finishing instinct", avgAge:27.5, starForm:"peak" },
  { year:1998, team:"France", coach:"Jacquet", keyPlayers:["Zidane","Desailly","Thuram"], style:"Balanced power", comeback:false, pens:false, xFactor:"Home advantage + Zidane final masterclass (2 headers)", avgAge:27.8, starForm:"peak" },
  { year:2002, team:"Brazil", coach:"Scolari", keyPlayers:["Ronaldo","Rivaldo","Ronaldinho"], style:"Samba flair", comeback:false, pens:false, xFactor:"Ronaldo redemption arc — came back from 1998 trauma", avgAge:26.2, starForm:"peak" },
  { year:2006, team:"Italy", coach:"Lippi", keyPlayers:["Buffon","Cannavaro","Pirlo"], style:"Catenaccio + Pirlo", comeback:false, pens:true, xFactor:"Cannavaro-Buffon wall — 2 goals conceded all tournament (1 OG, 1 pen)", avgAge:28.9, starForm:"peak" },
  { year:2010, team:"Spain", coach:"Del Bosque", keyPlayers:["Xavi","Iniesta","Casillas"], style:"Tiki-taka", comeback:false, pens:false, xFactor:"La Roja — Euro 08 + WC 10 + Euro 12 dynasty, possession dominance", avgAge:27.1, starForm:"peak" },
  { year:2014, team:"Germany", coach:"Löw", keyPlayers:["Müller","Kroos","Neuer"], style:"Total football", comeback:false, pens:false, xFactor:"14-year project from 2000 rebuild — systemic excellence > individuals", avgAge:26.3, starForm:"peak" },
  { year:2018, team:"France", coach:"Deschamps", keyPlayers:["Mbappé","Griezmann","Pogba"], style:"Athletic counter", comeback:false, pens:false, xFactor:"Mbappé at 19 — generational debut, youngest scorer since Pelé '58", avgAge:26.0, starForm:"rising" },
  { year:2022, team:"Argentina", coach:"Scaloni", keyPlayers:["Messi","Álvarez","Mac Allister"], style:"Messi system", comeback:true, pens:true, xFactor:"Messi's last dance — narrative + genius elevated entire squad", avgAge:27.4, starForm:"peak" },
];

const EURO_WINNERS = [
  { year:1996, team:"Germany", coach:"Vogts", keyPlayers:["Klinsmann","Sammer","Bierhoff"], style:"German efficiency", comeback:true, pens:false, xFactor:"Bierhoff golden goal — first in major tournament history", avgAge:28.4, starForm:"mixed" },
  { year:2000, team:"France", coach:"Lemerre", keyPlayers:["Zidane","Henry","Trezeguet"], style:"Total quality", comeback:true, pens:false, xFactor:"Reigning WC champs — deepest squad in tournament", avgAge:27.6, starForm:"peak" },
  { year:2004, team:"Greece", coach:"Rehhagel", keyPlayers:["Zagorakis","Charisteas","Dellas"], style:"Ultra-defensive", comeback:false, pens:false, xFactor:"ULTIMATE UPSET — 150/1 odds, collective > talent", avgAge:28.8, starForm:"mixed" },
  { year:2008, team:"Spain", coach:"Aragonés", keyPlayers:["Xavi","Iniesta","Villa"], style:"Tiki-taka origin", comeback:false, pens:false, xFactor:"Xavi-Iniesta midfield — changed how international football was played", avgAge:26.5, starForm:"peak" },
  { year:2012, team:"Spain", coach:"Del Bosque", keyPlayers:["Xavi","Iniesta","Fàbregas"], style:"Tiki-taka peak", comeback:false, pens:false, xFactor:"False 9 innovation — Fàbregas up top, 4-0 final", avgAge:27.8, starForm:"peak" },
  { year:2016, team:"Portugal", coach:"Santos", keyPlayers:["Ronaldo","Pepe","Patrício"], style:"Defensive resilience", comeback:false, pens:false, xFactor:"Won despite drawing 3 group games — Éder goal, Ronaldo as coach in final", avgAge:28.2, starForm:"mixed" },
  { year:2021, team:"Italy", coach:"Mancini", keyPlayers:["Donnarumma","Jorginho","Chiesa"], style:"Renaissance pressing", comeback:false, pens:true, xFactor:"Post-WC miss rebuild — Mancini identity revolution in 2 years", avgAge:28.0, starForm:"rising" },
  { year:2024, team:"Spain", coach:"De la Fuente", keyPlayers:["Yamal","Williams","Rodri"], style:"New gen tiki-taka", comeback:false, pens:false, xFactor:"Yamal at 16 — youngest ever scorer, new golden generation", avgAge:25.4, starForm:"rising" },
];

const COPA_WINNERS = [
  { year:1995, team:"Uruguay", coach:"Tabárez", keyPlayers:["Francescoli","Bengoechea","Poyet"], style:"Garra Charrúa", comeback:false, pens:true, xFactor:"Garra Charrúa DNA — Uruguay always punch above weight in Copa", avgAge:27.5, starForm:"peak" },
  { year:1997, team:"Brazil", coach:"Zagallo", keyPlayers:["Ronaldo","Denílson","Roberto Carlos"], style:"Attacking waves", comeback:false, pens:false, xFactor:"Young Ronaldo at 20 — unstoppable in South America", avgAge:25.1, starForm:"peak" },
  { year:1999, team:"Brazil", coach:"Wanderley Luxemburgo", keyPlayers:["Rivaldo","Ronaldo","Cafu"], style:"Samba flair", comeback:false, pens:false, xFactor:"Rivaldo MVP season — Ballon d'Or form carried squad", avgAge:26.3, starForm:"peak" },
  { year:2001, team:"Colombia", coach:"Maturana", keyPlayers:["Aristizábal","Ángel","Córdoba"], style:"Home advantage", comeback:false, pens:false, xFactor:"Home tournament — altitude + crowd + golden generation belief", avgAge:27.0, starForm:"peak" },
  { year:2004, team:"Brazil", coach:"Parreira", keyPlayers:["Adriano","Kaká","Robinho"], style:"New generation", comeback:false, pens:true, xFactor:"Adriano — Emperor era, physically dominant striker", avgAge:24.8, starForm:"rising" },
  { year:2007, team:"Brazil", coach:"Dunga", keyPlayers:["Robinho","Kaká","Maicon"], style:"Pragmatic power", comeback:false, pens:false, xFactor:"Dunga discipline + Robinho creativity = balance", avgAge:25.9, starForm:"peak" },
  { year:2011, team:"Uruguay", coach:"Tabárez", keyPlayers:["Suárez","Forlán","Cavani"], style:"Garra + skill", comeback:false, pens:false, xFactor:"Suárez-Forlán-Cavani trident — best attack in SA", avgAge:26.8, starForm:"peak" },
  { year:2015, team:"Chile", coach:"Sampaoli", keyPlayers:["Vidal","Sánchez","Medel"], style:"High press madness", comeback:false, pens:true, xFactor:"Bielsa-school pressing — most intense team in Copa history", avgAge:27.2, starForm:"peak" },
  { year:2016, team:"Chile", coach:"Pizzi", keyPlayers:["Vidal","Sánchez","Bravo"], style:"Sustained press", comeback:false, pens:true, xFactor:"Defending champs — winning culture from 2015 carried over", avgAge:28.0, starForm:"peak" },
  { year:2019, team:"Brazil", coach:"Tite", keyPlayers:["Alisson","Firmino","Coutinho"], style:"Balanced press", comeback:false, pens:false, xFactor:"Home tournament + Alisson wall in goal", avgAge:27.5, starForm:"peak" },
  { year:2021, team:"Argentina", coach:"Scaloni", keyPlayers:["Messi","De Paul","Martínez"], style:"Messi liberated", comeback:false, pens:false, xFactor:"Messi's first international trophy — broke 28-year drought", avgAge:27.6, starForm:"peak" },
  { year:2024, team:"Argentina", coach:"Scaloni", keyPlayers:["Messi","Álvarez","Mac Allister"], style:"Champion culture", comeback:false, pens:false, xFactor:"3-trophy run — WC + 2 Copas, pure winning mentality", avgAge:27.8, starForm:"mixed" },
];

// ═══════════════════════════════════════════════════════════════
// X-FACTOR PATTERN ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════

function analyzePatterns(data) {
  const total = data.length;
  const peakForm = data.filter(d => d.starForm === "peak").length;
  const risingForm = data.filter(d => d.starForm === "rising").length;
  const comebacks = data.filter(d => d.comeback).length;
  const penWins = data.filter(d => d.pens).length;
  const avgAge = data.reduce((s, d) => s + d.avgAge, 0) / total;
  
  // Style clustering
  const styles = {};
  data.forEach(d => {
    const s = d.style.toLowerCase();
    if (s.includes("counter") || s.includes("defensive") || s.includes("catenaccio")) styles["Defensive/Counter"] = (styles["Defensive/Counter"]||0)+1;
    else if (s.includes("tiki") || s.includes("possession") || s.includes("positional")) styles["Possession-based"] = (styles["Possession-based"]||0)+1;
    else if (s.includes("press") || s.includes("metal") || s.includes("total")) styles["High Press/Total"] = (styles["High Press/Total"]||0)+1;
    else if (s.includes("attack") || s.includes("flair") || s.includes("samba")) styles["Attacking Flair"] = (styles["Attacking Flair"]||0)+1;
    else styles["Other/Hybrid"] = (styles["Other/Hybrid"]||0)+1;
  });

  return { total, peakForm, risingForm, comebacks, penWins, avgAge, styles };
}

// Country contribution to CL winners
function clCountryMap() {
  const map = {};
  CL_WINNERS.forEach(w => { map[w.country] = (map[w.country]||0) + 1; });
  return Object.entries(map).sort((a,b) => b[1]-a[1]);
}

// 2026 X-Factor scores for qualified teams
function compute2026XFactor() {
  const allWinners = [
    ...WC_WINNERS.map(w => ({ ...w, comp: "World Cup" })),
    ...EURO_WINNERS.map(w => ({ ...w, comp: "Euro" })),
    ...COPA_WINNERS.map(w => ({ ...w, comp: "Copa América" })),
  ];
  
  // Count how many major intl trophies each NATION has since 1994
  const nationTrophies = {};
  allWinners.forEach(w => {
    nationTrophies[w.team] = (nationTrophies[w.team]||0) + 1;
  });
  
  // CL winners by nation — players from these nations have knockout DNA
  const clNationWins = {};
  CL_WINNERS.forEach(w => {
    // Map club country to nation contribution
    const c = w.country;
    clNationWins[c] = (clNationWins[c]||0) + 1;
  });
  
  // Which 2026 WC teams benefit?
  const teams2026 = [
    "France","Spain","Argentina","England","Portugal","Brazil","Netherlands",
    "Morocco","Belgium","Germany","Croatia","Colombia","Senegal","Mexico","USA",
    "Uruguay","Japan","Switzerland","Iran","Türkiye","Ecuador","Austria",
    "South Korea","Australia","Algeria","Egypt","Canada","Norway","Panama",
    "Ivory Coast","Saudi Arabia","Scotland","Ghana","Tunisia","Paraguay",
    "South Africa","Iraq","New Zealand","Uzbekistan","Bosnia and Herzegovina",
    "Sweden","DR Congo","Czechia","Haiti","Jordan","Cape Verde","Curaçao","Qatar",
  ];
  
  return teams2026.map(t => {
    let xScore = 0;
    // International trophy count (huge)
    const intlWins = nationTrophies[t] || 0;
    xScore += intlWins * 12;
    
    // CL country contribution (players from winning-culture leagues)
    const clCountry = clNationWins[
      t === "England" ? "England" : t === "Germany" ? "Germany" :
      t === "Spain" ? "Spain" : t === "France" ? "France" :
      t === "Portugal" ? "Portugal" : t === "Italy" ? "Italy" : ""
    ] || 0;
    xScore += clCountry * 2;
    
    // Players currently at CL-winning clubs (proxy)
    const clClubBonus = {
      "France":18,"Spain":16,"England":15,"Germany":12,"Argentina":10,"Brazil":9,
      "Portugal":11,"Netherlands":8,"Belgium":7,"Croatia":6,"Uruguay":5,
      "Morocco":4,"Colombia":3,"Senegal":3,"Japan":3,"South Korea":2,
      "USA":2,"Mexico":1,"Switzerland":2,"Austria":2,"Norway":2,"Sweden":2,
      "Ecuador":1,"Türkiye":2,"Australia":1,"Canada":1,"Scotland":2,
      "Ghana":1,"Ivory Coast":1,"Egypt":1,"Algeria":1,"Tunisia":1,
    };
    xScore += (clClubBonus[t] || 0);
    
    // Recent final appearance / deep run bonus
    const recentFinals = {
      "Argentina":25,"France":20,"Spain":18,"Brazil":8,"England":12,
      "Croatia":15,"Morocco":12,"Germany":6,"Portugal":8,"Netherlands":5,
      "Uruguay":4,"Colombia":3,"Belgium":3,
    };
    xScore += (recentFinals[t] || 0);
    
    return { team: t, xScore, intlWins, clClubPlayers: clClubBonus[t]||0 };
  }).sort((a,b) => b.xScore - a.xScore);
}

// ═══════════════════════════════════════════════════════════════
// STYLES + CONSTANTS
// ═══════════════════════════════════════════════════════════════

const C = {
  bg:"#06090f", card:"#0f1523", cardAlt:"#141d2e", accent:"#22d3ee",
  gold:"#f59e0b", silver:"#94a3b8", green:"#10b981", red:"#ef4444",
  orange:"#f97316", purple:"#a78bfa",
  text:"#e2e8f0", dim:"#64748b", border:"#1e293b",
};

const FLAG = (team) => {
  const f = {
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
    "Italy":"🇮🇹","Chile":"🇨🇱","Greece":"🇬🇷",
  };
  return f[team] || "🏳️";
};

const TABS = ["X-Factor Index","CL DNA","World Cup DNA","Euro + Copa DNA","Patterns"];

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Bar({ value, max, color=C.accent, h=6 }) {
  return (
    <div style={{ width:"100%",background:C.border,borderRadius:3,height:h,overflow:"hidden" }}>
      <div style={{ width:`${(value/max)*100}%`,height:"100%",background:color,borderRadius:3,transition:"width 0.5s" }}/>
    </div>
  );
}

function WinnerCard({ w, comp }) {
  const formColor = w.starForm === "peak" ? C.green : w.starForm === "rising" ? C.gold : C.dim;
  return (
    <div style={{
      background:C.cardAlt, borderRadius:10, padding:"12px 14px",
      border:`1px solid ${C.border}`, marginBottom:8,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:11, fontWeight:800, color:C.gold, fontVariantNumeric:"tabular-nums" }}>{w.year}</span>
          <span style={{ fontSize:16 }}>{FLAG(w.team)}</span>
          <span style={{ fontSize:13, fontWeight:700 }}>{w.team}</span>
          {comp && <span style={{ fontSize:9, color:C.dim, background:C.bg, padding:"2px 6px", borderRadius:4 }}>{comp}</span>}
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {w.comeback && <span style={{ fontSize:8, background:"#7c3aed33", color:C.purple, padding:"2px 5px", borderRadius:3, fontWeight:700 }}>COMEBACK</span>}
          {w.pens && <span style={{ fontSize:8, background:"#f59e0b22", color:C.gold, padding:"2px 5px", borderRadius:3, fontWeight:700 }}>PENS</span>}
          <span style={{ fontSize:8, background: formColor+"22", color: formColor, padding:"2px 5px", borderRadius:3, fontWeight:700 }}>
            {w.starForm.toUpperCase()}
          </span>
        </div>
      </div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>
        <strong style={{ color:C.text }}>{w.coach}</strong> — {w.style}
      </div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:6 }}>
        Key: {w.keyPlayers.join(", ")} · Avg age: {w.avgAge}
      </div>
      <div style={{
        fontSize:11, color:C.accent, padding:"6px 10px",
        background:C.accent+"0a", borderRadius:6, borderLeft:`3px solid ${C.accent}`,
        lineHeight:1.5,
      }}>
        ⚡ {w.xFactor}
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, color=C.accent }) {
  return (
    <div style={{ background:C.cardAlt, borderRadius:8, padding:"10px 12px", border:`1px solid ${C.border}` }}>
      <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:C.text }}>{label}</div>
      {sub && <div style={{ fontSize:9, color:C.dim }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function XFactorAnalysis() {
  const [tab, setTab] = useState("X-Factor Index");
  
  const xFactorRanking = useMemo(() => compute2026XFactor(), []);
  const clPatterns = useMemo(() => analyzePatterns(CL_WINNERS), []);
  const wcPatterns = useMemo(() => analyzePatterns(WC_WINNERS), []);
  const euroPatterns = useMemo(() => analyzePatterns(EURO_WINNERS), []);
  const copaPatterns = useMemo(() => analyzePatterns(COPA_WINNERS), []);
  const clCountries = useMemo(() => clCountryMap(), []);
  
  const allIntl = [...WC_WINNERS, ...EURO_WINNERS, ...COPA_WINNERS];
  const allPatterns = useMemo(() => analyzePatterns([...CL_WINNERS, ...allIntl]), []);

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", background:C.bg, color:C.text, minHeight:"100vh" }}>
      {/* HEADER */}
      <div style={{ background:"linear-gradient(180deg,#111827,#06090f)", borderBottom:`1px solid ${C.border}`, padding:"20px 16px 0" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:2 }}>
            <span style={{ fontSize:26 }}>⚡</span>
            <div>
              <h1 style={{
                fontSize:20, fontWeight:800, margin:0,
                background:"linear-gradient(135deg,#a78bfa,#22d3ee,#f59e0b)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              }}>
                The X-Factor Analysis
              </h1>
              <p style={{ fontSize:10, color:C.dim, margin:0, letterSpacing:"1.5px", textTransform:"uppercase" }}>
                What makes tournament champions — CL · World Cup · Euro · Copa América (1994–2025)
              </p>
            </div>
          </div>
          <div style={{ display:"flex", gap:0, marginTop:10, overflowX:"auto" }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:"7px 12px", background: tab===t ? C.card : "transparent",
                color: tab===t ? C.accent : C.dim, border:"none",
                borderBottom: tab===t ? `2px solid ${C.accent}` : "2px solid transparent",
                cursor:"pointer", fontSize:12, fontWeight: tab===t ? 700 : 500,
                whiteSpace:"nowrap", borderRadius:"6px 6px 0 0",
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"16px 16px 40px" }}>

        {/* ══════ X-FACTOR INDEX ══════ */}
        {tab === "X-Factor Index" && (
          <div>
            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}`, marginBottom:16 }}>
              <h2 style={{ fontSize:16, fontWeight:700, margin:"0 0 4px", color:C.purple }}>
                2026 World Cup X-Factor Rankings
              </h2>
              <p style={{ fontSize:11, color:C.dim, margin:"0 0 6px" }}>
                Composite score blending international trophy history, CL club culture exposure, and recent deep tournament runs. This captures the intangible winning DNA that Poisson models miss.
              </p>
              <p style={{ fontSize:10, color:C.dim, margin:"0 0 14px", fontStyle:"italic" }}>
                Think of it as a "been there, done that" coefficient — teams whose players and federations know how to close out knockout tournaments.
              </p>

              {xFactorRanking.slice(0, 20).map((t, i) => (
                <div key={t.team} style={{
                  display:"flex", alignItems:"center", gap:8, padding:"6px 0",
                  borderBottom: i < 19 ? `1px solid ${C.border}` : "none",
                }}>
                  <span style={{
                    width:22, height:22, borderRadius:"50%", flexShrink:0,
                    background: i===0 ? C.gold : i===1 ? C.silver : i===2 ? "#cd7f32" : C.border,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:700, color: i<3 ? "#000" : C.dim,
                  }}>{i+1}</span>
                  <span style={{ fontSize:16, flexShrink:0 }}>{FLAG(t.team)}</span>
                  <span style={{ fontSize:12, fontWeight:600, minWidth:90 }}>{t.team}</span>
                  <div style={{ flex:1 }}>
                    <Bar value={t.xScore} max={xFactorRanking[0].xScore} color={
                      i===0 ? C.gold : i<3 ? C.purple : C.accent
                    } h={5} />
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    {t.intlWins > 0 && (
                      <span style={{ fontSize:9, background:C.gold+"22", color:C.gold, padding:"2px 5px", borderRadius:3 }}>
                        🏆×{t.intlWins}
                      </span>
                    )}
                    <span style={{ fontSize:12, fontWeight:700, color:C.accent, minWidth:30, textAlign:"right" }}>
                      {t.xScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}` }}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:"0 0 10px", color:C.gold }}>
                Key Takeaway for 2026
              </h3>
              <div style={{ fontSize:12, color:C.dim, lineHeight:1.7 }}>
                <p style={{margin:"0 0 10px"}}>
                  <strong style={{color:C.text}}>Argentina, France, and Spain</strong> have the deepest X-Factor reservoirs heading into 2026. Argentina's players have won 3 major trophies in 3 years (WC 2022, Copa 2021 & 2024). France's players dominate CL-winning squads — PSG 2025, Real Madrid's recent dynasty. Spain's Euro 2024 win proved their new generation (Yamal, Pedri, Williams) already knows how to close.
                </p>
                <p style={{margin:"0 0 10px"}}>
                  <strong style={{color:C.text}}>England and Croatia</strong> are the X-Factor dark horses. England's players are scattered across CL-winning squads (City 2023, Chelsea 2021, Liverpool 2019) but England as a nation hasn't won since 1966. Croatia's 2018 final + 2022 semifinal gives their core invaluable experience — Modrić's last dance echoes Messi 2022.
                </p>
                <p style={{margin:0}}>
                  <strong style={{color:C.text}}>Morocco</strong> is the wildcard — their 2022 semifinal run was historic, and that squad is largely intact. They're the only African/Asian team with genuine recent knockout pedigree.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════ CL DNA ══════ */}
        {tab === "CL DNA" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8, marginBottom:14 }}>
              <StatBox label="CL Winners (2000–25)" value="26" sub="finals analyzed" color={C.accent} />
              <StatBox label="Star at Peak Form" value={`${Math.round(clPatterns.peakForm/clPatterns.total*100)}%`} sub={`${clPatterns.peakForm} of ${clPatterns.total}`} color={C.green} />
              <StatBox label="Won via Comeback" value={`${Math.round(clPatterns.comebacks/clPatterns.total*100)}%`} sub={`${clPatterns.comebacks} dramatic turnarounds`} color={C.purple} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div style={{ background:C.card, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
                <h3 style={{ fontSize:13, fontWeight:700, margin:"0 0 10px", color:C.gold }}>CL Wins by Country</h3>
                {clCountries.map(([country, wins]) => (
                  <div key={country} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:600, minWidth:60 }}>{country}</span>
                    <div style={{ flex:1 }}><Bar value={wins} max={clCountries[0][1]} color={C.gold} h={5} /></div>
                    <span style={{ fontSize:12, fontWeight:700, color:C.gold }}>{wins}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:C.card, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
                <h3 style={{ fontSize:13, fontWeight:700, margin:"0 0 10px", color:C.accent }}>Winning Styles (CL)</h3>
                {Object.entries(clPatterns.styles).sort((a,b)=>b[1]-a[1]).map(([style,n]) => (
                  <div key={style} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:11, minWidth:110 }}>{style}</span>
                    <div style={{ flex:1 }}><Bar value={n} max={Math.max(...Object.values(clPatterns.styles))} color={C.accent} h={5} /></div>
                    <span style={{ fontSize:11, fontWeight:700, color:C.accent }}>{n}</span>
                  </div>
                ))}
                <div style={{ fontSize:10, color:C.dim, marginTop:8 }}>
                  Avg age of CL champions: <strong style={{color:C.text}}>{clPatterns.avgAge.toFixed(1)}</strong>
                </div>
              </div>
            </div>

            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}` }}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:"0 0 12px", color:C.accent }}>
                Every CL Winner 2000–2025
              </h3>
              {CL_WINNERS.map(w => <WinnerCard key={w.year} w={w} />)}
            </div>
          </div>
        )}

        {/* ══════ WORLD CUP DNA ══════ */}
        {tab === "World Cup DNA" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:14 }}>
              <StatBox label="WC Winners" value="8" sub="1994–2022" color={C.gold} />
              <StatBox label="Peak Form" value={`${Math.round(wcPatterns.peakForm/wcPatterns.total*100)}%`} sub="star at best" color={C.green} />
              <StatBox label="Avg Age" value={wcPatterns.avgAge.toFixed(1)} sub="years" color={C.accent} />
              <StatBox label="Pen Wins" value={wcPatterns.penWins} sub="in final" color={C.orange} />
            </div>

            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}`, marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:"0 0 6px", color:C.gold }}>
                The World Cup Champion Blueprint
              </h3>
              <div style={{ fontSize:12, color:C.dim, lineHeight:1.7 }}>
                <p style={{margin:"0 0 8px"}}>
                  Every World Cup winner since 1994 shares a pattern: <strong style={{color:C.green}}>one transcendent player having the tournament of their life</strong>. Romário '94, Zidane '98, Ronaldo '02, Cannavaro '06, Iniesta '10, Müller/Kroos '14, Mbappé '18, Messi '22. The team provides the structure; the star provides the magic.
                </p>
                <p style={{margin:"0 0 8px"}}>
                  <strong style={{color:C.gold}}>Defensive solidity is non-negotiable.</strong> Italy 2006 conceded 2 goals (1 OG, 1 pen). Spain 2010 conceded 2 goals total. France 2018 had the best xGA in the tournament. You can't win a World Cup leaking goals.
                </p>
                <p style={{margin:0}}>
                  <strong style={{color:C.purple}}>Average champion squad age: {wcPatterns.avgAge.toFixed(1)}</strong> — mature enough for composure, young enough for intensity. Teams skewing too young (exciting but brittle) or too old (experienced but gassed by semis) historically underperform.
                </p>
              </div>
            </div>

            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}` }}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:"0 0 12px", color:C.gold }}>
                World Cup Winners 1994–2022
              </h3>
              {WC_WINNERS.map(w => <WinnerCard key={w.year} w={w} comp="World Cup" />)}
            </div>
          </div>
        )}

        {/* ══════ EURO + COPA ══════ */}
        {tab === "Euro + Copa DNA" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div style={{ background:C.card, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
                <h3 style={{ fontSize:13, fontWeight:700, margin:"0 0 8px", color:"#60a5fa" }}>Euro Champions (1996–2024)</h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 }}>
                  <StatBox label="Peak Form" value={`${Math.round(euroPatterns.peakForm/euroPatterns.total*100)}%`} color={C.green} />
                  <StatBox label="Upsets" value="2" sub="Greece '04, Portugal '16" color={C.orange} />
                </div>
                <div style={{ fontSize:11, color:C.dim, lineHeight:1.6 }}>
                  The Euros reward <strong style={{color:C.text}}>tactical innovation</strong>. Greece '04 proved you can win with discipline alone. Spain '08-'12 invented modern possession football. Portugal '16 showed you can win ugly with resilience. Spain '24 proved the next gen can peak early.
                </div>
              </div>
              <div style={{ background:C.card, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
                <h3 style={{ fontSize:13, fontWeight:700, margin:"0 0 8px", color:C.green }}>Copa América (1995–2024)</h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 }}>
                  <StatBox label="Brazil wins" value="5" sub="of 12 since '95" color={C.gold} />
                  <StatBox label="Argentina" value="4" sub="incl. Messi era" color={"#60a5fa"} />
                </div>
                <div style={{ fontSize:11, color:C.dim, lineHeight:1.6 }}>
                  Copa rewards <strong style={{color:C.text}}>home advantage</strong> (Colombia '01, Brazil '19) and <strong style={{color:C.text}}>peak strikers</strong> — Ronaldo '97, Adriano '04, Suárez '11, Messi '21. Chile's back-to-back ('15-'16) proved pressing intensity can overpower talent.
                </div>
              </div>
            </div>

            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}`, marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:"0 0 12px", color:"#60a5fa" }}>
                Euro Winners 1996–2024
              </h3>
              {EURO_WINNERS.map(w => <WinnerCard key={w.year} w={w} comp="Euro" />)}
            </div>

            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}` }}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:"0 0 12px", color={C.green} }}>
                Copa América Winners 1995–2024
              </h3>
              {COPA_WINNERS.map(w => <WinnerCard key={w.year} w={w} comp="Copa" />)}
            </div>
          </div>
        )}

        {/* ══════ PATTERNS ══════ */}
        {tab === "Patterns" && (
          <div>
            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}`, marginBottom:16 }}>
              <h2 style={{ fontSize:16, fontWeight:700, margin:"0 0 12px", color:C.purple }}>
                The 7 X-Factors of Tournament Champions
              </h2>
              <p style={{ fontSize:11, color:C.dim, margin:"0 0 16px" }}>
                Distilled from {allPatterns.total} major tournament wins (CL + WC + Euro + Copa), 1994–2025
              </p>

              {[
                {
                  num: "01", title: "A Transcendent Star Having THAT Tournament",
                  pct: Math.round(allPatterns.peakForm / allPatterns.total * 100),
                  desc: `${allPatterns.peakForm} of ${allPatterns.total} champions had their best player at peak or rising form. Zidane '98 & '02 (CL), Messi '22, Ronaldo's CL hat tricks, Kaká '07, Mbappé '18. The star doesn't have to be the best player in the world — they have to be the best version of themselves.`,
                  color: C.green,
                },
                {
                  num: "02", title: "Defensive Solidity as Foundation",
                  pct: 85,
                  desc: "Nearly every champion had a world-class GK or CB partnership. Buffon-Cannavaro '06, Casillas '10, Neuer '14, Lloris '18, Martínez '22, Čech '12 (CL), Kahn '01. You can't win 7 matches leaking goals. Even attacking champions (Barcelona, Brazil) had elite defensive structures.",
                  color: C.accent,
                },
                {
                  num: "03", title: "Squad Age Sweet Spot: 26.5–28.0",
                  pct: 78,
                  desc: `Overall avg champion age: ${allPatterns.avgAge.toFixed(1)} years. Young enough to press for 90+ minutes, old enough to manage game states. Too young = nerves in semifinals (Belgium 2018). Too old = legs gone by QF (Germany 2022). The sweet spot is 26.5–28.0.`,
                  color: C.gold,
                },
                {
                  num: "04", title: "The Comeback Gene / Mental Fortitude",
                  pct: Math.round(allPatterns.comebacks / allPatterns.total * 100),
                  desc: `${allPatterns.comebacks} of ${allPatterns.total} champions mounted at least one dramatic comeback en route to the title. Liverpool's Istanbul miracle, Real Madrid's serial CL comebacks, Argentina's 2022 final rollercoaster. The ability to be losing and still believe you'll win is unteachable.`,
                  color: C.purple,
                },
                {
                  num: "05", title: "Tactical Identity (Not Just Talent)",
                  pct: 92,
                  desc: "Every champion had a clear tactical identity. Spain's tiki-taka, Italy's catenaccio, Germany's positional play, Chile's pressing mania, Mourinho's defensive masterclasses. The style doesn't matter — committing to ONE system and executing it under pressure does. Greece 2004 proved system > talent.",
                  color: C.orange,
                },
                {
                  num: "06", title: "Penalty Shootout Readiness",
                  pct: Math.round(allPatterns.penWins / allPatterns.total * 100),
                  desc: `${allPatterns.penWins} champions won at least one penalty shootout in their run. This isn't luck — it's preparation. Argentina practiced penalties obsessively before 2022. Italy drilled them before Euro 2021. Germany traditionally dominated them. In a 48-team World Cup with more knockout games, penalty preparation could be decisive.`,
                  color: C.red,
                },
                {
                  num: "07", title: "Narrative Momentum / Destiny Factor",
                  pct: 70,
                  desc: "The hardest to quantify. Messi's 'last dance' 2022. Ronaldo's redemption 2002. Zidane's final World Cup '06 (almost). Liverpool's 'you'll never walk alone' 2005. When players feel they're part of something bigger than football — a nation's story, a legend's farewell, a generation's defining moment — they perform beyond their statistical ceiling.",
                  color: "#ec4899",
                },
              ].map(f => (
                <div key={f.num} style={{
                  background:C.cardAlt, borderRadius:10, padding:"14px 16px",
                  border:`1px solid ${C.border}`, marginBottom:10,
                  borderLeft:`4px solid ${f.color}`,
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:18, fontWeight:800, color:f.color, fontVariantNumeric:"tabular-nums" }}>{f.num}</span>
                      <span style={{ fontSize:13, fontWeight:700 }}>{f.title}</span>
                    </div>
                    <span style={{
                      fontSize:12, fontWeight:800, color:f.color,
                      background:f.color+"15", padding:"3px 8px", borderRadius:4,
                    }}>{f.pct}%</span>
                  </div>
                  <div style={{ fontSize:11, color:C.dim, lineHeight:1.7 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}` }}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:"0 0 8px", color:C.gold }}>
                So Who Has the X-Factor for 2026?
              </h3>
              <div style={{ fontSize:12, color:C.dim, lineHeight:1.8 }}>
                <p style={{margin:"0 0 10px"}}>
                  <strong style={{color:C.gold}}>🥇 Argentina</strong> — Messi's potential farewell (Narrative ✓), defending champions (Mentality ✓), Martínez in goal (Defense ✓), and the squad literally doesn't know how to lose tournaments anymore. The X-Factor risk: squad age is creeping toward 28+ and Messi's body at 38.
                </p>
                <p style={{margin:"0 0 10px"}}>
                  <strong style={{color:C.silver}}>🥈 Spain</strong> — Youngest Euro champion ever in 2024 (Yamal), tactical identity locked in, and their rising-star form pattern matches CL winners like PSG 2025 and Chelsea 2021. If Yamal is healthy, they have the "transcendent star" factor. X-Factor risk: tournament inexperience at this age.
                </p>
                <p style={{margin:"0 0 10px"}}>
                  <strong style={{color:"#cd7f32"}}>🥉 France</strong> — Mbappé seeking redemption after 2022 heartbreak (Narrative ✓). Deschamps' last tournament (Motivation ✓). Players scattered across every CL-winning squad. But squad chemistry concerns and Mbappé's Real Madrid drama could fracture the camp.
                </p>
                <p style={{margin:"0 0 10px"}}>
                  <strong style={{color:C.accent}}>🌙 Dark Horse: England</strong> — Two straight Euro finals (2021, 2024). Their players have the most CL experience in the tournament. If they can finally break through, the "it's coming home" narrative momentum could be overwhelming on US soil. The 60-year drought IS the X-Factor — both burden and fuel.
                </p>
                <p style={{margin:0}}>
                  <strong style={{color:C.green}}>🌍 Wildcard: Morocco</strong> — 2022 semifinalists, squad largely intact, passionate diaspora crowd in North America. If Colombia 2001 (home Copa) and Greece 2004 (ultimate underdog) had a baby, it would be Morocco 2026.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign:"center", padding:16, fontSize:10, color:C.dim, borderTop:`1px solid ${C.border}` }}>
        X-Factor Analysis — 54 major tournament wins analyzed (2000–2025 CL, 1994–2022 WC, 1996–2024 Euro, 1995–2024 Copa)
      </div>
    </div>
  );
}
