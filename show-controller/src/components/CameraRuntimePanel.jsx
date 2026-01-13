import { useState, useEffect, useCallback } from 'react';
import { useShow } from '../context/ShowContext';
import {
  VideoCameraIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SignalIcon,
  SignalSlashIcon
} from '@heroicons/react/24/solid';

// Health status colors
const HEALTH_COLORS = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  reconnecting: 'bg-orange-500',
  offline: 'bg-red-500',
  unknown: 'bg-zinc-500'
};

const HEALTH_TEXT_COLORS = {
  healthy: 'text-green-400',
  degraded: 'text-yellow-400',
  reconnecting: 'text-orange-400',
  offline: 'text-red-400',
  unknown: 'text-zinc-400'
};

// Men's apparatus options for reassignment
const APPARATUS_OPTIONS = ['FX', 'PH', 'SR', 'VT', 'PB', 'HB'];

export default function CameraRuntimePanel({ collapsed: initialCollapsed = false }) {
  const { socket } = useShow();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [cameraHealth, setCameraHealth] = useState([]);
  const [cameraRuntimeState, setCameraRuntimeState] = useState([]);
  const [activeFallbacks, setActiveFallbacks] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [reassignDropdown, setReassignDropdown] = useState(null);

  // Server URL for REST API calls
  const serverUrl = import.meta.env.PROD
    ? (import.meta.env.VITE_SOCKET_SERVER || '')
    : 'http://localhost:3003';

  // Fetch initial state via REST API
  useEffect(() => {
    async function fetchInitialState() {
      try {
        const [healthRes, runtimeRes, fallbackRes] = await Promise.all([
          fetch(`${serverUrl}/api/cameras/health`),
          fetch(`${serverUrl}/api/cameras/runtime`),
          fetch(`${serverUrl}/api/cameras/fallbacks`)
        ]);

        if (healthRes.ok) {
          const health = await healthRes.json();
          setCameraHealth(health);
        }
        if (runtimeRes.ok) {
          const runtime = await runtimeRes.json();
          setCameraRuntimeState(runtime);
        }
        if (fallbackRes.ok) {
          const fallbacks = await fallbackRes.json();
          setActiveFallbacks(fallbacks);
        }
      } catch (err) {
        console.error('Failed to fetch camera state:', err);
      }
    }
    fetchInitialState();
  }, [serverUrl]);

  // Subscribe to socket events
  useEffect(() => {
    if (!socket) return;

    const handleCameraHealth = (health) => {
      setCameraHealth(health);
    };

    const handleCameraRuntimeState = (state) => {
      setCameraRuntimeState(state);
    };

    const handleActiveFallbacks = (fallbacks) => {
      setActiveFallbacks(Array.isArray(fallbacks) ? fallbacks : []);
    };

    const handleCameraStatusChanged = ({ cameraId, previousStatus, currentStatus }) => {
      console.log(`Camera ${cameraId} changed from ${previousStatus} to ${currentStatus}`);
    };

    socket.on('cameraHealth', handleCameraHealth);
    socket.on('cameraRuntimeState', handleCameraRuntimeState);
    socket.on('activeFallbacks', handleActiveFallbacks);
    socket.on('cameraStatusChanged', handleCameraStatusChanged);
    socket.on('fallbackActivated', handleActiveFallbacks);
    socket.on('fallbackCleared', handleActiveFallbacks);

    return () => {
      socket.off('cameraHealth', handleCameraHealth);
      socket.off('cameraRuntimeState', handleCameraRuntimeState);
      socket.off('activeFallbacks', handleActiveFallbacks);
      socket.off('cameraStatusChanged', handleCameraStatusChanged);
      socket.off('fallbackActivated', handleActiveFallbacks);
      socket.off('fallbackCleared', handleActiveFallbacks);
    };
  }, [socket]);

  // Verify camera
  const verifyCamera = useCallback((cameraId) => {
    if (socket) {
      socket.emit('verifyCamera', { cameraId, verifiedBy: 'producer' });
    }
  }, [socket]);

  // Reassign apparatus
  const reassignApparatus = useCallback((cameraId, apparatus) => {
    if (socket) {
      socket.emit('reassignApparatus', { cameraId, apparatus, assignedBy: 'producer' });
    }
    setReassignDropdown(null);
  }, [socket]);

  // Quick switch to camera scene
  const switchToCamera = useCallback((cameraId, cameraName) => {
    if (socket) {
      socket.emit('overrideCamera', { cameraId });
    }
  }, [socket]);

  // Get combined camera data
  const getCombinedCameraData = useCallback(() => {
    return cameraHealth.map(health => {
      const runtime = cameraRuntimeState.find(r => r.id === health.cameraId) || {};
      const fallback = activeFallbacks.find(f => f.originalCameraId === health.cameraId);
      return {
        id: health.cameraId,
        name: health.cameraName || health.cameraId,
        status: health.status,
        bitrate: health.stats?.bitrate,
        packetLoss: health.stats?.packetLoss,
        expectedApparatus: runtime.expectedApparatus || [],
        currentApparatus: runtime.currentApparatus || [],
        verified: runtime.verified || false,
        verifiedAt: runtime.verifiedAt,
        verifiedBy: runtime.verifiedBy,
        hasMismatch: runtime.hasMismatch || false,
        note: runtime.note,
        fallback: fallback
      };
    });
  }, [cameraHealth, cameraRuntimeState, activeFallbacks]);

  const cameras = getCombinedCameraData();
  const mismatchCount = cameras.filter(c => c.hasMismatch).length;
  const offlineCount = cameras.filter(c => c.status === 'offline').length;

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <VideoCameraIcon className="w-5 h-5 text-blue-400" />
          <span className="text-white font-medium">Camera Status</span>

          {/* Alert badges */}
          <div className="flex items-center gap-2">
            {offlineCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                {offlineCount} offline
              </span>
            )}
            {mismatchCount > 0 && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                {mismatchCount} mismatch
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">{cameras.length} cameras</span>
          {collapsed ? (
            <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
          ) : (
            <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Collapsed summary - quick status indicators */}
      {collapsed && cameras.length > 0 && (
        <div className="px-4 pb-3 flex gap-2">
          {cameras.map(camera => (
            <div
              key={camera.id}
              className={`w-3 h-3 rounded-full ${HEALTH_COLORS[camera.status]} ${
                camera.hasMismatch ? 'ring-2 ring-yellow-400' : ''
              }`}
              title={`${camera.name}: ${camera.status}${camera.hasMismatch ? ' (mismatch)' : ''}`}
            />
          ))}
        </div>
      )}

      {/* Expanded panel */}
      {!collapsed && (
        <div className="p-4 pt-0">
          {cameras.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              No cameras configured
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {cameras.map(camera => (
                <CameraCard
                  key={camera.id}
                  camera={camera}
                  isSelected={selectedCamera === camera.id}
                  onSelect={() => setSelectedCamera(camera.id === selectedCamera ? null : camera.id)}
                  onVerify={() => verifyCamera(camera.id)}
                  onSwitchTo={() => switchToCamera(camera.id, camera.name)}
                  showReassign={reassignDropdown === camera.id}
                  onToggleReassign={() => setReassignDropdown(reassignDropdown === camera.id ? null : camera.id)}
                  onReassign={(apparatus) => reassignApparatus(camera.id, apparatus)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CameraCard({
  camera,
  isSelected,
  onSelect,
  onVerify,
  onSwitchTo,
  showReassign,
  onToggleReassign,
  onReassign
}) {
  const [selectedApparatus, setSelectedApparatus] = useState(camera.currentApparatus || []);

  useEffect(() => {
    setSelectedApparatus(camera.currentApparatus || []);
  }, [camera.currentApparatus]);

  const toggleApparatus = (app) => {
    const newApparatus = selectedApparatus.includes(app)
      ? selectedApparatus.filter(a => a !== app)
      : [...selectedApparatus, app];
    setSelectedApparatus(newApparatus);
  };

  const confirmReassign = () => {
    onReassign(selectedApparatus);
  };

  const isOnline = camera.status !== 'offline' && camera.status !== 'unknown';

  return (
    <div
      className={`bg-zinc-900 rounded-lg border transition-all ${
        camera.hasMismatch
          ? 'border-yellow-500/50'
          : isSelected
          ? 'border-blue-500'
          : 'border-zinc-700'
      }`}
    >
      {/* Card header - clickable to switch */}
      <button
        onClick={onSwitchTo}
        disabled={!isOnline}
        className={`w-full p-3 text-left transition-colors rounded-t-lg ${
          isOnline ? 'hover:bg-zinc-800' : 'opacity-60 cursor-not-allowed'
        }`}
        title={isOnline ? `Switch to ${camera.name}` : 'Camera offline'}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {/* Health indicator */}
            <div className={`w-3 h-3 rounded-full ${HEALTH_COLORS[camera.status]}`} />
            <div>
              <div className="text-white font-medium text-sm">{camera.name}</div>
              <div className={`text-xs ${HEALTH_TEXT_COLORS[camera.status]}`}>
                {camera.status}
                {camera.bitrate && ` • ${(camera.bitrate / 1000000).toFixed(1)} Mbps`}
              </div>
            </div>
          </div>

          {/* Verified badge */}
          {camera.verified ? (
            <div className="flex items-center gap-1 text-green-400" title={`Verified by ${camera.verifiedBy}`}>
              <CheckCircleIcon className="w-4 h-4" />
            </div>
          ) : (
            <div className="flex items-center gap-1 text-zinc-500" title="Not verified">
              <ExclamationTriangleIcon className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Apparatus display */}
        <div className="mt-2 flex flex-wrap gap-1">
          {(camera.currentApparatus || []).length > 0 ? (
            camera.currentApparatus.map(app => (
              <span
                key={app}
                className={`px-1.5 py-0.5 text-xs rounded ${
                  camera.expectedApparatus?.includes(app)
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {app}
              </span>
            ))
          ) : (
            <span className="text-xs text-zinc-500">No apparatus assigned</span>
          )}
        </div>

        {/* Mismatch warning */}
        {camera.hasMismatch && (
          <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
            <ExclamationTriangleIcon className="w-3 h-3" />
            Apparatus mismatch - expected: {camera.expectedApparatus?.join(', ') || 'none'}
          </div>
        )}

        {/* Fallback indicator */}
        {camera.fallback && (
          <div className="mt-2 flex items-center gap-1 text-xs text-orange-400">
            <ArrowPathIcon className="w-3 h-3" />
            Fallback active: {camera.fallback.fallbackCameraId}
          </div>
        )}
      </button>

      {/* Card actions */}
      <div className="border-t border-zinc-700 p-2 flex gap-2">
        <button
          onClick={onVerify}
          disabled={camera.verified}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            camera.verified
              ? 'bg-green-500/20 text-green-400 cursor-default'
              : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
          }`}
        >
          {camera.verified ? 'Verified' : 'Verify'}
        </button>

        <button
          onClick={onToggleReassign}
          className="flex-1 px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs font-medium transition-colors"
        >
          Reassign
        </button>
      </div>

      {/* Reassign dropdown */}
      {showReassign && (
        <div className="border-t border-zinc-700 p-3 bg-zinc-800/50">
          <div className="text-xs text-zinc-400 mb-2">Select apparatus:</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {APPARATUS_OPTIONS.map(app => (
              <button
                key={app}
                onClick={() => toggleApparatus(app)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedApparatus.includes(app)
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
              >
                {app}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmReassign}
              className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
            >
              Apply
            </button>
            <button
              onClick={onToggleReassign}
              className="px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
