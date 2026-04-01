import { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, SignalIcon } from '@heroicons/react/24/solid';
import { db, ref, onValue } from '../lib/firebase';
import { useScoringFeed } from '../hooks/useScoringFeed';

/**
 * ScoringFeedBadge - Shows scoring feed status on a competition card.
 *
 * States:
 * - LIVE·{interval}s: Green pulsing dot + green background (enabled + no error)
 * - FEED OFF: Gray background (disabled)
 * - FEED ERROR: Red background with icon (error status)
 *
 * Click behavior:
 * - LIVE: confirm dialog → set enabled: false
 * - OFF: set enabled: true
 * - ERROR: show error in tooltip (no action)
 *
 * Hidden when no virtiusSessionId is configured.
 */
export default function ScoringFeedBadge({ compId }) {
  const [hasSessionId, setHasSessionId] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { feedState, loading, setEnabled } = useScoringFeed(compId);

  // Listen for virtiusSessionId to determine if badge should be visible
  useEffect(() => {
    if (!compId) {
      setHasSessionId(false);
      return;
    }

    const sessionRef = ref(db, `competitions/${compId}/config/virtiusSessionId`);
    const unsubscribe = onValue(
      sessionRef,
      (snapshot) => {
        setHasSessionId(!!snapshot.val());
      },
      () => {
        setHasSessionId(false);
      }
    );

    return () => unsubscribe();
  }, [compId]);

  // Don't render if no virtiusSessionId configured
  if (!hasSessionId) return null;

  // Don't render while loading
  if (loading) return null;

  const { enabled, pollInterval, status, errorMessage } = feedState;
  const isLive = enabled && status !== 'error' && status !== 'stopped';
  const isError = status === 'error';

  // Handle click based on state
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isError) {
      // Show error in alert
      if (errorMessage) {
        window.alert(`Scoring Feed Error:\n${errorMessage}`);
      }
      return;
    }

    if (isLive) {
      // Show confirm before disabling
      setShowConfirm(true);
      return;
    }

    // OFF state - enable the feed
    setEnabled(true);
  };

  const handleConfirmDisable = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEnabled(false);
    setShowConfirm(false);
  };

  const handleCancelDisable = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(false);
  };

  // Determine badge appearance
  let badgeColor, badgeText, icon;

  if (isError) {
    badgeColor = 'bg-red-500/20 text-red-400 border border-red-500/30';
    badgeText = 'FEED ERROR';
    icon = <ExclamationTriangleIcon className="w-3 h-3" />;
  } else if (isLive) {
    badgeColor = 'bg-green-500/20 text-green-400 border border-green-500/30';
    badgeText = `LIVE·${pollInterval}s`;
    icon = (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
    );
  } else {
    badgeColor = 'bg-zinc-700 text-zinc-400';
    badgeText = 'FEED OFF';
    icon = <SignalIcon className="w-3 h-3 opacity-50" />;
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        title={isError && errorMessage ? errorMessage : isLive ? 'Click to disable' : 'Click to enable'}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors hover:opacity-80 ${badgeColor}`}
      >
        {icon}
        {badgeText}
      </button>

      {/* Confirm dialog for disabling */}
      {showConfirm && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-2 min-w-[140px]">
          <p className="text-[10px] text-zinc-300 mb-2">Stop scoring feed?</p>
          <div className="flex gap-1">
            <button
              onClick={handleConfirmDisable}
              className="px-2 py-0.5 text-[10px] bg-red-600 text-white rounded hover:bg-red-700"
            >
              Stop
            </button>
            <button
              onClick={handleCancelDisable}
              className="px-2 py-0.5 text-[10px] bg-zinc-600 text-white rounded hover:bg-zinc-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
