import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  SignalIcon,
  SignalSlashIcon,
  PlayIcon,
  StopIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';
import { useOBS } from '../context/OBSContext';
import { useShow } from '../context/ShowContext';
import SceneList from '../components/obs/SceneList';
import SceneEditor from '../components/obs/SceneEditor';
import SourceEditor from '../components/obs/SourceEditor';
import AudioMixer from '../components/obs/AudioMixer';
import AudioPresetManager from '../components/obs/AudioPresetManager';
import StreamConfig from '../components/obs/StreamConfig';
import AssetManager from '../components/obs/AssetManager';
import TemplateManager from '../components/obs/TemplateManager';
import TalentCommsPanel from '../components/obs/TalentCommsPanel';

export default function OBSManager() {
  const { identify } = useShow();
  const {
    obsState,
    obsConnected,
    connectionError,
    startStream,
    stopStream,
    startRecording,
    stopRecording,
    refreshState,
    duplicateScene,
    deleteScene,
    renameScene,
    takeScreenshot
  } = useOBS();

  const [activeTab, setActiveTab] = useState('scenes');

  // Identify as producer on mount to enable scene switching
  useEffect(() => {
    identify('producer', 'OBS Manager');
  }, [identify]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [showSceneEditor, setShowSceneEditor] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showSourceEditor, setShowSourceEditor] = useState(false);

  // Extract streaming and recording states
  const isStreaming = obsState?.streaming?.active || obsState?.streaming || false;
  const isRecording = obsState?.recording?.active || obsState?.recording || false;

  // Handle scene editing
  const handleEditScene = (sceneName) => {
    setSelectedScene(sceneName);
    setShowSceneEditor(true);
  };

  const handleCloseSceneEditor = () => {
    setShowSceneEditor(false);
    setSelectedScene(null);
  };

  // State for duplicate/rename modals
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [modalSceneName, setModalSceneName] = useState('');
  const [newSceneName, setNewSceneName] = useState('');

  const handleSceneAction = (action, sceneName) => {
    console.log('Scene action:', action, sceneName);
    switch (action) {
      case 'duplicate':
        setModalSceneName(sceneName);
        setNewSceneName(`${sceneName} Copy`);
        setShowDuplicateModal(true);
        break;
      case 'delete':
        if (confirm(`Delete scene "${sceneName}"?`)) {
          deleteScene(sceneName);
          // Refresh state after a short delay to get updated scene list
          setTimeout(() => refreshState(), 500);
        }
        break;
      case 'rename':
        setModalSceneName(sceneName);
        setNewSceneName(sceneName);
        setShowRenameModal(true);
        break;
      case 'preview':
        // Already handled by SceneList
        break;
      default:
        console.warn('Unknown scene action:', action);
    }
  };

  const handleDuplicateConfirm = () => {
    if (newSceneName.trim() && newSceneName.trim() !== modalSceneName) {
      duplicateScene(modalSceneName, newSceneName.trim());
      setTimeout(() => refreshState(), 500);
    }
    setShowDuplicateModal(false);
    setModalSceneName('');
    setNewSceneName('');
  };

  const handleRenameConfirm = () => {
    if (newSceneName.trim() && newSceneName.trim() !== modalSceneName) {
      renameScene(modalSceneName, newSceneName.trim());
      setTimeout(() => refreshState(), 500);
    }
    setShowRenameModal(false);
    setModalSceneName('');
    setNewSceneName('');
  };

  const closeModals = () => {
    setShowDuplicateModal(false);
    setShowRenameModal(false);
    setModalSceneName('');
    setNewSceneName('');
  };

  // Handle source editing
  const handleEditSource = (source) => {
    setSelectedSource(source);
    setShowSourceEditor(true);
  };

  const handleCloseSourceEditor = () => {
    setShowSourceEditor(false);
    setSelectedSource(null);
  };

  const handleSourceUpdate = () => {
    setShowSourceEditor(false);
    setSelectedSource(null);
    // Refresh OBS state to get updated source info
    refreshState();
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to=".."
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 text-xs hover:bg-gray-600 hover:text-gray-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Back
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <SignalIcon className="w-5 h-5 text-purple-400" />
                OBS Manager
              </h1>
              <div className="text-sm text-gray-400">
                Control OBS Studio and streaming
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshState}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 text-xs hover:bg-gray-600 hover:text-gray-200 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        {/* Connection Status Banner */}
        <OBSConnectionStatus
          connected={obsConnected}
          error={connectionError}
        />

        {/* Current Output Status */}
        <OBSCurrentOutput
          connected={obsConnected}
          currentScene={obsState?.currentScene}
          isStreaming={isStreaming}
          isRecording={isRecording}
        />

        {/* Stream Control Buttons */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <h2 className="text-white font-semibold mb-3">Stream Control</h2>
          <div className="flex flex-wrap gap-3">
            {/* Start/Stop Stream */}
            {isStreaming ? (
              <button
                onClick={stopStream}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
              >
                <StopIcon className="w-5 h-5" />
                Stop Stream
              </button>
            ) : (
              <button
                onClick={startStream}
                disabled={!obsConnected}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
              >
                <PlayIcon className="w-5 h-5" />
                Start Stream
              </button>
            )}

            {/* Start/Stop Recording */}
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
              >
                <StopIcon className="w-5 h-5" />
                Stop Recording
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={!obsConnected}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
              >
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                Start Recording
              </button>
            )}

            {/* Screenshot Button */}
            <button
              onClick={takeScreenshot}
              disabled={!obsConnected}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              <CameraIcon className="w-5 h-5" />
              Take Screenshot
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <div className="bg-gray-800 rounded-xl p-6 min-h-[400px]">
          {activeTab === 'scenes' && (
            showSceneEditor ? (
              <SceneEditor
                sceneName={selectedScene}
                onClose={handleCloseSceneEditor}
              />
            ) : (
              <SceneList
                onEditScene={handleEditScene}
                onSceneAction={handleSceneAction}
              />
            )
          )}
          {activeTab === 'sources' && (
            <SourceList
              inputs={obsState.inputs || []}
              onEditSource={handleEditSource}
            />
          )}
          {activeTab === 'audio' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Audio Mixer (left/main area) */}
              <div className="lg:col-span-2">
                <AudioMixer />
              </div>

              {/* Audio Presets (right sidebar) */}
              <div className="lg:col-span-1">
                <AudioPresetManager />
              </div>
            </div>
          )}
          {activeTab === 'transitions' && (
            <div className="text-center text-gray-400 py-12">
              <h3 className="text-xl font-semibold text-white mb-2">Transitions</h3>
              <p>Transition controls coming soon</p>
            </div>
          )}
          {activeTab === 'stream' && <StreamConfig />}
          {activeTab === 'assets' && <AssetManager />}
          {activeTab === 'templates' && <TemplateManager />}
          {activeTab === 'talent-comms' && <TalentCommsPanel />}
        </div>

        {/* Source Editor Modal */}
        {showSourceEditor && selectedSource && (
          <SourceEditor
            source={selectedSource}
            sceneName={selectedScene?.sceneName || ''}
            onClose={handleCloseSourceEditor}
            onUpdate={handleSourceUpdate}
          />
        )}

        {/* Duplicate Scene Modal */}
        {showDuplicateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Duplicate Scene</h3>
                <button
                  onClick={closeModals}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Create a copy of "{modalSceneName}" with all its sources.
              </p>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">New Scene Name</label>
                <input
                  type="text"
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDuplicateConfirm();
                    if (e.key === 'Escape') closeModals();
                  }}
                  placeholder="Enter new scene name..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDuplicateConfirm}
                  disabled={!newSceneName.trim() || newSceneName.trim() === modalSceneName}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  Duplicate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Scene Modal */}
        {showRenameModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Rename Scene</h3>
                <button
                  onClick={closeModals}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Enter a new name for "{modalSceneName}".
              </p>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">New Scene Name</label>
                <input
                  type="text"
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameConfirm();
                    if (e.key === 'Escape') closeModals();
                  }}
                  placeholder="Enter new scene name..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameConfirm}
                  disabled={!newSceneName.trim() || newSceneName.trim() === modalSceneName}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * OBSConnectionStatus - Shows connection state with error display
 */
function OBSConnectionStatus({ connected, error }) {
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <div className="text-red-300 font-semibold">Connection Error</div>
            <div className="text-red-200/80 text-sm">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <SignalSlashIcon className="w-6 h-6 text-gray-500 flex-shrink-0" />
          <div>
            <div className="text-gray-300 font-semibold">OBS Disconnected</div>
            <div className="text-gray-400 text-sm">Waiting for connection to OBS Studio...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-900/20 border border-green-700 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3">
        <CheckCircleIcon className="w-6 h-6 text-green-400 flex-shrink-0" />
        <div>
          <div className="text-green-300 font-semibold">OBS Connected</div>
          <div className="text-green-200/80 text-sm">Connected to OBS Studio via WebSocket</div>
        </div>
      </div>
    </div>
  );
}

/**
 * OBSCurrentOutput - Shows current scene name and stream status
 */
function OBSCurrentOutput({ connected, currentScene, isStreaming, isRecording }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-semibold mb-2">Current Output</h2>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-400 text-sm">Scene:</span>
            <span className="text-white font-medium">
              {connected ? (currentScene || 'No scene active') : 'Disconnected'}
            </span>
          </div>
          <div className="flex gap-2">
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
        </div>
        <div className="w-48 h-27 bg-gray-900 rounded-lg flex items-center justify-center text-gray-600 text-xs">
          Preview placeholder
        </div>
      </div>
    </div>
  );
}

/**
 * TabNavigation - Tab buttons for different sections
 */
function TabNavigation({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'scenes', label: 'Scenes' },
    { id: 'sources', label: 'Sources' },
    { id: 'audio', label: 'Audio' },
    { id: 'transitions', label: 'Transitions' },
    { id: 'stream', label: 'Stream' },
    { id: 'assets', label: 'Assets' },
    { id: 'templates', label: 'Templates' },
    { id: 'talent-comms', label: 'Talent Comms' }
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * SourceList - Display all OBS inputs grouped by type
 */
function SourceList({ inputs, onEditSource }) {
  if (!inputs || inputs.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        <h3 className="text-xl font-semibold text-white mb-2">No Sources</h3>
        <p>No input sources found in OBS. Connect to OBS and add sources to your scenes.</p>
      </div>
    );
  }

  // Group inputs by kind
  const groupedInputs = inputs.reduce((acc, input) => {
    const kind = input.inputKind || 'unknown';
    if (!acc[kind]) {
      acc[kind] = [];
    }
    acc[kind].push(input);
    return acc;
  }, {});

  // Human-readable names for input kinds
  const kindNames = {
    ffmpeg_source: 'SRT/Media Sources',
    browser_source: 'Browser Sources',
    image_source: 'Image Sources',
    vlc_source: 'VLC Sources',
    color_source: 'Color Sources',
    text_gdiplus: 'Text Sources',
    dshow_input: 'Video Capture Devices',
    wasapi_input_capture: 'Audio Input Capture',
    wasapi_output_capture: 'Audio Output Capture',
    unknown: 'Other Sources'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg">Input Sources</h3>
        <div className="text-sm text-gray-400">
          {inputs.length} source{inputs.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {Object.entries(groupedInputs).map(([kind, sources]) => (
        <div key={kind} className="space-y-2">
          <h4 className="text-gray-300 font-medium text-sm uppercase tracking-wider">
            {kindNames[kind] || kind}
          </h4>
          <div className="space-y-2">
            {sources.map((source) => (
              <div
                key={source.inputName}
                className="bg-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-600 transition-colors"
              >
                <div className="flex-1">
                  <div className="text-white font-medium">{source.inputName}</div>
                  <div className="text-gray-400 text-sm">{source.inputKind}</div>
                </div>
                <button
                  onClick={() => onEditSource(source)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
