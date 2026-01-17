import { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';

/**
 * StreamConfig - Configure streaming settings
 * Allows users to select service (YouTube, Twitch, Custom RTMP) and enter stream key
 */
export default function StreamConfig() {
  const { obsConnected } = useOBS();

  const [serviceType, setServiceType] = useState('youtube');
  const [streamKey, setStreamKey] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [currentSettings, setCurrentSettings] = useState(null);
  const [outputSettings, setOutputSettings] = useState(null);

  // Fetch current stream settings on mount
  useEffect(() => {
    if (obsConnected) {
      fetchStreamSettings();
      fetchStreamStatus();
    }
  }, [obsConnected]);

  const fetchStreamSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/obs/stream/settings');
      if (!response.ok) {
        throw new Error(`Failed to fetch stream settings: ${response.statusText}`);
      }
      const data = await response.json();
      setCurrentSettings(data);

      // Populate form with current settings
      if (data.serviceType) {
        setServiceType(data.serviceType);
      }
      if (data.settings?.server) {
        setServerUrl(data.settings.server);
      }
      // Stream key will be masked (e.g., ****xxxx) - don't populate field
    } catch (err) {
      console.error('Error fetching stream settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStreamStatus = async () => {
    try {
      const response = await fetch('/api/obs/stream/status');
      if (!response.ok) {
        throw new Error(`Failed to fetch stream status: ${response.statusText}`);
      }
      const data = await response.json();
      setOutputSettings(data);
    } catch (err) {
      console.error('Error fetching stream status:', err);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      // Validate inputs
      if (serviceType === 'custom' && !serverUrl.trim()) {
        throw new Error('Server URL is required for custom RTMP');
      }
      if (!streamKey.trim() && !currentSettings?.settings?.key) {
        throw new Error('Stream key is required');
      }

      const payload = {
        serviceType,
        settings: {}
      };

      // Only include fields that have been modified
      if (serviceType === 'custom' && serverUrl.trim()) {
        payload.settings.server = serverUrl.trim();
      }
      if (streamKey.trim()) {
        payload.settings.key = streamKey.trim();
      }

      const response = await fetch('/api/obs/stream/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update stream settings: ${response.statusText}`);
      }

      const data = await response.json();
      setCurrentSettings(data);
      setSuccess(true);
      setStreamKey(''); // Clear the key field after saving

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving stream settings:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Stream Configuration</h3>
          <p className="text-gray-400 text-sm mt-1">Configure streaming service and output settings</p>
        </div>
        <button
          onClick={() => {
            fetchStreamSettings();
            fetchStreamStatus();
          }}
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

      {/* Stream Configuration Form */}
      <div className="bg-gray-700 rounded-lg p-6 space-y-6">
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
            <option value="youtube">YouTube</option>
            <option value="twitch">Twitch</option>
            <option value="custom">Custom RTMP</option>
          </select>
          <p className="text-gray-400 text-sm mt-1">
            {serviceType === 'youtube' && 'Stream to YouTube Live'}
            {serviceType === 'twitch' && 'Stream to Twitch.tv'}
            {serviceType === 'custom' && 'Stream to a custom RTMP server'}
          </p>
        </div>

        {/* Server URL (Custom RTMP only) */}
        {serviceType === 'custom' && (
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
              placeholder={currentSettings?.settings?.key ? '••••••••' : 'Enter your stream key'}
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
            {currentSettings?.settings?.key
              ? 'Current key is set. Enter a new key to update it.'
              : 'Enter your stream key from your streaming platform'
            }
          </p>
        </div>

        {/* Current Masked Key Display */}
        {currentSettings?.settings?.key && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <InformationCircleIcon className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium text-sm">Current Stream Key</span>
            </div>
            <code className="text-gray-300 text-sm font-mono">
              {currentSettings.settings.key}
            </code>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
          >
            {saving && <ArrowPathIcon className="w-5 h-5 animate-spin" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Output Settings Display (Read-only) */}
      {outputSettings && (
        <div className="bg-gray-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <InformationCircleIcon className="w-6 h-6 text-blue-400" />
            <h4 className="text-white font-semibold text-lg">Output Settings</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stream Status */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Status</div>
              <div className="text-white font-medium flex items-center gap-2">
                {outputSettings.active ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-red-400">Streaming</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>

            {/* Output Resolution */}
            {outputSettings.outputWidth && outputSettings.outputHeight && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Output Resolution</div>
                <div className="text-white font-medium">
                  {outputSettings.outputWidth} x {outputSettings.outputHeight}
                </div>
              </div>
            )}

            {/* Output FPS */}
            {outputSettings.fps && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">FPS</div>
                <div className="text-white font-medium">
                  {outputSettings.fps} fps
                </div>
              </div>
            )}

            {/* Bitrate */}
            {outputSettings.kbitsPerSec && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Bitrate</div>
                <div className="text-white font-medium">
                  {outputSettings.kbitsPerSec} kbps
                </div>
              </div>
            )}

            {/* Stream Timecode */}
            {outputSettings.active && outputSettings.timecode && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Stream Duration</div>
                <div className="text-white font-medium font-mono">
                  {outputSettings.timecode}
                </div>
              </div>
            )}

            {/* Service Type */}
            {currentSettings?.serviceType && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Service</div>
                <div className="text-white font-medium capitalize">
                  {currentSettings.serviceType === 'youtube' && 'YouTube Live'}
                  {currentSettings.serviceType === 'twitch' && 'Twitch'}
                  {currentSettings.serviceType === 'custom' && 'Custom RTMP'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
