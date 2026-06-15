import { useState, useEffect, useRef, useCallback } from 'react';
import { MATCH_PREDICTIONS } from '../data/modelPredictions';

// WC 2026 events use 3 binary Yes/No markets per match.
// groupItemTitle tells us which outcome: "Germany", "Ecuador", "Draw (X vs Y)"
const parseBinaryMarkets = (markets, homeTeam, awayTeam) => {
  let home = null, draw = null, away = null;

  for (const m of markets) {
    const title = (m.groupItemTitle || '').toLowerCase();
    const prices = m.outcomePrices ? JSON.parse(m.outcomePrices) : [];
    const outcomes = m.outcomes ? JSON.parse(m.outcomes) : [];
    const yesIdx = outcomes.findIndex(o => o === 'Yes');
    if (yesIdx < 0 || prices.length <= yesIdx) continue;
    const yesProb = parseFloat(prices[yesIdx]);

    if (title.includes('draw')) {
      draw = yesProb;
    } else if (title === homeTeam.toLowerCase() || title === homeTeam.toLowerCase().trim()) {
      home = yesProb;
    } else if (title === awayTeam.toLowerCase() || title === awayTeam.toLowerCase().trim()) {
      away = yesProb;
    }
  }

  if (home === null && away === null && draw === null) return null;

  // Fill missing with remaining
  if (home !== null && away !== null && draw === null) draw = Math.max(0, 1 - home - away);
  if (home !== null && draw !== null && away === null) away = Math.max(0, 1 - home - draw);
  if (away !== null && draw !== null && home === null) home = Math.max(0, 1 - away - draw);

  // Normalize so they sum to 1
  const total = (home || 0) + (draw || 0) + (away || 0);
  if (total <= 0) return null;

  return {
    mkt_home: (home || 0) / total,
    mkt_draw: (draw || 0) / total,
    mkt_away: (away || 0) / total,
  };
};

const BATCH_SIZE = 10;

export function usePolymarket(refreshInterval = 30000) {
  const [liveData, setLiveData] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const failCount = useRef(0);
  const stopped = useRef(false);

  const fetchMarkets = useCallback(async () => {
    if (stopped.current) return;
    setIsRefreshing(true);

    try {
      // Batch-fetch all WC 2026 slugs in groups of BATCH_SIZE
      const slugs = MATCH_PREDICTIONS.map(p => p.slug);
      const allEvents = [];

      for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
        const batch = slugs.slice(i, i + BATCH_SIZE);
        const params = batch.map(s => `slug=${encodeURIComponent(s)}`).join('&');
        const res = await fetch(`/api/gamma/events?${params}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) allEvents.push(...data);
      }

      if (allEvents.length === 0) throw new Error('No events returned');

      const result = {};
      for (const event of allEvents) {
        const slug = event.slug || event.ticker;
        if (!slug) continue;

        const pred = MATCH_PREDICTIONS.find(p => p.slug === slug);
        if (!pred) continue;

        const markets = event.markets || [];
        const parsed = parseBinaryMarkets(markets, pred.home, pred.away);
        if (parsed) {
          result[slug] = { ...parsed, source: 'live', volume: event.volume || 0 };
        }
      }

      if (Object.keys(result).length > 0) {
        setLiveData(result);
        setLastUpdated(new Date());
        setIsLive(true);
        failCount.current = 0;
      } else {
        throw new Error('No parseable market data');
      }
    } catch {
      failCount.current += 1;
      if (failCount.current >= 3) {
        setIsLive(false);
        stopped.current = true;
      }
    }

    setIsRefreshing(false);
  }, []);

  const retry = useCallback(() => {
    stopped.current = false;
    failCount.current = 0;
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(() => {
      if (!stopped.current) fetchMarkets();
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMarkets, refreshInterval]);

  const mergedPredictions = MATCH_PREDICTIONS.map(pred => {
    const live = liveData[pred.slug];
    if (!live) return pred;

    const { mkt_home, mkt_draw, mkt_away } = live;
    const edge_home = pred.mdl_home - mkt_home;
    const edge_draw = pred.mdl_draw - mkt_draw;
    const edge_away = pred.mdl_away - mkt_away;

    const candidates = [
      { dir: 'home', edge: edge_home, mdl: pred.mdl_home, mkt: mkt_home },
      { dir: 'draw', edge: edge_draw, mdl: pred.mdl_draw, mkt: mkt_draw },
      { dir: 'away', edge: edge_away, mdl: pred.mdl_away, mkt: mkt_away },
    ];
    const best = candidates.reduce((a, b) => a.edge > b.edge ? a : b);
    const kelly_full = best.edge > 0 && best.mkt > 0 ? (best.edge / (1 / best.mkt - 1)) : 0;

    return {
      ...pred,
      mkt_home, mkt_draw, mkt_away,
      edge_home, edge_draw, edge_away,
      best_edge: best.edge,
      best_dir: best.dir,
      mdl_best: best.mdl,
      mkt_best: best.mkt,
      kelly_quarter: kelly_full * 0.25,
      source: 'live',
      vol_24h: live.volume || pred.vol_24h,
    };
  });

  return { predictions: mergedPredictions, lastUpdated, isLive, isRefreshing, retry };
}
