import { useState, useEffect, useMemo } from 'react';
import { db, ref, onValue } from '../lib/firebase';
import { useScoringFeed } from '../hooks/useScoringFeed';
import {
  SignalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

/**
 * TimeAgo - Shows last poll time with live-updating relative time
 */
function TimeAgo({ lastPollAt, pollInterval }) {
  const [now, setNow] = useState(Date.now());

  // Update "now" every second to keep relative time fresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { timeAgo, status } = useMemo(() => {
    if (!lastPollAt) return { timeAgo: 'never', status: 'stale' };
    const seconds = Math.floor((now - lastPollAt) / 1000);
    const intervalSec = pollInterval || 15;

    // Determine status based on multiples of poll interval
    let status;
    if (seconds < intervalSec * 2) {
      status = 'recent';
    } else if (seconds < intervalSec * 5) {
      status = 'warning';
    } else {
      status = 'stale';
    }

    return {
      timeAgo: seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`,
      status
    };
  }, [lastPollAt, now, pollInterval]);

  const textClass = {
    recent: 'text-blue-400',
    warning: 'text-yellow-400',
    stale: 'text-red-400'
  }[status];

  return (
    <span className={`text-sm ${textClass}`}>
      {timeAgo}
    </span>
  );
}

/**
 * ScoringFeedPanel - Control panel for Virtius scoring feed ingestion
 *
 * @param {string} compId - Competition ID
 * @param {boolean} collapsed - Initial collapsed state
 */
export default function ScoringFeedPanel({
  compId,
  collapsed: initialCollapsed = true
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [hasVirtiusSession, setHasVirtiusSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const { feedState, loading, setEnabled, setPollInterval, forceRefresh } = useScoringFeed(compId);

  // Check if virtiusSessionId is configured
  useEffect(() => {
    if (!compId) {
      setHasVirtiusSession(false);
      setCheckingSession(false);
      return;
    }

    const configRef = ref(db, `competitions/${compId}/config/virtiusSessionId`);
    const unsubscribe = onValue(configRef, (snapshot) => {
      const sessionId = snapshot.val();
      setHasVirtiusSession(!!sessionId && sessionId.trim() !== '');
      setCheckingSession(false);
    });

    return () => unsubscribe();
  }, [compId]);

  // Hide panel if no virtiusSessionId configured
  if (checkingSession || !hasVirtiusSession) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <SignalIcon className="w-5 h-5" />
          <span className="font-medium">Scoring Feed</span>
        </div>
        <div className="text-center py-4 text-zinc-500 text-sm">
          Loading...
        </div>
      </div>
    );
  }

  // Determine status badge
  const getStatusBadge = () => {
    if (feedState.status === 'error') {
      return (
        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
          <ExclamationTriangleIcon className="w-3 h-3" />
          ERROR
        </span>
      );
    }
    if (feedState.enabled) {
      return (
        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          LIVE·{feedState.pollInterval}s
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded-full">
        OFF
      </span>
    );
  };

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SignalIcon className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-white">Scoring Feed</span>
          {getStatusBadge()}
        </div>
        {collapsed ? (
          <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {!collapsed && (
        <div className="p-4 pt-0 space-y-3">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-zinc-300">Enable Feed</span>
            <button
              onClick={() => setEnabled(!feedState.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                feedState.enabled ? 'bg-blue-500' : 'bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  feedState.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Poll Interval Dropdown */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-zinc-300">Poll Interval</span>
            <select
              value={feedState.pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
              className="bg-zinc-700 text-zinc-200 text-sm px-3 py-1.5 rounded-lg border border-zinc-600 focus:outline-none focus:border-blue-500"
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>

          {/* Last Updated Indicator */}
          {feedState.enabled && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-300">Last Updated</span>
              <TimeAgo
                lastPollAt={feedState.lastPollAt}
                pollInterval={feedState.pollInterval}
              />
            </div>
          )}

          {/* Status Badge */}
          {feedState.enabled && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-300">Status</span>
              <span className={`text-sm font-medium ${
                feedState.status === 'ok' ? 'text-green-400' :
                feedState.status === 'error' ? 'text-red-400' :
                feedState.status === 'stopped' ? 'text-zinc-400' :
                'text-zinc-500'
              }`}>
                {feedState.status?.toUpperCase() || '—'}
              </span>
            </div>
          )}

          {/* Error Message */}
          {feedState.status === 'error' && feedState.errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400 font-medium">Error</span>
              </div>
              <p className="text-xs text-red-300/80 mt-1 ml-6">
                {feedState.errorMessage}
              </p>
            </div>
          )}

          {/* Manual Refresh Button */}
          {feedState.enabled && (
            <button
              onClick={forceRefresh}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Refresh Now</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
