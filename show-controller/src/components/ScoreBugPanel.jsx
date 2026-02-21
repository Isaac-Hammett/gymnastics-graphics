import { useState, useEffect } from 'react';
import { db, ref, onValue } from '../lib/firebase';
import {
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon
} from '@heroicons/react/24/solid';

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

          {/* Placeholder - more controls coming in subsequent tasks */}
          <div className="text-center py-2 text-zinc-500 text-sm">
            More controls coming soon
          </div>
        </div>
      )}
    </div>
  );
}
