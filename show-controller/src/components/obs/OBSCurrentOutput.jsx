import { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  PauseIcon,
  PlayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';
import { useAutoRefreshScreenshot } from '../../hooks/useAutoRefreshScreenshot';

/**
 * OBSCurrentOutput - Displays current OBS program output with auto-refresh
 * PRD-OBS-09: Preview System
 */
export default function OBSCurrentOutput({
  connected,
  currentScene,
  isStreaming,
  isRecording,
  streamStatus,
  recordingStatus
}) {
  const [refreshInterval, setRefreshInterval] = useState(2000);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const {
    imageData,
    loading,
    error,
    lastUpdated,
    isPaused,
    setIsPaused,
    refresh
  } = useAutoRefreshScreenshot({
    intervalMs: refreshInterval,
    imageWidth: 640,
    imageHeight: 360,
    imageFormat: 'jpg',
    enabled: connected && autoRefreshEnabled
  });

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  // Auto-update the "last updated" display
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Format stream duration
  const formatDuration = (ms) => {
    if (!ms) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate dropped frames percentage
  const droppedFramesPercent = streamStatus?.outputTotalFrames > 0
    ? ((streamStatus?.outputSkippedFrames || 0) / streamStatus.outputTotalFrames * 100).toFixed(2)
    : '0.00';

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-6" data-testid="obs-current-output">
      <div className="flex items-start gap-4">
        {/* Preview Image */}
        <div className="relative" data-testid="program-screenshot">
          <div className="w-64 h-36 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
            {!connected ? (
              <div className="text-gray-500 text-sm text-center px-4">
                <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                OBS Disconnected
              </div>
            ) : loading && !imageData ? (
              <div className="text-gray-500 text-sm flex items-center gap-2">
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Loading...
              </div>
            ) : error ? (
              <div className="text-red-400 text-sm text-center px-4">
                <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2 text-red-500" />
                {error}
                <button
                  onClick={refresh}
                  className="block mx-auto mt-2 text-xs text-gray-400 hover:text-white underline"
                >
                  Retry
                </button>
              </div>
            ) : imageData ? (
              <img
                src={imageData}
                alt="OBS Program Output"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-gray-500 text-sm">No preview available</div>
            )}
          </div>

          {/* Live indicator overlay */}
          {isStreaming && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
              LIVE
            </div>
          )}

          {/* Recording indicator overlay */}
          {isRecording && (
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-800 text-white text-xs font-bold rounded flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              REC
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="flex-1">
          <h2 className="text-white font-semibold mb-2">Program Output</h2>

          {/* Current Scene */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400 text-sm">Scene:</span>
            <span className="text-white font-medium">
              {connected ? (currentScene || 'No scene active') : 'Disconnected'}
            </span>
          </div>

          {/* Stream Info */}
          {isStreaming && streamStatus && (
            <div className="mb-2 text-sm">
              <div className="flex items-center gap-2 text-green-400">
                <span>Duration:</span>
                <span className="font-mono">{streamStatus.outputTimecode || formatDuration(streamStatus.outputDuration)}</span>
              </div>
              {streamStatus.outputBytes > 0 && (
                <div className="flex items-center gap-2 text-gray-400">
                  <span>Data:</span>
                  <span>{(streamStatus.outputBytes / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              )}
              {parseFloat(droppedFramesPercent) > 0.1 && (
                <div className="flex items-center gap-1 text-yellow-400">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  <span>Dropped frames: {droppedFramesPercent}%</span>
                </div>
              )}
            </div>
          )}

          {/* Recording Info */}
          {isRecording && recordingStatus && (
            <div className="mb-2 text-sm">
              <div className="flex items-center gap-2 text-red-400">
                <span>Recording:</span>
                <span className="font-mono">{recordingStatus.outputTimecode || formatDuration(recordingStatus.outputDuration)}</span>
              </div>
            </div>
          )}

          {/* Status badges */}
          <div className="flex gap-2 mb-3">
            {isStreaming && (
              <span className="px-2 py-1 bg-red-600/20 border border-red-600 text-red-300 text-xs font-semibold rounded flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                LIVE
              </span>
            )}
            {isRecording && (
              <span className="px-2 py-1 bg-red-600/20 border border-red-600 text-red-300 text-xs font-semibold rounded flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                RECORDING
              </span>
            )}
            {!isStreaming && !isRecording && connected && (
              <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs font-semibold rounded">
                Offline
              </span>
            )}
          </div>

          {/* Auto-refresh controls */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`p-1.5 rounded transition-colors ${
                  autoRefreshEnabled
                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
                title={autoRefreshEnabled ? 'Pause auto-refresh' : 'Resume auto-refresh'}
              >
                {autoRefreshEnabled ? (
                  <PauseIcon className="w-4 h-4" />
                ) : (
                  <PlayIcon className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={refresh}
                disabled={!connected}
                className="p-1.5 bg-gray-700 text-gray-400 rounded hover:bg-gray-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh now"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <span className="text-gray-500" data-testid="last-updated">
              {isPaused ? 'Paused (tab hidden)' : `Updated: ${formatLastUpdated()}`}
            </span>

            {/* Refresh interval selector */}
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-gray-700 text-gray-300 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-purple-500"
            >
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
