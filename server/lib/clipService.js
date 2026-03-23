/**
 * Clip Engine API Service
 *
 * Server-side adapter for fetching, normalizing, and deduplicating clips
 * from the Clip Engine API. Handles:
 * - Fetching clips by session key
 * - Score normalization (missing → null, 0 → 0, number → pass through)
 * - Deduplication by draft_id (exact) and athlete_id+apparatus+rotation (latest exported_at wins)
 * - Graceful defaults for optional fields
 * - Timeout and retry on server errors
 *
 * Firebase paths read:
 *   competitions/{compId}/config/sessionKey — Clip Engine session key
 *
 * Environment variables:
 *   CLIP_ENGINE_BASE_URL — API base URL (default: ngrok dev endpoint)
 */

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BASE_URL = 'https://unwronged-tyisha-littlish.ngrok-free.dev';
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBaseUrl() {
  return process.env.CLIP_ENGINE_BASE_URL || DEFAULT_BASE_URL;
}

/**
 * Normalize a score value from the API.
 * - undefined/null/missing → null (no score badge)
 * - 0 → 0 (real score, show "0.000")
 * - positive number → pass through
 */
function normalizeScore(score) {
  if (score === undefined || score === null || score === '') return null;
  const num = Number(score);
  if (isNaN(num)) return null;
  return num;
}

/**
 * Normalize a single clip from the API response.
 * Applies graceful defaults for optional fields.
 */
function normalizeClip(raw) {
  return {
    draft_id: raw.draft_id,
    clip_url: raw.clip_url || null,
    athlete_name: raw.athlete_name || 'Unknown',
    athlete_id: raw.athlete_id || null,
    team_name: raw.team_name || 'Unknown',
    team_id: raw.team_id || null,
    team_rtn_id: raw.team_rtn_id || null,
    rtn_id: raw.rtn_id || null,
    apparatus: raw.apparatus || null,
    rotation: raw.rotation ?? null,
    order: raw.order ?? 0,
    score: normalizeScore(raw.score),
    duration: raw.duration ?? null,
    gender: raw.gender || null,
    in_point: raw.in_point ?? null,
    out_point: raw.out_point ?? null,
    competition_name: raw.competition_name || null,
    source_video_id: raw.source_video_id ?? null,
    thumbnail_url: raw.thumbnail_url ?? null,
    exported_at: raw.exported_at || null,
  };
}

/**
 * Deduplicate clips:
 * 1. By draft_id (exact match — Map keyed on draft_id)
 * 2. By athlete_id+apparatus+rotation (reprocessed clips — keep latest exported_at)
 */
function deduplicateClips(clips) {
  // Step 1: Dedup by draft_id
  const byDraftId = new Map();
  for (const clip of clips) {
    if (!clip.draft_id) {
      console.warn('[clipService] Clip missing draft_id, skipping:', clip.athlete_name);
      continue;
    }
    byDraftId.set(clip.draft_id, clip);
  }

  // Step 2: Dedup by athlete_id+apparatus+rotation (keep latest exported_at)
  const byCompositeKey = new Map();
  for (const clip of byDraftId.values()) {
    if (!clip.athlete_id || !clip.apparatus || clip.rotation == null) {
      // Can't form composite key — keep the clip as-is
      byCompositeKey.set(clip.draft_id, clip);
      continue;
    }

    const compositeKey = `${clip.athlete_id}|${clip.apparatus}|${clip.rotation}`;
    const existing = byCompositeKey.get(compositeKey);

    if (!existing) {
      byCompositeKey.set(compositeKey, clip);
    } else {
      // Keep the one with the latest exported_at
      const existingDate = existing.exported_at ? new Date(existing.exported_at) : new Date(0);
      const newDate = clip.exported_at ? new Date(clip.exported_at) : new Date(0);
      if (newDate >= existingDate) {
        byCompositeKey.set(compositeKey, clip);
      }
    }
  }

  return Array.from(byCompositeKey.values());
}

// ============================================================================
// API Fetch
// ============================================================================

/**
 * Fetch clips from the Clip Engine API with timeout and retry on 5xx.
 * @param {string} sessionKey — The session key for the meet
 * @returns {Promise<Object>} Raw API response
 */
async function fetchClipsRaw(sessionKey) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/clip-api/meets/${encodeURIComponent(sessionKey)}/deliveries`;

  const attempt = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });
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
    // Retry once on 5xx errors
    if (err.message && err.message.startsWith('5')) {
      console.log(`[clipService] Retrying after server error: ${err.message}`);
      await sleep(RETRY_DELAY_MS);
      return await attempt();
    }
    throw err;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch and normalize clips for a session.
 * Returns a deduplicated array of normalized clip objects.
 *
 * @param {string} sessionKey — Clip Engine session key
 * @returns {Promise<{clips: Array, total: number, sessionKey: string, error: string|null}>}
 */
export async function fetchClips(sessionKey) {
  if (!sessionKey) {
    console.warn('[clipService] No session key provided');
    return { clips: [], total: 0, sessionKey: null, error: 'No session key' };
  }

  try {
    const raw = await fetchClipsRaw(sessionKey);

    if (!raw || !Array.isArray(raw.clips)) {
      console.warn('[clipService] Unexpected response shape:', typeof raw, raw ? Object.keys(raw) : 'null');
      return { clips: [], total: 0, sessionKey, error: 'Unexpected response shape' };
    }

    const normalized = raw.clips.map(normalizeClip);
    const deduplicated = deduplicateClips(normalized);

    console.log(`[clipService] Fetched ${raw.clips.length} clips, ${deduplicated.length} after dedup for session ${sessionKey}`);

    return {
      clips: deduplicated,
      total: deduplicated.length,
      sessionKey: raw.session_key || sessionKey,
      error: null,
    };
  } catch (err) {
    console.error(`[clipService] Error fetching clips for session ${sessionKey}:`, err.message);
    return { clips: [], total: 0, sessionKey, error: err.message };
  }
}

/**
 * Fetch clips and return only new ones not in the existing set.
 * Useful for polling — returns only clips with draft_ids not already known.
 *
 * @param {string} sessionKey
 * @param {Set<string>} existingDraftIds — Set of draft_ids already in the queue
 * @returns {Promise<{newClips: Array, allClips: Array, error: string|null}>}
 */
export async function fetchNewClips(sessionKey, existingDraftIds) {
  const result = await fetchClips(sessionKey);
  if (result.error) {
    return { newClips: [], allClips: [], error: result.error };
  }

  const newClips = result.clips.filter(c => !existingDraftIds.has(c.draft_id));

  if (newClips.length > 0) {
    console.log(`[clipService] ${newClips.length} new clips found (${result.clips.length} total)`);
  }

  return {
    newClips,
    allClips: result.clips,
    error: null,
  };
}
