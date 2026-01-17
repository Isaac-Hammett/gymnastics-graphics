import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SignalIcon,
  SignalSlashIcon,
  PlayIcon,
  StopIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';
import { useOBS } from '../context/OBSContext';

export default function OBSManager() {
  const {
    obsState,
    obsConnected,
    connectionError,
    startStream,
    stopStream,
    startRecording,
    stopRecording,
    refreshState
  } = useOBS();

  const [activeTab, setActiveTab] = useState('scenes');

  // Extract streaming and recording states
  const isStreaming = obsState?.streaming?.active || obsState?.streaming || false;
  const isRecording = obsState?.recording?.active || obsState?.recording || false;

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
            <div className="text-center text-gray-400 py-12">
              <SignalIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Scene Management</h3>
              <p>Scene list and editor components will be added in OBS-27</p>
            </div>
          )}
          {activeTab === 'sources' && (
            <div className="text-center text-gray-400 py-12">
              <h3 className="text-xl font-semibold text-white mb-2">Source Editor</h3>
              <p>Source editor will be added in OBS-28</p>
            </div>
          )}
          {activeTab === 'audio' && (
            <div className="text-center text-gray-400 py-12">
              <h3 className="text-xl font-semibold text-white mb-2">Audio Mixer</h3>
              <p>Audio mixer will be added in OBS-29</p>
            </div>
          )}
          {activeTab === 'transitions' && (
            <div className="text-center text-gray-400 py-12">
              <h3 className="text-xl font-semibold text-white mb-2">Transitions</h3>
              <p>Transition controls coming soon</p>
            </div>
          )}
          {activeTab === 'stream' && (
            <div className="text-center text-gray-400 py-12">
              <h3 className="text-xl font-semibold text-white mb-2">Stream Configuration</h3>
              <p>Stream configuration will be added in OBS-30</p>
            </div>
          )}
          {activeTab === 'assets' && (
            <div className="text-center text-gray-400 py-12">
              <h3 className="text-xl font-semibold text-white mb-2">Asset Manager</h3>
              <p>Asset manager will be added in OBS-30</p>
            </div>
          )}
          {activeTab === 'templates' && (
            <div className="text-center text-gray-400 py-12">
              <h3 className="text-xl font-semibold text-white mb-2">Template Manager</h3>
              <p>Template manager will be added in OBS-31</p>
            </div>
          )}
        </div>
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
    { id: 'templates', label: 'Templates' }
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
