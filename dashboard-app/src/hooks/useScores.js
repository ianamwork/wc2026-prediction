import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ─── Team name normalization ─────────────────────────────────────────────────
// Map API names → our model's canonical team names

const NAME_MAP = {
  // openfootball variations
  'Bosnia & Herzegovina':   'Bosnia and Herzegovina',
  'Bosnia & Herzegowina':   'Bosnia and Herzegovina',
  'Korea Republic':         'South Korea',
  'Republic of Korea':      'South Korea',
  "Côte d'Ivoire":          'Ivory Coast',
  "Cote d'Ivoire":          'Ivory Coast',
  'IR Iran':                'Iran',
  'Congo DR':               'DR Congo',
  'DR Congo (Congo-Kinshasa)': 'DR Congo',
  'Curacao':                'Curaçao',
  // primary API may use "United States" already, but just in case
  'USA':                    'United States',
  'US':                     'United States',
  // common alternates
  'Czech Rep.':             'Czech Republic',
  'Czechia':                'Czech Republic',
  'Saudi Arabia':           'Saudi Arabia',
  'New Zealand':            'New Zealand',
  'South Africa':           'South Africa',
};

const normalize = (name) => NAME_MAP[name] || name;

// ─── Parse helpers ────────────────────────────────────────────────────────────

// Primary API: { home_team_name_en, away_team_name_en, home_score, away_score,
//               finished ("TRUE"/"FALSE"), time_elapsed ("finished"/"notstarted"/"inprogress"),
//               local_date "06/13/2026 21:00", group (single letter) }
function parsePrimary(game) {
  const home = normalize(game.home_team_name_en || '');
  const away = normalize(game.away_team_name_en || '');
  const finished  = game.finished === 'TRUE';
  const inProgress = (game.time_elapsed || '').toLowerCase() === 'inprogress';

  // Parse "MM/DD/YYYY HH:MM" → "YYYY-MM-DD"
  let date = null;
  const m = (game.local_date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) date = `${m[3]}-${m[1]}-${m[2]}`;

  const hasResult = finished || inProgress;
  return {
    home,
    away,
    homeScore: hasResult ? parseInt(game.home_score, 10) : null,
    awayScore: hasResult ? parseInt(game.away_score, 10) : null,
    status:    finished ? 'completed' : inProgress ? 'live' : 'upcoming',
    date,
    group:     game.group || null,  // already single letter in this API
  };
}

// openfootball fallback: { team1, team2, score?: { ft: [h, a] }, date, group "Group A" }
function parseFallback(match) {
  const home = normalize(match.team1 || '');
  const away = normalize(match.team2 || '');
  const hasFt = Array.isArray(match.score?.ft);
  const group = (match.group || '').replace(/^Group\s+/, '');
  return {
    home,
    away,
    homeScore: hasFt ? match.score.ft[0] : null,
    awayScore: hasFt ? match.score.ft[1] : null,
    status:    hasFt ? 'completed' : 'upcoming',
    date:      match.date || null,
    group:     group || null,
  };
}

// ─── scoreKey / findScore ─────────────────────────────────────────────────────

export const scoreKey = (h, a) => `${h.toLowerCase()}|${a.toLowerCase()}`;

// Looks up a score by (home, away), trying both orderings.
// If found reversed, swaps homeScore/awayScore so caller always gets home-first perspective.
export function findScore(scoreMap, home, away) {
  const direct = scoreMap.get(scoreKey(home, away));
  if (direct) return direct;
  const rev = scoreMap.get(scoreKey(away, home));
  if (rev) return {
    ...rev,
    home:      rev.away,
    away:      rev.home,
    homeScore: rev.awayScore,
    awayScore: rev.homeScore,
  };
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScores(refreshInterval = 30000) {
  const [matchScores, setMatchScores] = useState([]);
  const [isLoaded,   setIsLoaded]     = useState(false);
  const [scoreSource, setScoreSource] = useState(null); // 'primary' | 'fallback' | null
  const [error,      setError]        = useState(null);
  const alive = useRef(true);

  const fetchScores = useCallback(async () => {
    // ── Primary: worldcup26.ir ──
    try {
      const res = await fetch('/api/wc/get/games', {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.games)) throw new Error('No games array');

      if (!alive.current) return;
      setMatchScores(data.games.map(parsePrimary));
      setScoreSource('primary');
      setError(null);
      return;
    } catch {
      // fall through to fallback
    }

    // ── Fallback: openfootball static JSON ──
    try {
      const res = await fetch(
        'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
        { signal: AbortSignal.timeout(12000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.matches)) throw new Error('No matches array');

      if (!alive.current) return;
      setMatchScores(data.matches.map(parseFallback));
      setScoreSource('fallback');
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError('Score data unavailable');
      setScoreSource(null);
    } finally {
      if (alive.current) setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    fetchScores();
    const id = setInterval(fetchScores, refreshInterval);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [fetchScores, refreshInterval]);

  // Build O(1) lookup map — keyed both ways so findScore can try either ordering
  const scoreMap = useMemo(() => {
    const map = new Map();
    for (const s of matchScores) {
      map.set(scoreKey(s.home, s.away), s);
      // Don't store the reverse here — findScore handles reversal with score swap
    }
    return map;
  }, [matchScores]);

  return { matchScores, scoreMap, isLoaded, scoreSource, error };
}
