import { useState, useEffect, useCallback } from 'react';
import { db, ref, onValue, update } from '../lib/firebase';

/**
 * useScoringFeed - Subscribe to and control the scoring feed service
 * Path: competitions/{compId}/config/scoringFeed
 *
 * The scoring feed service polls Virtius API and writes scoring data to Firebase.
 * This hook provides read/write access to feed configuration.
 */

// Default state when path doesn't exist
const DEFAULT_STATE = {
  enabled: false,
  pollInterval: 15,
  lastPollAt: null,
  status: null,
  errorMessage: null
};

export function useScoringFeed(compId) {
  const [feedState, setFeedState] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  // Subscribe to scoringFeed config
  useEffect(() => {
    if (!compId) {
      setFeedState(DEFAULT_STATE);
      setLoading(false);
      return;
    }

    const feedRef = ref(db, `competitions/${compId}/config/scoringFeed`);

    const unsubscribe = onValue(
      feedRef,
      (snapshot) => {
        const data = snapshot.val();
        setFeedState({
          enabled: data?.enabled ?? DEFAULT_STATE.enabled,
          pollInterval: data?.pollInterval ?? DEFAULT_STATE.pollInterval,
          lastPollAt: data?.lastPollAt ?? DEFAULT_STATE.lastPollAt,
          status: data?.status ?? DEFAULT_STATE.status,
          errorMessage: data?.errorMessage ?? DEFAULT_STATE.errorMessage
        });
        setLoading(false);
      },
      (error) => {
        console.error('useScoringFeed subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [compId]);

  // Enable or disable the feed
  const setEnabled = useCallback(async (enabled) => {
    if (!compId) return;
    try {
      const feedRef = ref(db, `competitions/${compId}/config/scoringFeed`);
      await update(feedRef, { enabled });
    } catch (err) {
      console.error('Failed to set enabled:', err);
    }
  }, [compId]);

  // Update poll interval
  const setPollInterval = useCallback(async (pollInterval) => {
    if (!compId) return;
    try {
      const feedRef = ref(db, `competitions/${compId}/config/scoringFeed`);
      await update(feedRef, { pollInterval });
    } catch (err) {
      console.error('Failed to set pollInterval:', err);
    }
  }, [compId]);

  // Trigger immediate poll by writing forceRefresh timestamp
  const forceRefresh = useCallback(async () => {
    if (!compId) return;
    try {
      const feedRef = ref(db, `competitions/${compId}/config/scoringFeed`);
      await update(feedRef, { forceRefresh: Date.now() });
    } catch (err) {
      console.error('Failed to trigger forceRefresh:', err);
    }
  }, [compId]);

  return {
    feedState,
    loading,
    setEnabled,
    setPollInterval,
    forceRefresh
  };
}
