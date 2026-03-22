import { useMemo } from 'react';
import {
  PlayIcon,
  FilmIcon,
  VideoCameraIcon,
  ArrowPathIcon,
  PauseIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';

/**
 * PlayoutStatusBar — Always visible at top of playout panel
 * Shows current system state at a glance: NOW, NEXT, QUEUE cards + coordinator health
 *
 * Props (from usePlayoutState):
 * - mode: 'CLIP' | 'LIVE' | 'MOMENT_REPLAY' | 'FALLBACK' | 'BREAK' | 'OVERRIDE' | 'PAUSED'
 * - currentContent: { type, athleteName, apparatus, teamName, cameraNumber, contentItem, graphicName }
 * - nextContent: { type, athleteName, apparatus, teamName, score, preloadState }
 * - queueStats: { queuedCount, playedCount, estimatedTimeRemaining }
 * - coordinatorHeartbeat: timestamp (ms) of last heartbeat
 * - currentRotation: number
 * - isOverride: boolean
 * - isAutonomous: boolean (inverse of isOverride)
 */
export default function PlayoutStatusBar({
  mode = 'FALLBACK',
  currentContent = {},
  nextContent = {},
  queueStats = {},
  coordinatorHeartbeat = null,
  currentRotation = 1,
  isOverride = false,
}) {
  // Calculate coordinator health based on heartbeat age
  const coordinatorHealth = useMemo(() => {
    if (!coordinatorHeartbeat) return 'offline';
    const age = Date.now() - coordinatorHeartbeat;
    if (age < 15000) return 'healthy';
    if (age < 30000) return 'slow';
    return 'offline';
  }, [coordinatorHeartbeat]);

  // Format estimated time remaining (seconds to MM:SS)
  const formatEstimatedTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`bg-zinc-800 rounded-xl p-4 border ${
        isOverride ? 'border-amber-500/50' : 'border-green-500/30'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PlayIcon className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-white uppercase tracking-wide">
            Playout Active
          </span>
          {currentRotation > 0 && (
            <span className="text-sm text-zinc-400">— Rotation {currentRotation}</span>
          )}
        </div>
        <CoordinatorHealthIndicator health={coordinatorHealth} />
      </div>

      {/* Three cards row */}
      <div className="grid grid-cols-3 gap-3">
        {/* NOW Card */}
        <NowCard mode={mode} content={currentContent} />

        {/* NEXT Card */}
        <NextCard content={nextContent} />

        {/* QUEUE Card */}
        <QueueCard stats={queueStats} formatTime={formatEstimatedTime} />
      </div>
    </div>
  );
}

/**
 * Mode badge styling based on playout mode
 */
function getModeBadgeStyle(mode) {
  switch (mode) {
    case 'CLIP':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'LIVE':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'MOMENT_REPLAY':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'FALLBACK':
      return 'bg-zinc-600/30 text-zinc-400 border-zinc-500/30';
    case 'BREAK':
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-400/30';
    case 'OVERRIDE':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'PAUSED':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-zinc-600/30 text-zinc-400 border-zinc-500/30';
  }
}

/**
 * Display label for mode (MOMENT_REPLAY → REPLAY)
 */
function getModeLabel(mode) {
  if (mode === 'MOMENT_REPLAY') return 'REPLAY';
  return mode;
}

/**
 * Mode icon
 */
function getModeIcon(mode) {
  switch (mode) {
    case 'CLIP':
    case 'MOMENT_REPLAY':
      return <FilmIcon className="w-4 h-4" />;
    case 'LIVE':
      return <VideoCameraIcon className="w-4 h-4" />;
    case 'PAUSED':
      return <PauseIcon className="w-4 h-4" />;
    case 'FALLBACK':
    case 'BREAK':
      return <ArrowPathIcon className="w-4 h-4" />;
    case 'OVERRIDE':
      return <ExclamationTriangleIcon className="w-4 h-4" />;
    default:
      return <PlayIcon className="w-4 h-4" />;
  }
}

/**
 * NOW Card — Current mode and content details
 */
function NowCard({ mode, content }) {
  const badgeStyle = getModeBadgeStyle(mode);

  // Build detail line based on mode
  let detailLine = '';
  let secondLine = '';

  switch (mode) {
    case 'CLIP':
    case 'MOMENT_REPLAY':
      detailLine = content.athleteName || 'Unknown Athlete';
      secondLine = content.apparatus || '';
      break;
    case 'LIVE':
      detailLine = content.apparatus || 'Camera';
      secondLine = content.cameraNumber ? `Camera ${content.cameraNumber}` : '';
      break;
    case 'FALLBACK':
      detailLine = content.graphicName || 'Gap Fill';
      break;
    case 'BREAK':
      detailLine = content.contentItem || 'Break Content';
      break;
    case 'OVERRIDE':
      detailLine = content.cameraNumber
        ? `Camera ${content.cameraNumber}`
        : content.graphicName || 'Override';
      break;
    case 'PAUSED':
      detailLine = 'Paused';
      break;
    default:
      detailLine = '-';
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Now</div>
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${badgeStyle}`}
        >
          {getModeIcon(mode)}
          {getModeLabel(mode)}
        </span>
      </div>
      <div className="text-white font-medium text-sm truncate" title={detailLine}>
        {detailLine}
      </div>
      {secondLine && (
        <div className="text-zinc-400 text-xs truncate" title={secondLine}>
          {secondLine}
        </div>
      )}
    </div>
  );
}

/**
 * NEXT Card — Upcoming content with preload indicator
 */
function NextCard({ content }) {
  const { type, athleteName, apparatus, teamName, score, preloadState } = content;

  // Preload indicator
  const PreloadIndicator = () => {
    if (preloadState === 'preload-ready') {
      return (
        <CheckCircleIcon
          className="w-3.5 h-3.5 text-green-400"
          title="Preloaded and ready"
        />
      );
    }
    if (preloadState === 'preloading') {
      return (
        <ArrowPathIcon
          className="w-3.5 h-3.5 text-blue-400 animate-spin"
          title="Preloading..."
        />
      );
    }
    if (preloadState === 'preload-failed') {
      return (
        <ExclamationTriangleIcon
          className="w-3.5 h-3.5 text-amber-400"
          title="Preload failed — will load on demand"
        />
      );
    }
    return null;
  };

  // No next content
  if (!type && !athleteName) {
    return (
      <div className="bg-zinc-900 rounded-lg p-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Next</div>
        <div className="text-zinc-500 text-sm">No upcoming content</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Next</div>
        <PreloadIndicator />
      </div>
      <div className="text-white font-medium text-sm truncate" title={athleteName}>
        {type === 'clip' && 'Clip: '}
        {athleteName || 'Unknown'}
      </div>
      <div className="text-zinc-400 text-xs truncate">
        {apparatus && <span>{apparatus}</span>}
        {apparatus && score !== null && score !== undefined && <span> · </span>}
        {score !== null && score !== undefined && <span>{score.toFixed(3)}</span>}
      </div>
      {teamName && (
        <div className="text-zinc-500 text-xs truncate" title={teamName}>
          {teamName}
        </div>
      )}
    </div>
  );
}

/**
 * QUEUE Card — Clip counts and estimated time remaining
 */
function QueueCard({ stats, formatTime }) {
  const { queuedCount = 0, playedCount = 0, estimatedTimeRemaining = 0 } = stats;

  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Queue</div>
      <div className="text-white font-medium text-sm">
        {queuedCount} clip{queuedCount !== 1 ? 's' : ''}
      </div>
      <div className="text-zinc-400 text-xs">
        ~{formatTime(estimatedTimeRemaining)} left
      </div>
      <div className="text-zinc-500 text-xs">{playedCount} played</div>
    </div>
  );
}

/**
 * Coordinator Health Indicator — Connection status dot
 */
function CoordinatorHealthIndicator({ health }) {
  const colors = {
    healthy: 'bg-green-500',
    slow: 'bg-amber-500',
    offline: 'bg-red-500',
  };

  const labels = {
    healthy: 'Coordinator',
    slow: 'Coordinator Slow',
    offline: 'Coordinator Offline',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colors[health]} animate-pulse`} />
      <span
        className={`text-xs ${
          health === 'healthy'
            ? 'text-zinc-400'
            : health === 'slow'
            ? 'text-amber-400'
            : 'text-red-400'
        }`}
      >
        {labels[health]}
      </span>
    </div>
  );
}
