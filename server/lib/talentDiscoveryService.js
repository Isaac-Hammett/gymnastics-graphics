/**
 * Talent Discovery Service
 *
 * AI-powered discovery of potential commentary talent from college gymnastics
 * alumni rosters. Uses web scraping + Claude API for candidate scoring.
 *
 * PRD-Commentary-Talent-CRM Phase 4
 */

import Anthropic from '@anthropic-ai/sdk';
import admin from 'firebase-admin';

// ============================================================================
// Configuration
// ============================================================================

// RTN does not have public alumni roster pages via their API
// This service attempts to scrape school athletic department pages
// For MVP, we'll use a flexible approach that can handle multiple URL patterns

const RTN_TEAMS_BASE = 'https://www.rtnathletics.com/teams';
const SCHOOL_ROSTER_PATTERNS = {
  // These are potential URL patterns - will need to be validated/updated
  // Most schools have their own athletic department sites, not RTN-hosted rosters
  rtn: (schoolSlug) => `${RTN_TEAMS_BASE}/${schoolSlug}/roster`,
  // Fallback: many schools use their own athletic department sites
  // We'll need school-specific mappings for production use
};

// Claude model for scoring
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// Levenshtein distance for fuzzy name matching (dedup check)
const FUZZY_MATCH_THRESHOLD = 0.85; // 85% similarity

// ============================================================================
// Firebase Integration
// ============================================================================

let db = null;

/**
 * Get Firebase database reference
 * Reuses the existing Firebase Admin initialization from other services
 */
function getDb() {
  if (!db) {
    try {
      db = admin.database();
    } catch (error) {
      console.error('[talentDiscoveryService] Firebase not initialized:', error.message);
      return null;
    }
  }
  return db;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy name matching to detect duplicates
 */
function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function similarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshtein(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Normalize name for comparison (lowercase, trim)
 */
function normalizeName(name) {
  return name.toLowerCase().trim();
}

/**
 * Check if a candidate already exists in the talent roster
 * Uses fuzzy name matching to catch variations in spelling
 */
async function checkIfInRoster(candidateName) {
  const database = getDb();
  if (!database) {
    console.warn('[talentDiscoveryService] Firebase not available for dedup check');
    return false;
  }

  try {
    const snapshot = await database.ref('talentRoster').once('value');
    const roster = snapshot.val();

    if (!roster) {
      return false;
    }

    const normalizedCandidate = normalizeName(candidateName);

    // Check all existing talent entries for fuzzy name match
    for (const [talentId, talent] of Object.entries(roster)) {
      if (talent && talent.name) {
        const normalizedExisting = normalizeName(talent.name);
        const similarityScore = similarity(normalizedCandidate, normalizedExisting);

        if (similarityScore >= FUZZY_MATCH_THRESHOLD) {
          console.log(`[talentDiscoveryService] Found existing talent: "${candidateName}" matches "${talent.name}" (${Math.round(similarityScore * 100)}% similar)`);
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('[talentDiscoveryService] Error checking roster:', error.message);
    return false;
  }
}

/**
 * Fetch alumni roster data for a school
 * This is a placeholder implementation - actual URL patterns will vary by school
 *
 * @param {string} schoolName - School name (e.g., "Stanford", "Oklahoma")
 * @returns {Promise<Array>} Array of { name, graduationYear }
 */
async function fetchAlumniRoster(schoolName) {
  // For MVP, we'll return a mock structure
  // In production, this would scrape the actual school pages
  // RTN doesn't have public alumni rosters - most schools use their own athletic dept sites

  console.log(`[talentDiscoveryService] Fetching alumni roster for ${schoolName}`);

  // Attempt to fetch from RTN pattern (likely to fail - RTN doesn't have this)
  const schoolSlug = schoolName.toLowerCase().replace(/\s+/g, '-');
  const rtnUrl = SCHOOL_ROSTER_PATTERNS.rtn(schoolSlug);

  try {
    const response = await fetch(rtnUrl, {
      headers: {
        'User-Agent': 'GymnasticsGraphics/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Basic HTML parsing (would need to be more sophisticated for real use)
    // This is a placeholder - actual implementation would parse the HTML structure
    // Most schools don't have machine-readable roster data, so this will often fail

    console.log('[talentDiscoveryService] Successfully fetched roster page');

    // Parse HTML for athlete names and graduation years
    // This is highly site-specific and would need per-school logic
    const athletes = parseRosterHTML(html, schoolName);

    return athletes;

  } catch (error) {
    console.warn(`[talentDiscoveryService] Failed to fetch from RTN (${rtnUrl}): ${error.message}`);

    // Fallback: Return empty array with informative error
    // In production, this is where we'd try alternative sources or return an error
    throw new Error(`Alumni roster not available for ${schoolName}. RTN does not provide public alumni rosters. Consider manual entry or alternative data sources.`);
  }
}

/**
 * Parse HTML roster page
 * Placeholder implementation - would need school-specific parsing logic
 */
function parseRosterHTML(html, schoolName) {
  // This is a placeholder
  // Real implementation would parse the HTML structure of the roster page
  // Each school has different HTML structures, making this very brittle

  // For now, return empty array to signal "no data available"
  return [];
}

/**
 * Score candidates using Claude API in a single batch call
 * CRITICAL: Batch all candidates in ONE API call to avoid N+1 timeout issues
 *
 * @param {Array} athletes - Array of { name, graduationYear, school }
 * @returns {Promise<Array>} Array of candidate cards with scores
 */
async function scoreAlumniWithClaude(athletes, schoolName) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  if (!athletes || athletes.length === 0) {
    return [];
  }

  console.log(`[talentDiscoveryService] Scoring ${athletes.length} candidates with Claude`);

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Build a prompt that includes ALL athletes
  // This avoids N+1 API calls which would cause HTTP timeout
  const athleteList = athletes.map((a, idx) =>
    `${idx + 1}. ${a.name}${a.graduationYear ? ` (Class of ${a.graduationYear})` : ''}`
  ).join('\n');

  const prompt = `You are evaluating former collegiate gymnasts from ${schoolName} as potential remote gymnastics commentators.

Here is a list of ${athletes.length} alumni:

${athleteList}

For each person, provide:
1. A suitability score from 1-5 (5 = excellent candidate, 1 = not suitable)
2. A brief explanation (1-2 sentences) of why they would or wouldn't be a good commentator

Scoring criteria:
- Recent graduation (more recent = higher score, as they're more familiar with current NCAA gymnastics)
- Years competed (4+ years = stronger candidate)
- Consider that being an athlete doesn't automatically make someone a good commentator

IMPORTANT: Do NOT attempt to find social media links. Return null for linkedIn and instagram fields.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
[
  {
    "name": "First Last",
    "score": 3,
    "explanation": "Brief explanation here",
    "linkedIn": null,
    "instagram": null
  }
]`;

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract the response text
    const responseText = message.content[0].text;

    // Parse JSON response
    let scoredCandidates;
    try {
      scoredCandidates = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[talentDiscoveryService] Failed to parse Claude response as JSON:', responseText);
      throw new Error('Claude API returned invalid JSON');
    }

    // Validate response structure
    if (!Array.isArray(scoredCandidates)) {
      throw new Error('Claude API response is not an array');
    }

    // Add school name and check if already in roster
    const candidateCards = await Promise.all(
      scoredCandidates.map(async (candidate) => {
        const alreadyInRoster = await checkIfInRoster(candidate.name);

        return {
          name: candidate.name,
          school: schoolName,
          graduationYear: athletes.find(a => a.name === candidate.name)?.graduationYear || null,
          score: candidate.score,
          explanation: candidate.explanation,
          linkedIn: null, // Always null per task requirements
          instagram: null, // Always null per task requirements
          rtnAthleteId: null, // Not available from our data source
          alreadyInRoster
        };
      })
    );

    console.log(`[talentDiscoveryService] Scored ${candidateCards.length} candidates`);
    return candidateCards;

  } catch (error) {
    console.error('[talentDiscoveryService] Claude API error:', error.message);
    throw new Error(`Failed to score candidates: ${error.message}`);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Discover alumni candidates for a school
 *
 * @param {string} schoolName - School name (e.g., "Stanford", "Oklahoma")
 * @returns {Promise<Array>} Array of CandidateCard objects
 */
export async function discoverAlumni(schoolName) {
  if (!schoolName || typeof schoolName !== 'string') {
    throw new Error('School name is required');
  }

  console.log(`[talentDiscoveryService] Starting discovery for ${schoolName}`);

  try {
    // Step 1: Fetch alumni roster
    const athletes = await fetchAlumniRoster(schoolName);

    if (athletes.length === 0) {
      console.warn(`[talentDiscoveryService] No alumni data found for ${schoolName}`);
      return [];
    }

    // Step 2: Score all athletes in ONE Claude API call (not N+1!)
    const candidateCards = await scoreAlumniWithClaude(athletes, schoolName);

    console.log(`[talentDiscoveryService] Discovery complete for ${schoolName}: ${candidateCards.length} candidates`);
    return candidateCards;

  } catch (error) {
    console.error(`[talentDiscoveryService] Error discovering alumni for ${schoolName}:`, error.message);
    throw error;
  }
}

/**
 * CandidateCard shape (for reference):
 * {
 *   name: string,
 *   school: string,
 *   graduationYear: number | null,
 *   score: number (1-5),
 *   explanation: string,
 *   linkedIn: null (always null - see task notes),
 *   instagram: null (always null - see task notes),
 *   rtnAthleteId: string | null,
 *   alreadyInRoster: boolean
 * }
 */
