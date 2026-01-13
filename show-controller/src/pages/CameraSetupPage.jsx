import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  VideoCameraIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon
} from '@heroicons/react/24/solid';

// Men's apparatus options
const APPARATUS_OPTIONS = [
  { value: 'FX', label: 'Floor Exercise' },
  { value: 'PH', label: 'Pommel Horse' },
  { value: 'SR', label: 'Still Rings' },
  { value: 'VT', label: 'Vault' },
  { value: 'PB', label: 'Parallel Bars' },
  { value: 'HB', label: 'High Bar' }
];

export default function CameraSetupPage() {
  const [cameras, setCameras] = useState([]);
  const [showConfig, setShowConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [scenePreview, setScenePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Server URL - use env var or default to localhost in dev
  // In production, use the env var or empty string (same origin)
  // In development, prefer localhost:3003 to avoid CORS issues with remote servers
  const serverUrl = import.meta.env.PROD
    ? (import.meta.env.VITE_SOCKET_SERVER || '')
    : 'http://localhost:3003';

  // Load initial config
  useEffect(() => {
    fetchConfig();
  }, []);

  // Update scene preview when cameras change
  useEffect(() => {
    if (cameras.length > 0) {
      fetchScenePreview();
    }
  }, [cameras.length]);

  async function fetchConfig() {
    try {
      const res = await fetch(`${serverUrl}/api/config`);
      const config = await res.json();
      setShowConfig(config);
      setCameras(config.cameras || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch config:', err);
      setLoading(false);
    }
  }

  async function fetchScenePreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/scenes/preview`);
      const preview = await res.json();
      setScenePreview(preview);
    } catch (err) {
      console.error('Failed to fetch scene preview:', err);
    }
    setPreviewLoading(false);
  }

  function generateCameraId() {
    const num = cameras.length + 1;
    return `cam-${num}`;
  }

  function addCamera() {
    const newCamera = {
      id: generateCameraId(),
      name: `Camera ${cameras.length + 1}`,
      srtPort: 9000 + cameras.length + 1,
      srtUrl: `srt://nimble.local:${9000 + cameras.length + 1}`,
      expectedApparatus: [],
      fallbackCameraId: null
    };
    setCameras([...cameras, newCamera]);
  }

  function removeCamera(index) {
    const cameraId = cameras[index].id;
    const newCameras = cameras.filter((_, i) => i !== index);
    // Clear fallback references to removed camera
    newCameras.forEach(cam => {
      if (cam.fallbackCameraId === cameraId) {
        cam.fallbackCameraId = null;
      }
    });
    setCameras(newCameras);
  }

  function updateCamera(index, field, value) {
    const newCameras = [...cameras];
    newCameras[index] = { ...newCameras[index], [field]: value };

    // Update srtUrl when srtPort changes
    if (field === 'srtPort') {
      newCameras[index].srtUrl = `srt://nimble.local:${value}`;
    }

    setCameras(newCameras);
  }

  function toggleApparatus(index, apparatus) {
    const camera = cameras[index];
    const current = camera.expectedApparatus || [];
    const newApparatus = current.includes(apparatus)
      ? current.filter(a => a !== apparatus)
      : [...current, apparatus];
    updateCamera(index, 'expectedApparatus', newApparatus);
  }

  async function saveConfig() {
    setSaving(true);
    setSaveStatus(null);

    try {
      const res = await fetch(`${serverUrl}/api/config/cameras`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameras })
      });

      if (res.ok) {
        setSaveStatus({ type: 'success', message: 'Cameras saved successfully!' });
        // Refresh scene preview
        fetchScenePreview();
      } else {
        const error = await res.json();
        setSaveStatus({ type: 'error', message: error.message || 'Failed to save' });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Connection error' });
    }

    setSaving(false);
    setTimeout(() => setSaveStatus(null), 3000);
  }

  // Calculate scene count formula
  function calculateSceneCount(n) {
    if (n === 0) return 0;
    // static(3) + single(n) + dual(C(n,2)) + triple(C(n,3)) + quad(C(n,4)) + graphics(1)
    const binomial = (n, k) => {
      if (k > n) return 0;
      if (k === 0 || k === n) return 1;
      let result = 1;
      for (let i = 0; i < k; i++) {
        result = result * (n - i) / (i + 1);
      }
      return Math.round(result);
    };
    return 3 + n + binomial(n, 2) + binomial(n, 3) + binomial(n, 4) + 1;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Hub
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <VideoCameraIcon className="w-5 h-5 text-blue-400" />
                Camera Setup
              </h1>
              <div className="text-sm text-zinc-500">
                {showConfig?.showName || 'Configure cameras for your show'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchConfig}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Reload
            </button>
            <button
              onClick={saveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </header>

      {/* Save Status Toast */}
      {saveStatus && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
          saveStatus.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {saveStatus.type === 'success' ? (
            <CheckCircleIcon className="w-5 h-5" />
          ) : (
            <ExclamationTriangleIcon className="w-5 h-5" />
          )}
          {saveStatus.message}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4">
        {/* Scene Preview Card */}
        <div className="bg-zinc-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CubeIcon className="w-5 h-5 text-purple-400" />
              <div>
                <div className="text-white font-medium">Scene Generation Preview</div>
                <div className="text-sm text-zinc-400">
                  {cameras.length} camera{cameras.length !== 1 ? 's' : ''} configured
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {previewLoading ? '...' : scenePreview?.totals?.total || calculateSceneCount(cameras.length)}
              </div>
              <div className="text-sm text-zinc-400">scenes will be generated</div>
            </div>
          </div>

          {scenePreview && (
            <div className="mt-4 grid grid-cols-6 gap-2 text-center">
              <div className="bg-zinc-700/50 rounded p-2">
                <div className="text-lg font-semibold text-white">{scenePreview.totals?.static || 3}</div>
                <div className="text-xs text-zinc-400">Static</div>
              </div>
              <div className="bg-zinc-700/50 rounded p-2">
                <div className="text-lg font-semibold text-white">{scenePreview.totals?.single || cameras.length}</div>
                <div className="text-xs text-zinc-400">Single</div>
              </div>
              <div className="bg-zinc-700/50 rounded p-2">
                <div className="text-lg font-semibold text-white">{scenePreview.totals?.dual || 0}</div>
                <div className="text-xs text-zinc-400">Dual</div>
              </div>
              <div className="bg-zinc-700/50 rounded p-2">
                <div className="text-lg font-semibold text-white">{scenePreview.totals?.triple || 0}</div>
                <div className="text-xs text-zinc-400">Triple</div>
              </div>
              <div className="bg-zinc-700/50 rounded p-2">
                <div className="text-lg font-semibold text-white">{scenePreview.totals?.quad || 0}</div>
                <div className="text-xs text-zinc-400">Quad</div>
              </div>
              <div className="bg-zinc-700/50 rounded p-2">
                <div className="text-lg font-semibold text-white">{scenePreview.totals?.graphics || 1}</div>
                <div className="text-xs text-zinc-400">Graphics</div>
              </div>
            </div>
          )}
        </div>

        {/* Camera List */}
        <div className="space-y-4">
          {cameras.length === 0 ? (
            <div className="bg-zinc-800 rounded-xl p-8 text-center">
              <VideoCameraIcon className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-white mb-2">No Cameras Configured</h2>
              <p className="text-zinc-400 mb-4">Add cameras to configure your show's video sources</p>
              <button
                onClick={addCamera}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                Add First Camera
              </button>
            </div>
          ) : (
            cameras.map((camera, index) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                index={index}
                cameras={cameras}
                onUpdate={updateCamera}
                onToggleApparatus={toggleApparatus}
                onRemove={removeCamera}
              />
            ))
          )}
        </div>

        {/* Add Camera Button */}
        {cameras.length > 0 && (
          <button
            onClick={addCamera}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border-2 border-dashed border-zinc-700 text-zinc-400 rounded-xl transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Camera
          </button>
        )}
      </main>
    </div>
  );
}

function CameraCard({ camera, index, cameras, onUpdate, onToggleApparatus, onRemove }) {
  const otherCameras = cameras.filter(c => c.id !== camera.id);

  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <VideoCameraIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-white font-medium">{camera.name || `Camera ${index + 1}`}</div>
            <div className="text-xs text-zinc-500 font-mono">{camera.id}</div>
          </div>
        </div>
        <button
          onClick={() => onRemove(index)}
          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Name */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Camera Name</label>
          <input
            type="text"
            value={camera.name}
            onChange={(e) => onUpdate(index, 'name', e.target.value)}
            placeholder="e.g., Floor/Vault Camera"
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* SRT Port */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">SRT Port</label>
          <input
            type="number"
            value={camera.srtPort}
            onChange={(e) => onUpdate(index, 'srtPort', parseInt(e.target.value) || 9000)}
            placeholder="9001"
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* SRT URL (read-only, auto-generated) */}
      <div className="mb-4">
        <label className="block text-xs text-zinc-400 mb-1">SRT URL</label>
        <input
          type="text"
          value={camera.srtUrl}
          readOnly
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400 text-sm font-mono"
        />
      </div>

      {/* Expected Apparatus */}
      <div className="mb-4">
        <label className="block text-xs text-zinc-400 mb-2">Expected Apparatus</label>
        <div className="flex flex-wrap gap-2">
          {APPARATUS_OPTIONS.map(({ value, label }) => {
            const isSelected = (camera.expectedApparatus || []).includes(value);
            return (
              <button
                key={value}
                onClick={() => onToggleApparatus(index, value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
        {(camera.expectedApparatus || []).length > 0 && (
          <div className="mt-2 text-xs text-zinc-500">
            Covering: {(camera.expectedApparatus || []).map(a =>
              APPARATUS_OPTIONS.find(o => o.value === a)?.label || a
            ).join(', ')}
          </div>
        )}
      </div>

      {/* Fallback Camera */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Fallback Camera</label>
        <select
          value={camera.fallbackCameraId || ''}
          onChange={(e) => onUpdate(index, 'fallbackCameraId', e.target.value || null)}
          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">No fallback</option>
          {otherCameras.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="mt-1 text-xs text-zinc-500">
          Camera to switch to if this one goes offline
        </div>
      </div>
    </div>
  );
}
