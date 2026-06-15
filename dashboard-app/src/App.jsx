import { useState, useMemo, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { usePolymarket } from './hooks/usePolymarket';
import { useScores, findScore } from './hooks/useScores';
import { TOURNAMENT_PREDICTIONS } from './data/modelPredictions';
import { MATCH_SCHEDULE, SCHEDULE_DATES, TODAY, formatDate, MODEL_SCORECARD } from './data/matchSchedule';
import { getFlag } from './data/teamMapping';
import { getMatchColors, barTextColor, textSafeColor } from './data/teamColors';

// ─── Helpers ────────────────────────────────────────────────────────────────

const mono = (str) => <span className="mono">{str}</span>;
const pct  = (v) => `${(v * 100).toFixed(1)}%`;
const pctR = (v, dec = 1) => `${v.toFixed(dec)}%`;
const fmt  = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${n.toFixed(0)}`;
const relTime = (d) => {
  if (!d) return null;
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
};

const GROUP_DOT = {
  A: 'bg-red-500', B: 'bg-orange-500', C: 'bg-yellow-500', D: 'bg-green-500',
  E: 'bg-teal-500', F: 'bg-cyan-500', G: 'bg-blue-500', H: 'bg-indigo-500',
  I: 'bg-violet-500', J: 'bg-purple-500', K: 'bg-fuchsia-500', L: 'bg-pink-500',
};

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// ─── Score + accuracy helpers ────────────────────────────────────────────────

// Determine model outcome prediction vs actual result
const computeModelCorrect = (pred, homeScore, awayScore) => {
  const predicted =
    pred.mdl_home > pred.mdl_draw && pred.mdl_home > pred.mdl_away ? 'home' :
    pred.mdl_away > pred.mdl_draw                                   ? 'away' : 'draw';
  const actual =
    homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
  return predicted === actual;
};

// Merge a live score into a MATCH_SCHEDULE entry (returns new object, not mutated).
// Never overrides static entries already marked completed — those are authoritative.
const enrichMatch = (match, liveScore, pred) => {
  if (match.status === 'completed' || !liveScore) return match;
  const hasResult = liveScore.homeScore != null && liveScore.awayScore != null;
  return {
    ...match,
    status: liveScore.status !== 'upcoming' ? liveScore.status : match.status,
    score:  hasResult
      ? { home: liveScore.homeScore, away: liveScore.awayScore }
      : match.score,
    modelCorrect: liveScore.status === 'completed' && hasResult && pred
      ? computeModelCorrect(pred, liveScore.homeScore, liveScore.awayScore)
      : match.modelCorrect,
  };
};

// ─── ProbBar ────────────────────────────────────────────────────────────────
// homeTeam / awayTeam are used to derive colors and render flag end-caps.
// colors = { home, draw, away } hex strings from getMatchColors().

const DRAW_COLOR = '#9ca3af';

function ProbBar({ home, draw, away, homeTeam, awayTeam, colors }) {
  const hc = colors?.home || '#3b82f6';
  const ac = colors?.away || '#6b7280';
  const hw = `${(home * 100).toFixed(1)}%`;
  const dw = `${(draw * 100).toFixed(1)}%`;
  const aw = `${(away * 100).toFixed(1)}%`;

  return (
    <div className="flex items-center gap-1">
      {/* Home flag end-cap */}
      <span className="text-xs shrink-0 leading-none">{getFlag(homeTeam)}</span>

      {/* Three-segment bar */}
      <div className="flex-1 flex h-4 rounded overflow-hidden text-[9px] font-semibold mono">
        <div
          className="prob-bar-fill flex items-center justify-center overflow-hidden"
          style={{ width: hw, backgroundColor: hc, color: barTextColor(hc) }}
        >
          {home > 0.20 && hw}
        </div>
        <div
          className="prob-bar-fill flex items-center justify-center overflow-hidden"
          style={{ width: dw, backgroundColor: DRAW_COLOR, color: '#fff' }}
        >
          {draw > 0.14 && dw}
        </div>
        <div
          className="prob-bar-fill flex items-center justify-center overflow-hidden"
          style={{ width: aw, backgroundColor: ac, color: barTextColor(ac) }}
        >
          {away > 0.20 && aw}
        </div>
      </div>

      {/* Away flag end-cap */}
      <span className="text-xs shrink-0 leading-none">{getFlag(awayTeam)}</span>
    </div>
  );
}

// ─── MatchRow — the timeline row ─────────────────────────────────────────────

function MatchRow({ match, pred }) {
  const prevEdge = useRef(pred?.best_edge ?? 0);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (!pred) return;
    const diff = pred.best_edge - prevEdge.current;
    if (Math.abs(diff) > 0.01) {
      setFlashClass(diff > 0 ? 'flash-value' : 'flash-drop');
      const t = setTimeout(() => setFlashClass(''), 1000);
      prevEdge.current = pred.best_edge;
      return () => clearTimeout(t);
    }
  }, [pred?.best_edge]);

  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const hasEdge = pred && pred.best_edge > 0;
  const edgePct = pred ? pred.best_edge * 100 : 0;
  const isStrong = edgePct >= 10;
  const isValue  = edgePct >= 5;

  const betTeam = pred
    ? pred.best_dir === 'home' ? pred.home
    : pred.best_dir === 'away' ? pred.away
    : 'Draw'
    : null;

  // Team-identity colors for bars and "Bet on" section
  const matchColors = getMatchColors(match.home, match.away);
  const betColor = betTeam === 'Draw'
    ? DRAW_COLOR
    : textSafeColor(pred?.best_dir === 'home' ? matchColors.home : matchColors.away);

  return (
    <div className={`
      border-l-[3px] pl-4 py-3 transition-all
      ${isCompleted
        ? 'border-l-gray-100 bg-gray-50/40 opacity-80'
        : isLive
        ? 'border-l-emerald-500 bg-emerald-50/30'
        : isStrong
        ? 'border-l-emerald-500'
        : isValue
        ? 'border-l-blue-400'
        : 'border-l-gray-200'}
      ${flashClass}
    `}>
      <div className="flex items-start gap-3 flex-wrap">

        {/* Time + group */}
        <div className="w-20 shrink-0 pt-0.5">
          {isCompleted ? (
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">FT</span>
          ) : isLive ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE
            </span>
          ) : (
            <span className="text-[11px] mono text-gray-600">{match.time}</span>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${GROUP_DOT[match.group]}`} />
            <span className="text-[10px] text-gray-400 font-medium">Grp {match.group}</span>
          </div>
        </div>

        {/* Teams + score/edge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Home */}
            <span className={`text-sm font-semibold ${isCompleted ? 'text-gray-500' : 'text-gray-900'}`}>
              {getFlag(match.home)} {match.home}
            </span>

            {/* Score or vs */}
            {(isCompleted || isLive) && match.score ? (
              <span className="mono text-sm font-bold text-gray-900 mx-1">
                {match.score.home} — {match.score.away}
              </span>
            ) : (
              <span className="text-gray-300 text-xs">vs</span>
            )}

            {/* Away */}
            <span className={`text-sm font-semibold ${isCompleted ? 'text-gray-500' : 'text-gray-900'}`}>
              {match.away} {getFlag(match.away)}
            </span>

            {/* Completed result badge */}
            {isCompleted && match.modelCorrect !== null && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                match.modelCorrect
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {match.modelCorrect ? '✓ Model correct' : '✗ Model wrong'}
              </span>
            )}

            {/* Value signal badges for upcoming */}
            {!isCompleted && isStrong && (
              <Badge className="text-[10px] px-1.5 py-0 h-5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                STRONG SIGNAL
              </Badge>
            )}
            {!isCompleted && !isStrong && isValue && (
              <Badge className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 border border-blue-200">
                VALUE
              </Badge>
            )}
            {!isCompleted && pred?.contrarian && (
              <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border border-amber-200">
                CONTRARIAN
              </Badge>
            )}
          </div>

          {/* Completed: model note + compact stats */}
          {isCompleted && (
            <div className="mt-0.5 text-[10px] text-gray-400">
              {match.modelNote && <p>{match.modelNote}</p>}
              {pred && (
                <p className="mono mt-0.5 text-gray-300">
                  Model: {pct(pred.mdl_home)} · {pct(pred.mdl_draw)} · {pct(pred.mdl_away)}
                  {pred.mkt_home > 0 && <> · Mkt: {pct(pred.mkt_home)} / {pct(pred.mkt_draw)} / {pct(pred.mkt_away)}</>}
                </p>
              )}
            </div>
          )}

          {/* Prob bars for upcoming + live */}
          {!isCompleted && pred && (
            <div className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-gray-400 w-10 shrink-0">Model</span>
                <div className="flex-1">
                  <ProbBar
                    home={pred.mdl_home} draw={pred.mdl_draw} away={pred.mdl_away}
                    homeTeam={match.home} awayTeam={match.away} colors={matchColors}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-gray-400 w-10 shrink-0">
                  {isLive ? 'Now' : 'Market'}
                </span>
                <div className="flex-1">
                  <ProbBar
                    home={pred.mkt_home} draw={pred.mkt_draw} away={pred.mkt_away}
                    homeTeam={match.home} awayTeam={match.away} colors={matchColors}
                  />
                </div>
              </div>
            </div>
          )}

          {/* No model data note for upcoming */}
          {!isCompleted && !pred && match.modelNote && (
            <p className="text-[10px] text-gray-400 mt-0.5">{match.modelNote}</p>
          )}
        </div>

        {/* Edge column — upcoming and live only */}
        {!isCompleted && pred && (
          <div className="shrink-0 text-right pl-2 border-l border-gray-100">
            <div className="text-[10px] text-gray-400 font-medium">Bet on</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: betColor }}>
              {getFlag(betTeam === 'Draw' ? null : betTeam)}{betTeam === 'Draw' ? '' : ' '}{betTeam}
            </div>
            <div className="mono text-lg font-bold leading-tight mt-0.5" style={{ color: betColor }}>
              {edgePct >= 0 ? '+' : ''}{edgePct.toFixed(1)}%
            </div>
            <div className="text-[9px] text-gray-400 mono">
              ¼K {pct(pred.kelly_quarter)}
              {pred.vol_24h > 0 && <> · {fmt(pred.vol_24h)}</>}
            </div>
          </div>
        )}

        {/* Venue */}
        <div className="w-full mt-0.5">
          <span className="text-[10px] text-gray-300">{match.venue}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Match Bets Tab ───────────────────────────────────────────────────────────

function MatchBetsTab({ predictions, scoreMap }) {
  const [view, setView]         = useState('day');   // 'day' | 'group'
  const [minEdge, setMinEdge]   = useState([0]);
  const [groupFilter, setGroupFilter] = useState('All');
  const [valueOnly, setValueOnly]     = useState(false);
  const [sort, setSort]         = useState('edge');
  const [showCompleted, setShowCompleted] = useState(true);

  const predBySlug = useMemo(() => {
    const m = {};
    for (const p of predictions) m[p.slug] = p;
    return m;
  }, [predictions]);

  const matchesForDisplay = useMemo(() => {
    return MATCH_SCHEDULE.filter(m => {
      if (groupFilter !== 'All' && m.group !== groupFilter) return false;
      if (!showCompleted && m.status === 'completed') return false;
      if (m.status !== 'completed') {
        const pred = m.modelSlug ? predBySlug[m.modelSlug] : null;
        if (valueOnly && (!pred || pred.best_edge < 0.05)) return false;
        if (pred && pred.best_edge * 100 < minEdge[0]) {
          if (m.status !== 'completed') return false;
        }
      }
      return true;
    });
  }, [predBySlug, groupFilter, showCompleted, valueOnly, minEdge]);

  // Group view: sort predictions list
  const filteredPreds = useMemo(() => {
    let list = predictions.filter(p => {
      if (p.best_edge * 100 < minEdge[0]) return false;
      if (valueOnly && p.best_edge < 0.05) return false;
      if (groupFilter !== 'All' && p.group !== groupFilter) return false;
      return true;
    });
    list.sort((a, b) =>
      sort === 'edge' ? b.best_edge - a.best_edge :
      sort === 'kelly' ? b.kelly_quarter - a.kelly_quarter :
      sort === 'group' ? a.group.localeCompare(b.group) || b.best_edge - a.best_edge : 0
    );
    return list;
  }, [predictions, minEdge, sort, groupFilter, valueOnly]);

  const valueBetsCount = predictions.filter(p => p.best_edge >= 0.05).length;
  const bestEdge = predictions.reduce((best, p) => p.best_edge > best.best_edge ? p : best, predictions[0]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 py-2 border-b border-gray-100">
        {/* View toggle */}
        <div className="flex rounded border border-gray-200 overflow-hidden text-xs font-medium">
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1.5 transition-colors ${view === 'day' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Day view
          </button>
          <button
            onClick={() => setView('group')}
            className={`px-3 py-1.5 transition-colors ${view === 'group' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Edge view
          </button>
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Min edge */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Min edge</label>
          <div className="w-28">
            <Slider value={minEdge} onValueChange={setMinEdge} min={0} max={15} step={1} />
          </div>
          <span className="mono text-xs text-gray-700 w-8">{minEdge[0]}%</span>
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Sort (edge view only) */}
        {view === 'group' && (
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="edge">By edge</SelectItem>
              <SelectItem value="kelly">By Kelly</SelectItem>
              <SelectItem value="group">By group</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Filters */}
        <button
          onClick={() => setValueOnly(v => !v)}
          className={`h-8 px-2.5 text-xs rounded border font-medium transition-colors ${
            valueOnly ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          Value ≥5%
        </button>
        {view === 'day' && (
          <button
            onClick={() => setShowCompleted(v => !v)}
            className={`h-8 px-2.5 text-xs rounded border font-medium transition-colors ${
              showCompleted ? 'bg-gray-100 text-gray-700 border-gray-200' : 'text-gray-400 border-gray-200'
            }`}
          >
            {showCompleted ? 'Hide completed' : 'Show completed'}
          </button>
        )}

        <Separator orientation="vertical" className="h-5" />

        {/* Group filter */}
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setGroupFilter('All')}
            className={`px-1.5 py-0.5 text-[11px] rounded font-medium transition-colors ${groupFilter === 'All' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}>
            All
          </button>
          {GROUPS.map(g => (
            <button key={g} onClick={() => setGroupFilter(g === groupFilter ? 'All' : g)}
              className={`px-1.5 py-0.5 text-[11px] rounded font-medium transition-colors ${groupFilter === g ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-gray-400 mono">
        {valueBetsCount} value bets · Best: {bestEdge ? `+${(bestEdge.best_edge * 100).toFixed(1)}%` : '—'}
      </div>

      {/* ── Day view ── */}
      {view === 'day' && (
        <div className="space-y-6">
          {SCHEDULE_DATES.map(date => {
            const dayMatches = matchesForDisplay.filter(m => m.date === date);
            if (dayMatches.length === 0) return null;

            // Enrich with live scores first so we can sort by actual status
            const enriched = dayMatches.map(m => {
              const pred = m.modelSlug ? predBySlug[m.modelSlug] : null;
              const live = findScore(scoreMap, m.home, m.away);
              return { enrichedMatch: enrichMatch(m, live, pred), pred };
            });

            // Within each day: live → upcoming → completed
            const STATUS_RANK = { live: 0, upcoming: 1, completed: 2 };
            enriched.sort((a, b) =>
              (STATUS_RANK[a.enrichedMatch.status] ?? 1) -
              (STATUS_RANK[b.enrichedMatch.status] ?? 1)
            );

            return (
              <div key={date}>
                <div className="day-rule mb-3">{formatDate(date)}</div>
                <div className="space-y-0 divide-y divide-gray-50">
                  {enriched.map(({ enrichedMatch, pred }) => (
                    <MatchRow
                      key={enrichedMatch.id}
                      match={enrichedMatch}
                      pred={pred}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edge view ── */}
      {view === 'group' && (
        filteredPreds.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <div className="text-3xl mb-2">⚽</div>
            <div className="font-medium">No matches found</div>
            <div className="text-sm mt-1">Loosen your filters</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2 bg-gray-50 text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
              <span>Match</span>
              <span className="text-right">Edge · Kelly · Volume</span>
            </div>
            {filteredPreds.map(pred => {
              const schedMatch = MATCH_SCHEDULE.find(m => m.modelSlug === pred.slug);
              const betTeam = pred.best_dir === 'home' ? pred.home
                : pred.best_dir === 'away' ? pred.away : 'Draw';
              const edgePct = pred.best_edge * 100;
              return (
                <div key={pred.slug} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${GROUP_DOT[pred.group]}`} />
                        <span className="text-[10px] text-gray-400">Grp {pred.group}</span>
                        {schedMatch && <span className="text-[10px] mono text-gray-400">{schedMatch.date.slice(5)} {schedMatch.time}</span>}
                        {pred.contrarian && <Badge className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border border-amber-200">CONTRARIAN</Badge>}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-gray-900">
                        {getFlag(pred.home)} {pred.home} <span className="text-gray-300 font-normal">vs</span> {pred.away} {getFlag(pred.away)}
                      </div>
                      {(() => {
                        const mc = getMatchColors(pred.home, pred.away);
                        return (
                          <div className="mt-1.5 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-400 w-9">Model</span>
                              <div className="flex-1">
                                <ProbBar
                                  home={pred.mdl_home} draw={pred.mdl_draw} away={pred.mdl_away}
                                  homeTeam={pred.home} awayTeam={pred.away} colors={mc}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-400 w-9">Market</span>
                              <div className="flex-1">
                                <ProbBar
                                  home={pred.mkt_home} draw={pred.mkt_draw} away={pred.mkt_away}
                                  homeTeam={pred.home} awayTeam={pred.away} colors={mc}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {(() => {
                      const mc = getMatchColors(pred.home, pred.away);
                      const bc = betTeam === 'Draw'
                        ? DRAW_COLOR
                        : textSafeColor(pred.best_dir === 'home' ? mc.home : mc.away);
                      return (
                        <div className="shrink-0 text-right">
                          <div className="text-xs text-gray-500">Bet on</div>
                          <div className="text-xs font-semibold mt-0.5" style={{ color: bc }}>
                            {getFlag(betTeam === 'Draw' ? null : betTeam)}{betTeam === 'Draw' ? '' : ' '}{betTeam}
                          </div>
                          <div className="mono text-xl font-bold" style={{ color: bc }}>
                            +{edgePct.toFixed(1)}%
                          </div>
                          <div className="mono text-[10px] text-gray-400">
                            ¼K {pct(pred.kelly_quarter)} · {fmt(pred.vol_24h)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Tournament Tab ───────────────────────────────────────────────────────────

const MARKET_WIN_PCT = {
  'France': 16.0, 'Spain': 14.0, 'Argentina': 13.5, 'Germany': 11.0,
  'Brazil': 7.5, 'England': 6.5, 'Belgium': 5.0, 'Norway': 3.5,
  'Netherlands': 3.8, 'Switzerland': 2.5, 'Colombia': 2.0, 'Portugal': 2.2,
  'Turkey': 1.8, 'Austria': 1.5, 'Croatia': 1.6, 'Morocco': 1.4,
  'Ecuador': 1.3, 'Japan': 1.2, 'Uruguay': 1.1, 'Mexico': 1.0,
  'Senegal': 0.8, 'Canada': 0.7, 'South Korea': 0.5, 'Iran': 0.4,
  'Czech Republic': 0.4, 'Scotland': 0.35, 'Paraguay': 0.35,
  'Algeria': 0.25, 'United States': 0.3, 'Australia': 0.2,
  'Ivory Coast': 0.18, 'Panama': 0.1, 'Uzbekistan': 0.05,
  'Tunisia': 0.05, 'Bosnia and Herzegovina': 0.04, 'Egypt': 0.04,
  'Sweden': 0.04, 'Jordan': 0.025, 'Iraq': 0.025, 'Haiti': 0.015,
  'DR Congo': 0.015, 'Saudi Arabia': 0.01, 'Cape Verde': 0.01,
  'Qatar': 0.005, 'South Africa': 0.005, 'Ghana': 0.005,
  'New Zealand': 0.005, 'Curaçao': 0.005,
};

function TournamentTab() {
  const [sortCol, setSortCol] = useState('edge');
  const [sortDir, setSortDir] = useState(-1);

  const tableData = useMemo(() => TOURNAMENT_PREDICTIONS.map(t => ({
    ...t,
    mktWin: MARKET_WIN_PCT[t.team] || 0,
    edge: t.win - (MARKET_WIN_PCT[t.team] || 0),
  })), []);

  const sorted = useMemo(() =>
    [...tableData].sort((a, b) => sortDir * (b[sortCol] - a[sortCol])),
    [tableData, sortCol, sortDir]
  );

  const toggle = (col) => {
    if (sortCol === col) setSortDir(d => -d);
    else { setSortCol(col); setSortDir(-1); }
  };

  const Th = ({ col, children, right }) => (
    <TableHead
      className={`cursor-pointer select-none hover:text-gray-900 text-xs py-2 ${right ? 'text-right' : ''}`}
      onClick={() => toggle(col)}
    >
      {children}{sortCol === col ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Model win probability vs Polymarket implied odds — sorted by edge descending by default.
        Click any column header to resort.
      </p>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="text-xs py-2 w-8 text-gray-500">#</TableHead>
                <TableHead className="text-xs py-2 text-gray-500">Team</TableHead>
                <Th col="win" right>Model %</Th>
                <Th col="mktWin" right>Market %</Th>
                <Th col="edge" right>Edge</Th>
                <Th col="final" right>Final %</Th>
                <TableHead className="text-xs py-2">Signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((t, i) => (
                <TableRow key={t.team} className="hover:bg-gray-50/50 border-b border-gray-50">
                  <TableCell className="mono text-xs text-gray-400 py-2">{i + 1}</TableCell>
                  <TableCell className="text-xs font-medium py-2 text-gray-900">
                    {getFlag(t.team)} {t.team}
                  </TableCell>
                  <TableCell className="mono text-xs text-right text-blue-600 py-2">{pctR(t.win, 2)}</TableCell>
                  <TableCell className="mono text-xs text-right text-orange-500 py-2">{pctR(t.mktWin, 2)}</TableCell>
                  <TableCell className={`mono text-xs text-right font-semibold py-2 ${
                    t.edge >= 2 ? 'text-emerald-600' : t.edge <= -2 ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {t.edge >= 0 ? '+' : ''}{t.edge.toFixed(2)}%
                  </TableCell>
                  <TableCell className="mono text-xs text-right text-gray-500 py-2">{pctR(t.final, 1)}</TableCell>
                  <TableCell className="py-2">
                    {t.edge >= 2 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">VALUE</span>
                    ) : t.edge <= -2 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-semibold">AVOID</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 border border-gray-200">FAIR</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── Knockout Tab ─────────────────────────────────────────────────────────────

function KnockoutTab() {
  const topTeams = TOURNAMENT_PREDICTIONS.filter(t => t.sf >= 5).sort((a, b) => b.win - a.win);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="text-amber-600 font-semibold text-xs">Work in progress</span>
        <span className="text-amber-500 text-xs">—</span>
        <span className="text-xs text-amber-600">
          Knockout predictions will update as group stage results come in. Model re-runs Elo + form after each matchday.
        </span>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-700">SF+ Contenders — Monte Carlo (10,000 simulations)</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-100">
                {['Team','R32','R16','QF','SF','Final','Win'].map(h => (
                  <TableHead key={h} className="text-[10px] text-gray-500 py-2">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {topTeams.map(t => (
                <TableRow key={t.team} className="border-b border-gray-50 hover:bg-gray-50/40">
                  <TableCell className="text-xs font-medium py-2">{getFlag(t.team)} {t.team}</TableCell>
                  {[t.r32, t.r16, t.qf, t.sf, t.final].map((v, i) => (
                    <TableCell key={i} className="mono text-xs text-gray-600 py-2">{v.toFixed(0)}%</TableCell>
                  ))}
                  <TableCell className="mono text-xs font-bold text-emerald-600 py-2">{t.win.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── About Tab ────────────────────────────────────────────────────────────────

function AboutTab({ modelAccuracy }) {
  // Prefer live accuracy computed from WC API; fall back to embedded scorecard
  const { total: sTotal, correct: sCorrect, upsets, accuracy: sAccuracy } = MODEL_SCORECARD;
  const hasLive  = modelAccuracy.total > 0;
  const total    = hasLive ? modelAccuracy.total   : sTotal;
  const correct  = hasLive ? modelAccuracy.correct : sCorrect;
  const accuracy = hasLive ? modelAccuracy.pct      : sAccuracy.toFixed(0);

  return (
    <div className="max-w-2xl space-y-4">

      {/* Live scorecard */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {hasLive ? 'Live Model Scorecard' : 'Model Scorecard (WC API loading…)'}
          </p>
          {hasLive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              Live
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="mono text-2xl font-bold text-gray-900">{correct}/{total}</span>
          <span className="text-gray-500 text-sm">correct ({accuracy}%)</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {upsets} upset{upsets !== 1 ? 's' : ''} caught · Model vs every completed group stage match ·
          <span className="text-gray-300"> Updates automatically as results come in</span>
        </p>
        <div className="mt-2 h-1.5 bg-gray-100 rounded overflow-hidden">
          <div className="h-full bg-emerald-500 rounded transition-all duration-700"
               style={{ width: `${accuracy}%` }} />
        </div>
      </div>

      {/* Model details */}
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Model</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">M6 — Platt-scaled XGBoost</p>
          <p className="text-xs text-gray-500 mt-0.5">15,507 international matches · 1994–2022</p>
        </div>
        {[
          ['Features', 'Elo rating · Trailing form (3/6/12mo) · Squad quality index'],
          ['X-Factor', '3.25M Wyscout events → 6 validated behavioral features'],
          ['Accuracy', '56.3% on 2022 WC holdout · Log-loss 0.9898'],
          ['Calibration', 'Platt scaling vs isotonic regression'],
        ].map(([k, v]) => (
          <div key={k} className="px-4 py-2.5 flex gap-3">
            <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0 pt-0.5">{k}</span>
            <span className="text-xs text-gray-700">{v}</span>
          </div>
        ))}
      </div>

      {/* How to read */}
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">How to read edges</p>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs text-gray-600">
          <p>
            <strong className="text-gray-900">Edge</strong> = Model probability − Market probability.
            A +10% edge means our model assigns a 10pp higher win probability than the Polymarket crowd.
          </p>
          <p>
            <strong className="text-gray-900">¼ Kelly</strong> = Conservative bet sizing.
            Full Kelly maximizes long-run growth but is aggressive; 25% Kelly accounts for model uncertainty.
          </p>
          <div className="flex gap-2 mt-2">
            {[['STRONG SIGNAL', '≥10% edge', 'emerald'], ['VALUE', '5–10% edge', 'blue'], ['CONTRARIAN', 'Disagree on favorite', 'amber']].map(([l, d, c]) => (
              <div key={l} className={`flex-1 text-center border rounded p-2 bg-${c}-50 border-${c}-200`}>
                <div className={`text-[10px] font-bold text-${c}-700`}>{l}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border border-red-200 rounded-lg p-3 bg-red-50">
        <p className="text-xs text-red-700">
          <strong>⚠️ Disclaimer:</strong> Educational project. Not financial advice.
          Model accuracy is ~56% — nearly half of predictions are wrong.
          Past performance doesn't predict future results.
        </p>
      </div>

      {/* Credit */}
      <div className="flex items-center justify-between py-2 border-t border-gray-100">
        <span className="text-xs text-gray-500">Built by <strong className="text-gray-800">Ian</strong> · UC Berkeley Economics '26</span>
        <a href="https://github.com/ianamwork/wc2026-prediction" target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline font-medium">
          GitHub →
        </a>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ predictions, isLive, isRefreshing, lastUpdated, retry, modelAccuracy, scoreSource }) {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const valueBets = predictions.filter(p => p.best_edge >= 0.05).length;
  const best = predictions.reduce((b, p) => p.best_edge > b.best_edge ? p : b, predictions[0] || { best_edge: 0 });
  const bestLabel = best?.best_edge > 0 ? `+${(best.best_edge * 100).toFixed(1)}%` : '—';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between gap-6">
        {/* Left: brand */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-gray-900 text-sm">WC 2026 Scanner</span>
          <span className="text-gray-300 text-xs hidden sm:block">Model vs Market</span>
        </div>

        {/* Center: inline stats */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          <span className="text-gray-500">
            <span className="mono font-semibold text-emerald-600">{valueBets}</span>{' '}
            value bets
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">
            Best edge: <span className="mono font-semibold text-blue-600">{bestLabel}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">
            {modelAccuracy.total > 0 ? (
              <>
                Model: <span className="mono font-semibold text-gray-900">
                  {modelAccuracy.correct}/{modelAccuracy.total}
                </span>
                {' '}correct{' '}
                <span className={`mono font-semibold ${
                  modelAccuracy.pct >= 60 ? 'text-emerald-600' :
                  modelAccuracy.pct >= 50 ? 'text-blue-600' : 'text-red-500'
                }`}>({modelAccuracy.pct}%)</span>
                {scoreSource === 'fallback' && <span className="text-gray-300 text-[9px] ml-1">↓fb</span>}
              </>
            ) : (
              <>Model: <span className="mono font-semibold text-gray-900">56.3%</span> holdout</>
            )}
          </span>
        </div>

        {/* Right: live status */}
        <div className="flex items-center gap-2 shrink-0">
          {isRefreshing && <span className="text-[10px] text-gray-400">Refreshing...</span>}
          {!isLive && (
            <button onClick={retry} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-2 py-0.5 rounded transition-colors">
              Retry
            </button>
          )}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className={isLive ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
              {isLive
                ? lastUpdated ? `Live · ${relTime(lastUpdated)}` : 'Live'
                : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ predictions, isRefreshing }) {
  const valueBets = predictions.filter(p => p.best_edge >= 0.05);
  const best = predictions.reduce((b, p) => p.best_edge > b.best_edge ? p : b, predictions[0] || { best_edge: 0, home: '', away: '' });
  const betTeam = best?.best_dir === 'home' ? best.home : best?.best_dir === 'away' ? best.away : 'Draw';

  const stats = [
    {
      label: 'Value bets',
      value: <span className="mono text-3xl font-bold text-emerald-600">{valueBets.length}</span>,
      sub: 'matches with model edge ≥5%',
    },
    {
      label: 'Best edge today',
      value: <span className="mono text-xl font-bold text-blue-600">+{(best?.best_edge * 100 || 0).toFixed(1)}%</span>,
      sub: best?.best_edge > 0 ? `${getFlag(betTeam === 'Draw' ? null : betTeam)} ${betTeam} · ${best.home} vs ${best.away}` : '—',
    },
    {
      label: 'Model record (2022 WC)',
      value: <span className="mono text-2xl font-bold text-gray-900">56.3%</span>,
      sub: 'holdout accuracy · log-loss 0.9898',
    },
  ];

  return (
    <div className={`grid grid-cols-3 gap-3 transition-opacity ${isRefreshing ? 'opacity-50' : ''}`}>
      {stats.map(s => (
        <Card key={s.label} className={`border border-gray-200 shadow-none ${isRefreshing ? 'shimmer' : ''}`}>
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{s.label}</div>
            <div className="min-h-8 flex items-center">{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-1 truncate">{s.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { predictions, lastUpdated, isLive, isRefreshing, retry } = usePolymarket(30000);
  const { scoreMap, scoreSource } = useScores(30000);

  // Live model accuracy: check every completed match in scoreMap against model predictions
  const modelAccuracy = useMemo(() => {
    let correct = 0, total = 0;
    for (const pred of predictions) {
      const live = findScore(scoreMap, pred.home, pred.away);
      if (live?.status === 'completed' && live.homeScore != null && live.awayScore != null) {
        total++;
        if (computeModelCorrect(pred, live.homeScore, live.awayScore)) correct++;
      }
    }
    const pct = total > 0 ? Math.round((correct / total) * 100) : null;
    return { correct, total, pct };
  }, [predictions, scoreMap]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Header predictions={predictions} isLive={isLive} isRefreshing={isRefreshing} lastUpdated={lastUpdated} retry={retry} modelAccuracy={modelAccuracy} scoreSource={scoreSource} />
      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        <StatsBar predictions={predictions} isRefreshing={isRefreshing} />
        <Tabs defaultValue="matches">
          <TabsList className="bg-white border border-gray-200 shadow-none h-9">
            <TabsTrigger value="matches" className="text-xs h-7">Match Bets</TabsTrigger>
            <TabsTrigger value="tournament" className="text-xs h-7">Tournament Winner</TabsTrigger>
            <TabsTrigger value="knockout" className="text-xs h-7 gap-1">
              Knockout
              <span className="text-[9px] px-1 bg-amber-100 text-amber-700 rounded font-medium">WIP</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="text-xs h-7">About</TabsTrigger>
          </TabsList>
          <TabsContent value="matches" className="mt-4">
            <MatchBetsTab predictions={predictions} scoreMap={scoreMap} />
          </TabsContent>
          <TabsContent value="tournament" className="mt-4">
            <TournamentTab />
          </TabsContent>
          <TabsContent value="knockout" className="mt-4">
            <KnockoutTab />
          </TabsContent>
          <TabsContent value="about" className="mt-4">
            <AboutTab modelAccuracy={modelAccuracy} />
          </TabsContent>
        </Tabs>
      </main>
      <footer className="border-t border-gray-100 py-4 text-center text-[10px] text-gray-300 mt-8 mono">
        M6 XGBoost · 15,507 matches · Not financial advice · ianamwork/wc2026-prediction
      </footer>
    </div>
  );
}
