import { useState, useEffect, useCallback } from 'react';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  PlayIcon,
  StopIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';

/**
 * StreamConfig - Configure streaming and recording settings
 * Uses Socket.io via OBSContext instead of REST API (PRD-OBS-06)
 */
export default function StreamConfig() {
  const {
    obsConnected,
    obsState,
    getStreamSettings,
    setStreamSettings,
    getStreamStatus,
    startStream,
    stopStream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getRecordingStatus
  } = useOBS();

  // Form state
  const [serviceType, setServiceType] = useState('rtmp_common');
  const [streamKey, setStreamKey] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [showKey, setShowKey] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Derived state from obsState
  const streamSettings = obsState?.streamSettings;
  const streamStatus = obsState?.streamStatus;
  const recordingStatus = obsState?.recordingStatus;
  const isStreaming = obsState?.streaming || streamStatus?.active;
  const isRecording = obsState?.recording || recordingStatus?.active;
  const isRecordingPaused = obsState?.recordingPaused || recordingStatus?.paused;

  // Fetch stream settings and status on mount and when obsConnected changes
  useEffect(() => {
    if (obsConnected) {
      refreshData();
    }
  }, [obsConnected]);

  // Update form when stream settings are received
  useEffect(() => {
    if (streamSettings) {
      if (streamSettings.serviceType) {
        setServiceType(streamSettings.serviceType);
      }
      if (streamSettings.settings?.server) {
        setServerUrl(streamSettings.settings.server);
      }
    }
  }, [streamSettings]);

  const refreshData = useCallback(() => {
    setLoading(true);
    setError(null);
    getStreamSettings();
    getStreamStatus();
    getRecordingStatus();
    // Loading will be cleared when data arrives via socket events
    setTimeout(() => setLoading(false), 1000);
  }, [getStreamSettings, getStreamStatus, getRecordingStatus]);

  const handleSave = useCallback(() => {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      // Validate inputs
      if (serviceType === 'rtmp_custom' && !serverUrl.trim()) {
        throw new Error('Server URL is required for custom RTMP');
      }
      if (!streamKey.trim() && !streamSettings?.settings?.key) {
        throw new Error('Stream key is required');
      }

      // Build settings object
      const settings = {};

      // Add server URL for custom RTMP or YouTube/Twitch default servers
      if (serviceType === 'rtmp_custom') {
        settings.server = serverUrl.trim();
      } else if (serviceType === 'rtmp_common') {
        // Default YouTube server
        settings.server = 'rtmps://a.rtmps.youtube.com/live2';
      }

      // Only include key if a new one was entered
      if (streamKey.trim()) {
        settings.key = streamKey.trim();
      }

      // Call socket method
      setStreamSettings(serviceType, settings);

      setSuccess(true);
      setStreamKey(''); // Clear the key field after saving

      // Refresh to get updated settings
      setTimeout(() => {
        getStreamSettings();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Error saving stream settings:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [serviceType, serverUrl, streamKey, streamSettings, setStreamSettings, getStreamSettings]);

  const handleStartStream = useCallback(() => {
    startStream();
  }, [startStream]);

  const handleStopStream = useCallback(() => {
    stopStream();
  }, [stopStream]);

  const handleStartRecording = useCallback(() => {
    startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handlePauseRecording = useCallback(() => {
    pauseRecording();
  }, [pauseRecording]);

  const handleResumeRecording = useCallback(() => {
    resumeRecording();
  }, [resumeRecording]);

  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <ExclamationTriangleIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-lg font-semibold text-white mb-2">OBS Not Connected</p>
        <p>Connect to OBS to configure streaming settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Stream & Recording</h3>
          <p className="text-gray-400 text-sm mt-1">Configure streaming service and control output</p>
        </div>
        <button
          onClick={refreshData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-red-300 font-semibold">Error</div>
            <div className="text-red-200/80 text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-green-300 font-semibold">Settings Saved</div>
            <div className="text-green-200/80 text-sm">Stream configuration updated successfully</div>
          </div>
        </div>
      )}

      {/* Stream/Recording Controls */}
      <div className="bg-gray-700 rounded-lg p-6">
        <h4 className="text-white font-semibold mb-4">Output Controls</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Streaming Control */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-white font-medium">Streaming</div>
                <div className="text-sm text-gray-400">
                  {isStreaming ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      LIVE {streamStatus?.timecode && `- ${streamStatus.timecode}`}
                    </span>
                  ) : (
                    'Offline'
                  )}
                </div>
              </div>
              {isStreaming ? (
                <button
                  onClick={handleStopStream}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  <StopIcon className="w-4 h-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleStartStream}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  <PlayIcon className="w-4 h-4" />
                  Go Live
                </button>
              )}
            </div>
            {isStreaming && streamStatus && (
              <div className="text-xs text-gray-400 space-y-1">
                {streamStatus.skippedFrames > 0 && (
                  <div className="text-yellow-400">Dropped frames: {streamStatus.skippedFrames}</div>
                )}
              </div>
            )}
          </div>

          {/* Recording Control */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-white font-medium">Recording</div>
                <div className="text-sm text-gray-400">
                  {isRecording ? (
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isRecordingPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></span>
                      {isRecordingPaused ? 'Paused' : 'Recording'} {recordingStatus?.timecode && `- ${recordingStatus.timecode}`}
                    </span>
                  ) : (
                    'Stopped'
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {isRecording ? (
                  <>
                    {isRecordingPaused ? (
                      <button
                        onClick={handleResumeRecording}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                      >
                        <PlayIcon className="w-4 h-4" />
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={handlePauseRecording}
                        className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition-colors"
                      >
                        <PauseIcon className="w-4 h-4" />
                        Pause
                      </button>
                    )}
                    <button
                      onClick={handleStopRecording}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                    >
                      <StopIcon className="w-4 h-4" />
                      Stop
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleStartRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <span className="w-3 h-3 rounded-full bg-white"></span>
                    Record
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stream Configuration Form */}
      <div className="bg-gray-700 rounded-lg p-6 space-y-6">
        <h4 className="text-white font-semibold">Stream Settings</h4>

        {/* Service Type Selector */}
        <div>
          <label className="block text-white font-medium mb-2">
            Streaming Service
          </label>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
          >
            <option value="rtmp_common">YouTube / Twitch (RTMP)</option>
            <option value="rtmp_custom">Custom RTMP Server</option>
          </select>
          <p className="text-gray-400 text-sm mt-1">
            {serviceType === 'rtmp_common' && 'Stream to YouTube or Twitch using their RTMP servers'}
            {serviceType === 'rtmp_custom' && 'Stream to a custom RTMP server'}
          </p>
        </div>

        {/* Server URL (Custom RTMP only) */}
        {serviceType === 'rtmp_custom' && (
          <div>
            <label className="block text-white font-medium mb-2">
              Server URL
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="rtmp://your-server.com/live"
              className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
            />
            <p className="text-gray-400 text-sm mt-1">
              Enter the RTMP server URL (e.g., rtmp://your-server.com/live)
            </p>
          </div>
        )}

        {/* Stream Key */}
        <div>
          <label className="block text-white font-medium mb-2">
            Stream Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              placeholder={streamSettings?.settings?.key ? '••••••••' : 'Enter your stream key'}
              className="w-full px-3 py-2 pr-10 bg-gray-800 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
            >
              {showKey ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            {streamSettings?.settings?.key
              ? 'Current key is set. Enter a new key to update it.'
              : 'Enter your stream key from your streaming platform'
            }
          </p>
        </div>

        {/* Current Masked Key Display */}
        {streamSettings?.settings?.key && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <InformationCircleIcon className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium text-sm">Current Stream Key</span>
            </div>
            <code className="text-gray-300 text-sm font-mono">
              {streamSettings.settings.key}
            </code>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving || loading || isStreaming}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
          >
            {saving && <ArrowPathIcon className="w-5 h-5 animate-spin" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
        {isStreaming && (
          <p className="text-yellow-400 text-sm text-right">Stop streaming to change settings</p>
        )}
      </div>

      {/* Stream Status Display */}
      {(streamStatus || streamSettings) && (
        <div className="bg-gray-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <InformationCircleIcon className="w-6 h-6 text-blue-400" />
            <h4 className="text-white font-semibold text-lg">Stream Info</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Stream Status */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Status</div>
              <div className="text-white font-medium flex items-center gap-2">
                {isStreaming ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-red-400">LIVE</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>

            {/* Stream Timecode */}
            {isStreaming && streamStatus?.timecode && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Stream Duration</div>
                <div className="text-white font-medium font-mono">
                  {streamStatus.timecode}
                </div>
              </div>
            )}

            {/* Service Type */}
            {streamSettings?.serviceType && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Service Type</div>
                <div className="text-white font-medium">
                  {streamSettings.serviceType === 'rtmp_common' && 'RTMP (YouTube/Twitch)'}
                  {streamSettings.serviceType === 'rtmp_custom' && 'Custom RTMP'}
                  {!['rtmp_common', 'rtmp_custom'].includes(streamSettings.serviceType) && streamSettings.serviceType}
                </div>
              </div>
            )}

            {/* Dropped Frames */}
            {isStreaming && streamStatus?.skippedFrames !== undefined && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Dropped Frames</div>
                <div className={`font-medium ${streamStatus.skippedFrames > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {streamStatus.skippedFrames} / {streamStatus.totalFrames || 0}
                </div>
              </div>
            )}

            {/* Reconnecting Status */}
            {streamStatus?.reconnecting && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Connection</div>
                <div className="text-yellow-400 font-medium flex items-center gap-2">
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Reconnecting...
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
