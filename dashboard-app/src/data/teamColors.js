// Primary kit / federation colors for all 48 WC 2026 teams.
// England overridden to #D3D3D3 (light gray) because white-on-white is invisible.
export const TEAM_COLORS = {
  // Group A
  "Mexico":                   "#006847",
  "South Korea":              "#C60C30",
  "South Africa":             "#007749",
  "Czech Republic":           "#11457E",
  // Group B
  "Canada":                   "#FF0000",
  "Switzerland":              "#FF0000",
  "Qatar":                    "#8B1538",
  "Bosnia and Herzegovina":   "#002395",
  // Group C
  "Brazil":                   "#FFDF00",
  "Morocco":                  "#C1272D",
  "Haiti":                    "#00209F",
  "Scotland":                 "#003078",
  // Group D
  "United States":            "#002868",
  "Paraguay":                 "#C8102E",
  "Australia":                "#FFCD00",
  "Turkey":                   "#E30A17",
  "Türkiye":                  "#E30A17",
  // Group E
  "Germany":                  "#000000",
  "Curaçao":                  "#002B7F",
  "Ivory Coast":              "#FF8200",
  "Ecuador":                  "#FFD100",
  // Group F
  "Netherlands":              "#FF6600",
  "Japan":                    "#000080",
  "Sweden":                   "#006AA7",
  "Tunisia":                  "#C8102E",
  // Group G
  "Belgium":                  "#ED2939",
  "Egypt":                    "#C8102E",
  "Iran":                     "#239F40",
  "New Zealand":              "#000000",
  // Group H
  "Spain":                    "#AA151B",
  "Cape Verde":               "#003893",
  "Saudi Arabia":             "#006C35",
  "Uruguay":                  "#5CBFEB",
  // Group I
  "France":                   "#002395",
  "Senegal":                  "#00853F",
  "Norway":                   "#BA0C2F",
  "Iraq":                     "#007A3D",
  // Group J
  "Argentina":                "#75AADB",
  "Algeria":                  "#006233",
  "Austria":                  "#ED2939",
  "Jordan":                   "#007A3D",
  // Group K
  "Portugal":                 "#006600",
  "Uzbekistan":               "#0099B5",
  "Colombia":                 "#FCD116",
  "DR Congo":                 "#007FFF",
  // Group L
  "England":                  "#D3D3D3",   // white kit → light gray so bar is visible
  "Ghana":                    "#006B3F",
  "Panama":                   "#D21034",
  "Croatia":                  "#FF0000",
};

// ─── Color utilities ─────────────────────────────────────────────────────────

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const hexToHsl = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, Math.round(l * 100)];
  const s = d / (l > 0.5 ? 2 - max - min : max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

const hslToHex = (h, s, l) => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16).padStart(2, '0');
  };
  return '#' + [0, 8, 4].map(f).join('');
};

// Reduce saturation ~35pts and clamp lightness to 28–60% so colors read as
// distinct but not eye-searing on the probability bars.
const mute = (hex) => {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, Math.max(0, s - 35), Math.min(60, Math.max(28, l)));
};

const clamp = (v) => Math.max(0, Math.min(255, v));

const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');

const colorDistance = (h1, h2) => {
  const [r1, g1, b1] = hexToRgb(h1);
  const [r2, g2, b2] = hexToRgb(h2);
  return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
};

const adjustBrightness = (hex, amount) =>
  rgbToHex(hexToRgb(hex).map(c => clamp(c + amount)));

// Luminance-aware: darken light colors, lighten dark ones
const shiftForContrast = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 80
    ? adjustBrightness(hex, +60)   // very dark → lighten
    : adjustBrightness(hex, -50);  // light / medium → darken
};

// Returns { home, draw, away } hex colors for a given matchup.
// Draw is always #9ca3af. If the two team colors are too similar, the away
// color is shifted so the two segments remain distinguishable.
export const getMatchColors = (homeTeam, awayTeam) => {
  const homeColor = mute(TEAM_COLORS[homeTeam] || '#6b7280');
  let   awayColor = mute(TEAM_COLORS[awayTeam] || '#6b7280');

  if (colorDistance(homeColor, awayColor) < 50) {
    awayColor = shiftForContrast(awayColor);
  }

  return { home: homeColor, draw: '#9ca3af', away: awayColor };
};

// Returns white or dark text for a given background color (for bar labels).
export const barTextColor = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 130 ? '#374151' : '#ffffff';
};

// Returns a text-safe version of a team color for use on white backgrounds.
// Very light colors are darkened so they remain legible.
export const textSafeColor = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 190 ? adjustBrightness(hex, -70) : hex;
};
