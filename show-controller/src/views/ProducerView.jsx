import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useShow } from '../context/ShowContext';
import { useCompetition } from '../context/CompetitionContext';
import { useTimesheet } from '../hooks/useTimesheet';
import CurrentSegment from '../components/CurrentSegment';
import NextSegment from '../components/NextSegment';
import RunOfShow from '../components/RunOfShow';
import ConnectionStatus from '../components/ConnectionStatus';
import GraphicsControl from '../components/GraphicsControl';
import CameraRuntimePanel from '../components/CameraRuntimePanel';
// TimesheetPanel removed - functionality consolidated into main content area (PRD-Rundown-00)
import OverrideLog from '../components/OverrideLog';
import AlertPanel from '../components/AlertPanel';
import { useAlerts } from '../hooks/useAlerts';
import {
  PlayIcon,
  BackwardIcon,
  ForwardIcon,
  PauseIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowPathIcon,
  StopIcon,
  UsersIcon,
  VideoCameraIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  BellAlertIcon,
  QueueListIcon,
  ComputerDesktopIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  BeakerIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/solid';

// Health status colors for quick camera buttons
const HEALTH_COLORS = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  reconnecting: 'bg-orange-500',
  offline: 'bg-red-500',
  unknown: 'bg-zinc-500'
};

export default function ProducerView() {
  const { compId, competitionConfig } = useCompetition();
  const {
    socket,
    state,
    jumpTo,
    overrideScene,
    lockTalent,
    togglePause,
    resetShow,
    identify,
    error,
    loadRundown,
    timesheetState,
    setRehearsalMode,
    clearRundownModified
  } = useShow();

  // Use timesheet hook for show control actions
  const {
    start: timesheetStart,
    stop: timesheetStop,
    advance: timesheetAdvance,
    previous: timesheetPrevious,
    isRunning: timesheetIsRunning,
    isPaused: timesheetIsPaused,
    isHoldSegment,
    canAdvanceHold,
    isFirstSegment,
    totalSegments,
    rundownModified,
    rundownModifiedSummary
  } = useTimesheet();

  const {
    showConfig,
    isPlaying,
    isPaused,
    talentLocked,
    obsConnected,
    obsCurrentScene,
    connectedClients,
    showProgress
  } = state;

  // Determine if show is active (use timesheet state if available, fallback to legacy)
  const showIsActive = timesheetIsRunning || isPlaying;
  const showIsPaused = timesheetIsPaused || isPaused;

  // Alerts state
  const {
    alerts,
    criticalAlerts,
    warningAlerts,
    criticalCount,
    warningCount,
    infoCount,
    hasUnacknowledgedCritical,
    acknowledgeAlert,
    acknowledgeAll
  } = useAlerts();

  const [scenes, setScenes] = useState([]);
  const [cameraHealth, setCameraHealth] = useState([]);
  const [cameraRuntimeState, setCameraRuntimeState] = useState([]);
  const [cameraMismatches, setCameraMismatches] = useState([]);
  const [isLoadingRundown, setIsLoadingRundown] = useState(false);
  const [isReloadingRundown, setIsReloadingRundown] = useState(false);
  const [loadRundownToast, setLoadRundownToast] = useState(null); // { type: 'success' | 'error', message: string }
  const [showReloadConfirmation, setShowReloadConfirmation] = useState(false); // Confirmation dialog state

  // Server URL for REST API calls
  const serverUrl = import.meta.env.PROD
    ? (import.meta.env.VITE_SOCKET_SERVER || '')
    : 'http://localhost:3003';

  useEffect(() => {
    identify('producer', 'Producer');

    // Fetch available scenes
    fetch('/api/scenes')
      .then(res => res.json())
      .then(setScenes)
      .catch(console.error);

    // Fetch initial camera state
    async function fetchCameraState() {
      try {
        const [healthRes, runtimeRes] = await Promise.all([
          fetch(`${serverUrl}/api/cameras/health`),
          fetch(`${serverUrl}/api/cameras/runtime`)
        ]);

        if (healthRes.ok) {
          setCameraHealth(await healthRes.json());
        }
        if (runtimeRes.ok) {
          const runtime = await runtimeRes.json();
          setCameraRuntimeState(runtime);
          setCameraMismatches(runtime.filter(c => c.hasMismatch));
        }
      } catch (err) {
        console.error('Failed to fetch camera state:', err);
      }
    }
    fetchCameraState();
  }, [identify, serverUrl]);

  // Subscribe to camera socket events
  useEffect(() => {
    if (!socket) return;

    const handleCameraHealth = (health) => {
      setCameraHealth(health);
    };

    const handleCameraRuntimeState = (state) => {
      setCameraRuntimeState(state);
      setCameraMismatches(state.filter(c => c.hasMismatch));
    };

    socket.on('cameraHealth', handleCameraHealth);
    socket.on('cameraRuntimeState', handleCameraRuntimeState);

    return () => {
      socket.off('cameraHealth', handleCameraHealth);
      socket.off('cameraRuntimeState', handleCameraRuntimeState);
    };
  }, [socket]);

  // Quick camera switch function
  const switchToCamera = useCallback((cameraId) => {
    if (socket) {
      socket.emit('overrideCamera', { cameraId });
    }
  }, [socket]);

  // Get camera health status by ID
  const getCameraHealth = useCallback((cameraId) => {
    const health = cameraHealth.find(c => c.cameraId === cameraId);
    return health?.status || 'unknown';
  }, [cameraHealth]);

  // Get camera name by ID
  const getCameraName = useCallback((cameraId) => {
    const health = cameraHealth.find(c => c.cameraId === cameraId);
    return health?.cameraName || cameraId;
  }, [cameraHealth]);

  // Handle load rundown button click
  const handleLoadRundown = useCallback(() => {
    setIsLoadingRundown(true);
    setLoadRundownToast(null);
    loadRundown();
  }, [loadRundown]);

  // Handle reload rundown button click - shows confirmation dialog
  const handleReloadRundown = useCallback(() => {
    setShowReloadConfirmation(true);
  }, []);

  // Actually perform the reload after confirmation
  const confirmReloadRundown = useCallback(() => {
    setShowReloadConfirmation(false);
    setIsReloadingRundown(true);
    setLoadRundownToast(null);
    // Clear the modified state before reloading
    clearRundownModified();
    loadRundown();
  }, [loadRundown, clearRundownModified]);

  // Cancel the reload confirmation
  const cancelReloadRundown = useCallback(() => {
    setShowReloadConfirmation(false);
  }, []);

  // Listen for loadRundownResult via socket
  useEffect(() => {
    if (!socket) return;

    const handleLoadRundownResult = ({ success, segmentCount, error: loadError }) => {
      setIsLoadingRundown(false);
      setIsReloadingRundown(false);
      if (success) {
        setLoadRundownToast({ type: 'success', message: `Rundown loaded: ${segmentCount} segments` });
      } else {
        setLoadRundownToast({ type: 'error', message: `Failed to load rundown: ${loadError || 'Unknown error'}` });
      }
      // Auto-clear toast after 5 seconds
      setTimeout(() => setLoadRundownToast(null), 5000);
    };

    socket.on('loadRundownResult', handleLoadRundownResult);

    return () => {
      socket.off('loadRundownResult', handleLoadRundownResult);
    };
  }, [socket]);

  // Common OBS scenes for quick access
  const sceneOverrides = [
    'Intro Video',
    'Talent Camera',
    'Competition Camera',
    'Scoreboard',
    'Interview',
    'Sponsor',
    'BRB',
    'End Card'
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Home
            </Link>
            <Link
              to={`/${compId}/rundown`}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <QueueListIcon className="w-3 h-3" />
              Rundown Editor
            </Link>
            <Link
              to={`/${compId}/obs-manager`}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <ComputerDesktopIcon className="w-3 h-3" />
              OBS Manager
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">
                {competitionConfig?.eventName || showConfig?.showName || 'Show Controller'}
              </h1>
              <div className="text-sm text-zinc-500">Producer View</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Rundown status badge */}
            {timesheetState?.rundownLoaded ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/30">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                <span>{timesheetState?.segments?.length || 0} segments</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-700/50 text-zinc-400 text-xs rounded-lg border border-zinc-600/50">
                <DocumentTextIcon className="w-3.5 h-3.5" />
                <span>No Rundown</span>
              </span>
            )}
            {/* Rundown Modified warning badge + Reload button */}
            {rundownModified && rundownModifiedSummary && (
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border ${
                    rundownModifiedSummary.affectsCurrent
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }`}
                  title={rundownModifiedSummary.summaryText || 'Rundown has been modified'}
                >
                  {rundownModifiedSummary.affectsCurrent ? (
                    <ExclamationCircleIcon className="w-3.5 h-3.5" />
                  ) : (
                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {(() => {
                      const total = (rundownModifiedSummary.added?.length || 0) +
                        (rundownModifiedSummary.removed?.length || 0) +
                        (rundownModifiedSummary.modified?.length || 0);
                      return `${total} change${total !== 1 ? 's' : ''}`;
                    })()}
                  </span>
                </span>
                <button
                  onClick={handleReloadRundown}
                  disabled={isReloadingRundown}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    isReloadingRundown
                      ? 'bg-zinc-600 text-zinc-400 border-zinc-500 cursor-wait'
                      : rundownModifiedSummary.affectsCurrent
                      ? 'bg-red-600 hover:bg-red-500 text-white border-red-500'
                      : 'bg-yellow-600 hover:bg-yellow-500 text-white border-yellow-500'
                  }`}
                  title="Reload rundown from Rundown Editor"
                >
                  <ArrowUturnLeftIcon className={`w-3.5 h-3.5 ${isReloadingRundown ? 'animate-spin' : ''}`} />
                  <span>{isReloadingRundown ? 'Reloading...' : 'Reload'}</span>
                </button>
              </div>
            )}
            {/* Alert count badge */}
            {(criticalCount > 0 || warningCount > 0) && (
              <div className="flex items-center gap-1">
                {criticalCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">
                    <ExclamationCircleIcon className="w-3.5 h-3.5" />
                    {criticalCount}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-lg">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                    {warningCount}
                  </span>
                )}
              </div>
            )}
            <ConnectionStatus />
          </div>
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}

      {/* Load Rundown Toast */}
      {loadRundownToast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 ${
          loadRundownToast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {loadRundownToast.message}
        </div>
      )}

      {/* Reload Rundown Confirmation Dialog */}
      {showReloadConfirmation && rundownModifiedSummary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 border-b ${
              rundownModifiedSummary.affectsCurrent
                ? 'bg-red-500/20 border-red-500/30'
                : 'bg-yellow-500/20 border-yellow-500/30'
            }`}>
              <div className="flex items-center gap-3">
                {rundownModifiedSummary.affectsCurrent ? (
                  <ExclamationCircleIcon className="w-6 h-6 text-red-400" />
                ) : (
                  <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400" />
                )}
                <h3 className="text-lg font-bold text-white">Reload Rundown?</h3>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Changes summary */}
              <div>
                <div className="text-sm text-zinc-400 mb-2">Changes detected:</div>
                <ul className="space-y-1 text-sm">
                  {(rundownModifiedSummary.added?.length || 0) > 0 && (
                    <li className="flex items-center gap-2 text-green-400">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                      {rundownModifiedSummary.added.length} segment{rundownModifiedSummary.added.length !== 1 ? 's' : ''} added
                    </li>
                  )}
                  {(rundownModifiedSummary.removed?.length || 0) > 0 && (
                    <li className="flex items-center gap-2 text-red-400">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                      {rundownModifiedSummary.removed.length} segment{rundownModifiedSummary.removed.length !== 1 ? 's' : ''} removed
                    </li>
                  )}
                  {(rundownModifiedSummary.modified?.length || 0) > 0 && (
                    <li className="flex items-center gap-2 text-yellow-400">
                      <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                      {rundownModifiedSummary.modified.length} segment{rundownModifiedSummary.modified.length !== 1 ? 's' : ''} modified
                    </li>
                  )}
                  {(rundownModifiedSummary.reordered?.length || 0) > 0 && (
                    <li className="flex items-center gap-2 text-blue-400">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                      {rundownModifiedSummary.reordered.length} segment{rundownModifiedSummary.reordered.length !== 1 ? 's' : ''} reordered
                    </li>
                  )}
                </ul>
              </div>

              {/* Current position info */}
              <div className="bg-zinc-800 rounded-lg px-4 py-3">
                <div className="text-sm text-zinc-300">
                  <span className="text-zinc-400">Current position will be preserved.</span>
                  {timesheetState?.currentSegmentIndex !== undefined && totalSegments > 0 && (
                    <div className="mt-1">
                      You are on segment <span className="font-medium text-white">{timesheetState.currentSegmentIndex + 1}</span> of <span className="font-medium text-white">{totalSegments}</span>.
                    </div>
                  )}
                </div>
              </div>

              {/* Warning if current segment affected */}
              {rundownModifiedSummary.affectsCurrent && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <div className="flex items-start gap-2">
                    <ExclamationCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-300">
                      <span className="font-medium">Warning:</span> The current segment has been modified or removed.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-zinc-800/50 border-t border-zinc-700 flex justify-end gap-3">
              <button
                onClick={cancelReloadRundown}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmReloadRundown}
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  rundownModifiedSummary.affectsCurrent
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
              >
                Reload Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Critical Alert Banner - always visible at top */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-500/20 border-b border-red-500/40 px-4 py-3">
          <div className="max-w-6xl mx-auto">
            {criticalAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-3 mb-2 last:mb-0">
                <ExclamationCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-red-400 font-medium">{alert.title}: </span>
                  <span className="text-red-300/80">{alert.message}</span>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="px-2 py-1 text-xs bg-red-500/30 hover:bg-red-500/50 text-red-300 rounded transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera Mismatch Alert Banner - shown without expanding panel */}
      {cameraMismatches.length > 0 && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-yellow-400 font-medium">Camera Mismatch Alert: </span>
              <span className="text-yellow-300/80">
                {cameraMismatches.map((cam, idx) => (
                  <span key={cam.id}>
                    {idx > 0 && ', '}
                    {getCameraName(cam.id)} (expected: {cam.expectedApparatus?.join(', ') || 'none'})
                  </span>
                ))}
              </span>
            </div>
            <span className="text-xs text-yellow-400/60">{cameraMismatches.length} camera{cameraMismatches.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* REHEARSAL Mode Banner - always visible when rehearsal mode is active */}
      {timesheetState?.isRehearsalMode && (
        <div className="bg-purple-500/20 border-b border-purple-500/40 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-3">
            <BeakerIcon className="w-5 h-5 text-purple-400" />
            <span className="text-purple-300 font-bold tracking-wider">REHEARSAL MODE</span>
            <span className="text-purple-400/70 text-sm">— OBS scene changes and graphics are disabled</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Show State */}
          <div className="lg:col-span-2 space-y-4">
            {!showIsActive ? (
              /* Start Show */
              <div className="bg-zinc-800 rounded-xl p-8 text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Start</h2>
                <p className="text-zinc-400 mb-6">
                  {timesheetState?.rundownLoaded
                    ? `${totalSegments || timesheetState?.segments?.length || 0} segments loaded`
                    : 'No rundown loaded'}
                </p>
                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={handleLoadRundown}
                    disabled={isLoadingRundown}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                      isLoadingRundown
                        ? 'bg-zinc-600 text-zinc-400 cursor-wait'
                        : timesheetState?.rundownLoaded
                        ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    <ArrowDownTrayIcon className={`w-5 h-5 ${isLoadingRundown ? 'animate-pulse' : ''}`} />
                    {isLoadingRundown ? 'Loading...' : timesheetState?.rundownLoaded ? 'Reload Rundown' : 'Load Rundown'}
                  </button>
                  {/* Rehearsal Mode Toggle */}
                  <button
                    onClick={() => setRehearsalMode(!timesheetState?.isRehearsalMode)}
                    disabled={!timesheetState?.rundownLoaded}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      !timesheetState?.rundownLoaded
                        ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        : timesheetState?.isRehearsalMode
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                    }`}
                    title={timesheetState?.isRehearsalMode ? 'Disable rehearsal mode' : 'Enable rehearsal mode (skips OBS/graphics)'}
                  >
                    <BeakerIcon className="w-4 h-4" />
                    {timesheetState?.isRehearsalMode ? 'Rehearsal Mode ON' : 'Rehearsal Mode'}
                  </button>
                  <button
                    onClick={timesheetStart}
                    disabled={!timesheetState?.rundownLoaded}
                    className={`inline-flex items-center gap-2 px-8 py-4 font-bold text-lg rounded-xl transition-colors ${
                      timesheetState?.rundownLoaded
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <PlayIcon className="w-6 h-6" />
                    Start Show
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Current Segment Deleted Warning (Task 35) */}
                {timesheetState?.currentSegmentDeleted && (
                  <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
                    <ExclamationCircleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-red-300 font-semibold">Current Segment Deleted</div>
                      <div className="text-red-400/80 text-sm mt-1">
                        This segment was removed from the rundown. Click <strong>NEXT</strong> to advance to the next valid segment.
                      </div>
                    </div>
                  </div>
                )}

                {/* Current & Next Segment */}
                <CurrentSegment />
                <NextSegment />

                {/* Show Controls */}
                <div className="bg-zinc-800 rounded-xl p-4">
                  <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Show Control</div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => timesheetPrevious('producer')}
                      disabled={isFirstSegment}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                        isFirstSegment
                          ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                      }`}
                      title={isFirstSegment ? 'Already at first segment' : 'Go to previous segment'}
                    >
                      <BackwardIcon className="w-5 h-5" />
                      Previous
                    </button>

                    <button
                      onClick={() => timesheetAdvance('producer')}
                      disabled={isHoldSegment && !canAdvanceHold}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-bold rounded-lg transition-colors ${
                        isHoldSegment && !canAdvanceHold
                          ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                      title={isHoldSegment && !canAdvanceHold ? 'Wait for hold minimum duration' : 'Advance to next segment'}
                    >
                      <ForwardIcon className="w-5 h-5" />
                      NEXT
                    </button>

                    <button
                      onClick={togglePause}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                        showIsPaused
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                      }`}
                    >
                      {showIsPaused ? (
                        <>
                          <PlayIcon className="w-5 h-5" />
                          Resume
                        </>
                      ) : (
                        <>
                          <PauseIcon className="w-5 h-5" />
                          Pause
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => lockTalent(!talentLocked)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        talentLocked
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      {talentLocked ? (
                        <>
                          <LockClosedIcon className="w-4 h-4" />
                          Unlock Talent
                        </>
                      ) : (
                        <>
                          <LockOpenIcon className="w-4 h-4" />
                          Lock Talent
                        </>
                      )}
                    </button>

                    <button
                      onClick={resetShow}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                      Reset Show
                    </button>

                    <button
                      onClick={timesheetStop}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                      title="Stop the show"
                    >
                      <StopIcon className="w-4 h-4" />
                      Stop
                    </button>
                  </div>
                </div>

                {/* Quick Camera Buttons - wired to runtime state */}
                {cameraHealth.length > 0 && (
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-wide mb-3">
                      <VideoCameraIcon className="w-4 h-4" />
                      Quick Camera Switch
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {cameraHealth.map((cam) => {
                        const runtime = cameraRuntimeState.find(r => r.id === cam.cameraId);
                        const isOnline = cam.status !== 'offline' && cam.status !== 'unknown';
                        const hasMismatch = runtime?.hasMismatch;
                        const apparatus = runtime?.currentApparatus || [];

                        return (
                          <button
                            key={cam.cameraId}
                            onClick={() => switchToCamera(cam.cameraId)}
                            disabled={!isOnline}
                            className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              !isOnline
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-60'
                                : hasMismatch
                                ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border border-yellow-500/50'
                                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                            }`}
                            title={`${cam.cameraName}: ${cam.status}${apparatus.length > 0 ? ` (${apparatus.join(', ')})` : ''}${hasMismatch ? ' - MISMATCH' : ''}`}
                          >
                            {/* Health indicator dot */}
                            <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${HEALTH_COLORS[cam.status]}`} />
                            <div className="truncate">{cam.cameraName || cam.cameraId}</div>
                            {apparatus.length > 0 && (
                              <div className="text-xs opacity-70 truncate">{apparatus.join(', ')}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Scene Override */}
                <div className="bg-zinc-800 rounded-xl p-4">
                  <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Scene Override</div>

                  <div className="grid grid-cols-4 gap-2">
                    {sceneOverrides.map((scene) => (
                      <button
                        key={scene}
                        onClick={() => overrideScene(scene)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          obsCurrentScene === scene
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                        }`}
                      >
                        {scene}
                      </button>
                    ))}
                  </div>

                  {scenes.length > 0 && (
                    <div className="mt-3">
                      <select
                        value={obsCurrentScene || ''}
                        onChange={(e) => overrideScene(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm"
                      >
                        <option value="">Select scene...</option>
                        {scenes.map((scene) => (
                          <option key={scene} value={scene}>{scene}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Run of Show - Clickable for jump */}
            <RunOfShow clickable onSegmentClick={jumpTo} />
          </div>

          {/* Right Column - Status */}
          <div className="space-y-4">
            {/* Override Log */}
            <OverrideLog collapsed={true} defaultVisible={5} />

            {/* Alert Panel - warning alerts shown in collapsible panel */}
            <AlertPanel
              alerts={alerts}
              onAcknowledge={acknowledgeAlert}
              onAcknowledgeAll={acknowledgeAll}
              collapsed={true}
            />

            {/* Camera Runtime Panel */}
            <CameraRuntimePanel collapsed={false} />

            {/* Web Graphics Control */}
            <GraphicsControl competitionId={compId} />

            {/* Connected Clients */}
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-wide mb-3">
                <UsersIcon className="w-4 h-4" />
                Connected Clients ({connectedClients.length})
              </div>

              <div className="space-y-2">
                {connectedClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-zinc-300">{client.name || 'Unknown'}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      client.role === 'producer'
                        ? 'bg-purple-500/20 text-purple-400'
                        : client.role === 'talent'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {client.role || 'unknown'}
                    </span>
                  </div>
                ))}

                {connectedClients.length === 0 && (
                  <div className="text-zinc-500 text-sm">No clients connected</div>
                )}
              </div>
            </div>

            {/* Show Stats - Simplified per PRD-Rundown-00 */}
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Show Stats</div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Status</span>
                  <span className={
                    showIsPaused ? 'text-yellow-400' :
                    showIsActive ? 'text-green-400' :
                    'text-zinc-400'
                  }>
                    {showIsPaused ? 'Paused' : showIsActive ? 'Live' : 'Ready'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Talent Controls</span>
                  <span className={talentLocked ? 'text-red-400' : 'text-green-400'}>
                    {talentLocked ? 'Locked' : 'Unlocked'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">OBS</span>
                  <span className={obsConnected ? 'text-green-400' : 'text-red-400'}>
                    {obsConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
