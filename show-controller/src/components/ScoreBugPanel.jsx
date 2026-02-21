import { useState, useEffect, useMemo } from 'react';
import { db, ref, onValue, set } from '../lib/firebase';
import {
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon
} from '@heroicons/react/24/solid';

/**
 * HeartbeatIndicator - Shows last poll time with status indicator
 *
 * States:
 * - Recent (green): within 2x poll interval - normal operation
 * - Warning (yellow): 2x-5x poll interval - delayed but not critical
 * - Stale (red): beyond 5x poll interval - data may be outdated
 */
function HeartbeatIndicator({ lastPoll, pollInterval }) {
  const [now, setNow] = useState(Date.now());

  // Update "now" every second to keep relative time fresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { timeAgo, status } = useMemo(() => {
    if (!lastPoll) return { timeAgo: 'never', status: 'stale' };
    const seconds = Math.floor((now - lastPoll) / 1000);
    const intervalSec = pollInterval / 1000;

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
  }, [lastPoll, now, pollInterval]);

  const dotClass = {
    recent: 'bg-green-500 animate-pulse',
    warning: 'bg-yellow-500',
    stale: 'bg-red-500'
  }[status];

  const textClass = {
    recent: 'text-green-400',
    warning: 'text-yellow-400',
    stale: 'text-red-400'
  }[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      <span className={`text-sm ${textClass}`}>
        {timeAgo}
      </span>
      {status === 'stale' && (
        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded font-medium">
          STALE
        </span>
      )}
    </div>
  );
}

/**
 * ScoreBugPanel - Control panel for team scores bug overlay
 *
 * @param {string} compId - Competition ID
 * @param {boolean} collapsed - Initial collapsed state
 */
export default function ScoreBugPanel({
  compId,
  collapsed: initialCollapsed = true
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [scoreBugState, setScoreBugState] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Generate overlay URL
  const overlayUrl = compId
    ? `${window.location.origin}/overlays/team-bug.html?compId=${compId}`
    : '';

  // Copy URL to clipboard
  const copyUrl = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Toggle enabled state
  const toggleEnabled = () => {
    const newState = !scoreBugState?.enabled;
    set(ref(db, `competitions/${compId}/scoreBug/enabled`), newState);
  };

  // Toggle polling state
  const togglePolling = () => {
    const newState = !scoreBugState?.polling;
    set(ref(db, `competitions/${compId}/scoreBug/polling`), newState);
  };

  // Set poll frequency
  const setPollFrequency = (frequency) => {
    set(ref(db, `competitions/${compId}/scoreBug/config/pollInterval`), frequency);
  };

  // Toggle automation mode (auto/manual)
  const toggleAutomationMode = () => {
    const currentMode = scoreBugState?.config?.automationMode || 'auto';
    const newMode = currentMode === 'auto' ? 'manual' : 'auto';
    set(ref(db, `competitions/${compId}/scoreBug/config/automationMode`), newMode);
  };

  // Listen to scoreBug state from Firebase
  useEffect(() => {
    if (!compId) return;

    const scoreBugRef = ref(db, `competitions/${compId}/scoreBug`);
    const unsubscribe = onValue(scoreBugRef, (snapshot) => {
      setScoreBugState(snapshot.val() || {});
    });

    return () => unsubscribe();
  }, [compId]);

  // Empty state - no competition selected
  if (!compId) {
    return (
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <ChartBarIcon className="w-5 h-5" />
          <span className="font-medium">Score Bug</span>
        </div>
        <div className="text-center py-4 text-zinc-500 text-sm">
          Select a competition
        </div>
      </div>
    );
  }

  // Loading state
  if (scoreBugState === null) {
    return (
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <ChartBarIcon className="w-5 h-5" />
          <span className="font-medium">Score Bug</span>
        </div>
        <div className="text-center py-4 text-zinc-500 text-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-zinc-400" />
          <span className="font-medium text-white">Score Bug</span>
          {/* Status indicator */}
          {scoreBugState.enabled && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              ON
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {!collapsed && (
        <div className="p-4 pt-0 space-y-3">
          {/* Overlay URL with Copy Button */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={overlayUrl}
              className="flex-1 bg-zinc-900 text-zinc-400 text-xs px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none"
            />
            <button
              onClick={copyUrl}
              className="p-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
              title="Copy overlay URL"
            >
              {copiedUrl ? (
                <CheckIcon className="w-4 h-4 text-green-400" />
              ) : (
                <ClipboardIcon className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* On/Off Toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-zinc-300">Show Bug</span>
            <button
              onClick={toggleEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                scoreBugState?.enabled ? 'bg-green-500' : 'bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  scoreBugState?.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Polling Toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-zinc-300">API Polling</span>
            <button
              onClick={togglePolling}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                scoreBugState?.polling ? 'bg-blue-500' : 'bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  scoreBugState?.polling ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Poll Frequency Selector */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-zinc-300">Poll Frequency</span>
            <select
              value={scoreBugState?.config?.pollInterval || 5000}
              onChange={(e) => setPollFrequency(Number(e.target.value))}
              className="bg-zinc-700 text-zinc-200 text-sm px-3 py-1.5 rounded-lg border border-zinc-600 focus:outline-none focus:border-blue-500"
            >
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
          </div>

          {/* Heartbeat Indicator */}
          {scoreBugState?.polling && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-300">Last Poll</span>
              <HeartbeatIndicator
                lastPoll={scoreBugState?.status?.lastPoll}
                pollInterval={scoreBugState?.config?.pollInterval || 5000}
              />
            </div>
          )}

          {/* Automation Mode Toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-zinc-300">Now Competing</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${
                (scoreBugState?.config?.automationMode || 'auto') === 'auto'
                  ? 'text-zinc-500'
                  : 'text-purple-400 font-medium'
              }`}>
                MANUAL
              </span>
              <button
                onClick={toggleAutomationMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  (scoreBugState?.config?.automationMode || 'auto') === 'auto'
                    ? 'bg-purple-500'
                    : 'bg-zinc-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    (scoreBugState?.config?.automationMode || 'auto') === 'auto'
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs ${
                (scoreBugState?.config?.automationMode || 'auto') === 'auto'
                  ? 'text-purple-400 font-medium'
                  : 'text-zinc-500'
              }`}>
                AUTO
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
