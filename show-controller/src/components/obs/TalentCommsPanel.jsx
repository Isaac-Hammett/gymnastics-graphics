import { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  MicrophoneIcon,
  UserGroupIcon,
  LinkIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';
import { useShow } from '../../context/ShowContext';

/**
 * TalentCommsPanel - Manage talent communications (VDO.Ninja, Discord)
 * Shows connection URLs with copy-to-clipboard and status indicators
 */
export default function TalentCommsPanel() {
  const { obsConnected } = useOBS();
  const { socketUrl } = useShow();

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);

  // Fetch current config on mount
  useEffect(() => {
    if (obsConnected) {
      fetchConfig();
    }
  }, [obsConnected]);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${socketUrl}/api/obs/talent-comms`);
      if (!response.ok) {
        throw new Error(`Failed to fetch talent comms config: ${response.statusText}`);
      }
      const data = await response.json();
      // API returns { configured: true, config: {...} } or { configured: false, ... }
      // Extract the config if it exists, otherwise use the whole response for "not configured" case
      if (data.configured && data.config) {
        setConfig(data.config);
      } else if (data.configured === false) {
        // Not configured yet - set a minimal config with default method
        setConfig({ method: 'vdo-ninja' });
      } else {
        setConfig(data);
      }
    } catch (err) {
      console.error('Error fetching talent comms config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupVDONinja = async () => {
    setError(null);
    setSuccess(null);
    setRegenerating(true);

    try {
      const response = await fetch(`${socketUrl}/api/obs/talent-comms/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to setup VDO.Ninja: ${response.statusText}`);
      }

      const data = await response.json();
      // API returns { success: true, config: {...} } - extract the config
      setConfig(data.config || data);
      setSuccess('VDO.Ninja room created successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error setting up VDO.Ninja:', err);
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerateUrls = async () => {
    setError(null);
    setSuccess(null);
    setRegenerating(true);

    try {
      const response = await fetch(`${socketUrl}/api/obs/talent-comms/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to regenerate URLs: ${response.statusText}`);
      }

      const data = await response.json();
      // API returns { success: true, config: {...} } - extract the config
      setConfig(data.config || data);
      setSuccess('URLs regenerated successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error regenerating URLs:', err);
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSwitchMethod = async (method) => {
    setError(null);
    setSuccess(null);
    setSwitching(true);

    try {
      const response = await fetch(`${socketUrl}/api/obs/talent-comms/method`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ method })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to switch method: ${response.statusText}`);
      }

      const data = await response.json();
      // API returns { success: true, config: {...} } - extract the config
      setConfig(data.config || data);
      setSuccess(`Switched to ${method === 'vdo-ninja' ? 'VDO.Ninja' : 'Discord'}`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error switching method:', err);
      setError(err.message);
    } finally {
      setSwitching(false);
    }
  };

  const handleCopyUrl = async (url, label) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(label);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setError('Failed to copy to clipboard');
    }
  };

  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <ExclamationTriangleIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-lg font-semibold text-white mb-2">OBS Not Connected</p>
        <p>Connect to OBS to manage talent communications</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Talent Communications</h3>
          <p className="text-gray-400 text-sm mt-1">Manage VDO.Ninja or Discord connections for talent audio</p>
        </div>
        <button
          onClick={fetchConfig}
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
          <div className="flex-1">
            <div className="text-red-300 font-semibold">Error</div>
            <div className="text-red-200/80 text-sm">{error}</div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-100"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-green-300 font-semibold">Success</div>
            <div className="text-green-200/80 text-sm">{success}</div>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-green-300 hover:text-green-100"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Method Switcher */}
      <div className="bg-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserGroupIcon className="w-5 h-5 text-gray-300" />
          <h4 className="text-white font-semibold">Communication Method</h4>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleSwitchMethod('vdo-ninja')}
            disabled={switching || config?.method === 'vdo-ninja'}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              config?.method === 'vdo-ninja'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
            } disabled:opacity-50`}
          >
            <div className="flex items-center justify-center gap-2">
              <MicrophoneIcon className="w-5 h-5" />
              VDO.Ninja
            </div>
          </button>
          <button
            onClick={() => handleSwitchMethod('discord')}
            disabled={switching || config?.method === 'discord'}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              config?.method === 'discord'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
            } disabled:opacity-50`}
          >
            <div className="flex items-center justify-center gap-2">
              <UserGroupIcon className="w-5 h-5" />
              Discord
            </div>
          </button>
        </div>
        <p className="text-gray-400 text-sm mt-3">
          {config?.method === 'vdo-ninja'
            ? 'Using VDO.Ninja for low-latency browser-based audio'
            : 'Using Discord for voice channel communications'
          }
        </p>
      </div>

      {/* VDO.Ninja Configuration */}
      {config?.method === 'vdo-ninja' && (
        <div className="bg-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-gray-300" />
              <h4 className="text-white font-semibold">VDO.Ninja URLs</h4>
            </div>
            <div className="flex gap-2">
              {!config.vdoNinja?.roomId ? (
                <button
                  onClick={handleSetupVDONinja}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {regenerating ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Setup VDO.Ninja'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleRegenerateUrls}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-750 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  {regenerating ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="w-4 h-4" />
                      Regenerate URLs
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <ArrowPathIcon className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
              <div className="text-gray-400">Loading configuration...</div>
            </div>
          ) : !config.vdoNinja?.roomId ? (
            <div className="text-center py-8">
              <MicrophoneIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <div className="text-gray-400 mb-4">VDO.Ninja room not configured</div>
              <button
                onClick={handleSetupVDONinja}
                disabled={regenerating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors mx-auto"
              >
                {regenerating ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Creating Room...
                  </>
                ) : (
                  'Create VDO.Ninja Room'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Room Info */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                <div className="text-gray-400 text-sm mb-1">Room ID</div>
                <div className="text-white font-mono">{config.vdoNinja.roomId}</div>
              </div>

              {/* Talent URLs */}
              {config.vdoNinja.talentUrls && Object.entries(config.vdoNinja.talentUrls).map(([role, url]) => (
                <URLCard
                  key={role}
                  label={`${role.charAt(0).toUpperCase() + role.slice(1)} URL`}
                  url={url}
                  description={`Share this URL with the ${role}`}
                  onCopy={() => handleCopyUrl(url, role)}
                  isCopied={copiedUrl === role}
                />
              ))}

              {/* Director (Receive) URL */}
              {config.vdoNinja.directorUrl && (
                <URLCard
                  label="Director URL (Receive Audio)"
                  url={config.vdoNinja.directorUrl}
                  description="Add this as a Browser Source in OBS to receive all talent audio"
                  onCopy={() => handleCopyUrl(config.vdoNinja.directorUrl, 'director')}
                  isCopied={copiedUrl === 'director'}
                  highlight
                />
              )}

              {/* Connection Status */}
              {config.vdoNinja.connections && config.vdoNinja.connections.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircleIcon className="w-5 h-5 text-green-400" />
                    <span className="text-white font-medium">Connected Talent</span>
                  </div>
                  <div className="space-y-2">
                    {config.vdoNinja.connections.map(conn => (
                      <div key={conn.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{conn.role || conn.id}</span>
                        <span className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-green-400">Connected</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Discord Configuration */}
      {config?.method === 'discord' && (
        <div className="bg-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserGroupIcon className="w-5 h-5 text-gray-300" />
            <h4 className="text-white font-semibold">Discord Configuration</h4>
          </div>

          {config.discord?.channelUrl ? (
            <div className="space-y-4">
              <URLCard
                label="Discord Voice Channel"
                url={config.discord.channelUrl}
                description="Share this invite link with talent to join the voice channel"
                onCopy={() => handleCopyUrl(config.discord.channelUrl, 'discord')}
                isCopied={copiedUrl === 'discord'}
              />

              {config.discord.channelName && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                  <div className="text-gray-400 text-sm mb-1">Channel Name</div>
                  <div className="text-white font-medium">{config.discord.channelName}</div>
                </div>
              )}

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 flex items-start gap-3">
                <LinkIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-blue-200 text-sm">
                  To capture Discord audio in OBS, use Discord's built-in streaming or an audio routing application like Virtual Audio Cable.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <UserGroupIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <div className="text-gray-400">Discord channel not configured</div>
              <div className="text-gray-500 text-sm mt-1">Configure Discord in the API settings</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * URLCard - Card component for displaying copyable URLs
 */
function URLCard({ label, url, description, onCopy, isCopied, highlight }) {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${
      highlight ? 'border-purple-600 bg-purple-900/10' : 'border-gray-600'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1">
          <div className="text-gray-400 text-sm mb-1">{label}</div>
          <div className="text-white font-mono text-sm break-all">{url}</div>
          {description && (
            <div className="text-gray-500 text-xs mt-2">{description}</div>
          )}
        </div>
        <button
          onClick={onCopy}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors whitespace-nowrap"
          title="Copy to clipboard"
        >
          {isCopied ? (
            <>
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="w-5 h-5" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
