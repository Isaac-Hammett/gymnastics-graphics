import { useEffect, useState, useCallback } from 'react';
import { useShow } from '../context/ShowContext';
import {
  VideoCameraIcon,
  PlayIcon,
  ChartBarIcon,
  ArrowPathIcon,
  PauseIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

const iconMap = {
  'video-camera': VideoCameraIcon,
  'play': PlayIcon,
  'chart-bar': ChartBarIcon,
  'arrow-path': ArrowPathIcon,
  'pause': PauseIcon,
  'currency-dollar': CurrencyDollarIcon
};

// Men's gymnastics apparatus in Olympic order
const APPARATUS_ORDER = ['FX', 'PH', 'SR', 'VT', 'PB', 'HB'];

// Health status colors
const HEALTH_COLORS = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  reconnecting: 'bg-orange-500',
  offline: 'bg-red-500',
  unknown: 'bg-zinc-500'
};

export default function QuickActions() {
  const { socket, state, overrideScene } = useShow();
  const { showConfig, obsCurrentScene } = state;

  const [cameraHealth, setCameraHealth] = useState([]);
  const [cameraRuntimeState, setCameraRuntimeState] = useState([]);

  // Server URL for REST API calls
  const serverUrl = import.meta.env.PROD
    ? (import.meta.env.VITE_SOCKET_SERVER || '')
    : 'http://localhost:3003';

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
      {cameraRuntimeState.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-wide mb-3">
            <VideoCameraIcon className="w-4 h-4" />
            Apparatus Cameras
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {APPARATUS_ORDER.map((apparatus) => {
              const camera = getCameraForApparatus(apparatus);
              const cameraId = camera?.cameraId;
              const isOnline = cameraId ? isCameraOnline(cameraId) : false;
              const healthStatus = cameraId ? getCameraHealth(cameraId) : 'unknown';
              const cameraName = cameraId ? getCameraName(cameraId) : 'No camera';
              const isActive = isApparatusActive(apparatus);
              const hasMismatch = camera?.hasMismatch;

              const tooltipText = camera
                ? `${cameraName}: ${healthStatus}${hasMismatch ? ' (MISMATCH)' : ''}`
                : 'No camera assigned';

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
    </div>
  );
}
