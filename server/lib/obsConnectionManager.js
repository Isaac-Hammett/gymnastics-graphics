/**
 * OBS Connection Manager
 *
 * Manages OBS WebSocket connections to competition VMs.
 * When a client connects for a specific competition, this manager
 * connects to the OBS instance running on that competition's VM.
 *
 * This solves the Mixed Content issue where HTTPS frontends cannot
 * connect directly to HTTP WebSockets on VMs.
 *
 * @module obsConnectionManager
 */

import OBSWebSocket from 'obs-websocket-js';
import { EventEmitter } from 'events';

/**
 * Manages OBS connections per competition
 */
class OBSConnectionManager extends EventEmitter {
  constructor() {
    super();

    // Map of compId -> OBSWebSocket instances
    this.connections = new Map();

    // Map of compId -> connection state
    this.connectionStates = new Map();

    // Reconnect timers per competition
    this.reconnectTimers = new Map();

    // Default OBS WebSocket port
    this.OBS_PORT = 4455;

    // Default password (can be overridden)
    this.OBS_PASSWORD = process.env.OBS_WEBSOCKET_PASSWORD || '';

    console.log('[OBSConnectionManager] Initialized');
  }

  /**
   * Connect to OBS on a specific VM for a competition
   * @param {string} compId - Competition ID
   * @param {string} vmAddress - VM address (IP or hostname)
   * @returns {Promise<OBSWebSocket>} The OBS WebSocket connection
   */
  async connectToVM(compId, vmAddress) {
    console.log(`[OBSConnectionManager] Connecting to OBS for competition ${compId} on VM ${vmAddress}`);

    // Check if already connected
    if (this.isConnected(compId)) {
      console.log(`[OBSConnectionManager] Already connected to OBS for ${compId}`);
      return this.connections.get(compId);
    }

    // Parse vmAddress - it might be "ip:port" or just "ip"
    let host = vmAddress;
    if (vmAddress.includes(':')) {
      // vmAddress format is "ip:serverPort" (e.g., "3.89.92.162:3003")
      // We need to use the OBS WebSocket port (4455), not the server port
      host = vmAddress.split(':')[0];
    }

    const obsUrl = `ws://${host}:${this.OBS_PORT}`;
    console.log(`[OBSConnectionManager] OBS WebSocket URL: ${obsUrl}`);

    // Create new OBS WebSocket instance
    const obs = new OBSWebSocket();

    // Set up event handlers
    this._setupEventHandlers(obs, compId, vmAddress);

    try {
      // Connect to OBS
      await obs.connect(obsUrl, this.OBS_PASSWORD || undefined);

      // Store connection
      this.connections.set(compId, obs);
      this.connectionStates.set(compId, {
        connected: true,
        vmAddress: vmAddress,
        connectedAt: new Date().toISOString(),
        error: null
      });

      console.log(`[OBSConnectionManager] Connected to OBS for ${compId} at ${obsUrl}`);

      // Emit connection event
      this.emit('connected', { compId, vmAddress });

      return obs;
    } catch (error) {
      console.error(`[OBSConnectionManager] Failed to connect to OBS for ${compId}:`, error.message);

      // Update connection state
      this.connectionStates.set(compId, {
        connected: false,
        vmAddress: vmAddress,
        connectedAt: null,
        error: error.message
      });

      // Schedule reconnect
      this._scheduleReconnect(compId, vmAddress);

      throw error;
    }
  }

  /**
   * Get OBS connection for a competition
   * @param {string} compId - Competition ID
   * @returns {OBSWebSocket|null} The OBS connection or null
   */
  getConnection(compId) {
    return this.connections.get(compId) || null;
  }

  /**
   * Check if connected to OBS for a competition
   * @param {string} compId - Competition ID
   * @returns {boolean} True if connected
   */
  isConnected(compId) {
    const state = this.connectionStates.get(compId);
    return state?.connected === true;
  }

  /**
   * Get connection state for a competition
   * @param {string} compId - Competition ID
   * @returns {Object|null} Connection state or null
   */
  getConnectionState(compId) {
    return this.connectionStates.get(compId) || null;
  }

  /**
   * Disconnect from OBS for a competition
   * @param {string} compId - Competition ID
   */
  async disconnect(compId) {
    console.log(`[OBSConnectionManager] Disconnecting from OBS for ${compId}`);

    // Clear reconnect timer
    const timer = this.reconnectTimers.get(compId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(compId);
    }

    // Disconnect OBS
    const obs = this.connections.get(compId);
    if (obs) {
      try {
        await obs.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.connections.delete(compId);
    }

    // Update state
    this.connectionStates.set(compId, {
      connected: false,
      vmAddress: this.connectionStates.get(compId)?.vmAddress,
      connectedAt: null,
      error: 'Disconnected'
    });

    this.emit('disconnected', { compId });
  }

  /**
   * Set up event handlers for an OBS connection
   * @private
   */
  _setupEventHandlers(obs, compId, vmAddress) {
    // Connection closed
    obs.on('ConnectionClosed', () => {
      console.log(`[OBSConnectionManager] OBS connection closed for ${compId}`);

      this.connectionStates.set(compId, {
        connected: false,
        vmAddress: vmAddress,
        connectedAt: null,
        error: 'Connection closed'
      });

      this.emit('connectionClosed', { compId });

      // Schedule reconnect
      this._scheduleReconnect(compId, vmAddress);
    });

    // Connection error
    obs.on('ConnectionError', (error) => {
      console.error(`[OBSConnectionManager] OBS connection error for ${compId}:`, error);

      this.connectionStates.set(compId, {
        connected: false,
        vmAddress: vmAddress,
        connectedAt: null,
        error: error.message
      });

      this.emit('connectionError', { compId, error: error.message });
    });

    // Identified (successfully authenticated)
    obs.on('Identified', () => {
      console.log(`[OBSConnectionManager] OBS identified for ${compId}`);

      this.connectionStates.set(compId, {
        connected: true,
        vmAddress: vmAddress,
        connectedAt: new Date().toISOString(),
        error: null
      });

      this.emit('identified', { compId });
    });

    // Forward OBS events to listeners
    const eventsToForward = [
      'CurrentProgramSceneChanged',
      'SceneListChanged',
      'InputVolumeChanged',
      'InputMuteStateChanged',
      'StreamStateChanged',
      'RecordStateChanged',
      'StudioModeStateChanged',
      'CurrentPreviewSceneChanged'
    ];

    for (const eventName of eventsToForward) {
      obs.on(eventName, (data) => {
        this.emit('obsEvent', { compId, eventName, data });
      });
    }
  }

  /**
   * Schedule a reconnection attempt
   * @private
   */
  _scheduleReconnect(compId, vmAddress) {
    // Clear existing timer
    const existingTimer = this.reconnectTimers.get(compId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule reconnect after 30 seconds
    const timer = setTimeout(async () => {
      console.log(`[OBSConnectionManager] Attempting reconnection for ${compId}`);
      try {
        await this.connectToVM(compId, vmAddress);
      } catch (error) {
        console.error(`[OBSConnectionManager] Reconnection failed for ${compId}:`, error.message);
        // _scheduleReconnect will be called again from the error handler
      }
    }, 30000);

    this.reconnectTimers.set(compId, timer);
  }

  /**
   * Shutdown all connections
   */
  async shutdown() {
    console.log('[OBSConnectionManager] Shutting down all connections');

    // Clear all reconnect timers
    for (const [compId, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Disconnect all OBS instances
    for (const [compId, obs] of this.connections) {
      try {
        await obs.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    this.connections.clear();
    this.connectionStates.clear();

    console.log('[OBSConnectionManager] Shutdown complete');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the OBS Connection Manager singleton
 * @returns {OBSConnectionManager}
 */
export function getOBSConnectionManager() {
  if (!instance) {
    instance = new OBSConnectionManager();
  }
  return instance;
}

export { OBSConnectionManager };
export default getOBSConnectionManager;
