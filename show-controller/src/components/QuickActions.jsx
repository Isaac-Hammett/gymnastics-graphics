import { useEffect, useState, useCallback, useMemo } from 'react';
import { useShow } from '../context/ShowContext';
import { useCompetition } from '../context/CompetitionContext';
import { useApparatus } from '../hooks/useApparatus';
import useEventConfig from '../hooks/useEventConfig';
import { db, ref, set, onValue } from '../lib/firebase';
import {
  VideoCameraIcon,
  PlayIcon,
  ChartBarIcon,
  ArrowPathIcon,
  PauseIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  XMarkIcon,
  TrophyIcon
} from '@heroicons/react/24/solid';

const iconMap = {
  'video-camera': VideoCameraIcon,
  'play': PlayIcon,
  'chart-bar': ChartBarIcon,
  'arrow-path': ArrowPathIcon,
  'pause': PauseIcon,
  'currency-dollar': CurrencyDollarIcon
};

// Health status colors
const HEALTH_COLORS = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  reconnecting: 'bg-orange-500',
  offline: 'bg-red-500',
  unknown: 'bg-zinc-500'
};

// Leaderboard button mapping (uses short names for display)
const leaderboardButtonConfig = {
  floor: { id: 'leaderboard-fx', label: 'FX', leaderboardEvent: 'fx' },
  pommel: { id: 'leaderboard-ph', label: 'PH', leaderboardEvent: 'ph' },
  rings: { id: 'leaderboard-sr', label: 'SR', leaderboardEvent: 'sr' },
  vault: { id: 'leaderboard-vt', label: 'VT', leaderboardEvent: 'vt' },
  pBars: { id: 'leaderboard-pb', label: 'PB', leaderboardEvent: 'pb' },
  hBar: { id: 'leaderboard-hb', label: 'HB', leaderboardEvent: 'hb' },
  bars: { id: 'leaderboard-ub', label: 'UB', leaderboardEvent: 'ub' },
  beam: { id: 'leaderboard-bb', label: 'BB', leaderboardEvent: 'bb' },
};

// AA leaderboard is always available
const commonLeaderboardButtons = [
  { id: 'leaderboard-aa', label: 'AA', leaderboardEvent: 'aa' },
];

// Team counts for competition types
const teamCounts = {
  'mens-dual': 2, 'womens-dual': 2,
  'mens-tri': 3, 'womens-tri': 3,
  'mens-quad': 4, 'womens-quad': 4,
  'mens-5': 5,
  'mens-6': 6
};

// Available themes for Event Summary
const summaryThemes = [
  // LAYOUTS - Different structural designs
  { id: 'layout-broadcast-table', label: '🎴 Hero Cards' },
  { id: 'layout-classic-broadcast', label: '📺 Classic Broadcast' },
  { id: 'layout-default-v2', label: '✨ Default V2' },
  { id: 'layout-default-v3', label: '📊 V3 Full Height' },
  { id: 'layout-default-v4', label: '🏆 V4 Rankings' },
  { id: 'layout-default-v5', label: '📦 V5 Compact' },
  { id: 'layout-default-v6', label: '🃏 V6 Cards' },
  { id: 'layout-default-v7', label: '📊 V7 Progress Bars' },
  { id: 'layout-default-v8', label: '⬜ V8 Light Minimal' },
  { id: 'layout-default-v9', label: '🔵 V9 Bold Blue' },
  { id: 'layout-default-v10', label: '🔢 V10 Score Focus' },
  { id: 'layout-default-v11', label: '📋 V11 Blue Accent' },
  { id: 'layout-default-v12', label: '🌈 V12 Gradient Rows' },
  { id: 'layout-default-v13', label: '🖼️ V13 Split Header' },
  { id: 'layout-default-v14', label: '⬇️ V14 Big Footer' },
  { id: 'layout-default-v15', label: '🔶 V15 Orange Badges' },
  { id: 'layout-default-v16', label: '🟣 V16 Purple Theme' },
  { id: 'layout-default-v17', label: '💚 V17 Green Scores' },
  { id: 'layout-default-v18', label: '🎨 V18 Team Colors' },
  { id: 'layout-default-v19', label: '📐 V19 Dense Compact' },
  { id: 'layout-default-v20', label: '⭐ V20 Combined Best' },
  { id: 'layout-default-v21', label: '📺 V21 Extra Large' },
  { id: 'layout-default-v22', label: '🏅 V22 Integrated Rank' },
  { id: 'layout-default-v23', label: '📋 V23 No Rankings' },
  { id: 'layout-split-row', label: '📊 Split Row (5-team)' },
  { id: 'layout-dual-dynamic-v1', label: '📏 Dual Dynamic V1' },
  // COLOR THEMES - Same structure, different colors
  { id: 'default', label: 'Default (Original)' },
  { id: 'espn', label: 'ESPN Colors' },
  { id: 'nbc', label: 'NBC Olympics' },
  { id: 'btn', label: 'Big Ten' },
  { id: 'pac12', label: 'Pac-12' },
  { id: 'virtius', label: 'Virtius' },
  { id: 'neon', label: 'Neon' },
  { id: 'classic', label: 'Classic' },
  { id: 'light', label: 'Light' },
  { id: 'home', label: 'Team Colors' },
  { id: 'gradient', label: 'Gradient' },
];

export default function QuickActions({ hideApparatusCameras = false }) {
  const { socket, state, overrideScene } = useShow();
  const { showConfig, obsCurrentScene } = state;

  // Get competition context for graphics control
  const { compId, competitionConfig, gender, socketUrl } = useCompetition();
  const { apparatusCodes, getApparatusName, count: apparatusCount } = useApparatus(gender);
  const { events, eventIds, rotationCount } = useEventConfig(competitionConfig?.compType);

  const [cameraHealth, setCameraHealth] = useState([]);
  const [cameraRuntimeState, setCameraRuntimeState] = useState([]);

  // Graphics control state
  const [currentGraphicId, setCurrentGraphicId] = useState(null);
  const [summaryTheme, setSummaryTheme] = useState('layout-default-v4');

  // Server URL for REST API calls - use socketUrl from competition context
  const serverUrl = socketUrl || 'http://localhost:3003';

  // Fetch initial camera state
  useEffect(() => {
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
          setCameraRuntimeState(await runtimeRes.json());
        }
      } catch (err) {
        console.error('Failed to fetch camera state:', err);
      }
    }
    fetchCameraState();
  }, [serverUrl]);

  // Subscribe to camera socket events
  useEffect(() => {
    if (!socket) return;

    const handleCameraHealth = (health) => {
      setCameraHealth(health);
    };

    const handleCameraRuntimeState = (state) => {
      setCameraRuntimeState(state);
    };

    socket.on('cameraHealth', handleCameraHealth);
    socket.on('cameraRuntimeState', handleCameraRuntimeState);

    return () => {
      socket.off('cameraHealth', handleCameraHealth);
      socket.off('cameraRuntimeState', handleCameraRuntimeState);
    };
  }, [socket]);

  // Listen for current graphic state (for highlighting active buttons)
  useEffect(() => {
    if (!compId) return;

    const graphicRef = ref(db, `competitions/${compId}/currentGraphic`);
    const unsubscribe = onValue(graphicRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.graphic === 'clear') {
        setCurrentGraphicId(null);
      } else {
        setCurrentGraphicId(data?.graphicId || null);
      }
    });

    return () => unsubscribe();
  }, [compId]);

  // Build apparatus buttons for Event Summary (gender-specific)
  const apparatusButtons = useMemo(() => {
    return events.map(event => ({
      id: event.shortName.toLowerCase(),
      label: event.shortName,
    }));
  }, [events]);

  // Build leaderboard buttons based on gender-specific events
  const leaderboardButtons = useMemo(() => {
    return eventIds
      .map(eventId => leaderboardButtonConfig[eventId])
      .filter(Boolean);
  }, [eventIds]);

  // Send event summary graphic - rotation-based (R1-R4/R1-R6) or apparatus-based
  const sendEventSummary = useCallback((mode, value) => {
    if (!compId || !competitionConfig) return;

    const maxTeams = teamCounts[competitionConfig.compType] || 2;
    const isDual = competitionConfig.compType?.includes('dual');

    let graphicId, data;

    if (mode === 'rotation') {
      graphicId = `summary-r${value}`;
      data = {
        virtiusSessionId: competitionConfig.virtiusSessionId || '',
        summaryMode: 'rotation',
        summaryRotation: value,
        summaryNumTeams: maxTeams,
        summaryFormat: isDual ? 'alternating' : 'rotation',
        summaryTheme: summaryTheme,
        summaryGender: gender,
        team1Logo: competitionConfig.team1Logo || '',
        team1Name: competitionConfig.team1Name || '',
        team2Name: competitionConfig.team2Name || '',
        meetTheme: competitionConfig.meetTheme || '',
      };
    } else {
      graphicId = `summary-${value}`;
      data = {
        virtiusSessionId: competitionConfig.virtiusSessionId || '',
        summaryMode: 'apparatus',
        summaryApparatus: value,
        summaryNumTeams: maxTeams,
        summaryFormat: 'head-to-head',
        summaryTheme: summaryTheme,
        summaryGender: gender,
        team1Logo: competitionConfig.team1Logo || '',
        team1Name: competitionConfig.team1Name || '',
        team2Name: competitionConfig.team2Name || '',
        meetTheme: competitionConfig.meetTheme || '',
      };
    }

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'event-summary',
      graphicId: graphicId,
      data: data,
      timestamp: Date.now()
    });
  }, [compId, competitionConfig, summaryTheme, gender]);

  // Send leaderboard graphic
  const sendLeaderboard = useCallback((leaderboardEvent) => {
    if (!compId || !competitionConfig) return;

    const graphicId = `leaderboard-${leaderboardEvent}`;

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'virtius-leaderboard',
      graphicId: graphicId,
      data: {
        virtiusSessionId: competitionConfig.virtiusSessionId || '',
        leaderboardEvent: leaderboardEvent,
        leaderboardGender: gender,
        meetTheme: competitionConfig.meetTheme || '',
      },
      timestamp: Date.now()
    });
  }, [compId, competitionConfig, gender]);

  // Clear current graphic
  const clearGraphic = useCallback(() => {
    if (!compId) return;

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'clear',
      data: {},
      timestamp: Date.now()
    });
  }, [compId]);

  // Get camera covering a specific apparatus based on runtime state
  const getCameraForApparatus = useCallback((apparatus) => {
    return cameraRuntimeState.find(cam =>
      cam.currentApparatus && cam.currentApparatus.includes(apparatus)
    );
  }, [cameraRuntimeState]);

  // Get health for a camera
  const getCameraHealth = useCallback((cameraId) => {
    const health = cameraHealth.find(c => c.cameraId === cameraId);
    return health?.status || 'unknown';
  }, [cameraHealth]);

  // Get camera name
  const getCameraName = useCallback((cameraId) => {
    const health = cameraHealth.find(c => c.cameraId === cameraId);
    return health?.cameraName || cameraId;
  }, [cameraHealth]);

  // Switch to camera for apparatus
  const switchToApparatusCamera = useCallback((apparatus) => {
    const camera = getCameraForApparatus(apparatus);
    if (camera && socket) {
      socket.emit('overrideCamera', { cameraId: camera.cameraId });
    }
  }, [getCameraForApparatus, socket]);

  // Check if camera is online
  const isCameraOnline = useCallback((cameraId) => {
    const status = getCameraHealth(cameraId);
    return status !== 'offline' && status !== 'unknown';
  }, [getCameraHealth]);

  // Check if apparatus has a camera that's currently active
  const isApparatusActive = useCallback((apparatus) => {
    const camera = getCameraForApparatus(apparatus);
    if (!camera) return false;
    const sceneName = `Single - ${getCameraName(camera.cameraId)}`;
    return obsCurrentScene === sceneName;
  }, [getCameraForApparatus, getCameraName, obsCurrentScene]);

  const quickActions = showConfig?.quickActions || [
    { id: 'talent', name: 'Talent Camera', obsScene: 'Talent Camera', icon: 'video-camera' },
    { id: 'competition', name: 'Competition', obsScene: 'Competition Camera', icon: 'play' },
    { id: 'scores', name: 'Scores', obsScene: 'Scoreboard', icon: 'chart-bar' },
    { id: 'replay', name: 'Replay', obsScene: 'Replay', icon: 'arrow-path' }
  ];

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      {/* Apparatus Quick Switch - Runtime-based camera buttons */}
      {!hideApparatusCameras && cameraRuntimeState.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-wide mb-3">
            <VideoCameraIcon className="w-4 h-4" />
            Apparatus Cameras
          </div>

          {/* Grid layout: grid-cols-4 for WAG (4 apparatus), grid-cols-6 for MAG (6 apparatus) */}
          <div className={`grid gap-2 mb-4 ${apparatusCount === 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-6'}`}>
            {apparatusCodes.map((apparatus) => {
              const camera = getCameraForApparatus(apparatus);
              const cameraId = camera?.cameraId;
              const isOnline = cameraId ? isCameraOnline(cameraId) : false;
              const healthStatus = cameraId ? getCameraHealth(cameraId) : 'unknown';
              const cameraName = cameraId ? getCameraName(cameraId) : 'No camera';
              const isActive = isApparatusActive(apparatus);
              const hasMismatch = camera?.hasMismatch;
              const apparatusFullName = getApparatusName(apparatus);

              const tooltipText = camera
                ? `${apparatusFullName} - ${cameraName}: ${healthStatus}${hasMismatch ? ' (MISMATCH)' : ''}`
                : `${apparatusFullName} - No camera assigned`;

              return (
                <button
                  key={apparatus}
                  onClick={() => switchToApparatusCamera(apparatus)}
                  disabled={!camera || !isOnline}
                  className={`
                    relative flex flex-col items-center gap-1 p-2 rounded-lg text-sm font-bold transition-all
                    ${!camera || !isOnline
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                      : isActive
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : hasMismatch
                      ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border border-yellow-500/50'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }
                  `}
                  title={tooltipText}
                >
                  {/* Health indicator dot */}
                  {camera && (
                    <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${HEALTH_COLORS[healthStatus]}`} />
                  )}

                  {/* Mismatch warning icon */}
                  {hasMismatch && (
                    <ExclamationTriangleIcon className="absolute top-1 left-1 w-3 h-3 text-yellow-400" />
                  )}

                  <span>{apparatus}</span>
                  {camera && (
                    <span className="text-[10px] opacity-70 truncate max-w-full">
                      {cameraName.split(' - ')[0] || cameraName.substring(0, 8)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-zinc-800 pt-4 mt-2" />
        </>
      )}

      {/* Original Quick Actions */}
      <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Quick Actions</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {quickActions.map((action) => {
          const Icon = iconMap[action.icon] || PlayIcon;
          const isActive = obsCurrentScene === action.obsScene;

          return (
            <button
              key={action.id}
              onClick={() => overrideScene(action.obsScene)}
              className={`
                flex flex-col items-center gap-2 p-3 rounded-lg transition-all
                ${isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{action.name}</span>
            </button>
          );
        })}
      </div>

      {/* Event Summary Section - only show if competition has Virtius session */}
      {competitionConfig?.virtiusSessionId && (
        <>
          <div className="border-t border-zinc-800 pt-4 mt-4" />

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-wide">
              <PhotoIcon className="w-4 h-4" />
              Event Summary
            </div>
            <select
              value={summaryTheme}
              onChange={(e) => setSummaryTheme(e.target.value)}
              className="text-xs bg-zinc-700 text-zinc-300 border border-zinc-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {summaryThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>{theme.label}</option>
              ))}
            </select>
          </div>

          {/* By Rotation buttons */}
          <div className="text-xs text-zinc-500 mb-1">By Rotation</div>
          <div className={`grid gap-1.5 mb-3 ${rotationCount === 4 ? 'grid-cols-4' : 'grid-cols-6'}`}>
            {Array.from({ length: rotationCount }, (_, i) => i + 1).map((rotation) => {
              const graphicId = `summary-r${rotation}`;
              return (
                <button
                  key={rotation}
                  onClick={() => sendEventSummary('rotation', rotation)}
                  className={`px-2 py-2 rounded text-sm font-bold transition-colors ${
                    currentGraphicId === graphicId
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  R{rotation}
                </button>
              );
            })}
          </div>

          {/* By Apparatus buttons */}
          <div className="text-xs text-zinc-500 mb-1">By Apparatus</div>
          <div className={`grid gap-1.5 ${apparatusButtons.length === 4 ? 'grid-cols-4' : 'grid-cols-6'}`}>
            {apparatusButtons.map((apparatus) => {
              const graphicId = `summary-${apparatus.id}`;
              return (
                <button
                  key={apparatus.id}
                  onClick={() => sendEventSummary('apparatus', apparatus.id)}
                  className={`px-2 py-2 rounded text-sm font-bold transition-colors ${
                    currentGraphicId === graphicId
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {apparatus.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Leaderboard Section - only show if competition has Virtius session */}
      {competitionConfig?.virtiusSessionId && (
        <>
          <div className="border-t border-zinc-800 pt-4 mt-4" />

          <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-wide mb-3">
            <TrophyIcon className="w-4 h-4" />
            Leaderboards
          </div>

          <div className={`grid gap-1.5 ${leaderboardButtons.length + 1 <= 4 ? 'grid-cols-4' : leaderboardButtons.length + 1 === 5 ? 'grid-cols-5' : 'grid-cols-7'}`}>
            {leaderboardButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => sendLeaderboard(btn.leaderboardEvent)}
                className={`px-2 py-2 rounded text-sm font-bold transition-colors ${
                  currentGraphicId === btn.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                {btn.label}
              </button>
            ))}
            {/* AA Leaderboard - always available */}
            {commonLeaderboardButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => sendLeaderboard(btn.leaderboardEvent)}
                className={`px-2 py-2 rounded text-sm font-bold transition-colors ${
                  currentGraphicId === btn.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Clear Graphic Button - only show if there's an active graphic */}
      {currentGraphicId && (
        <>
          <div className="border-t border-zinc-800 pt-4 mt-4" />
          <button
            onClick={clearGraphic}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
            Clear Graphic
          </button>
        </>
      )}
    </div>
  );
}
