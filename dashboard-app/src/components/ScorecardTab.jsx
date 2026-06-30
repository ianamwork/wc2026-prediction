import { useMemo } from 'react';
import { GROUP_STAGE_RESULTS } from '../data/groupStageResults';
import { ALL_GROUP_PREDICTIONS } from '../data/allGroupPredictions';
import { MATCH_PREDICTIONS } from '../data/modelPredictions';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

function buildResultMap(results) {
  const map = new Map();
  for (const r of results) {
    map.set(`${r.home}|${r.away}`, r);
    map.set(`${r.away}|${r.home}`, r);
  }
  return map;
}

function getActualOutcome(predHome, predAway, result) {
  let hg, ag;
  if (result.home === predHome) {
    hg = result.homeGoals;
    ag = result.awayGoals;
  } else {
    hg = result.awayGoals;
    ag = result.homeGoals;
  }
  return hg > ag ? 'home_win' : hg < ag ? 'away_win' : 'draw';
}

function Sparkline({ points }) {
  if (points.length < 2) return null;
  const W = 200, H = 56, PAD = 4;
  const w = W - PAD * 2;
  const h = H - PAD * 2;
  const minV = Math.min(...points);
  const maxV = Math.max(...points);
  const range = maxV - minV || 1;

  const coords = points.map((v, i) => [
    PAD + (i / (points.length - 1)) * w,
    PAD + (1 - (v - minV) / range) * h,
  ]);

  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const fillPoints = [
    `${PAD},${PAD + h}`,
    ...coords.map(([x, y]) => `${x},${y}`),
    `${PAD + w},${PAD + h}`,
  ].join(' ');

  const isProfit = points[points.length - 1] >= points[0];
  const color = isProfit ? '#22c55e' : '#ef4444';
  const last = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <polygon points={fillPoints} fill={color} fillOpacity="0.12" />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

export function ScorecardTab() {
  const resultMap = useMemo(() => buildResultMap(GROUP_STAGE_RESULTS), []);

  const accuracy = useMemo(() => {
    let correct = 0;
    let totalLogLoss = 0;
    let totalPredDraw = 0;
    let matched = 0;

    for (const pred of ALL_GROUP_PREDICTIONS) {
      const result = resultMap.get(`${pred.home}|${pred.away}`);
      if (!result) continue;
      matched++;

      const actual = getActualOutcome(pred.home, pred.away, result);
      if (actual === pred.predicted) correct++;

      const pActual =
        actual === 'home_win' ? pred.pHome :
        actual === 'away_win' ? pred.pAway :
        pred.pDraw;
      totalLogLoss += -Math.log(Math.max(pActual, 1e-7));
      totalPredDraw += pred.pDraw;
    }

    const actualDraws = GROUP_STAGE_RESULTS.filter(r => r.homeGoals === r.awayGoals).length;
    const actualDrawRate = actualDraws / GROUP_STAGE_RESULTS.length;
    const avgPredDrawProb = totalPredDraw / (matched || 1);

    return {
      correct,
      total: matched,
      accuracy: matched > 0 ? (correct / matched) * 100 : 0,
      logLoss: matched > 0 ? totalLogLoss / matched : 0,
      drawRateMiss: (avgPredDrawProb - actualDrawRate) * 100,
      actualDraws,
      actualDrawRate: actualDrawRate * 100,
      avgPredDrawProb: avgPredDrawProb * 100,
    };
  }, [resultMap]);

  const pnl = useMemo(() => {
    const bets = MATCH_PREDICTIONS
      .filter(m => m.kelly_quarter > 0)
      .sort((a, b) => a.slug.slice(-10).localeCompare(b.slug.slice(-10)));

    let qkBankroll = 1000;
    let flatNet = 0;
    let wins = 0;
    const bankrollHistory = [1000];
    const rows = [];

    for (const bet of bets) {
      const result = resultMap.get(`${bet.home}|${bet.away}`);
      if (!result) continue;

      const actual = getActualOutcome(bet.home, bet.away, result);
      const targetOutcome =
        bet.best_dir === 'home' ? 'home_win' :
        bet.best_dir === 'away' ? 'away_win' :
        'draw';
      const won = actual === targetOutcome;

      const odds = 1 / bet.mkt_best;
      const qkStake = bet.kelly_quarter * qkBankroll;
      const qkReturn = won ? qkStake * (odds - 1) : -qkStake;
      const flatReturn = won ? 10 * (odds - 1) : -10;

      qkBankroll += qkReturn;
      flatNet += flatReturn;
      if (won) wins++;
      bankrollHistory.push(qkBankroll);

      const betOn =
        bet.best_dir === 'home' ? bet.home :
        bet.best_dir === 'away' ? bet.away :
        'Draw';

      rows.push({
        date: bet.slug.slice(-10),
        match: bet.match,
        betOn,
        best_dir: bet.best_dir,
        edge: (bet.best_edge * 100).toFixed(1),
        qkStake: qkStake.toFixed(1),
        won,
        qkReturn: qkReturn.toFixed(1),
        flatReturn: flatReturn.toFixed(1),
        bankroll: qkBankroll.toFixed(1),
      });
    }

    return {
      qkNet: qkBankroll - 1000,
      qkFinal: qkBankroll,
      flatNet,
      wins,
      total: rows.length,
      bankrollHistory,
      rows,
    };
  }, [resultMap]);

  const signedStr = (n) => (n >= 0 ? '+' : '') + n.toFixed(1);

  return (
    <div className="space-y-6">
      {/* ── Section 1: Accuracy ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          M6 Accuracy — All {accuracy.total} Group Stage Matches
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">Correct Predictions</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold tabular-nums">
                {accuracy.correct}/{accuracy.total}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {accuracy.accuracy.toFixed(1)}% accuracy
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">Log-Loss</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold tabular-nums">
                {accuracy.logLoss.toFixed(3)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">avg −log(p_actual)</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">Draw-Rate Miss</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className={`text-2xl font-bold tabular-nums ${accuracy.drawRateMiss >= 0 ? '' : 'text-amber-500'}`}>
                {signedStr(accuracy.drawRateMiss)}pp
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                pred {accuracy.avgPredDrawProb.toFixed(1)}% vs actual {accuracy.actualDrawRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">Actual Draws</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold tabular-nums">
                {accuracy.actualDraws}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                of {GROUP_STAGE_RESULTS.length} matches ({accuracy.actualDrawRate.toFixed(1)}%)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Section 2: Betting P&L ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Betting P&amp;L — {pnl.total} Value Bets · Quarter-Kelly primary · Flat 10 u secondary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">Quarter-Kelly Net</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className={`text-2xl font-bold tabular-nums ${pnl.qkNet >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {signedStr(pnl.qkNet)} u
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {signedStr((pnl.qkNet / 1000) * 100)}% ROI · final {pnl.qkFinal.toFixed(0)} u
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">Flat Bet Net (10 u)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className={`text-2xl font-bold tabular-nums ${pnl.flatNet >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {signedStr(pnl.flatNet)} u
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {signedStr((pnl.flatNet / (pnl.total * 10)) * 100)}% yield · {pnl.total} × 10 u
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">Win Rate</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold tabular-nums">
                {pnl.wins}/{pnl.total}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {pnl.total > 0 ? ((pnl.wins / pnl.total) * 100).toFixed(1) : 0}% bets won
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">QK Bankroll Curve</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2">
              <Sparkline points={pnl.bankrollHistory} />
            </CardContent>
          </Card>
        </div>

        {/* Bet table */}
        <div className="rounded-md border overflow-auto max-h-[420px]">
          <table className="text-xs w-full">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Match</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Bet on</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Edge</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">QK Stake</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Result</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">QK P&L</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Flat P&L</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Bankroll</th>
              </tr>
            </thead>
            <tbody>
              {pnl.rows.map((row, i) => (
                <tr key={i} className={`border-t hover:bg-muted/30 ${row.won ? '' : 'opacity-80'}`}>
                  <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{row.date.slice(5)}</td>
                  <td className="px-3 py-1.5 max-w-[140px] truncate">{row.match}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className={row.best_dir === 'draw' ? 'text-amber-500 font-medium' : 'font-medium'}>
                      {row.betOn}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{row.edge}%</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{row.qkStake} u</td>
                  <td className="px-3 py-1.5 text-center">
                    {row.won
                      ? <span className="text-green-500 font-bold">✓</span>
                      : <span className="text-red-500 font-bold">✗</span>}
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap font-medium ${parseFloat(row.qkReturn) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {parseFloat(row.qkReturn) >= 0 ? '+' : ''}{row.qkReturn}
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${parseFloat(row.flatReturn) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {parseFloat(row.flatReturn) >= 0 ? '+' : ''}{row.flatReturn}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{row.bankroll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
