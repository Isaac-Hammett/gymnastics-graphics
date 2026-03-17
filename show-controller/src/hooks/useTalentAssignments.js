import { useState, useEffect, useMemo, useRef } from 'react';
import { db, ref, get } from '../lib/firebase';
import { SERVER_URL } from '../lib/serverUrl';

/**
 * useTalentAssignments - Cross-competition talent assignment aggregator.
 *
 * Fetches commentary assignments from ALL competitions and builds a per-talent
 * assignment map. Uses a lightweight server endpoint to discover competition IDs,
 * then does targeted reads on `competitions/{compId}/commentary` only.
 *
 * DUAL MODE:
 * - If `competitions` param is passed (e.g., from CommentaryPage which already has
 *   useCompetitions data), derives data via useMemo — no extra fetching.
 * - If `competitions` is NOT passed (e.g., TalentPage), fetches from server endpoint
 *   + targeted Firebase get() calls. Refreshes every 30 seconds.
 *
 * @param {Array} talentList - Array of talent objects with { id, interested, surveyAvailability, status, ... }
 * @param {Object|null} competitions - Optional: already-loaded competitions from useCompetitions()
 * @returns {{ assignmentsByTalent: Object, loading: boolean }}
 */
export function useTalentAssignments(talentList = [], competitions = null) {
  const [assignmentsByTalent, setAssignmentsByTalent] = useState({});
  const [loading, setLoading] = useState(true);

  // Cache for competition index from server (refresh every 5 minutes)
  const indexCacheRef = useRef({ data: null, fetchedAt: 0 });
  const INDEX_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Track if this is the first fetch
  const hasInitializedRef = useRef(false);

  // Mode: derived from passed competitions object
  const derivedMode = competitions !== null;

  // ─── Derived mode: use useMemo to extract data from passed competitions ─────
  const derivedAssignments = useMemo(() => {
    if (!derivedMode || !competitions) return null;

    const result = {};
    const talentMap = {};

    // Build a map for quick lookup
    talentList.forEach(t => {
      talentMap[t.id] = t;
    });

    // Process each competition
    Object.entries(competitions).forEach(([compId, comp]) => {
      const commentary = comp.commentary || {};
      const eventName = comp.config?.eventName || compId;
      const meetDate = comp.config?.meetDate || null;
      const gender = comp.config?.gender || null;

      Object.entries(commentary).forEach(([talentId, assignment]) => {
        if (!result[talentId]) {
          result[talentId] = {
            assignments: [],
            lastOutreach: null,
            lastOutreachType: null,
            pendingCount: 0,
            confirmedCount: 0,
            availableFor: [],
            availabilityDot: 'gray',
          };
        }

        result[talentId].assignments.push({
          compId,
          compName: eventName,
          meetDate,
          gender,
          role: assignment.role,
          status: assignment.status,
          invitedAt: assignment.invitedAt,
          confirmedAt: assignment.confirmedAt,
          briefedAt: assignment.briefedAt,
        });

        // Track outreach timestamps
        updateOutreachTracking(result[talentId], assignment);

        // Count pending/confirmed
        if (assignment.status === 'invited') {
          result[talentId].pendingCount++;
        }
        if (assignment.status === 'confirmed' || assignment.status === 'briefed') {
          result[talentId].confirmedCount++;
        }
      });
    });

    // Process availability data from talent records
    processAvailabilityData(result, talentList, competitions, talentMap);

    return result;
  }, [derivedMode, competitions, talentList]);

  // ─── Fetch mode: get from server endpoint + targeted Firebase reads ─────────
  useEffect(() => {
    // Skip if using derived mode
    if (derivedMode) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let intervalId;

    async function fetchCompetitionIndex() {
      const now = Date.now();
      if (indexCacheRef.current.data && (now - indexCacheRef.current.fetchedAt) < INDEX_CACHE_TTL) {
        return indexCacheRef.current.data;
      }

      try {
        const response = await fetch(`${SERVER_URL}/api/competitions/index`);
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        const index = await response.json();
        indexCacheRef.current = { data: index, fetchedAt: now };
        return index;
      } catch (err) {
        console.error('[useTalentAssignments] Failed to fetch competition index:', err);
        // Return cached data if available, even if stale
        return indexCacheRef.current.data || {};
      }
    }

    async function fetchCommentaryData() {
      try {
        const index = await fetchCompetitionIndex();
        if (!isMounted) return;

        const compIds = Object.keys(index);
        if (compIds.length === 0) {
          setAssignmentsByTalent({});
          setLoading(false);
          hasInitializedRef.current = true;
          return;
        }

        // Fetch commentary for each competition in parallel
        const commentaryPromises = compIds.map(async (compId) => {
          try {
            const snapshot = await get(ref(db, `competitions/${compId}/commentary`));
            return { compId, commentary: snapshot.val() || {} };
          } catch (err) {
            console.error(`[useTalentAssignments] Failed to fetch commentary for ${compId}:`, err);
            return { compId, commentary: {} };
          }
        });

        const commentaryResults = await Promise.all(commentaryPromises);
        if (!isMounted) return;

        // Build assignments map
        const result = {};
        const talentMap = {};

        talentList.forEach(t => {
          talentMap[t.id] = t;
        });

        // Build a competitions-like object for availability processing
        const competitionsObj = {};

        commentaryResults.forEach(({ compId, commentary }) => {
          const compMeta = index[compId] || {};
          const eventName = compMeta.eventName || compId;
          const meetDate = compMeta.meetDate || null;
          const gender = compMeta.gender || null;

          // Store for availability processing
          competitionsObj[compId] = {
            config: { eventName, meetDate, gender },
            commentary,
          };

          Object.entries(commentary).forEach(([talentId, assignment]) => {
            if (!result[talentId]) {
              result[talentId] = {
                assignments: [],
                lastOutreach: null,
                lastOutreachType: null,
                pendingCount: 0,
                confirmedCount: 0,
                availableFor: [],
                availabilityDot: 'gray',
              };
            }

            result[talentId].assignments.push({
              compId,
              compName: eventName,
              meetDate,
              gender,
              role: assignment.role,
              status: assignment.status,
              invitedAt: assignment.invitedAt,
              confirmedAt: assignment.confirmedAt,
              briefedAt: assignment.briefedAt,
            });

            updateOutreachTracking(result[talentId], assignment);

            if (assignment.status === 'invited') {
              result[talentId].pendingCount++;
            }
            if (assignment.status === 'confirmed' || assignment.status === 'briefed') {
              result[talentId].confirmedCount++;
            }
          });
        });

        // Process availability data
        processAvailabilityData(result, talentList, competitionsObj, talentMap);

        setAssignmentsByTalent(result);
        setLoading(false);
        hasInitializedRef.current = true;
      } catch (err) {
        console.error('[useTalentAssignments] Error fetching data:', err);
        if (isMounted) {
          setLoading(false);
          hasInitializedRef.current = true;
        }
      }
    }

    // Initial fetch
    fetchCommentaryData();

    // Refresh every 30 seconds
    intervalId = setInterval(fetchCommentaryData, 30 * 1000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [derivedMode, talentList]);

  // Return derived data if in derived mode
  if (derivedMode) {
    return {
      assignmentsByTalent: derivedAssignments || {},
      loading: false,
    };
  }

  return { assignmentsByTalent, loading };
}

/**
 * Update lastOutreach tracking based on assignment timestamps
 */
function updateOutreachTracking(talentData, assignment) {
  const timestamps = [
    { time: assignment.invitedAt, type: 'invite' },
    { time: assignment.briefedAt, type: 'briefing' },
    { time: assignment.confirmedAt, type: 'calendar' }, // Using confirmedAt as proxy for calendar
  ].filter(t => t.time);

  timestamps.forEach(({ time, type }) => {
    if (!talentData.lastOutreach || time > talentData.lastOutreach) {
      talentData.lastOutreach = time;
      talentData.lastOutreachType = type;
    }
  });
}

/**
 * Process availability data from talent records (interested + surveyAvailability)
 */
function processAvailabilityData(result, talentList, competitions, talentMap) {
  const now = new Date();

  talentList.forEach(talent => {
    const talentId = talent.id;
    if (!result[talentId]) {
      result[talentId] = {
        assignments: [],
        lastOutreach: null,
        lastOutreachType: null,
        pendingCount: 0,
        confirmedCount: 0,
        availableFor: [],
        availabilityDot: 'gray',
      };
    }

    const availableFor = [];

    // Check `interested` object
    if (talent.interested && typeof talent.interested === 'object') {
      Object.keys(talent.interested).forEach(compId => {
        if (talent.interested[compId]) {
          const comp = competitions[compId];
          if (comp && comp.config?.meetDate) {
            const meetDate = new Date(comp.config.meetDate);
            if (meetDate >= now) {
              availableFor.push({
                compId,
                compName: comp.config?.eventName || compId,
                source: 'interested',
              });
            }
          }
        }
      });
    }

    // Check `surveyAvailability` object
    if (talent.surveyAvailability && typeof talent.surveyAvailability === 'object') {
      Object.keys(talent.surveyAvailability).forEach(compId => {
        if (talent.surveyAvailability[compId]) {
          const comp = competitions[compId];
          // Don't add duplicates
          const alreadyAdded = availableFor.some(a => a.compId === compId);
          if (!alreadyAdded && comp && comp.config?.meetDate) {
            const meetDate = new Date(comp.config.meetDate);
            if (meetDate >= now) {
              availableFor.push({
                compId,
                compName: comp.config?.eventName || compId,
                source: 'survey',
              });
            }
          }
        }
      });
    }

    result[talentId].availableFor = availableFor;

    // Determine availability dot color
    if (availableFor.length > 0) {
      result[talentId].availabilityDot = 'green';
    } else if (talent.status?.startsWith('did-')) {
      result[talentId].availabilityDot = 'yellow';
    } else {
      result[talentId].availabilityDot = 'gray';
    }
  });
}

export default useTalentAssignments;
