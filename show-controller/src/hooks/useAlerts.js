import { useEffect, useState, useCallback, useMemo } from 'react';
import { db, ref, onValue, update } from '../lib/firebase';
import { useCompetition } from '../context/CompetitionContext';

// Alert levels - must match server-side ALERT_LEVEL
export const ALERT_LEVEL = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

// Alert categories - must match server-side ALERT_CATEGORY
export const ALERT_CATEGORY = {
  VM: 'vm',
  SERVICE: 'service',
  CAMERA: 'camera',
  OBS: 'obs',
  TALENT: 'talent'
};

/**
 * useAlerts - Hook for managing alerts for the current competition
 *
 * Subscribes to alerts/{competitionId}/ in Firebase for real-time updates
 * Provides actions for acknowledging alerts
 * Filters to unresolved alerts and sorts by level then timestamp
 *
 * @returns {Object} Alerts state and actions
 */
export function useAlerts() {
  const { compId, isLocalMode } = useCompetition();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subscribe to alerts in Firebase
  useEffect(() => {
    // In local mode, use 'local' as the competition ID
    const competitionId = isLocalMode ? 'local' : compId;

    if (!competitionId) {
      setLoading(false);
      return;
    }

    const alertsRef = ref(db, `alerts/${competitionId}`);

    const unsubscribe = onValue(
      alertsRef,
      (snapshot) => {
        const data = snapshot.val() || {};

        // Convert to array and filter to unresolved alerts
        const alertArray = Object.values(data)
          .filter(alert => alert && !alert.resolved)
          .sort((a, b) => {
            // Sort by level (critical first), then by timestamp (newest first)
            const levelOrder = { critical: 0, warning: 1, info: 2 };
            const levelDiff = (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99);
            if (levelDiff !== 0) return levelDiff;
            return new Date(b.createdAt) - new Date(a.createdAt);
          });

        setAlerts(alertArray);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useAlerts] Firebase error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [compId, isLocalMode]);

  // Acknowledge a single alert
  const acknowledgeAlert = useCallback(async (alertId) => {
    const competitionId = isLocalMode ? 'local' : compId;
    if (!competitionId || !alertId) return { success: false, error: 'Missing params' };

    try {
      const alertRef = ref(db, `alerts/${competitionId}/${alertId}`);
      await update(alertRef, {
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: 'producer'
      });
      return { success: true };
    } catch (err) {
      console.error('[useAlerts] Acknowledge failed:', err);
      return { success: false, error: err.message };
    }
  }, [compId, isLocalMode]);

  // Acknowledge all unacknowledged alerts
  const acknowledgeAll = useCallback(async () => {
    const competitionId = isLocalMode ? 'local' : compId;
    if (!competitionId) return { success: false, error: 'No competition ID' };

    const unacknowledged = alerts.filter(a => !a.acknowledged);
    if (unacknowledged.length === 0) return { success: true, count: 0 };

    try {
      const promises = unacknowledged.map(alert =>
        acknowledgeAlert(alert.id)
      );
      await Promise.all(promises);
      return { success: true, count: unacknowledged.length };
    } catch (err) {
      console.error('[useAlerts] Acknowledge all failed:', err);
      return { success: false, error: err.message };
    }
  }, [alerts, compId, isLocalMode, acknowledgeAlert]);

  // Filter alerts by level
  const criticalAlerts = useMemo(() => {
    return alerts.filter(a => a.level === ALERT_LEVEL.CRITICAL);
  }, [alerts]);

  const warningAlerts = useMemo(() => {
    return alerts.filter(a => a.level === ALERT_LEVEL.WARNING);
  }, [alerts]);

  const infoAlerts = useMemo(() => {
    return alerts.filter(a => a.level === ALERT_LEVEL.INFO);
  }, [alerts]);

  // Counts
  const criticalCount = criticalAlerts.length;
  const warningCount = warningAlerts.length;
  const infoCount = infoAlerts.length;

  // Unacknowledged counts
  const unacknowledgedAlerts = useMemo(() => {
    return alerts.filter(a => !a.acknowledged);
  }, [alerts]);

  const unacknowledgedCount = unacknowledgedAlerts.length;

  const unacknowledgedCritical = useMemo(() => {
    return criticalAlerts.filter(a => !a.acknowledged);
  }, [criticalAlerts]);

  const hasUnacknowledgedCritical = unacknowledgedCritical.length > 0;

  return {
    // State
    alerts,
    loading,
    error,

    // Filtered arrays
    criticalAlerts,
    warningAlerts,
    infoAlerts,
    unacknowledgedAlerts,

    // Counts
    criticalCount,
    warningCount,
    infoCount,
    unacknowledgedCount,
    hasUnacknowledgedCritical,

    // Actions
    acknowledgeAlert,
    acknowledgeAll,

    // Re-export constants for convenience
    ALERT_LEVEL,
    ALERT_CATEGORY
  };
}

export default useAlerts;
