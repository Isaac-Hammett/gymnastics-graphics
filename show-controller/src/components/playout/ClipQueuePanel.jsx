import { useState, useMemo, useEffect } from 'react';
import {
  FilmIcon,
  PlayIcon,
  ForwardIcon,
  FlagIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PauseIcon,
  PlusIcon,
  XMarkIcon,
  FunnelIcon,
  ClockIcon,
} from '@heroicons/react/24/solid';

/**
 * ClipQueuePanel — Shows available clips, their status, and controls
 * Replaces Camera Runtime panel on the right column when playout is active.
 *
 * Props (from usePlayoutState/usePlayoutActions):
 * - clips: Array of clip objects with status
 * - clipQueue: { all, queued, played, shownLive, failed, stalled, pending }
 * - currentClip: Currently playing clip object
 * - nextClip: Next clip in queue
 * - preloadState: { state, clipId, progress }
 * - currentMode: Current playout mode
 * - actions: { skipClip, addToQueue, retryClip, retryAllFailed, fetchClips, flagMoment, pausePlayout, resumePlayout }
 * - onFlagMoment: () => void — opens the MomentReplayDialog
 * - currentRotation: number — current rotation for default filter
 * - apiError: { message, cacheAge } | null — API error state
 * - CLIP_STATUS: Status enum from usePlayoutState
 */

// Apparatus colors per PRD (EVS color-coding pattern)
const APPARATUS_COLORS = {
  VT: { bg: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  UB: { bg: 'bg-purple-500', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  BB: { bg: 'bg-blue-500', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  FX: { bg: 'bg-green-500', text: 'text-green-400', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
  PH: { bg: 'bg-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  SR: { bg: 'bg-teal-500', text: 'text-teal-400', badge: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  PB: { bg: 'bg-indigo-500', text: 'text-indigo-400', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  HB: { bg: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
};

// Virtius apparatus name to code mapping
const APPARATUS_NAME_TO_CODE = {
  VAULT: 'VT',
  BARS: 'UB',
  BEAM: 'BB',
  FLOOR: 'FX',
  HORSE: 'PH',
  RINGS: 'SR',
  PBARS: 'PB',
  BAR: 'HB',
};

// Map clip apparatus to display code
function getApparatusCode(apparatus) {
  if (!apparatus) return null;
  return APPARATUS_NAME_TO_CODE[apparatus.toUpperCase()] || apparatus;
}

// Tabs enum
const TABS = {
  ALL: 'all',
  QUEUED: 'queued',
  PLAYED: 'played',
  SHOWN_LIVE: 'shownLive',
};

export default function ClipQueuePanel({
  clips = [],
  clipQueue = {},
  currentClip = null,
  nextClip = null,
  preloadState = {},
  currentMode = 'CLIP',
  actions = {},
  onFlagMoment,
  currentRotation = 1,
  apiError = null,
  CLIP_STATUS = {},
}) {
  const {
    skipClip,
    addToQueue,
    retryClip,
    retryAllFailed,
    fetchClips,
    pausePlayout,
    resumePlayout,
  } = actions;

  // Active tab state
  const [activeTab, setActiveTab] = useState(TABS.ALL);

  // Filter state
  const [filters, setFilters] = useState({
    apparatus: 'all',
    team: 'all',
    rotation: currentRotation || 'all',
  });

  // Update rotation filter when currentRotation changes (playout active)
  useEffect(() => {
    if (currentRotation && currentRotation !== filters.rotation) {
      setFilters(prev => ({ ...prev, rotation: currentRotation }));
    }
  }, [currentRotation]);

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const apparatuses = new Set();
    const teams = new Set();
    const rotations = new Set();

    clips.forEach(clip => {
      if (clip.apparatus) apparatuses.add(clip.apparatus);
      if (clip.team_name) teams.add(clip.team_name);
      if (clip.rotation) rotations.add(clip.rotation);
    });

    return {
      apparatuses: Array.from(apparatuses).sort(),
      teams: Array.from(teams).sort(),
      rotations: Array.from(rotations).sort((a, b) => a - b),
    };
  }, [clips]);

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: clipQueue.all?.length || 0,
    queued: clipQueue.queued?.length || 0,
    played: clipQueue.played?.length || 0,
    shownLive: clipQueue.shownLive?.length || 0,
  }), [clipQueue]);

  // Get clips for current tab
  const tabClips = useMemo(() => {
    switch (activeTab) {
      case TABS.QUEUED:
        return clipQueue.queued || [];
      case TABS.PLAYED:
        return clipQueue.played || [];
      case TABS.SHOWN_LIVE:
        return clipQueue.shownLive || [];
      default:
        return clipQueue.all || [];
    }
  }, [activeTab, clipQueue]);

  // Apply filters to tab clips
  const filteredClips = useMemo(() => {
    return tabClips.filter(clip => {
      if (filters.apparatus !== 'all' && clip.apparatus !== filters.apparatus) return false;
      if (filters.team !== 'all' && clip.team_name !== filters.team) return false;
      if (filters.rotation !== 'all' && clip.rotation !== filters.rotation) return false;
      return true;
    });
  }, [tabClips, filters]);

  // Check if any filter is active (for bulk actions)
  const hasActiveFilter = filters.apparatus !== 'all' || filters.team !== 'all' || filters.rotation !== 'all';

  // Count of failed/stalled clips for Retry All button
  const failedCount = (clipQueue.failed?.length || 0) + (clipQueue.stalled?.length || 0);

  // Get next 2-3 queued clips for UP NEXT section (after current)
  const upNextClips = useMemo(() => {
    const queued = clipQueue.queued || [];
    return queued.slice(0, 3);
  }, [clipQueue.queued]);

  // Check if a clip is in the "up next" section
  const isUpNext = (clipId) => {
    return upNextClips.some(c => c.draft_id === clipId);
  };

  // Handle bulk skip
  const handleBulkSkip = () => {
    filteredClips
      .filter(c => c.status === CLIP_STATUS.QUEUED)
      .forEach(c => skipClip?.(c.draft_id));
  };

  // Handle bulk queue (for shown live clips)
  const handleBulkQueue = () => {
    filteredClips
      .filter(c => c.status === CLIP_STATUS.SHOWN_LIVE)
      .forEach(c => addToQueue?.(c.draft_id));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ apparatus: 'all', team: 'all', rotation: 'all' });
  };

  return (
    <div className="bg-zinc-800 rounded-xl border border-zinc-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilmIcon className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white uppercase tracking-wide">
              Clip Queue
            </span>
          </div>
          <div className="flex items-center gap-2">
            {failedCount > 0 && (
              <button
                onClick={retryAllFailed}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/30 transition-colors"
              >
                <ArrowPathIcon className="w-3 h-3" />
                Retry All ({failedCount})
              </button>
            )}
            <button
              onClick={fetchClips}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white rounded transition-colors"
              title="Refresh clips from Clip Engine"
            >
              <ArrowPathIcon className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div className="mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
            <span>
              Clip Engine API unreachable — showing cached clips
              {apiError.cacheAge && ` (last updated ${apiError.cacheAge} ago)`}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {Object.entries(TABS).map(([key, value]) => {
            const count = tabCounts[value];
            const isActive = activeTab === value;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-zinc-600 text-white'
                    : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                }`}
              >
                {key === 'ALL' && 'All'}
                {key === 'QUEUED' && `Queued (${count})`}
                {key === 'PLAYED' && `Played (${count})`}
                {key === 'SHOWN_LIVE' && `Shown Live (${count})`}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3">
          <FunnelIcon className="w-3.5 h-3.5 text-zinc-500" />
          <select
            value={filters.apparatus}
            onChange={(e) => setFilters(prev => ({ ...prev, apparatus: e.target.value }))}
            className="px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All Apparatus</option>
            {filterOptions.apparatuses.map(app => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
          <select
            value={filters.team}
            onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
            className="px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-zinc-500 max-w-32 truncate"
          >
            <option value="all">All Teams</option>
            {filterOptions.teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          <select
            value={filters.rotation}
            onChange={(e) => setFilters(prev => ({ ...prev, rotation: e.target.value === 'all' ? 'all' : Number(e.target.value) }))}
            className="px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All Rot.</option>
            {filterOptions.rotations.map(rot => (
              <option key={rot} value={rot}>R{rot}</option>
            ))}
          </select>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Clear filters"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Bulk Actions (when filter active) */}
        {hasActiveFilter && (
          <div className="flex gap-2 mt-2">
            {activeTab !== TABS.SHOWN_LIVE && filteredClips.some(c => c.status === CLIP_STATUS.QUEUED) && (
              <button
                onClick={handleBulkSkip}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded border border-amber-500/30 transition-colors"
              >
                <ForwardIcon className="w-3 h-3" />
                Skip All ({filteredClips.filter(c => c.status === CLIP_STATUS.QUEUED).length})
              </button>
            )}
            {(activeTab === TABS.SHOWN_LIVE || filteredClips.some(c => c.status === CLIP_STATUS.SHOWN_LIVE)) && (
              <button
                onClick={handleBulkQueue}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded border border-green-500/30 transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                Queue All ({filteredClips.filter(c => c.status === CLIP_STATUS.SHOWN_LIVE).length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* UP NEXT section - always visible at top */}
        {upNextClips.length > 0 && (
          <div className="px-4 py-3 border-b border-zinc-700/50">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <PlayIcon className="w-3 h-3" />
              Up Next
            </div>
            <div className="space-y-2">
              {upNextClips.map((clip, index) => (
                <UpNextClipCard
                  key={clip.draft_id}
                  clip={clip}
                  isFirst={index === 0}
                  preloadState={index === 0 ? preloadState : null}
                  onSkip={() => skipClip?.(clip.draft_id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* NOW PLAYING section */}
        {currentClip && (
          <div className="px-4 py-3 border-b border-zinc-700/50">
            <NowPlayingCard
              clip={currentClip}
              currentMode={currentMode}
              onSkip={() => skipClip?.(currentClip.draft_id)}
              onFlagMoment={onFlagMoment}
              onPause={pausePlayout}
              onResume={resumePlayout}
              isPaused={currentMode === 'PAUSED'}
            />
          </div>
        )}

        {/* Tab content - clip list */}
        <div className="px-4 py-3">
          {filteredClips.length === 0 ? (
            <EmptyState
              tab={activeTab}
              hasFilter={hasActiveFilter}
              totalClips={clips.length}
            />
          ) : (
            <div className="space-y-2">
              {filteredClips.map(clip => (
                <ClipCard
                  key={clip.draft_id}
                  clip={clip}
                  isUpNext={isUpNext(clip.draft_id)}
                  isPlaying={currentClip?.draft_id === clip.draft_id}
                  onSkip={() => skipClip?.(clip.draft_id)}
                  onAddToQueue={() => addToQueue?.(clip.draft_id)}
                  onRetry={() => retryClip?.(clip.draft_id)}
                  CLIP_STATUS={CLIP_STATUS}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * NowPlayingCard — Currently playing clip with progress and controls
 */
function NowPlayingCard({ clip, currentMode, onSkip, onFlagMoment, onPause, onResume, isPaused }) {
  const [elapsed, setElapsed] = useState(0);
  const duration = clip.duration || 0;

  // Calculate elapsed time from startedAt
  useEffect(() => {
    if (!clip.startedAt) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const now = Date.now();
      const elapsedMs = now - clip.startedAt;
      setElapsed(Math.min(elapsedMs / 1000, duration));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 250);
    return () => clearInterval(interval);
  }, [clip.startedAt, duration]);

  // Format time as M:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (elapsed / duration) * 100 : 0;
  const remaining = Math.max(0, duration - elapsed);
  const apparatusCode = getApparatusCode(clip.apparatus);
  const apparatusColors = apparatusCode ? APPARATUS_COLORS[apparatusCode] : null;

  return (
    <div className="bg-zinc-900 rounded-lg p-3 border border-green-500/30">
      <div className="text-xs text-green-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <PlayIcon className="w-3 h-3" />
        Now Playing
      </div>

      <div className="flex gap-3">
        {/* Thumbnail placeholder */}
        <div
          className={`w-16 h-9 rounded flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
            apparatusColors?.bg || 'bg-zinc-700'
          }`}
        >
          {apparatusCode || '?'}
        </div>

        {/* Clip info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white font-medium text-sm truncate" title={clip.athlete_name}>
              {truncateAthleteName(clip.athlete_name)}
            </span>
            {clip.rotation && (
              <span className="text-xs px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded flex-shrink-0">
                R{clip.rotation}
              </span>
            )}
          </div>
          <div className="text-zinc-400 text-xs truncate">
            {clip.team_name || 'Unknown Team'}
            {clip.score !== null && clip.score !== undefined && (
              <span> · {clip.score.toFixed(3)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span>{formatTime(elapsed)}</span>
          <span>-{formatTime(remaining)}</span>
        </div>
        <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-200"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={isPaused ? onResume : onPause}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
            isPaused
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white border border-zinc-600'
          }`}
        >
          {isPaused ? (
            <>
              <PlayIcon className="w-3 h-3" />
              Resume
            </>
          ) : (
            <>
              <PauseIcon className="w-3 h-3" />
              Pause
            </>
          )}
        </button>
        <button
          onClick={onSkip}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white rounded border border-zinc-600 transition-colors"
        >
          <ForwardIcon className="w-3 h-3" />
          Skip
        </button>
        <button
          onClick={onFlagMoment}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded border border-cyan-500/30 transition-colors"
        >
          <FlagIcon className="w-3 h-3" />
          Flag Moment
        </button>
      </div>
    </div>
  );
}

/**
 * UpNextClipCard — Compact card for clips in the Up Next section
 */
function UpNextClipCard({ clip, isFirst, preloadState, onSkip }) {
  const apparatusCode = getApparatusCode(clip.apparatus);
  const apparatusColors = apparatusCode ? APPARATUS_COLORS[apparatusCode] : null;

  // Preload indicator
  const PreloadIndicator = () => {
    if (!isFirst || !preloadState) return null;

    if (preloadState.state === 'preload-ready') {
      return (
        <span className="flex items-center gap-1 text-xs text-green-400">
          <CheckCircleIcon className="w-3.5 h-3.5" />
          Preloaded
        </span>
      );
    }
    if (preloadState.state === 'preloading') {
      return (
        <span className="flex items-center gap-1 text-xs text-blue-400">
          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
          Preloading...
        </span>
      );
    }
    if (preloadState.state === 'preload-failed') {
      return (
        <span className="flex items-center gap-1 text-xs text-amber-400">
          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
          Preload failed
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`bg-zinc-900/70 rounded-lg p-2 border ${isFirst ? 'border-blue-500/30' : 'border-zinc-700/50'}`}>
      <div className="flex items-center gap-2">
        {/* Thumbnail placeholder */}
        <div
          className={`w-12 h-7 rounded flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
            apparatusColors?.bg || 'bg-zinc-700'
          }`}
        >
          {apparatusCode || '?'}
        </div>

        {/* Clip info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm truncate" title={clip.athlete_name}>
              {truncateAthleteName(clip.athlete_name)}
            </span>
            {clip.rotation && (
              <span className="text-xs px-1 py-0.5 bg-zinc-700/70 text-zinc-500 rounded">
                R{clip.rotation}
              </span>
            )}
          </div>
          <div className="text-zinc-500 text-xs truncate flex items-center gap-2">
            <span>{clip.team_name || 'Unknown'}</span>
            <PreloadIndicator />
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={onSkip}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          title="Skip this clip"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * ClipCard — Individual clip in the list
 */
function ClipCard({ clip, isUpNext, isPlaying, onSkip, onAddToQueue, onRetry, CLIP_STATUS }) {
  const apparatusCode = getApparatusCode(clip.apparatus);
  const apparatusColors = apparatusCode ? APPARATUS_COLORS[apparatusCode] : null;

  // Status-based styling
  const getStatusStyle = () => {
    switch (clip.status) {
      case CLIP_STATUS.QUEUED:
        return isUpNext
          ? 'border-blue-500/30 bg-blue-500/5'
          : 'border-zinc-700/50';
      case CLIP_STATUS.PLAYING:
        return 'border-green-500/30 bg-green-500/5';
      case CLIP_STATUS.PLAYED:
        return 'border-zinc-700/30 opacity-60';
      case CLIP_STATUS.SHOWN_LIVE:
        return 'border-amber-500/30 bg-amber-500/5';
      case CLIP_STATUS.SKIPPED:
        return 'border-zinc-700/30 opacity-40';
      case CLIP_STATUS.FAILED:
        return 'border-red-500/30 bg-red-500/5';
      case CLIP_STATUS.STALLED:
        return 'border-amber-500/30 bg-amber-500/5';
      case CLIP_STATUS.PENDING:
        return 'border-zinc-700/30 opacity-50';
      default:
        return 'border-zinc-700/50';
    }
  };

  // Status badge
  const StatusBadge = () => {
    switch (clip.status) {
      case CLIP_STATUS.PLAYED:
        return (
          <span className="text-xs px-1.5 py-0.5 bg-zinc-700/50 text-zinc-500 rounded">
            Played
          </span>
        );
      case CLIP_STATUS.SHOWN_LIVE:
        return (
          <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
            Shown Live
          </span>
        );
      case CLIP_STATUS.SKIPPED:
        return (
          <span className="text-xs px-1.5 py-0.5 bg-zinc-700/50 text-zinc-500 rounded">
            Skipped
          </span>
        );
      case CLIP_STATUS.FAILED:
        return (
          <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30">
            Failed
          </span>
        );
      case CLIP_STATUS.STALLED:
        return (
          <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
            Stalled
          </span>
        );
      case CLIP_STATUS.PENDING:
        return (
          <span className="text-xs px-1.5 py-0.5 bg-zinc-700/50 text-zinc-500 rounded flex items-center gap-1">
            <ClockIcon className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  // Action buttons based on status
  const ActionButtons = () => {
    switch (clip.status) {
      case CLIP_STATUS.QUEUED:
        return (
          <button
            onClick={onSkip}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Skip"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        );
      case CLIP_STATUS.PLAYED:
      case CLIP_STATUS.SHOWN_LIVE:
      case CLIP_STATUS.SKIPPED:
        return (
          <button
            onClick={onAddToQueue}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded border border-green-500/30 transition-colors"
          >
            <PlusIcon className="w-3 h-3" />
            {clip.status === CLIP_STATUS.PLAYED ? 'Re-queue' : 'Queue'}
          </button>
        );
      case CLIP_STATUS.FAILED:
      case CLIP_STATUS.STALLED:
        return (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded border border-amber-500/30 transition-colors"
          >
            <ArrowPathIcon className="w-3 h-3" />
            Retry
          </button>
        );
      default:
        return null;
    }
  };

  // Don't show playing clips in the list (they have their own section)
  if (isPlaying) return null;

  return (
    <div className={`bg-zinc-900 rounded-lg p-2 border ${getStatusStyle()}`}>
      <div className="flex items-center gap-2">
        {/* Thumbnail placeholder */}
        <div
          className={`w-14 h-8 rounded flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
            apparatusColors?.bg || 'bg-zinc-700'
          }`}
        >
          {apparatusCode || '?'}
        </div>

        {/* Clip info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm truncate" title={clip.athlete_name}>
              {truncateAthleteName(clip.athlete_name)}
            </span>
            <StatusBadge />
          </div>
          <div className="text-zinc-500 text-xs truncate flex items-center gap-1.5">
            <span>{clip.team_name || 'Unknown Team'}</span>
            {apparatusCode && (
              <>
                <span className="text-zinc-600">·</span>
                <span className={apparatusColors?.text || 'text-zinc-400'}>{apparatusCode}</span>
              </>
            )}
            {clip.score !== null && clip.score !== undefined && (
              <>
                <span className="text-zinc-600">·</span>
                <span>{clip.score.toFixed(3)}</span>
              </>
            )}
            {clip.rotation && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-600">R{clip.rotation}</span>
              </>
            )}
            {clip.duration && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-600">{Math.round(clip.duration)}s</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          <ActionButtons />
        </div>
      </div>

      {/* Failed clip error message */}
      {clip.status === CLIP_STATUS.FAILED && (
        <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
          <ExclamationTriangleIcon className="w-3 h-3" />
          Failed to load clip
        </div>
      )}
    </div>
  );
}

/**
 * EmptyState — Shown when no clips match current view/filters
 */
function EmptyState({ tab, hasFilter, totalClips }) {
  if (totalClips === 0) {
    // Initial state - no clips at all
    return (
      <div className="text-center py-8">
        <FilmIcon className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <div className="text-zinc-400 text-sm font-medium">No clips available yet</div>
        <div className="text-zinc-500 text-xs mt-1 flex items-center justify-center gap-1.5">
          <ArrowPathIcon className="w-3 h-3 animate-spin" />
          Waiting for routines...
        </div>
      </div>
    );
  }

  if (hasFilter) {
    // Filtered to empty
    return (
      <div className="text-center py-6">
        <FunnelIcon className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <div className="text-zinc-400 text-sm">No clips match current filters</div>
        <div className="text-zinc-500 text-xs mt-1">Try adjusting your filters</div>
      </div>
    );
  }

  // Tab-specific empty states
  const messages = {
    [TABS.ALL]: 'No clips in the queue',
    [TABS.QUEUED]: 'No clips waiting to play',
    [TABS.PLAYED]: 'No clips have been played yet',
    [TABS.SHOWN_LIVE]: 'No clips were shown live',
  };

  return (
    <div className="text-center py-6">
      <div className="text-zinc-500 text-sm">{messages[tab] || 'No clips'}</div>
    </div>
  );
}

/**
 * Truncate athlete name with ellipsis after 20 characters
 */
function truncateAthleteName(name) {
  if (!name) return 'Unknown Athlete';
  if (name.length <= 20) return name;
  return name.substring(0, 17) + '...';
}
