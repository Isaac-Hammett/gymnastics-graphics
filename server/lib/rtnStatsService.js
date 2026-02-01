/**
 * RTN Stats Service
 *
 * Server-side service for fetching, normalizing, and storing NCAA gymnastics
 * statistics from Road To Nationals (roadtonationals.com).
 *
 * This service handles:
 * - Fetching all 8 RTN stat endpoints per team (rate-limited)
 * - Rate limiting (200ms between requests, 10s timeout, retry on 500)
 * - Event code translation for men's and women's gymnastics
 *
 * Firebase paths written:
 *   teamsDatabase/stats/{teamKey}/  - Shared stats store (source of truth)
 *
 * Task 3: Fetch functions and rate limiting only.
 * Tasks 4-7 add normalization, orchestration, config sync, and socket wiring.
 */

// ============================================================================
// Constants
// ============================================================================

const RTN_BASE = 'https://www.roadtonationals.com/api';
const RATE_LIMIT_MS = 200;
const REQUEST_TIMEOUT_MS = 10000;
const STALENESS_TTL = 24 * 60 * 60 * 1000; // 24 hours
const RANKINGS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Women's consistency event field -> standard code
const WOMENS_CONSISTENCY_EVENTS = { vts: 'VT', ubs: 'UB', bbs: 'BB', fxs: 'FX' };
// Men's consistency event field -> standard code
const MENS_CONSISTENCY_EVENTS = { fxs: 'FX', phs: 'PH', srs: 'SR', vts: 'VT', pbs: 'PB', hbs: 'HB' };

// Women's MVP sum fields -> standard code
const WOMENS_MVP_EVENTS = { vsum: 'VT', ubsum: 'UB', bbsum: 'BB', fsum: 'FX' };
// Men's MVP sum fields -> standard code
const MENS_MVP_EVENTS = { fxsum: 'FX', phsum: 'PH', srsum: 'SR', vsum: 'VT', pbsum: 'PB', hbsum: 'HB' };

// Women's individual stats fields (highs/averages) -> standard code
const WOMENS_INDIVIDUAL_FIELDS = { maxv: 'VT', maxub: 'UB', maxbb: 'BB', maxfx: 'FX', maxaa: 'AA' };
// Men's individual stats fields -> standard code
const MENS_INDIVIDUAL_FIELDS = { maxfx: 'FX', maxph: 'PH', maxsr: 'SR', maxvt: 'VT', maxpb: 'PB', maxhb: 'HB', maxaa: 'AA' };

// Individual ranking event numbers -> standard code
const WOMENS_INDIVIDUAL_EVENTS = { 1: 'VT', 2: 'UB', 3: 'BB', 4: 'FX', 5: 'AA' };
const MENS_INDIVIDUAL_EVENTS = { 1: 'FX', 2: 'PH', 3: 'SR', 4: 'VT', 5: 'PB', 6: 'HB', 7: 'AA' };

// Team ranking type codes
const TEAM_RANKING_TYPE = { womens: 5, mens: 7 };

// Top scores event field names (same for men/women where applicable)
const WOMENS_TOP_SCORE_EVENTS = { vault: 'VT', bars: 'UB', beam: 'BB', floor: 'FX' };
const MENS_TOP_SCORE_EVENTS = { floor: 'FX', phorse: 'PH', rings: 'SR', vault: 'VT', pbars: 'PB', highbar: 'HB' };

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getGenderPath(gender) {
  return gender === 'womens' ? 'women' : 'men';
}

function getConsistencyEvents(gender) {
  return gender === 'womens' ? WOMENS_CONSISTENCY_EVENTS : MENS_CONSISTENCY_EVENTS;
}

function getMvpEvents(gender) {
  return gender === 'womens' ? WOMENS_MVP_EVENTS : MENS_MVP_EVENTS;
}

function getIndividualFields(gender) {
  return gender === 'womens' ? WOMENS_INDIVIDUAL_FIELDS : MENS_INDIVIDUAL_FIELDS;
}

function getIndividualEventNumbers(gender) {
  return gender === 'womens' ? WOMENS_INDIVIDUAL_EVENTS : MENS_INDIVIDUAL_EVENTS;
}

function getTopScoreEvents(gender) {
  return gender === 'womens' ? WOMENS_TOP_SCORE_EVENTS : MENS_TOP_SCORE_EVENTS;
}

function getTeamRankingType(gender) {
  return TEAM_RANKING_TYPE[gender] || 5;
}

// ============================================================================
// Rate-Limited Fetch
// ============================================================================

/**
 * Fetch a single URL with timeout and retry-once on 500 errors.
 * @param {string} url
 * @returns {Promise<Object>} Parsed JSON response
 */
async function fetchWithRetry(url) {
  const attempt = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    return await attempt();
  } catch (err) {
    // Retry once on 500-level errors
    if (err.message && err.message.startsWith('5')) {
      console.log(`[rtnStatsService] Retrying after 500 error: ${url}`);
      await sleep(1000);
      return await attempt();
    }
    throw err;
  }
}

/**
 * Fetch multiple URLs sequentially with rate limiting.
 * Each entry: { url, label }
 * Returns array of { label, data, status, error? }
 *
 * @param {Array<{url: string, label: string}>} urls
 * @param {Function} [onProgress] - Callback: (label, step, total, status)
 * @returns {Promise<Array<{label: string, data: Object|null, status: string, error?: string}>>}
 */
async function rateLimitedFetch(urls, onProgress) {
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const { url, label } = urls[i];
    try {
      const data = await fetchWithRetry(url);
      // Check for empty responses
      const isEmpty = data === null || data === undefined ||
        (Array.isArray(data) && data.length === 0) ||
        (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0);

      if (isEmpty) {
        results.push({ label, data: null, status: 'empty' });
      } else {
        results.push({ label, data, status: 'ok' });
      }
    } catch (err) {
      console.error(`[rtnStatsService] Fetch failed for ${label}: ${err.message}`);
      results.push({ label, data: null, status: 'error', error: err.message });
    }
    if (onProgress) onProgress(label, i + 1, urls.length, results[results.length - 1].status);
    if (i < urls.length - 1) await sleep(RATE_LIMIT_MS);
  }
  return results;
}

// ============================================================================
// Individual Fetch Functions
// ============================================================================

/**
 * Fetch team consistency data (per-meet event scores over season)
 * Endpoint: /{gender}/teamConsistency/{year}/{tid}
 */
async function fetchConsistency(gender, year, tid) {
  const url = `${RTN_BASE}/${getGenderPath(gender)}/teamConsistency/${year}/${tid}`;
  return fetchWithRetry(url);
}

/**
 * Fetch MVP data (athlete contribution totals)
 * Endpoint: /{gender}/mvp/{year}/{tid}
 */
async function fetchMVP(gender, year, tid) {
  const url = `${RTN_BASE}/${getGenderPath(gender)}/mvp/${year}/${tid}`;
  return fetchWithRetry(url);
}

/**
 * Fetch top scores (best possible lineup)
 * Endpoint: /{gender}/topscores/{year}/{tid}
 */
async function fetchTopScores(gender, year, tid) {
  const url = `${RTN_BASE}/${getGenderPath(gender)}/topscores/${year}/${tid}`;
  return fetchWithRetry(url);
}

/**
 * Fetch lineup data (meet-by-meet lineup usage)
 * Endpoint: /{gender}/lineup/{year}/{tid}
 */
async function fetchLineup(gender, year, tid) {
  const url = `${RTN_BASE}/${getGenderPath(gender)}/lineup/${year}/${tid}`;
  return fetchWithRetry(url);
}

/**
 * Fetch individual high scores per athlete
 * Endpoint: /{gender}/rostermain/{year}/{tid}/2
 */
async function fetchIndividualHighs(gender, year, tid) {
  const url = `${RTN_BASE}/${getGenderPath(gender)}/rostermain/${year}/${tid}/2`;
  return fetchWithRetry(url);
}

/**
 * Fetch individual averages per athlete
 * Endpoint: /{gender}/rostermain/{year}/{tid}/3
 */
async function fetchIndividualAverages(gender, year, tid) {
  const url = `${RTN_BASE}/${getGenderPath(gender)}/rostermain/${year}/${tid}/3`;
  return fetchWithRetry(url);
}

/**
 * Fetch team ranking from league results
 * Endpoint: /{gender}/results/{year}/{week}/0/{type}
 *
 * Returns the full ranking results; caller should find the team by tid.
 */
async function fetchTeamRanking(gender, year, week, tid) {
  const type = getTeamRankingType(gender);
  const url = `${RTN_BASE}/${getGenderPath(gender)}/results/${year}/${week}/0/${type}`;
  return fetchWithRetry(url);
}

/**
 * Determine the current RTN week for a given gender and year.
 * Fetches the results schema and looks for the current week.
 *
 * Endpoint: /{gender}/results/{year}/1/0/{type}
 * The response includes a `schema.weeks` array with week objects.
 * Looks for the week with `current: "1"` or falls back to the latest week with `rqs: "1"`.
 *
 * @param {string} gender - "mens" or "womens"
 * @param {number} year
 * @returns {Promise<number>} Week number (defaults to 1 on failure)
 */
async function getCurrentWeek(gender, year) {
  try {
    const type = getTeamRankingType(gender);
    const url = `${RTN_BASE}/${getGenderPath(gender)}/results/${year}/1/0/${type}`;
    const data = await fetchWithRetry(url);

    if (data?.schema?.weeks && Array.isArray(data.schema.weeks)) {
      // Look for the week marked as current
      const currentWeek = data.schema.weeks.find(w => w.current === '1' || w.current === 1);
      if (currentWeek?.week) {
        return parseInt(currentWeek.week, 10);
      }

      // Fallback: latest week with rqs enabled
      const rqsWeeks = data.schema.weeks.filter(w => w.rqs === '1' || w.rqs === 1);
      if (rqsWeeks.length > 0) {
        const latest = rqsWeeks[rqsWeeks.length - 1];
        return parseInt(latest.week, 10);
      }

      // Fallback: last week in array
      if (data.schema.weeks.length > 0) {
        const last = data.schema.weeks[data.schema.weeks.length - 1];
        return parseInt(last.week, 10);
      }
    }

    console.warn('[rtnStatsService] Could not determine current week, defaulting to 1');
    return 1;
  } catch (err) {
    console.error(`[rtnStatsService] Failed to get current week: ${err.message}`);
    return 1;
  }
}

/**
 * Build the list of URLs for all 8 stat endpoints for a team.
 * Used by rateLimitedFetch for sequential fetching.
 *
 * @param {string} gender - "mens" or "womens"
 * @param {number} year
 * @param {number|string} tid - RTN team ID
 * @param {number} week - Current RTN week
 * @returns {Array<{url: string, label: string}>}
 */
function buildTeamStatUrls(gender, year, tid, week) {
  const g = getGenderPath(gender);
  const type = getTeamRankingType(gender);
  return [
    { url: `${RTN_BASE}/${g}/results/${year}/${week}/0/${type}`, label: 'teamRanking' },
    { url: `${RTN_BASE}/${g}/teamConsistency/${year}/${tid}`, label: 'consistency' },
    { url: `${RTN_BASE}/${g}/mvp/${year}/${tid}`, label: 'mvp' },
    { url: `${RTN_BASE}/${g}/topscores/${year}/${tid}`, label: 'topScores' },
    { url: `${RTN_BASE}/${g}/lineup/${year}/${tid}`, label: 'lineup' },
    { url: `${RTN_BASE}/${g}/rostermain/${year}/${tid}/2`, label: 'individualHighs' },
    { url: `${RTN_BASE}/${g}/rostermain/${year}/${tid}/3`, label: 'individualAverages' },
  ];
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Constants
  RTN_BASE,
  RATE_LIMIT_MS,
  REQUEST_TIMEOUT_MS,
  STALENESS_TTL,
  RANKINGS_CACHE_TTL,
  TEAM_RANKING_TYPE,

  // Event mappings
  WOMENS_CONSISTENCY_EVENTS,
  MENS_CONSISTENCY_EVENTS,
  WOMENS_MVP_EVENTS,
  MENS_MVP_EVENTS,
  WOMENS_INDIVIDUAL_FIELDS,
  MENS_INDIVIDUAL_FIELDS,
  WOMENS_INDIVIDUAL_EVENTS,
  MENS_INDIVIDUAL_EVENTS,
  WOMENS_TOP_SCORE_EVENTS,
  MENS_TOP_SCORE_EVENTS,

  // Helpers
  sleep,
  getGenderPath,
  getConsistencyEvents,
  getMvpEvents,
  getIndividualFields,
  getIndividualEventNumbers,
  getTopScoreEvents,
  getTeamRankingType,

  // Fetch functions
  fetchWithRetry,
  rateLimitedFetch,
  fetchConsistency,
  fetchMVP,
  fetchTopScores,
  fetchLineup,
  fetchIndividualHighs,
  fetchIndividualAverages,
  fetchTeamRanking,
  getCurrentWeek,

  // URL builder
  buildTeamStatUrls,
};
