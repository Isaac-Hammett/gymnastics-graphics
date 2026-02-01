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
// Score Parsing Helpers
// ============================================================================

/**
 * Parse a score value from RTN.
 * - String scores are parsed to numbers (e.g., "9.9250" -> 9.925)
 * - Negative scores (exhibition/scratch) are treated as null
 * - null/undefined/empty string -> null
 * - Results are rounded to 4 decimal places
 *
 * @param {*} val - Raw score value from RTN
 * @returns {number|null}
 */
function parseScore(val) {
  if (val === null || val === undefined || val === '' || val === '0.0000' || val === 0) return null;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return null;
  if (num < 0) return null; // Negative = exhibition/scratch
  return Math.round(num * 10000) / 10000;
}

/**
 * Coerce an RTN athlete ID to a string for consistent storage.
 * RTN uses 'id', 'gid', or 'gymnast_id' depending on endpoint, and types vary (string or number).
 *
 * @param {*} val - Raw ID value
 * @returns {string|null}
 */
function toRtnIdString(val) {
  if (val === null || val === undefined || val === '') return null;
  return String(val);
}

// ============================================================================
// Normalization Functions (Task 4)
// ============================================================================

/**
 * Normalize consistency data.
 * Raw shape: { labels: [...], vts: [...], ubs: [...], bbs: [...], fxs: [...] }
 * (men: fxs, phs, srs, vts, pbs, hbs)
 *
 * @param {Object} raw - Raw RTN consistency response
 * @param {string} gender - "mens" or "womens"
 * @returns {Object|null} { labels: string[], events: { VT: number[], UB: number[], ... } }
 */
function normalizeConsistency(raw, gender) {
  if (!raw || typeof raw !== 'object') return null;

  const labels = raw.labels || [];
  const eventMap = getConsistencyEvents(gender);
  const events = {};

  for (const [rtnField, stdCode] of Object.entries(eventMap)) {
    if (raw[rtnField] && Array.isArray(raw[rtnField])) {
      events[stdCode] = raw[rtnField].map(v => parseScore(v));
    }
  }

  if (Object.keys(events).length === 0) return null;

  return { labels, events };
}

/**
 * Normalize MVP data.
 * Raw shape: array of athlete objects with sum fields (vsum, ubsum, etc.) and gid.
 *
 * @param {Array} raw - Raw RTN MVP response
 * @param {string} gender - "mens" or "womens"
 * @returns {Array|null} Array of { rtnId, firstName, lastName, fullName, events: {...}, total }
 */
function normalizeMVP(raw, gender) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;

  const eventMap = getMvpEvents(gender);

  return raw.map(athlete => {
    const events = {};
    let total = 0;

    for (const [rtnField, stdCode] of Object.entries(eventMap)) {
      const score = parseScore(athlete[rtnField]);
      events[stdCode] = score;
      if (score !== null) total += score;
    }

    // Round total to 4 decimals to avoid floating-point artifacts
    total = Math.round(total * 10000) / 10000;

    return {
      rtnId: toRtnIdString(athlete.gid),
      firstName: (athlete.fname || '').trim(),
      lastName: (athlete.lname || '').trim(),
      fullName: `${(athlete.fname || '').trim()} ${(athlete.lname || '').trim()}`.trim(),
      events,
      total,
    };
  }).sort((a, b) => b.total - a.total);
}

/**
 * Normalize top scores data.
 * Raw shape: { data: [...top lineup entries...], max: number }
 * Each entry has gymnast_id and event-named fields (vault, bars, beam, floor for women).
 *
 * @param {Object} raw - Raw RTN top scores response
 * @param {string} gender - "mens" or "womens"
 * @returns {Object|null} { theoreticalMax, scores: [...], events: { VT: [...], UB: [...], ... } }
 */
function normalizeTopScores(raw, gender) {
  if (!raw || typeof raw !== 'object') return null;

  const rawData = raw.data || raw;
  if (!Array.isArray(rawData)) return null;

  const eventMap = getTopScoreEvents(gender);
  const theoreticalMax = parseScore(raw.max) || null;

  // Group athletes by event
  const events = {};
  for (const stdCode of Object.values(eventMap)) {
    events[stdCode] = [];
  }

  // Also build the flat scores array (top lineup entries)
  const scores = rawData.map(entry => {
    const row = {};
    for (const [rtnField, stdCode] of Object.entries(eventMap)) {
      row[rtnField] = entry[rtnField] || '';
    }
    return row;
  });

  // Build per-event top athletes
  for (const [rtnField, stdCode] of Object.entries(eventMap)) {
    // Collect athletes who have a score for this event
    const athletesWithScores = rawData
      .filter(entry => {
        const score = parseScore(entry[rtnField]);
        return score !== null;
      })
      .map(entry => ({
        rtnId: toRtnIdString(entry.gymnast_id || entry.gid || entry.id),
        firstName: (entry.fname || '').trim(),
        lastName: (entry.lname || '').trim(),
        fullName: `${(entry.fname || '').trim()} ${(entry.lname || '').trim()}`.trim(),
        high: parseScore(entry[rtnField]),
      }))
      .sort((a, b) => (b.high || 0) - (a.high || 0));

    events[stdCode] = athletesWithScores;
  }

  return { theoreticalMax, scores, events };
}

/**
 * Normalize lineup data.
 * Raw shape: array of athlete objects with binary meets arrays and id field.
 *
 * @param {Array} raw - Raw RTN lineup response
 * @param {string} gender - "mens" or "womens"
 * @returns {Array|null} Array of { rtnId, firstName, lastName, fullName, meets: number[], rate: number }
 */
function normalizeLineup(raw, gender) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;

  return raw.map(athlete => {
    const meets = athlete.meets || [];
    const totalMeets = meets.length;
    const competed = meets.filter(m => m === 1 || m === '1').length;
    const rate = totalMeets > 0 ? Math.round((competed / totalMeets) * 10000) / 10000 : 0;

    return {
      rtnId: toRtnIdString(athlete.id || athlete.gid),
      firstName: (athlete.fname || '').trim(),
      lastName: (athlete.lname || '').trim(),
      fullName: `${(athlete.fname || '').trim()} ${(athlete.lname || '').trim()}`.trim(),
      meets: meets.map(m => (m === 1 || m === '1') ? 1 : 0),
      rate,
    };
  });
}

/**
 * Normalize individual stats (highs or averages).
 * Raw shape: { team: [...], ind: [...] } — NOT a flat array.
 * The `ind` array contains athlete records with fields like maxv, maxub, maxbb, maxfx, maxaa (women)
 * or maxfx, maxph, maxsr, maxvt, maxpb, maxhb, maxaa (men), plus gid.
 *
 * @param {Object} raw - Raw RTN rostermain response
 * @param {string} gender - "mens" or "womens"
 * @returns {Array|null} Array of { rtnId, firstName, lastName, fullName, events: { VT, UB, ... } }
 */
function normalizeIndividualStats(raw, gender) {
  if (!raw || typeof raw !== 'object') return null;

  // Handle { team, ind } structure
  const athletes = raw.ind || raw;
  if (!Array.isArray(athletes) || athletes.length === 0) return null;

  const fieldMap = getIndividualFields(gender);

  return athletes.map(athlete => {
    const events = {};

    for (const [rtnField, stdCode] of Object.entries(fieldMap)) {
      events[stdCode] = parseScore(athlete[rtnField]);
    }

    return {
      rtnId: toRtnIdString(athlete.gid || athlete.id),
      firstName: (athlete.fname || '').trim(),
      lastName: (athlete.lname || '').trim(),
      fullName: `${(athlete.fname || '').trim()} ${(athlete.lname || '').trim()}`.trim(),
      events,
    };
  });
}

/**
 * Normalize individual highs (convenience wrapper).
 * @param {Object} raw - Raw RTN rostermain/{tid}/2 response
 * @param {string} gender
 * @returns {Array|null}
 */
function normalizeIndividualHighs(raw, gender) {
  return normalizeIndividualStats(raw, gender);
}

/**
 * Normalize individual averages (convenience wrapper).
 * @param {Object} raw - Raw RTN rostermain/{tid}/3 response
 * @param {string} gender
 * @returns {Array|null}
 */
function normalizeIndividualAverages(raw, gender) {
  return normalizeIndividualStats(raw, gender);
}

/**
 * Normalize team ranking from league results.
 * The results endpoint returns ALL teams; we find ours by tid.
 *
 * Raw shape: { data: [...], schema: {...} }
 * Each entry in data has: tid, rank, ave, high, rqs, conference, region, division, etc.
 *
 * @param {Object} raw - Raw RTN results response
 * @param {string} gender - "mens" or "womens"
 * @param {number|string} tid - RTN team ID to find
 * @returns {Object|null} { rank, ave, high, rqs, conference, region, division }
 */
function normalizeTeamRanking(raw, gender, tid) {
  if (!raw || typeof raw !== 'object') return null;

  const results = raw.data || raw;
  if (!Array.isArray(results) || results.length === 0) return null;

  const tidStr = String(tid);
  const team = results.find(t =>
    String(t.tid) === tidStr || String(t.id) === tidStr
  );

  if (!team) {
    console.warn(`[rtnStatsService] Team tid=${tid} not found in ranking results`);
    return null;
  }

  return {
    rank: team.rank ? String(team.rank) : null,
    ave: team.ave ? String(team.ave) : null,
    high: team.high ? String(team.high) : null,
    rqs: team.rqs != null ? String(team.rqs) : null,
    conference: team.conference || team.conf || null,
    region: team.region || null,
    division: team.division || team.div || null,
  };
}

/**
 * Normalize all raw fetch results for a team into the Firebase schema.
 * Takes the results array from rateLimitedFetch and produces the full stats object.
 *
 * @param {Array<{label: string, data: Object|null, status: string}>} fetchResults
 * @param {string} gender - "mens" or "womens"
 * @param {number|string} tid - RTN team ID
 * @returns {Object} { normalized: {...}, endpointStatus: {...} }
 */
function normalizeAllResults(fetchResults, gender, tid) {
  const normalized = {};
  const endpointStatus = {};

  for (const result of fetchResults) {
    endpointStatus[result.label] = result.status;

    if (result.status !== 'ok' || !result.data) continue;

    switch (result.label) {
      case 'teamRanking':
        normalized.teamRanking = normalizeTeamRanking(result.data, gender, tid);
        break;
      case 'consistency':
        normalized.consistency = normalizeConsistency(result.data, gender);
        break;
      case 'mvp':
        normalized.mvp = normalizeMVP(result.data, gender);
        break;
      case 'topScores':
        normalized.topScores = normalizeTopScores(result.data, gender);
        break;
      case 'lineup':
        normalized.lineup = normalizeLineup(result.data, gender);
        break;
      case 'individualHighs':
        normalized.individualHighs = normalizeIndividualHighs(result.data, gender);
        break;
      case 'individualAverages':
        normalized.individualAverages = normalizeIndividualAverages(result.data, gender);
        break;
    }
  }

  return { normalized, endpointStatus };
}

// ============================================================================
// Orchestration Functions (Task 5)
// ============================================================================

import productionConfigService from './productionConfigService.js';

const DEDUP_WINDOW_MS = 60 * 1000; // 60 seconds — skip if another ingestion just completed

/**
 * Parse competition type to extract gender and team count.
 * @param {string} compType - e.g., "womens-dual", "mens-tri", "womens-quad"
 * @returns {{ gender: string, teamCount: number }}
 */
function parseCompetitionType(compType) {
  if (!compType) return { gender: 'womens', teamCount: 2 };
  const parts = compType.toLowerCase().split('-');
  const gender = parts[0] === 'mens' ? 'mens' : 'womens';
  let teamCount = 2;
  if (parts[1]) {
    const typeMap = { dual: 2, tri: 3, quad: 4, '5': 5, '6': 6 };
    teamCount = typeMap[parts[1]] || 2;
  }
  return { gender, teamCount };
}

/**
 * Build a teamsDatabase key from a team name and gender.
 * Matches the client-side buildTeamKey() logic: lowercase, strip gender suffixes, hyphenate.
 * @param {string} schoolName - e.g., "Oklahoma", "Stanford"
 * @param {string} gender - "mens" or "womens"
 * @returns {string} e.g., "oklahoma-womens"
 */
function buildTeamDbKey(schoolName, gender) {
  if (!schoolName) return '';
  const normalized = schoolName
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/-mens$/, '')
    .replace(/-womens$/, '')
    .replace(/ mens$/, '')
    .replace(/ womens$/, '')
    .replace(/ men$/, '')
    .replace(/ women$/, '')
    .replace(/\s+/g, '-')
    .trim();
  if (!normalized) return '';
  const genderSuffix = gender === 'womens' ? 'womens' : 'mens';
  return `${normalized}-${genderSuffix}`;
}

/**
 * Check if a team's stats are stale (older than STALENESS_TTL).
 * @param {string} teamKey - teamsDatabase key, e.g., "oklahoma-womens"
 * @returns {Promise<{ isStale: boolean, fetchedAt: string|null, withinDedup: boolean }>}
 */
async function checkStaleness(teamKey) {
  const db = productionConfigService.getDb();
  if (!db) return { isStale: true, fetchedAt: null, withinDedup: false };

  try {
    const snapshot = await db.ref(`teamsDatabase/stats/${teamKey}/meta/fetchedAt`).once('value');
    const fetchedAt = snapshot.val();

    if (!fetchedAt) return { isStale: true, fetchedAt: null, withinDedup: false };

    const fetchedTime = new Date(fetchedAt).getTime();
    const now = Date.now();
    const age = now - fetchedTime;

    return {
      isStale: age > STALENESS_TTL,
      fetchedAt,
      withinDedup: age < DEDUP_WINDOW_MS,
    };
  } catch (err) {
    console.error(`[rtnStatsService] Error checking staleness for ${teamKey}:`, err.message);
    return { isStale: true, fetchedAt: null, withinDedup: false };
  }
}

/**
 * Ingest stats for a single team: fetch all RTN endpoints, normalize, and write to Firebase.
 *
 * @param {string} teamKey - teamsDatabase key, e.g., "oklahoma-womens"
 * @param {string|number} rtnId - RTN team ID
 * @param {string} gender - "mens" or "womens"
 * @param {number} year - Season year
 * @param {Object} [io] - Socket.IO server instance for progress events
 * @param {string} [compId] - Competition ID for progress events
 * @returns {Promise<{ status: string, endpointStatus: Object, errors: Object|null }>}
 */
async function ingestTeamStats(teamKey, rtnId, gender, year, io, compId) {
  const db = productionConfigService.getDb();
  if (!db) {
    return { status: 'error', endpointStatus: {}, errors: { firebase: 'Firebase not available' } };
  }

  const tidStr = String(rtnId);

  // Get current week for team ranking endpoint
  let week;
  try {
    week = await getCurrentWeek(gender, year);
  } catch (err) {
    console.warn(`[rtnStatsService] Failed to get week, using 1: ${err.message}`);
    week = 1;
  }

  // Build URLs and fetch all endpoints
  const urls = buildTeamStatUrls(gender, year, tidStr, week);

  const onProgress = (label, step, total, status) => {
    console.log(`[rtnStatsService] ${teamKey}: ${label} (${step}/${total}) - ${status}`);
    if (io && compId) {
      const roomName = `competition:${compId}`;
      io.to(roomName).emit('rtnStatsProgress', {
        compId,
        teamKey,
        endpoint: label,
        step,
        total,
        status,
      });
    }
  };

  const fetchResults = await rateLimitedFetch(urls, onProgress);

  // Normalize all results
  const { normalized, endpointStatus } = normalizeAllResults(fetchResults, gender, tidStr);

  // Determine overall status
  const statuses = Object.values(endpointStatus);
  const errorCount = statuses.filter(s => s === 'error').length;
  let overallStatus;
  if (errorCount === statuses.length) {
    overallStatus = 'error';
  } else if (errorCount > 0) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'complete';
  }

  // Build error details
  const errors = {};
  for (const result of fetchResults) {
    if (result.status === 'error') {
      errors[result.label] = result.error || 'Unknown error';
    }
  }

  // Build meta
  const meta = {
    fetchedAt: new Date().toISOString(),
    rtnId: tidStr,
    year,
    gender,
    week,
    status: overallStatus,
    errors: Object.keys(errors).length > 0 ? errors : null,
    endpointStatus,
  };

  // Write to Firebase: teamsDatabase/stats/{teamKey}/
  try {
    const statsRef = db.ref(`teamsDatabase/stats/${teamKey}`);
    const writeData = { ...normalized, meta };
    await statsRef.set(writeData);
    console.log(`[rtnStatsService] Wrote stats for ${teamKey} (status: ${overallStatus})`);
  } catch (err) {
    console.error(`[rtnStatsService] Failed to write stats for ${teamKey}:`, err.message);
    return { status: 'error', endpointStatus, errors: { ...errors, firebase: err.message } };
  }

  return { status: overallStatus, endpointStatus, errors: Object.keys(errors).length > 0 ? errors : null };
}

/**
 * Ingest RTN stats for all teams in a competition.
 * Checks staleness, deduplicates, fetches if needed, writes to shared store.
 *
 * @param {string} compId - Competition ID
 * @param {Object} [io] - Socket.IO server instance for progress/result events
 * @returns {Promise<{ success: boolean, teams: Object, error?: string }>}
 */
async function ingestCompetitionStats(compId, io) {
  const db = productionConfigService.getDb();
  if (!db) {
    return { success: false, teams: {}, error: 'Firebase not available' };
  }

  console.log(`[rtnStatsService] Starting ingestion for competition ${compId}`);

  // Read competition config
  let config;
  try {
    const configSnapshot = await db.ref(`competitions/${compId}/config`).once('value');
    config = configSnapshot.val();
  } catch (err) {
    console.error(`[rtnStatsService] Failed to read config for ${compId}:`, err.message);
    return { success: false, teams: {}, error: `Failed to read config: ${err.message}` };
  }

  if (!config) {
    return { success: false, teams: {}, error: 'Competition config not found' };
  }

  // Extract gender and team count
  const { gender, teamCount } = parseCompetitionType(config.compType);
  const year = new Date().getFullYear();

  // Build team name list from config
  const teamNames = [];
  for (let i = 1; i <= teamCount; i++) {
    const name = config[`team${i}Name`];
    if (name) teamNames.push({ index: i, name });
  }

  if (teamNames.length === 0) {
    return { success: false, teams: {}, error: 'No team names found in config' };
  }

  const teamResults = {};

  for (const { index, name } of teamNames) {
    const teamKey = buildTeamDbKey(name, gender);
    if (!teamKey) {
      console.warn(`[rtnStatsService] Could not build team key for "${name}"`);
      teamResults[`team${index}`] = { teamKey: null, status: 'error', error: 'Invalid team name' };
      continue;
    }

    // Look up RTN ID from teamsDatabase
    let rtnId;
    try {
      const rtnIdSnapshot = await db.ref(`teamsDatabase/teams/${teamKey}/rtnId`).once('value');
      rtnId = rtnIdSnapshot.val();
    } catch (err) {
      console.error(`[rtnStatsService] Failed to read rtnId for ${teamKey}:`, err.message);
    }

    if (!rtnId) {
      console.warn(`[rtnStatsService] No RTN ID for team ${teamKey} — skipping`);
      // Write error to meta so the UI can see it
      try {
        await db.ref(`teamsDatabase/stats/${teamKey}/meta`).update({
          status: 'error',
          errors: { rtnId: 'RTN ID not set. Run Media Manager team setup first.' },
          fetchedAt: new Date().toISOString(),
        });
      } catch (e) {
        // Best effort
      }
      teamResults[`team${index}`] = { teamKey, status: 'error', error: 'Missing RTN ID' };
      continue;
    }

    // Check staleness
    const staleness = await checkStaleness(teamKey);

    if (staleness.withinDedup) {
      console.log(`[rtnStatsService] ${teamKey}: Recently ingested (dedup window), skipping`);
      teamResults[`team${index}`] = { teamKey, status: 'skipped', reason: 'dedup' };
      continue;
    }

    if (!staleness.isStale) {
      console.log(`[rtnStatsService] ${teamKey}: Stats are fresh (fetched ${staleness.fetchedAt}), skipping`);
      teamResults[`team${index}`] = { teamKey, status: 'skipped', reason: 'fresh' };
      continue;
    }

    // Stats are stale or missing — fetch from RTN
    console.log(`[rtnStatsService] ${teamKey}: Stats are stale/missing, fetching from RTN...`);
    const result = await ingestTeamStats(teamKey, rtnId, gender, year, io, compId);
    teamResults[`team${index}`] = { teamKey, ...result };
  }

  const allStatuses = Object.values(teamResults).map(r => r.status);
  const allErrors = allStatuses.every(s => s === 'error');

  const success = !allErrors;

  console.log(`[rtnStatsService] Ingestion complete for ${compId}: ${JSON.stringify(teamResults)}`);

  return { success, teams: teamResults };
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

  // Score parsing
  parseScore,
  toRtnIdString,

  // Normalization functions (Task 4)
  normalizeConsistency,
  normalizeMVP,
  normalizeTopScores,
  normalizeLineup,
  normalizeIndividualHighs,
  normalizeIndividualAverages,
  normalizeIndividualStats,
  normalizeTeamRanking,
  normalizeAllResults,

  // Orchestration functions (Task 5)
  parseCompetitionType,
  buildTeamDbKey,
  checkStaleness,
  ingestTeamStats,
  ingestCompetitionStats,
};
