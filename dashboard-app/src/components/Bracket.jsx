import { useCallback } from 'react';
import { getFlag } from '../data/teamMapping';
import { getMatchColors, textSafeColor } from '../data/teamColors';

// ─── Layout constants ─────────────────────────────────────────────────────────
// Topology mirrors predict_knockout_mc.py R16_PAIRS/QF_PAIRS/SF_PAIRS exactly.

const NODE_H  = 64;   // R32 match node height
const LATER_H = 28;   // R16 / QF / SF / Final TBD node height
const SLOT_H  = 80;   // vertical slot per R32 match (NODE_H + 16px gap)
const R32_W   = 160;  // R32 node width
const R16_W   = 118;  // R16 node width
const QF_W    = 96;   // QF node width
const SF_W    = 96;   // SF node width
const FIN_W   = 124;  // Final node width
const CONN    = 24;   // connector gap between adjacent round columns
const TOTAL_H = 8 * SLOT_H; // 640px

// Column left-edge X positions
const R32L_X = 0;
const R16L_X = R32L_X + R32_W + CONN;          // 184
const QFL_X  = R16L_X + R16_W + CONN;          // 326
const SFL_X  = QFL_X  + QF_W  + CONN;          // 446
const FIN_X  = SFL_X  + SF_W  + CONN;          // 566
const SFR_X  = FIN_X  + FIN_W + CONN;          // 714
const QFR_X  = SFR_X  + SF_W  + CONN;          // 834
const R16R_X = QFR_X  + QF_W  + CONN;          // 954
const R32R_X = R16R_X + R16_W + CONN;          // 1096
const TOTAL_W = R32R_X + R32_W;                // 1256

// R32 match order, top→bottom on each side
// Matches predict_knockout_mc.py R16_PAIRS groups:
//   left:  R16-0=(74,77), R16-1=(73,75), R16-2=(83,84), R16-3=(81,82)
//   right: R16-4=(76,78), R16-5=(79,80), R16-6=(86,88), R16-7=(85,87)
const LEFT_R32  = [74, 77, 73, 75, 83, 84, 81, 82];
const RIGHT_R32 = [76, 78, 79, 80, 86, 88, 85, 87];

// Vertical centers
const r32Y = Array.from({ length: 8 }, (_, i) => SLOT_H * i + SLOT_H / 2);
// [40, 120, 200, 280, 360, 440, 520, 600]
const r16Y = [0,1,2,3].map(i => (r32Y[i*2] + r32Y[i*2+1]) / 2);
// [80, 240, 400, 560]
const qfY  = [0,1].map(i => (r16Y[i*2] + r16Y[i*2+1]) / 2);
// [160, 480]
const sfY  = (qfY[0] + qfY[1]) / 2; // 320

// R16 venue labels (left 0-3, right 4-7)
const R16_META = [
  'Philadelphia · Jul 4', 'Houston · Jul 4',
  'Dallas · Jul 6',       'Seattle · Jul 6',
  'New York · Jul 5',     'Mexico City · Jul 5',
  'Atlanta · Jul 7',      'Vancouver · Jul 7',
];

// ─── SVG connector line generation ───────────────────────────────────────────
// Draws classic L-shaped bracket connectors:
//   horizontal stub from each feeder → vertical bar → horizontal to next node
// Works for both left-side (lines go right) and right-side (lines go left).
// edgeA: inner face X of current round nodes
// midX:  gather point X (CONN/2 into the gap)
// aYs:   Y centers of current-round nodes (consumed in pairs)
// edgeB: inner face X of next-round nodes
// bYs:   Y centers of next-round nodes (one per pair)
function makeLines(edgeA, midX, aYs, edgeB, bYs) {
  const lines = [];
  for (let j = 0; j < bYs.length; j++) {
    const y0 = aYs[j * 2], y1 = aYs[j * 2 + 1], ny = bYs[j];
    lines.push([edgeA, y0, midX,  y0]);   // stub from top feeder
    lines.push([edgeA, y1, midX,  y1]);   // stub from bottom feeder
    lines.push([midX,  y0, midX,  y1]);   // vertical bar
    lines.push([midX,  ny, edgeB, ny]);   // horizontal to next node
  }
  return lines;
}

const SVG_LINES = [
  // Left: R32 → R16
  ...makeLines(R32_W, R32_W + CONN/2, r32Y, R16L_X, r16Y),
  // Left: R16 → QF
  ...makeLines(R16L_X + R16_W, R16L_X + R16_W + CONN/2, r16Y, QFL_X, qfY),
  // Left: QF → SF (2 QFs, 1 SF)
  ...makeLines(QFL_X + QF_W, QFL_X + QF_W + CONN/2, qfY, SFL_X, [sfY]),
  // Left: SF → Final
  [SFL_X + SF_W, sfY, FIN_X, sfY],

  // Right: R32 → R16 (connections face inward, so edgeA = left face of R32R)
  ...makeLines(R32R_X, R32R_X - CONN/2, r32Y, R16R_X + R16_W, r16Y),
  // Right: R16 → QF
  ...makeLines(R16R_X, R16R_X - CONN/2, r16Y, QFR_X + QF_W, qfY),
  // Right: QF → SF
  ...makeLines(QFR_X, QFR_X - CONN/2, qfY, SFR_X + SF_W, [sfY]),
  // Right: SF → Final
  [SFR_X, sfY, FIN_X + FIN_W, sfY],
];

// ─── Node components ─────────────────────────────────────────────────────────

function R32Node({ pred, onClick }) {
  if (!pred) {
    return (
      <div
        style={{ height: NODE_H }}
        className="border border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50/40"
      >
        <span className="text-[10px] text-gray-300">TBD</span>
      </div>
    );
  }

  const favoredIsHome = pred.adj_home > pred.adj_away;
  const favoredAdj    = Math.max(pred.adj_home, pred.adj_away);
  const colors        = getMatchColors(pred.home, pred.away);
  const pctColor      = textSafeColor(favoredIsHome ? colors.home : colors.away);

  return (
    <button
      id={`bracket-node-${pred.matchNum}`}
      onClick={() => onClick(pred.matchNum)}
      style={{ height: NODE_H }}
      className="w-full text-left border border-gray-200 rounded-lg bg-white
                 hover:border-blue-300 hover:shadow-sm active:bg-blue-50/30
                 transition-all cursor-pointer overflow-hidden"
      title={`Jump to match details: ${pred.home} vs ${pred.away}`}
    >
      <div className="px-2 pt-1 pb-1.5 flex flex-col h-full justify-between">
        <div className="text-[9px] text-gray-400 mono truncate leading-none">
          #{pred.matchNum} · {pred.date.slice(5).replace('-', '/')} · {pred.venue}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className={`text-[11px] leading-tight font-semibold truncate
              ${favoredIsHome ? 'text-gray-900' : 'text-gray-400'}`}>
              {getFlag(pred.home)} {pred.home}
            </div>
            <div className={`text-[11px] leading-tight font-semibold truncate
              ${!favoredIsHome ? 'text-gray-900' : 'text-gray-400'}`}>
              {getFlag(pred.away)} {pred.away}
            </div>
          </div>
          <div className="shrink-0 mono text-sm font-bold leading-none" style={{ color: pctColor }}>
            {(favoredAdj * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </button>
  );
}

function TBDNode({ label, w, h = LATER_H, highlight = false }) {
  return (
    <div
      style={{ width: w, height: h }}
      className={`border rounded flex flex-col items-center justify-center
        ${highlight
          ? 'border-amber-300 bg-amber-50/70 border-2'
          : 'border-dashed border-gray-200 bg-gray-50/40'
        }`}
    >
      <span className={`text-[9px] mono truncate px-1 text-center leading-tight
        ${highlight ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

// ─── Main bracket component ───────────────────────────────────────────────────

export function Bracket({ predByNum }) {
  const handleClick = useCallback((matchNum) => {
    document.getElementById(`r32-match-${matchNum}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <div className="overflow-x-auto pb-2 -mx-1 px-1">
      <div style={{ width: TOTAL_W, height: TOTAL_H, position: 'relative', minWidth: TOTAL_W }}>

        {/* ── SVG connector lines ── */}
        <svg
          style={{ position: 'absolute', inset: 0, width: TOTAL_W, height: TOTAL_H, pointerEvents: 'none' }}
          aria-hidden="true"
        >
          {SVG_LINES.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#e5e7eb" strokeWidth={1.5} />
          ))}
        </svg>

        {/* ── Left R32 nodes ── */}
        {LEFT_R32.map((num, i) => (
          <div key={num} style={{ position: 'absolute', left: R32L_X, top: r32Y[i] - NODE_H / 2, width: R32_W }}>
            <R32Node pred={predByNum[num]} onClick={handleClick} />
          </div>
        ))}

        {/* ── Right R32 nodes ── */}
        {RIGHT_R32.map((num, i) => (
          <div key={num} style={{ position: 'absolute', left: R32R_X, top: r32Y[i] - NODE_H / 2, width: R32_W }}>
            <R32Node pred={predByNum[num]} onClick={handleClick} />
          </div>
        ))}

        {/* ── Left R16 TBD nodes ── */}
        {r16Y.map((cy, j) => (
          <div key={j} style={{ position: 'absolute', left: R16L_X, top: cy - LATER_H / 2 }}>
            <TBDNode label={R16_META[j]} w={R16_W} />
          </div>
        ))}

        {/* ── Right R16 TBD nodes ── */}
        {r16Y.map((cy, j) => (
          <div key={j} style={{ position: 'absolute', left: R16R_X, top: cy - LATER_H / 2 }}>
            <TBDNode label={R16_META[j + 4]} w={R16_W} />
          </div>
        ))}

        {/* ── Left QF TBD nodes ── */}
        {qfY.map((cy, k) => (
          <div key={k} style={{ position: 'absolute', left: QFL_X, top: cy - LATER_H / 2 }}>
            <TBDNode label="Quarterfinal" w={QF_W} />
          </div>
        ))}

        {/* ── Right QF TBD nodes ── */}
        {qfY.map((cy, k) => (
          <div key={k} style={{ position: 'absolute', left: QFR_X, top: cy - LATER_H / 2 }}>
            <TBDNode label="Quarterfinal" w={QF_W} />
          </div>
        ))}

        {/* ── Left SF ── */}
        <div style={{ position: 'absolute', left: SFL_X, top: sfY - LATER_H / 2 }}>
          <TBDNode label="SF · Dallas · Jul 14" w={SF_W} />
        </div>

        {/* ── Right SF ── */}
        <div style={{ position: 'absolute', left: SFR_X, top: sfY - LATER_H / 2 }}>
          <TBDNode label="SF · Atlanta · Jul 15" w={SF_W} />
        </div>

        {/* ── Final ── */}
        <div style={{ position: 'absolute', left: FIN_X, top: sfY - 20, width: FIN_W, height: 40 }}>
          <TBDNode label={'🏆 Final · Jul 19'} w={FIN_W} h={40} highlight />
        </div>

        {/* ── 3rd place ── */}
        <div style={{ position: 'absolute', left: FIN_X, top: sfY + 30, width: FIN_W }}>
          <TBDNode label="3rd place · Jul 19" w={FIN_W} />
        </div>

      </div>
    </div>
  );
}
