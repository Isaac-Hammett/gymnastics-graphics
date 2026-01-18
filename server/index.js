import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import OBSWebSocket from 'obs-websocket-js';
import cors from 'cors';
import { readFileSync, writeFileSync, watchFile } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { validateShowConfig } from './lib/showConfigSchema.js';
import { CameraHealthMonitor } from './lib/cameraHealth.js';
import { CameraRuntimeState } from './lib/cameraRuntimeState.js';
import { CameraFallbackManager } from './lib/cameraFallback.js';
import { OBSSceneGenerator } from './lib/obsSceneGenerator.js';
import { TimesheetEngine } from './lib/timesheetEngine.js';
import { getApparatusForGender } from './lib/apparatusConfig.js';
import productionConfigService from './lib/productionConfigService.js';
import configLoader from './lib/configLoader.js';
import { getVMPoolManager, VM_STATUS } from './lib/vmPoolManager.js';
import { getAWSService } from './lib/awsService.js';
import { getAlertService, ALERT_LEVEL, ALERT_CATEGORY } from './lib/alertService.js';
import { getAutoShutdownService } from './lib/autoShutdown.js';
import { getSelfStopService } from './lib/selfStop.js';
import { getOBSStateSync } from './lib/obsStateSync.js';
import { setupOBSRoutes } from './routes/obs.js';
import { getOBSConnectionManager } from './lib/obsConnectionManager.js';

dotenv.config();

// ============================================
// Coordinator State Tracking
// ============================================
const serverStartTime = Date.now();
let lastActivityTimestamp = Date.now();
const SERVER_VERSION = '1.0.0';

/**
 * Update last activity timestamp
 * Called on API requests and socket events
 */
function updateLastActivity() {
  lastActivityTimestamp = Date.now();
}

/**
 * Get server uptime in seconds
 */
function getUptime() {
  return Math.floor((Date.now() - serverStartTime) / 1000);
}

/**
 * Get idle time in seconds
 */
function getIdleTime() {
  return Math.floor((Date.now() - lastActivityTimestamp) / 1000);
}

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const obs = new OBSWebSocket();

// Configuration
const PORT = process.env.PORT || 3003;
const OBS_WEBSOCKET_URL = process.env.OBS_WEBSOCKET_URL || 'ws://localhost:4455';
const OBS_WEBSOCKET_PASSWORD = process.env.OBS_WEBSOCKET_PASSWORD || '';

// Show State
let showState = {
  currentSegmentIndex: 0,
  currentSegment: null,
  nextSegment: null,
  isPlaying: false,
  isPaused: false,
  talentLocked: false,
  obsConnected: false,
  obsCurrentScene: null,
  obsIsStreaming: false,
  obsIsRecording: false,
  connectedClients: [],
  showProgress: {
    completed: 0,
    total: 0
  },
  segmentStartTime: null,
  segmentElapsed: 0
};

// Show Configuration
let showConfig = null;

// Camera Management Modules
let cameraHealthMonitor = null;
let cameraRuntimeState = null;
let cameraFallbackManager = null;

// OBS Scene Generator
let obsSceneGenerator = null;

// Timesheet Engine
let timesheetEngine = null;

// OBS State Sync
let obsStateSync = null;

// Load show configuration
function loadShowConfig(exitOnInvalid = false) {
  try {
    const configPath = join(__dirname, 'config', 'show-config.json');
    const configData = readFileSync(configPath, 'utf-8');
    const parsedConfig = JSON.parse(configData);

    // Validate the configuration against schema
    const validation = validateShowConfig(parsedConfig);
    if (!validation.valid) {
      console.error('Show config validation failed:');
      validation.errors.forEach(err => console.error(`  - ${err}`));
      if (exitOnInvalid) {
        console.error('Exiting due to invalid configuration');
        process.exit(1);
      }
      return false;
    }

    showConfig = parsedConfig;
    showState.showProgress.total = showConfig.segments.length;
    updateCurrentSegment();
    console.log(`Loaded show config: ${showConfig.showName} with ${showConfig.segments.length} segments (validated)`);
    return true;
  } catch (error) {
    console.error('Error loading show config:', error.message);
    if (exitOnInvalid) {
      process.exit(1);
    }
    return false;
  }
}

// Initialize camera management modules
function initializeCameraModules() {
  if (!showConfig || !showConfig.cameras) {
    console.log('No cameras configured, skipping camera module initialization');
    return;
  }

  // Initialize health monitor
  if (cameraHealthMonitor) {
    cameraHealthMonitor.stop();
  }
  cameraHealthMonitor = new CameraHealthMonitor({
    cameras: showConfig.cameras,
    nimbleServer: showConfig.nimbleServer || {}
  });

  // Initialize runtime state
  cameraRuntimeState = new CameraRuntimeState({
    cameras: showConfig.cameras
  });

  // Initialize fallback manager
  cameraFallbackManager = new CameraFallbackManager({
    cameras: showConfig.cameras,
    cameraHealthMonitor,
    cameraRuntimeState,
    switchScene
  });

  // Attach event handlers BEFORE starting (to catch initial poll errors)
  // Broadcast camera health on each poll
  cameraHealthMonitor.on('cameraHealth', (healthData) => {
    io.emit('cameraHealth', healthData);
  });

  // Broadcast status changes to all clients
  cameraHealthMonitor.on('cameraStatusChanged', (change) => {
    console.log(`Camera ${change.cameraName} status: ${change.previousStatus} -> ${change.newStatus}`);
    io.emit('cameraStatusChanged', change);
  });

  // Handle errors from health monitor (e.g., Nimble server not available)
  cameraHealthMonitor.on('error', (error) => {
    // Log but don't crash - Nimble server may not be running
    console.warn(`Camera health monitor error: ${error.message}`);
  });

  // Broadcast runtime state changes to all clients
  cameraRuntimeState.on('stateChanged', (state) => {
    io.emit('cameraRuntimeState', state);
  });

  cameraRuntimeState.on('apparatusReassigned', (data) => {
    io.emit('apparatusReassigned', data);
  });

  cameraRuntimeState.on('cameraVerified', (data) => {
    io.emit('cameraVerified', data);
  });

  cameraRuntimeState.on('mismatchDetected', (data) => {
    io.emit('mismatchDetected', data);
  });

  // Broadcast fallback events to all clients
  cameraFallbackManager.on('fallbackActivated', (data) => {
    io.emit('fallbackActivated', data);
  });

  cameraFallbackManager.on('fallbackCleared', (data) => {
    io.emit('fallbackCleared', data);
  });

  cameraFallbackManager.on('fallbackUnavailable', (data) => {
    io.emit('fallbackUnavailable', data);
  });

  cameraFallbackManager.on('fallbackChainExhausted', (data) => {
    io.emit('fallbackChainExhausted', data);
  });

  // Start health monitoring (after event handlers are attached)
  cameraHealthMonitor.start();

  console.log(`Camera modules initialized with ${showConfig.cameras.length} cameras`);
}

// Initialize OBS scene generator
function initializeSceneGenerator() {
  obsSceneGenerator = new OBSSceneGenerator(obs, showConfig);
  console.log('OBS scene generator initialized');
}

// Initialize timesheet engine
function initializeTimesheetEngine() {
  timesheetEngine = new TimesheetEngine({
    showConfig,
    obs,
    io
  });

  // Wire up timesheet events to broadcast to all clients
  timesheetEngine.on('tick', (data) => {
    io.emit('timesheetTick', data);
  });

  timesheetEngine.on('segmentActivated', (data) => {
    console.log(`Timesheet: Segment activated - ${data.segment.name} (${data.reason})`);
    io.emit('timesheetSegmentActivated', data);
    io.emit('timesheetState', timesheetEngine.getState());
  });

  timesheetEngine.on('segmentCompleted', (data) => {
    console.log(`Timesheet: Segment completed - ${data.segmentId} (${data.endReason})`);
    io.emit('timesheetSegmentCompleted', data);
  });

  timesheetEngine.on('showStarted', (data) => {
    console.log('Timesheet: Show started');
    io.emit('timesheetShowStarted', data);
    io.emit('timesheetState', timesheetEngine.getState());
  });

  timesheetEngine.on('showStopped', (data) => {
    console.log('Timesheet: Show stopped');
    io.emit('timesheetShowStopped', data);
    io.emit('timesheetState', timesheetEngine.getState());
  });

  timesheetEngine.on('stateChanged', (data) => {
    io.emit('timesheetStateChanged', data);
    io.emit('timesheetState', timesheetEngine.getState());
  });

  timesheetEngine.on('holdStarted', (data) => {
    console.log(`Timesheet: Hold started - ${data.segmentId}`);
    io.emit('timesheetHoldStarted', data);
  });

  timesheetEngine.on('holdMaxReached', (data) => {
    console.log(`Timesheet: Hold max reached - ${data.segmentId}`);
    io.emit('timesheetHoldMaxReached', data);
  });

  timesheetEngine.on('autoAdvancing', (data) => {
    console.log(`Timesheet: Auto-advancing from ${data.fromSegmentId} to segment ${data.toSegmentIndex}`);
    io.emit('timesheetAutoAdvancing', data);
  });

  timesheetEngine.on('overrideRecorded', (data) => {
    console.log(`Timesheet: Override recorded - ${data.type}`);
    io.emit('timesheetOverrideRecorded', data);
  });

  timesheetEngine.on('sceneChanged', (data) => {
    io.emit('timesheetSceneChanged', data);
  });

  timesheetEngine.on('sceneOverridden', (data) => {
    console.log(`Timesheet: Scene overridden to ${data.sceneName}`);
    io.emit('timesheetSceneOverridden', data);
  });

  timesheetEngine.on('cameraOverridden', (data) => {
    console.log(`Timesheet: Camera overridden to ${data.cameraName}`);
    io.emit('timesheetCameraOverridden', data);
  });

  timesheetEngine.on('graphicTriggered', (data) => {
    io.emit('timesheetGraphicTriggered', data);
  });

  timesheetEngine.on('videoStarted', (data) => {
    io.emit('timesheetVideoStarted', data);
  });

  timesheetEngine.on('breakStarted', (data) => {
    console.log(`Timesheet: Break started - ${data.segmentId}`);
    io.emit('timesheetBreakStarted', data);
  });

  timesheetEngine.on('error', (data) => {
    console.error(`Timesheet error: ${data.message}`);
    io.emit('timesheetError', data);
  });

  console.log('Timesheet engine initialized');
}

// Initialize OBS State Sync
async function initializeOBSStateSync(competitionId) {
  if (!competitionId) {
    console.log('No competition ID provided, skipping OBS State Sync initialization');
    return;
  }

  console.log(`Initializing OBS State Sync for competition: ${competitionId}`);

  // Get or create the singleton instance
  obsStateSync = getOBSStateSync(obs, io, productionConfigService);

  // Initialize with competition ID
  await obsStateSync.initialize(competitionId);

  // Wire up state change event to broadcast
  obsStateSync.on('broadcast', ({ event, data }) => {
    // State changes are already broadcast by obsStateSync
    // This listener is here for logging or additional handling if needed
  });

  console.log('OBS State Sync initialized and ready');
}

// Initialize VM Pool Manager and wire up event broadcasts (P15-03)
function initializeVMPoolManager() {
  const vmPoolManager = getVMPoolManager();

  // Wire up VM pool events to broadcast to all clients
  vmPoolManager.on('poolUpdated', (data) => {
    console.log(`[VMPool] Pool updated: ${data.vmCount} VMs`);
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('vmAssigned', (data) => {
    console.log(`[VMPool] VM ${data.vmId} assigned to competition ${data.competitionId}`);
    io.emit('vmAssigned', data);
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('vmReleased', (data) => {
    console.log(`[VMPool] VM ${data.vmId} released from competition ${data.competitionId}`);
    io.emit('vmReleased', data);
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('vmStarting', (data) => {
    console.log(`[VMPool] VM ${data.vmId} is starting`);
    io.emit('vmStarting', {
      ...data,
      estimatedReadyTime: new Date(Date.now() + 180000).toISOString() // ~3 minutes
    });
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('vmReady', (data) => {
    console.log(`[VMPool] VM ${data.vmId} is ready at ${data.publicIp}`);
    io.emit('vmReady', data);
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('vmStopping', (data) => {
    console.log(`[VMPool] VM ${data.vmId} is stopping`);
    io.emit('vmStopping', data);
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('vmStopped', (data) => {
    console.log(`[VMPool] VM ${data.vmId} is stopped`);
    io.emit('vmStopped', data);
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('vmError', (data) => {
    console.error(`[VMPool] VM ${data.vmId} error: ${data.error || data.reason}`);
    io.emit('vmError', data);
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('vmInUse', (data) => {
    console.log(`[VMPool] VM ${data.vmId} is now in use for competition ${data.competitionId}`);
    io.emit('vmInUse', data);
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  });

  vmPoolManager.on('configUpdated', (config) => {
    console.log('[VMPool] Pool config updated');
    io.emit('vmPoolConfigUpdated', config);
  });

  vmPoolManager.on('poolMaintenance', (data) => {
    console.log(`[VMPool] Pool maintenance: started ${data.startedCount} VMs`);
    io.emit('vmPoolMaintenance', data);
  });

  // Try to initialize the pool (non-blocking, will log errors)
  vmPoolManager.initializePool().then(() => {
    console.log('[VMPool] VM pool manager initialized and listening for events');
    // Broadcast initial pool status
    io.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
  }).catch((error) => {
    console.log(`[VMPool] VM pool not available: ${error.message}`);
    console.log('[VMPool] VM pool features disabled - this is normal for local development');
  });
}

// Initialize Auto-Shutdown Service (P19-02)
async function initializeAutoShutdown() {
  const isCoordinatorMode = process.env.COORDINATOR_MODE === 'true';

  if (!isCoordinatorMode) {
    console.log('[AutoShutdown] Not in coordinator mode, skipping initialization');
    return;
  }

  const autoShutdown = getAutoShutdownService();

  // Wire up shutdown events to broadcast to all clients
  autoShutdown.on('shutdownPending', (data) => {
    console.log(`[AutoShutdown] Shutdown pending: ${data.reason} (${data.secondsRemaining}s)`);
    io.emit('shutdownPending', data);
  });

  autoShutdown.on('shutdownCancelled', (data) => {
    console.log(`[AutoShutdown] Shutdown cancelled: ${data.reason}`);
    io.emit('shutdownCancelled', data);
  });

  autoShutdown.on('shutdownExecuting', (data) => {
    console.log(`[AutoShutdown] Shutdown executing: ${data.reason}`);
    io.emit('shutdownExecuting', data);
  });

  // Custom stop callback for graceful shutdown
  const gracefulStopCallback = async () => {
    console.log('[AutoShutdown] Graceful shutdown initiated');

    // Notify all connected clients
    io.emit('serverShuttingDown', {
      timestamp: new Date().toISOString(),
      message: 'Server shutting down due to idle timeout'
    });

    // Close all socket connections gracefully
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // Stop camera health polling
    if (cameraHealthMonitor) {
      cameraHealthMonitor.stop();
    }

    // Stop timesheet engine
    if (timesheetEngine) {
      timesheetEngine.stop();
    }

    console.log('[AutoShutdown] Graceful shutdown complete');
  };

  // Initialize with socket.io and AWS service
  try {
    const awsService = getAWSService();
    await autoShutdown.initialize({
      io,
      awsService,
      stopCallback: gracefulStopCallback
    });
    console.log('[AutoShutdown] Auto-shutdown service initialized');

    // Initialize self-stop service and wire it to auto-shutdown
    const selfStop = getSelfStopService();
    await selfStop.initialize({ io });
    console.log('[SelfStop] Self-stop service initialized');

    // Wire auto-shutdown completion to EC2 self-stop
    autoShutdown.on('shutdownComplete', async (data) => {
      console.log('[SelfStop] Auto-shutdown complete, initiating EC2 self-stop');
      const result = await selfStop.stopSelf({
        reason: data.reason || 'Auto-shutdown idle timeout',
        idleMinutes: data.idleMinutes || 0
      });
      console.log('[SelfStop] Self-stop result:', result);
    });
  } catch (error) {
    console.warn('[AutoShutdown] Failed to initialize:', error.message);
  }
}

// Watch for config changes (hot reload)
watchFile(join(__dirname, 'config', 'show-config.json'), () => {
  console.log('Show config changed, reloading...');
  loadShowConfig();
  // Update camera modules with new config
  if (cameraHealthMonitor) {
    cameraHealthMonitor.updateConfig(showConfig);
  }
  if (cameraRuntimeState) {
    cameraRuntimeState.updateConfig(showConfig);
  }
  if (cameraFallbackManager) {
    cameraFallbackManager.updateConfig({ cameras: showConfig.cameras });
  }
  // Update scene generator with new config
  if (obsSceneGenerator) {
    obsSceneGenerator.updateConfig(showConfig);
  }
  // Update timesheet engine with new config
  if (timesheetEngine) {
    timesheetEngine.updateConfig(showConfig);
  }
  broadcastState();
});

// Update current segment based on index
function updateCurrentSegment() {
  if (!showConfig || !showConfig.segments) return;

  showState.currentSegment = showConfig.segments[showState.currentSegmentIndex] || null;
  showState.nextSegment = showConfig.segments[showState.currentSegmentIndex + 1] || null;
  showState.showProgress.completed = showState.currentSegmentIndex;
}

// Broadcast state to all clients
function broadcastState() {
  io.emit('stateUpdate', {
    ...showState,
    showConfig: showConfig ? {
      showName: showConfig.showName,
      segments: showConfig.segments,
      sponsors: showConfig.sponsors
    } : null,
    obsState: obsStateSync && obsStateSync.isInitialized() ? obsStateSync.getState() : null
  });
}

// Connect to OBS
let obsReconnectTimer = null;
let obsConnecting = false;

async function connectToOBS() {
  if (obsConnecting) return; // Prevent multiple simultaneous connection attempts
  obsConnecting = true;

  try {
    await obs.connect(OBS_WEBSOCKET_URL, OBS_WEBSOCKET_PASSWORD || undefined);
    showState.obsConnected = true;
    obsConnecting = false;
    console.log('Connected to OBS WebSocket');

    // Get initial scene
    const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
    showState.obsCurrentScene = currentProgramSceneName;

    // Get streaming/recording status
    try {
      const streamStatus = await obs.call('GetStreamStatus');
      showState.obsIsStreaming = streamStatus.outputActive;
    } catch (e) {
      // Streaming might not be available
    }

    try {
      const recordStatus = await obs.call('GetRecordStatus');
      showState.obsIsRecording = recordStatus.outputActive;
    } catch (e) {
      // Recording might not be available
    }

    broadcastState();
  } catch (error) {
    console.error('Failed to connect to OBS:', error.message);
    showState.obsConnected = false;
    obsConnecting = false;

    // Retry connection after 30 seconds (longer delay to avoid spam)
    if (obsReconnectTimer) clearTimeout(obsReconnectTimer);
    obsReconnectTimer = setTimeout(connectToOBS, 30000);
  }
}

// OBS Event Handlers
obs.on('CurrentProgramSceneChanged', ({ sceneName }) => {
  showState.obsCurrentScene = sceneName;
  io.emit('sceneChanged', sceneName);
  broadcastState();
});

obs.on('StreamStateChanged', ({ outputActive }) => {
  showState.obsIsStreaming = outputActive;
  broadcastState();
});

obs.on('RecordStateChanged', ({ outputActive }) => {
  showState.obsIsRecording = outputActive;
  broadcastState();
});

obs.on('ConnectionClosed', () => {
  console.log('OBS connection closed');
  showState.obsConnected = false;
  obsConnecting = false;
  broadcastState();
  // Attempt reconnect after 30 seconds
  if (obsReconnectTimer) clearTimeout(obsReconnectTimer);
  obsReconnectTimer = setTimeout(connectToOBS, 30000);
});

// Switch OBS scene
async function switchScene(sceneName) {
  if (!showState.obsConnected) {
    console.error('Cannot switch scene: OBS not connected');
    return false;
  }

  try {
    await obs.call('SetCurrentProgramScene', { sceneName });
    console.log(`Switched to scene: ${sceneName}`);
    return true;
  } catch (error) {
    console.error(`Failed to switch scene to ${sceneName}:`, error.message);
    return false;
  }
}

// Get available OBS scenes
async function getSceneList() {
  if (!showState.obsConnected) return [];

  try {
    const { scenes } = await obs.call('GetSceneList');
    return scenes.map(s => s.sceneName);
  } catch (error) {
    console.error('Failed to get scene list:', error.message);
    return [];
  }
}

// Default media source name in OBS (user should create this)
const VIDEO_SOURCE_NAME = process.env.OBS_VIDEO_SOURCE || 'Video Player';

// Set video file for media source
async function setVideoFile(filePath, sourceName = VIDEO_SOURCE_NAME) {
  if (!showState.obsConnected) {
    console.error('Cannot set video: OBS not connected');
    return false;
  }

  try {
    // Get current settings first
    const { inputSettings } = await obs.call('GetInputSettings', { inputName: sourceName });

    // Update with new file path
    await obs.call('SetInputSettings', {
      inputName: sourceName,
      inputSettings: {
        ...inputSettings,
        local_file: filePath,
        is_local_file: true
      }
    });

    // Restart the media source to play from beginning
    await obs.call('TriggerMediaInputAction', {
      inputName: sourceName,
      mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'
    });

    console.log(`Set video file: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Failed to set video file:`, error.message);
    return false;
  }
}

// Play/pause/stop media source
async function controlMedia(action, sourceName = VIDEO_SOURCE_NAME) {
  if (!showState.obsConnected) return false;

  const actionMap = {
    'play': 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
    'pause': 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
    'stop': 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
    'restart': 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'
  };

  try {
    await obs.call('TriggerMediaInputAction', {
      inputName: sourceName,
      mediaAction: actionMap[action] || action
    });
    console.log(`Media action: ${action}`);
    return true;
  } catch (error) {
    console.error(`Failed to control media:`, error.message);
    return false;
  }
}

// Get media source status (for progress tracking)
async function getMediaStatus(sourceName = VIDEO_SOURCE_NAME) {
  if (!showState.obsConnected) return null;

  try {
    const status = await obs.call('GetMediaInputStatus', { inputName: sourceName });
    return {
      state: status.mediaState,
      duration: status.mediaDuration,
      cursor: status.mediaCursor // current position in ms
    };
  } catch (error) {
    console.error(`Failed to get media status:`, error.message);
    return null;
  }
}

// Advance to next segment
async function advanceSegment(clientId = null) {
  if (showState.talentLocked && clientId) {
    const client = showState.connectedClients.find(c => c.id === clientId);
    if (client && client.role === 'talent') {
      console.log('Talent controls locked, ignoring advance request');
      return false;
    }
  }

  if (!showConfig || showState.currentSegmentIndex >= showConfig.segments.length - 1) {
    console.log('Already at last segment');
    return false;
  }

  showState.currentSegmentIndex++;
  updateCurrentSegment();
  showState.segmentStartTime = Date.now();
  showState.segmentElapsed = 0;

  // Switch OBS scene if specified
  if (showState.currentSegment?.obsScene) {
    await switchScene(showState.currentSegment.obsScene);
  }

  // Set video file if specified (for video segments)
  if (showState.currentSegment?.videoFile) {
    await setVideoFile(showState.currentSegment.videoFile);
  }

  // Trigger graphic if specified
  if (showState.currentSegment?.graphic) {
    io.emit('triggerGraphic', {
      graphic: showState.currentSegment.graphic,
      data: showState.currentSegment.graphicData || {}
    });
  }

  // Set up auto-advance if applicable
  if (showState.currentSegment?.autoAdvance && showState.currentSegment?.duration) {
    setupAutoAdvance(showState.currentSegment.duration);
  }

  broadcastState();
  console.log(`Advanced to segment ${showState.currentSegmentIndex}: ${showState.currentSegment?.name}`);
  return true;
}

// Go to previous segment
async function previousSegment() {
  if (!showConfig || showState.currentSegmentIndex <= 0) {
    console.log('Already at first segment');
    return false;
  }

  showState.currentSegmentIndex--;
  updateCurrentSegment();
  showState.segmentStartTime = Date.now();
  showState.segmentElapsed = 0;

  if (showState.currentSegment?.obsScene) {
    await switchScene(showState.currentSegment.obsScene);
  }

  broadcastState();
  console.log(`Went back to segment ${showState.currentSegmentIndex}: ${showState.currentSegment?.name}`);
  return true;
}

// Jump to specific segment
async function jumpToSegment(segmentId) {
  if (!showConfig) return false;

  const index = showConfig.segments.findIndex(s => s.id === segmentId);
  if (index === -1) {
    console.error(`Segment not found: ${segmentId}`);
    return false;
  }

  showState.currentSegmentIndex = index;
  updateCurrentSegment();
  showState.segmentStartTime = Date.now();
  showState.segmentElapsed = 0;

  if (showState.currentSegment?.obsScene) {
    await switchScene(showState.currentSegment.obsScene);
  }

  // Set video file if specified
  if (showState.currentSegment?.videoFile) {
    await setVideoFile(showState.currentSegment.videoFile);
  }

  if (showState.currentSegment?.graphic) {
    io.emit('triggerGraphic', {
      graphic: showState.currentSegment.graphic,
      data: showState.currentSegment.graphicData || {}
    });
  }

  if (showState.currentSegment?.autoAdvance && showState.currentSegment?.duration) {
    setupAutoAdvance(showState.currentSegment.duration);
  }

  broadcastState();
  console.log(`Jumped to segment ${index}: ${showState.currentSegment?.name}`);
  return true;
}

// Auto-advance timer
let autoAdvanceTimer = null;

function setupAutoAdvance(durationSeconds) {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
  }

  if (showState.isPaused) return;

  autoAdvanceTimer = setTimeout(() => {
    if (!showState.isPaused) {
      console.log('Auto-advancing to next segment');
      advanceSegment();
    }
  }, durationSeconds * 1000);
}

function clearAutoAdvance() {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'show-controller', 'dist')));
// Serve graphics output files from project root (output.html, overlays/)
app.use(express.static(join(__dirname, '..')));

// Activity tracking middleware - updates last activity on every REST request
app.use((req, res, next) => {
  updateLastActivity();
  // Also update auto-shutdown service if initialized
  const autoShutdown = getAutoShutdownService();
  if (autoShutdown.isInitialized()) {
    autoShutdown.resetActivity();
  }
  next();
});

// REST API endpoints
app.get('/api/status', (req, res) => {
  res.json(showState);
});

app.get('/api/scenes', async (req, res) => {
  const scenes = await getSceneList();
  res.json(scenes);
});

app.get('/api/config', (req, res) => {
  res.json(showConfig);
});

// Config validation endpoint
app.get('/api/config/validate', (req, res) => {
  if (!showConfig) {
    return res.json({ valid: false, errors: ['No configuration loaded'] });
  }
  const validation = validateShowConfig(showConfig);
  res.json(validation);
});

// Update cameras configuration
app.put('/api/config/cameras', (req, res) => {
  const { cameras } = req.body;
  if (!cameras || !Array.isArray(cameras)) {
    return res.status(400).json({ error: 'cameras must be an array' });
  }

  try {
    // Update showConfig with new cameras
    showConfig.cameras = cameras;

    // Save to file
    const configPath = join(__dirname, 'config', 'show-config.json');
    writeFileSync(configPath, JSON.stringify(showConfig, null, 2));

    // Re-validate the config
    const validation = validateShowConfig(showConfig);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration',
        errors: validation.errors
      });
    }

    // Reinitialize camera modules with new config
    initializeCameraModules();

    // Update scene generator
    if (obsSceneGenerator) {
      obsSceneGenerator.updateConfig(showConfig);
    }

    console.log(`Camera config updated: ${cameras.length} cameras`);
    res.json({ success: true, cameras: cameras.length });
  } catch (error) {
    console.error('Failed to save camera config:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Apparatus API Endpoints
// ============================================

// GET /api/apparatus/:gender - Get apparatus for a specific gender
app.get('/api/apparatus/:gender', (req, res) => {
  const { gender } = req.params;

  // Handle invalid gender gracefully (defaults to womens internally)
  const apparatus = getApparatusForGender(gender);

  // Determine normalized gender for response
  const normalizedGender = (gender && (gender.toLowerCase() === 'mens' ||
    gender.toLowerCase() === 'mag' ||
    gender.toLowerCase() === 'male' ||
    gender.toLowerCase() === 'm')) ? 'mens' : 'womens';

  res.json({
    gender: normalizedGender,
    apparatus
  });
});

// ============================================
// Production Config API Endpoints
// ============================================

// GET /api/competitions/active - Get current active competition
app.get('/api/competitions/active', (req, res) => {
  const activeCompetitionId = configLoader.getActiveCompetition();
  res.json({
    activeCompetitionId,
    isActive: !!activeCompetitionId
  });
});

// POST /api/competitions/deactivate - Clear active competition
app.post('/api/competitions/deactivate', (req, res) => {
  configLoader.clearActiveCompetition();
  res.json({
    success: true,
    message: 'Active competition cleared'
  });
});

// GET /api/competitions/:id/production - Get full production config
app.get('/api/competitions/:id/production', async (req, res) => {
  const { id } = req.params;

  if (!productionConfigService.isAvailable()) {
    return res.status(503).json({ error: 'Firebase not available' });
  }

  try {
    const productionConfig = await productionConfigService.getProductionConfig(id);
    if (!productionConfig) {
      return res.status(404).json({ error: 'Production config not found', competitionId: id });
    }
    res.json(productionConfig);
  } catch (error) {
    console.error(`Failed to get production config for ${id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/competitions/:id/production/cameras - Save cameras for a competition
app.put('/api/competitions/:id/production/cameras', async (req, res) => {
  const { id } = req.params;
  const { cameras } = req.body;

  if (!cameras || !Array.isArray(cameras)) {
    return res.status(400).json({ error: 'cameras must be an array' });
  }

  if (!productionConfigService.isAvailable()) {
    return res.status(503).json({ error: 'Firebase not available' });
  }

  try {
    const success = await productionConfigService.saveCameras(id, cameras);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save cameras' });
    }
    res.json({ success: true, cameras: cameras.length, competitionId: id });
  } catch (error) {
    console.error(`Failed to save cameras for ${id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/competitions/:id/production/rundown - Save rundown for a competition
app.put('/api/competitions/:id/production/rundown', async (req, res) => {
  const { id } = req.params;
  const rundown = req.body;

  if (!rundown || typeof rundown !== 'object') {
    return res.status(400).json({ error: 'rundown must be an object' });
  }

  if (!productionConfigService.isAvailable()) {
    return res.status(503).json({ error: 'Firebase not available' });
  }

  try {
    const success = await productionConfigService.saveRundown(id, rundown);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save rundown' });
    }
    res.json({ success: true, competitionId: id });
  } catch (error) {
    console.error(`Failed to save rundown for ${id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/competitions/:id/production/settings - Save settings for a competition
app.put('/api/competitions/:id/production/settings', async (req, res) => {
  const { id } = req.params;
  const settings = req.body;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings must be an object' });
  }

  if (!productionConfigService.isAvailable()) {
    return res.status(503).json({ error: 'Firebase not available' });
  }

  try {
    const success = await productionConfigService.saveSettings(id, settings);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save settings' });
    }
    res.json({ success: true, competitionId: id });
  } catch (error) {
    console.error(`Failed to save settings for ${id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/competitions/:id/production/history - Get history for a competition
app.get('/api/competitions/:id/production/history', async (req, res) => {
  const { id } = req.params;

  if (!productionConfigService.isAvailable()) {
    return res.status(503).json({ error: 'Firebase not available' });
  }

  try {
    const history = await productionConfigService.getHistory(id);
    res.json(history);
  } catch (error) {
    console.error(`Failed to get history for ${id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/competitions/:id/activate - Set active competition
app.post('/api/competitions/:id/activate', async (req, res) => {
  const { id } = req.params;

  configLoader.setActiveCompetition(id);

  // Initialize OBS State Sync for this competition
  try {
    await initializeOBSStateSync(id);
    console.log(`OBS State Sync initialized for competition: ${id}`);
  } catch (error) {
    console.error(`Failed to initialize OBS State Sync for ${id}:`, error);
    // Don't fail the activation if OBS State Sync fails
  }

  res.json({
    success: true,
    activeCompetitionId: id,
    message: `Competition ${id} activated`
  });
});

// ============================================
// VM Pool Management API Endpoints
// ============================================

// GET /api/admin/vm-pool - Get full pool status
app.get('/api/admin/vm-pool', (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.json({
        initialized: false,
        message: 'VM pool manager not initialized. Call initializePool() first.',
        config: null,
        counts: { total: 0, available: 0, assigned: 0, inUse: 0, stopped: 0, starting: 0, stopping: 0, error: 0 },
        vms: []
      });
    }
    res.json(vmPoolManager.getPoolStatus());
  } catch (error) {
    console.error('Failed to get VM pool status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/vm-pool/config - Get pool configuration
app.get('/api/admin/vm-pool/config', (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    const status = vmPoolManager.getPoolStatus();
    const awsService = getAWSService();
    const awsConfig = awsService.getConfig();

    // Merge pool config with AWS config (AMI, region, instance type)
    res.json({
      ...status.config,
      region: awsConfig.region,
      amiId: awsConfig.amiId,
      defaultInstanceType: awsConfig.defaultInstanceType,
    });
  } catch (error) {
    console.error('Failed to get VM pool config:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/vm-pool/config - Update pool configuration
app.put('/api/admin/vm-pool/config', async (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.status(503).json({ error: 'VM pool manager not initialized' });
    }
    const config = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config must be an object' });
    }
    const updatedConfig = await vmPoolManager.updatePoolConfig(config);
    res.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error('Failed to update VM pool config:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/vm-pool/:vmId - Get single VM details
app.get('/api/admin/vm-pool/:vmId', (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.status(503).json({ error: 'VM pool manager not initialized' });
    }
    const { vmId } = req.params;
    const vm = vmPoolManager.getVM(vmId);
    if (!vm) {
      return res.status(404).json({ error: 'VM not found', vmId });
    }
    res.json(vm);
  } catch (error) {
    console.error('Failed to get VM:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/vm-pool/:vmId/start - Start a stopped VM
app.post('/api/admin/vm-pool/:vmId/start', async (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.status(503).json({ error: 'VM pool manager not initialized' });
    }
    const { vmId } = req.params;
    const result = await vmPoolManager.startVM(vmId);
    res.json(result);
  } catch (error) {
    console.error('Failed to start VM:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/vm-pool/:vmId/stop - Stop a VM
app.post('/api/admin/vm-pool/:vmId/stop', async (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.status(503).json({ error: 'VM pool manager not initialized' });
    }
    const { vmId } = req.params;
    const result = await vmPoolManager.stopVM(vmId);
    res.json(result);
  } catch (error) {
    console.error('Failed to stop VM:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/vm-pool/launch - Launch a new VM from AMI
app.post('/api/admin/vm-pool/launch', async (req, res) => {
  try {
    const awsService = getAWSService();
    const { name, instanceType, tags } = req.body || {};
    // Note: Project and ManagedBy tags are added automatically by awsService.launchInstance()
    const result = await awsService.launchInstance({
      name: name || `gymnastics-vm-${Date.now()}`,
      instanceType,
      tags: tags || {}
    });

    // Sync the pool to include the new instance
    const vmPoolManager = getVMPoolManager();
    if (vmPoolManager.isInitialized()) {
      // Allow time for AWS to process then re-sync
      setTimeout(async () => {
        try {
          await vmPoolManager._syncWithAWS();
        } catch (syncError) {
          console.error('Failed to sync after launch:', syncError);
        }
      }, 5000);
    }

    res.json({
      success: true,
      instance: result,
      message: 'VM launched successfully. It will appear in the pool after startup.'
    });
  } catch (error) {
    console.error('Failed to launch VM:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/vm-pool/:vmId - Terminate a VM
app.delete('/api/admin/vm-pool/:vmId', async (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.status(503).json({ error: 'VM pool manager not initialized' });
    }
    const { vmId } = req.params;
    const vm = vmPoolManager.getVM(vmId);
    if (!vm) {
      return res.status(404).json({ error: 'VM not found', vmId });
    }

    // Don't allow terminating assigned VMs
    if (vm.assignedTo) {
      return res.status(400).json({
        error: 'Cannot terminate assigned VM',
        assignedTo: vm.assignedTo,
        message: 'Release the VM from its competition first'
      });
    }

    const awsService = getAWSService();
    const result = await awsService.terminateInstance(vm.instanceId);

    res.json({
      success: true,
      vmId,
      instanceId: vm.instanceId,
      result,
      message: 'VM termination initiated'
    });
  } catch (error) {
    console.error('Failed to terminate VM:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Competition VM Assignment API Endpoints
// ============================================

// POST /api/competitions/:compId/vm/assign - Assign a VM to a competition
app.post('/api/competitions/:compId/vm/assign', async (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.status(503).json({ error: 'VM pool manager not initialized' });
    }

    const { compId } = req.params;
    const { preferredVmId } = req.body || {};

    // Check if competition already has a VM assigned
    const existingVM = vmPoolManager.getVMForCompetition(compId);
    if (existingVM) {
      return res.status(400).json({
        error: 'Competition already has a VM assigned',
        competitionId: compId,
        vmId: existingVM.vmId,
        publicIp: existingVM.publicIp
      });
    }

    const result = await vmPoolManager.assignVM(compId, preferredVmId);
    res.json(result);
  } catch (error) {
    console.error('Failed to assign VM:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/competitions/:compId/vm/release - Release a VM from a competition
app.post('/api/competitions/:compId/vm/release', async (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.status(503).json({ error: 'VM pool manager not initialized' });
    }

    const { compId } = req.params;
    const result = await vmPoolManager.releaseVM(compId);
    res.json(result);
  } catch (error) {
    console.error('Failed to release VM:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/competitions/:compId/vm - Get the VM assigned to a competition
app.get('/api/competitions/:compId/vm', (req, res) => {
  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.status(503).json({ error: 'VM pool manager not initialized' });
    }

    const { compId } = req.params;
    const vm = vmPoolManager.getVMForCompetition(compId);

    if (!vm) {
      return res.status(404).json({
        error: 'No VM assigned to this competition',
        competitionId: compId
      });
    }

    res.json({
      competitionId: compId,
      vmId: vm.vmId,
      instanceId: vm.instanceId,
      publicIp: vm.publicIp,
      status: vm.status,
      services: vm.services,
      vmAddress: vm.publicIp ? `${vm.publicIp}:${vmPoolManager.getPoolStatus().config.servicePort}` : null
    });
  } catch (error) {
    console.error('Failed to get competition VM:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Camera Health API Endpoints
// ============================================

// GET /api/cameras/health - Get health status for all cameras
app.get('/api/cameras/health', (req, res) => {
  if (!cameraHealthMonitor) {
    return res.status(503).json({ error: 'Camera health monitoring not initialized' });
  }
  res.json(cameraHealthMonitor.getAllHealth());
});

// GET /api/cameras/:id/health - Get health status for a specific camera
app.get('/api/cameras/:id/health', (req, res) => {
  if (!cameraHealthMonitor) {
    return res.status(503).json({ error: 'Camera health monitoring not initialized' });
  }
  const health = cameraHealthMonitor.getCameraHealth(req.params.id);
  if (!health) {
    return res.status(404).json({ error: 'Camera not found', cameraId: req.params.id });
  }
  res.json(health);
});

// GET /api/cameras/runtime - Get runtime state for all cameras
app.get('/api/cameras/runtime', (req, res) => {
  if (!cameraRuntimeState) {
    return res.status(503).json({ error: 'Camera runtime state not initialized' });
  }
  res.json(cameraRuntimeState.getAllState());
});

// POST /api/cameras/:id/reassign - Reassign apparatus to a camera
app.post('/api/cameras/:id/reassign', (req, res) => {
  if (!cameraRuntimeState) {
    return res.status(503).json({ error: 'Camera runtime state not initialized' });
  }
  const { apparatus, assignedBy } = req.body;
  if (!apparatus || !Array.isArray(apparatus)) {
    return res.status(400).json({ error: 'apparatus must be an array of apparatus codes' });
  }
  const result = cameraRuntimeState.reassignApparatus(req.params.id, apparatus, assignedBy);
  if (!result) {
    return res.status(404).json({ error: 'Camera not found', cameraId: req.params.id });
  }
  res.json(result);
});

// POST /api/cameras/:id/verify - Verify a camera
app.post('/api/cameras/:id/verify', (req, res) => {
  if (!cameraRuntimeState) {
    return res.status(503).json({ error: 'Camera runtime state not initialized' });
  }
  const { verifiedBy } = req.body || {};
  const result = cameraRuntimeState.verifyCamera(req.params.id, verifiedBy);
  if (!result) {
    return res.status(404).json({ error: 'Camera not found', cameraId: req.params.id });
  }
  res.json(result);
});

// GET /api/cameras/fallbacks - Get active fallbacks
app.get('/api/cameras/fallbacks', (req, res) => {
  if (!cameraFallbackManager) {
    return res.status(503).json({ error: 'Camera fallback manager not initialized' });
  }
  res.json(cameraFallbackManager.getActiveFallbacks());
});

// POST /api/cameras/:id/clear-fallback - Clear fallback for a camera
app.post('/api/cameras/:id/clear-fallback', (req, res) => {
  if (!cameraFallbackManager) {
    return res.status(503).json({ error: 'Camera fallback manager not initialized' });
  }
  const result = cameraFallbackManager.clearFallback(req.params.id);
  if (!result.success) {
    return res.status(404).json({ error: result.error, cameraId: req.params.id });
  }
  res.json(result);
});

// ============================================
// OBS Scene Generation API Endpoints
// ============================================

// POST /api/scenes/generate - Generate OBS scenes from camera config
app.post('/api/scenes/generate', async (req, res) => {
  if (!obsSceneGenerator) {
    return res.status(503).json({ error: 'Scene generator not initialized' });
  }
  if (!showState.obsConnected) {
    return res.status(503).json({ error: 'OBS not connected' });
  }

  try {
    const { types } = req.body || {};

    // If types are specified, generate only those scene types
    // Otherwise generate all scenes
    let results;
    if (types && Array.isArray(types) && types.length > 0) {
      // Generate scenes filtered by types
      // For filtered generation, we need to manually call each type
      results = {
        created: [],
        skipped: [],
        failed: [],
        summary: { created: 0, skipped: 0, failed: 0, total: 0 }
      };

      const graphicsUrl = obsSceneGenerator.buildGraphicsUrl();
      const cameras = obsSceneGenerator.cameras;

      // Helper to categorize results
      const categorize = (result) => {
        if (result.status === 'created') results.created.push(result);
        else if (result.status === 'skipped') results.skipped.push(result);
        else results.failed.push(result);
      };

      if (types.includes('static')) {
        for (const name of ['Starting Soon', 'BRB', 'Thanks for Watching']) {
          const result = await obsSceneGenerator.createStaticScene(name, graphicsUrl);
          categorize(result);
        }
      }

      if (types.includes('single')) {
        for (const camera of cameras) {
          const result = await obsSceneGenerator.createSingleCameraScene(camera, graphicsUrl);
          categorize(result);
        }
      }

      if (types.includes('dual') && cameras.length >= 2) {
        const combos = getCombinations(cameras, 2);
        for (const [cam1, cam2] of combos) {
          const result = await obsSceneGenerator.createDualCameraScene(cam1, cam2, graphicsUrl);
          categorize(result);
        }
      }

      if (types.includes('triple') && cameras.length >= 3) {
        const combos = getCombinations(cameras, 3);
        for (const [cam1, cam2, cam3] of combos) {
          const result = await obsSceneGenerator.createTriCameraScene(cam1, cam2, cam3, graphicsUrl);
          categorize(result);
        }
      }

      if (types.includes('quad') && cameras.length >= 4) {
        const combos = getCombinations(cameras, 4);
        for (const cams of combos) {
          const result = await obsSceneGenerator.createQuadCameraScene(cams, graphicsUrl);
          categorize(result);
        }
      }

      if (types.includes('graphics')) {
        const result = await obsSceneGenerator.createGraphicsFullscreenScene(graphicsUrl);
        categorize(result);
      }

      results.summary.created = results.created.length;
      results.summary.skipped = results.skipped.length;
      results.summary.failed = results.failed.length;
      results.summary.total = results.summary.created + results.summary.skipped + results.summary.failed;
    } else {
      // Generate all scenes
      results = await obsSceneGenerator.generateAllScenes();
    }

    res.json(results);
  } catch (error) {
    console.error('Scene generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function for combinations (used in filtered generation)
function getCombinations(arr, size) {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, size - 1).map(combo => [first, ...combo]);
  const withoutFirst = getCombinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

// GET /api/scenes/preview - Preview what scenes would be generated
app.get('/api/scenes/preview', (req, res) => {
  if (!obsSceneGenerator) {
    return res.status(503).json({ error: 'Scene generator not initialized' });
  }

  try {
    const types = req.query.types ? req.query.types.split(',') : undefined;
    const preview = obsSceneGenerator.previewScenes({ types });
    res.json(preview);
  } catch (error) {
    console.error('Scene preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/scenes/generated - Delete all generated scenes
app.delete('/api/scenes/generated', async (req, res) => {
  if (!obsSceneGenerator) {
    return res.status(503).json({ error: 'Scene generator not initialized' });
  }
  if (!showState.obsConnected) {
    return res.status(503).json({ error: 'OBS not connected' });
  }

  try {
    const results = await obsSceneGenerator.deleteGeneratedScenes();
    res.json(results);
  } catch (error) {
    console.error('Scene deletion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Timesheet Engine API Endpoints
// ============================================

// GET /api/timesheet/state - Get current timesheet state
app.get('/api/timesheet/state', (req, res) => {
  if (!timesheetEngine) {
    return res.status(503).json({ error: 'Timesheet engine not initialized' });
  }
  res.json(timesheetEngine.getState());
});

// GET /api/timesheet/overrides - Get timesheet override history
app.get('/api/timesheet/overrides', (req, res) => {
  if (!timesheetEngine) {
    return res.status(503).json({ error: 'Timesheet engine not initialized' });
  }
  res.json(timesheetEngine.getOverrides());
});

// GET /api/timesheet/history - Get segment history
app.get('/api/timesheet/history', (req, res) => {
  if (!timesheetEngine) {
    return res.status(503).json({ error: 'Timesheet engine not initialized' });
  }
  res.json(timesheetEngine.getHistory());
});

// POST /api/timesheet/start - Start the timesheet show
app.post('/api/timesheet/start', async (req, res) => {
  if (!timesheetEngine) {
    return res.status(503).json({ error: 'Timesheet engine not initialized' });
  }
  try {
    await timesheetEngine.start();
    res.json({ success: true, state: timesheetEngine.getState() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/timesheet/stop - Stop the timesheet show
app.post('/api/timesheet/stop', (req, res) => {
  if (!timesheetEngine) {
    return res.status(503).json({ error: 'Timesheet engine not initialized' });
  }
  timesheetEngine.stop();
  res.json({ success: true, state: timesheetEngine.getState() });
});

// POST /api/timesheet/advance - Advance to next segment
app.post('/api/timesheet/advance', async (req, res) => {
  if (!timesheetEngine) {
    return res.status(503).json({ error: 'Timesheet engine not initialized' });
  }
  const { advancedBy } = req.body || {};
  const success = await timesheetEngine.advance(advancedBy || 'api');
  if (!success) {
    return res.status(400).json({ error: 'Cannot advance segment', state: timesheetEngine.getState() });
  }
  res.json({ success: true, state: timesheetEngine.getState() });
});

// POST /api/timesheet/previous - Go to previous segment
app.post('/api/timesheet/previous', async (req, res) => {
  if (!timesheetEngine) {
    return res.status(503).json({ error: 'Timesheet engine not initialized' });
  }
  const { triggeredBy } = req.body || {};
  const success = await timesheetEngine.previous(triggeredBy || 'api');
  if (!success) {
    return res.status(400).json({ error: 'Cannot go to previous segment', state: timesheetEngine.getState() });
  }
  res.json({ success: true, state: timesheetEngine.getState() });
});

// POST /api/timesheet/jump - Jump to specific segment
app.post('/api/timesheet/jump', async (req, res) => {
  if (!timesheetEngine) {
    return res.status(503).json({ error: 'Timesheet engine not initialized' });
  }
  const { segmentId, triggeredBy } = req.body || {};
  if (!segmentId) {
    return res.status(400).json({ error: 'segmentId is required' });
  }
  const success = await timesheetEngine.goToSegment(segmentId, triggeredBy || 'api');
  if (!success) {
    return res.status(400).json({ error: `Cannot jump to segment: ${segmentId}`, state: timesheetEngine.getState() });
  }
  res.json({ success: true, state: timesheetEngine.getState() });
});

// ============================================
// Alert System API Endpoints
// ============================================

// GET /api/alerts/:compId - Get active alerts for a competition
app.get('/api/alerts/:compId', async (req, res) => {
  const { compId } = req.params;

  try {
    const alertService = getAlertService();

    if (!alertService.isInitialized()) {
      // Try to initialize
      try {
        await alertService.initialize();
      } catch (initError) {
        return res.status(503).json({
          error: 'Alert service not initialized',
          details: 'Firebase credentials not configured'
        });
      }
    }

    const alerts = await alertService.getActiveAlerts(compId);
    res.json(alerts);
  } catch (error) {
    console.error(`[Alerts API] Failed to get alerts for ${compId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/:compId/counts - Get alert counts for a competition
app.get('/api/alerts/:compId/counts', async (req, res) => {
  const { compId } = req.params;

  try {
    const alertService = getAlertService();

    if (!alertService.isInitialized()) {
      return res.status(503).json({
        error: 'Alert service not initialized',
        details: 'Firebase credentials not configured'
      });
    }

    const counts = await alertService.getAlertCounts(compId);
    res.json(counts);
  } catch (error) {
    console.error(`[Alerts API] Failed to get counts for ${compId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/:compId/all - Get all alerts (including resolved)
app.get('/api/alerts/:compId/all', async (req, res) => {
  const { compId } = req.params;
  const { includeResolved, limit } = req.query;

  try {
    const alertService = getAlertService();

    if (!alertService.isInitialized()) {
      return res.status(503).json({
        error: 'Alert service not initialized'
      });
    }

    const alerts = await alertService.getAllAlerts(compId, {
      includeResolved: includeResolved !== 'false',
      limit: limit ? parseInt(limit, 10) : 100
    });
    res.json(alerts);
  } catch (error) {
    console.error(`[Alerts API] Failed to get all alerts for ${compId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:compId - Create a new alert
app.post('/api/alerts/:compId', async (req, res) => {
  const { compId } = req.params;
  const { level, category, title, message, sourceId, metadata } = req.body;

  // Validate required fields
  if (!level || !category || !title || !message) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['level', 'category', 'title', 'message']
    });
  }

  // Validate level
  if (!Object.values(ALERT_LEVEL).includes(level)) {
    return res.status(400).json({
      error: `Invalid alert level: ${level}`,
      validLevels: Object.values(ALERT_LEVEL)
    });
  }

  // Validate category
  if (!Object.values(ALERT_CATEGORY).includes(category)) {
    return res.status(400).json({
      error: `Invalid alert category: ${category}`,
      validCategories: Object.values(ALERT_CATEGORY)
    });
  }

  try {
    const alertService = getAlertService();

    if (!alertService.isInitialized()) {
      try {
        await alertService.initialize();
      } catch (initError) {
        return res.status(503).json({
          error: 'Alert service not initialized',
          details: 'Firebase credentials not configured'
        });
      }
    }

    const alert = await alertService.createAlert(compId, {
      level,
      category,
      title,
      message,
      sourceId: sourceId || null,
      metadata: metadata || {}
    });

    res.json({ success: true, id: alert.id, alert });
  } catch (error) {
    console.error(`[Alerts API] Failed to create alert for ${compId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:compId/:alertId/acknowledge - Acknowledge an alert
app.post('/api/alerts/:compId/:alertId/acknowledge', async (req, res) => {
  const { compId, alertId } = req.params;
  const { acknowledgedBy } = req.body || {};

  try {
    const alertService = getAlertService();

    if (!alertService.isInitialized()) {
      return res.status(503).json({
        error: 'Alert service not initialized'
      });
    }

    const alert = await alertService.acknowledgeAlert(compId, alertId, acknowledgedBy || 'api');

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        alertId
      });
    }

    res.json({ success: true, acknowledged: true, alert });
  } catch (error) {
    console.error(`[Alerts API] Failed to acknowledge alert ${alertId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:compId/:alertId/resolve - Resolve an alert
app.post('/api/alerts/:compId/:alertId/resolve', async (req, res) => {
  const { compId, alertId } = req.params;
  const { resolvedBy } = req.body || {};

  try {
    const alertService = getAlertService();

    if (!alertService.isInitialized()) {
      return res.status(503).json({
        error: 'Alert service not initialized'
      });
    }

    const alert = await alertService.resolveAlert(compId, alertId, resolvedBy || 'api', false);

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        alertId
      });
    }

    res.json({ success: true, resolved: true, alert });
  } catch (error) {
    console.error(`[Alerts API] Failed to resolve alert ${alertId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:compId/resolve-by-source - Resolve alerts by source ID
app.post('/api/alerts/:compId/resolve-by-source', async (req, res) => {
  const { compId } = req.params;
  const { sourceId, resolvedBy } = req.body || {};

  if (!sourceId) {
    return res.status(400).json({
      error: 'sourceId is required'
    });
  }

  try {
    const alertService = getAlertService();

    if (!alertService.isInitialized()) {
      return res.status(503).json({
        error: 'Alert service not initialized'
      });
    }

    const count = await alertService.resolveBySourceId(compId, sourceId, resolvedBy || 'api');
    res.json({ success: true, count });
  } catch (error) {
    console.error(`[Alerts API] Failed to resolve by sourceId ${sourceId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:compId/acknowledge-all - Acknowledge all alerts
app.post('/api/alerts/:compId/acknowledge-all', async (req, res) => {
  const { compId } = req.params;
  const { acknowledgedBy } = req.body || {};

  try {
    const alertService = getAlertService();

    if (!alertService.isInitialized()) {
      return res.status(503).json({
        error: 'Alert service not initialized'
      });
    }

    const count = await alertService.acknowledgeAll(compId, acknowledgedBy || 'api');
    res.json({ success: true, count });
  } catch (error) {
    console.error(`[Alerts API] Failed to acknowledge all for ${compId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Coordinator Health API Endpoints
// ============================================

// GET /api/coordinator/status - Get coordinator health and status
app.get('/api/coordinator/status', async (req, res) => {
  updateLastActivity();

  const isCoordinatorMode = process.env.COORDINATOR_MODE === 'true';

  // Check Firebase connection status
  let firebaseStatus = 'unknown';
  try {
    if (productionConfigService.isAvailable()) {
      firebaseStatus = 'connected';
    } else {
      firebaseStatus = 'unavailable';
    }
  } catch (error) {
    firebaseStatus = 'error';
  }

  // Check AWS SDK status (can we reach EC2 API?)
  let awsStatus = 'unknown';
  try {
    const awsService = getAWSService();
    // Try a simple describe call with a filter that returns quickly
    await awsService.describeInstances({ limit: 1 });
    awsStatus = 'connected';
  } catch (error) {
    // Check if it's a credentials error vs network error
    if (error.name === 'CredentialsProviderError' || error.message?.includes('credentials')) {
      awsStatus = 'no_credentials';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      awsStatus = 'unreachable';
    } else {
      awsStatus = 'error';
    }
  }

  // Check OBS connection status
  const obsStatus = showState.obsConnected ? 'connected' : 'disconnected';

  // Get auto-shutdown status if initialized
  const autoShutdown = getAutoShutdownService();
  const autoShutdownStatus = autoShutdown.isInitialized() ? autoShutdown.getStatus() : null;

  // Build response
  // Include 'state' and 'appReady' fields for frontend compatibility
  // (frontend expects EC2-style state from Netlify functions)
  const status = {
    success: true,
    state: 'running',  // EC2-style state for frontend
    appReady: true,    // App is responding, so it's ready
    status: 'online',
    uptime: getUptime(),
    uptimeFormatted: formatUptime(getUptime()),
    version: SERVER_VERSION,
    mode: isCoordinatorMode ? 'coordinator' : 'standalone',
    lastActivity: new Date(lastActivityTimestamp).toISOString(),
    idleSeconds: getIdleTime(),
    idleMinutes: Math.floor(getIdleTime() / 60),
    publicIp: process.env.PUBLIC_IP || null,
    connections: {
      firebase: firebaseStatus,
      aws: awsStatus,
      obs: obsStatus
    },
    connectedClients: showState.connectedClients.length,
    autoShutdown: autoShutdownStatus
  };

  res.json(status);
});

// GET /api/coordinator/activity - Get last activity timestamp
app.get('/api/coordinator/activity', (req, res) => {
  res.json({
    lastActivity: new Date(lastActivityTimestamp).toISOString(),
    idleSeconds: getIdleTime()
  });
});

// POST /api/coordinator/activity - Update last activity timestamp (keep-alive)
app.post('/api/coordinator/activity', (req, res) => {
  updateLastActivity();
  res.json({
    success: true,
    lastActivity: new Date(lastActivityTimestamp).toISOString()
  });
});

// GET /api/coordinator/idle - Get detailed idle status for auto-shutdown (P19-02)
app.get('/api/coordinator/idle', (req, res) => {
  const autoShutdown = getAutoShutdownService();
  const idleSeconds = getIdleTime();
  const idleMinutes = Math.floor(idleSeconds / 60);

  // Get auto-shutdown config if available
  const autoShutdownStatus = autoShutdown.isInitialized() ? autoShutdown.getStatus() : null;

  res.json({
    idleSeconds,
    idleMinutes,
    lastActivity: new Date(lastActivityTimestamp).toISOString(),
    autoShutdown: autoShutdownStatus ? {
      enabled: autoShutdownStatus.enabled,
      timeoutMinutes: autoShutdownStatus.idleTimeoutMinutes,
      shutdownPending: autoShutdownStatus.shutdownPending,
      timeUntilShutdown: autoShutdownStatus.enabled
        ? Math.max(0, autoShutdownStatus.idleTimeoutMinutes - idleMinutes)
        : null
    } : null
  });
});

// POST /api/coordinator/keep-alive - Reset activity and cancel pending shutdown (P19-02)
app.post('/api/coordinator/keep-alive', (req, res) => {
  // Update local activity timestamp
  updateLastActivity();

  // Also update auto-shutdown service if initialized
  const autoShutdown = getAutoShutdownService();
  if (autoShutdown.isInitialized()) {
    autoShutdown.keepAlive();
  }

  res.json({
    success: true,
    lastActivity: new Date(lastActivityTimestamp).toISOString(),
    message: 'Keep-alive received, activity timestamp updated'
  });
});

/**
 * Format uptime seconds into human readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// CSV Upload endpoint
app.post('/api/import-csv', upload.single('csv'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Get show name from query param or first row or default
    const showName = req.body.showName || req.query.showName || 'Imported Show';

    // Convert CSV records to segments
    const segments = records.map((row, index) => {
      // Generate ID from name if not provided
      const id = row.id || row.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `segment-${index}`;

      // Parse duration (can be "mm:ss" format or just seconds)
      let duration = null;
      if (row.duration) {
        if (row.duration.includes(':')) {
          const [mins, secs] = row.duration.split(':').map(Number);
          duration = mins * 60 + secs;
        } else {
          duration = parseInt(row.duration) || null;
        }
      }

      // Parse autoAdvance (various true/false formats)
      const autoAdvance = ['true', 'yes', '1', 'auto'].includes(
        (row.autoAdvance || row.auto_advance || row.auto || '').toLowerCase()
      );

      // Build segment object
      const segment = {
        id,
        name: row.name || row.segment_name || row.title || `Segment ${index + 1}`,
        type: row.type || 'live',
        obsScene: row.obsScene || row.obs_scene || row.scene || null,
        duration,
        autoAdvance,
        notes: row.notes || row.description || null,
        videoFile: row.videoFile || row.video_file || row.video || null
      };

      // Add graphic if specified
      if (row.graphic) {
        segment.graphic = row.graphic;

        // Parse graphicData if provided as JSON string
        if (row.graphicData || row.graphic_data) {
          try {
            segment.graphicData = JSON.parse(row.graphicData || row.graphic_data);
          } catch (e) {
            // If not valid JSON, try to parse as key=value pairs
            const data = {};
            const dataStr = row.graphicData || row.graphic_data;
            if (dataStr.includes('=')) {
              dataStr.split(';').forEach(pair => {
                const [key, value] = pair.split('=');
                if (key && value) data[key.trim()] = value.trim();
              });
              segment.graphicData = data;
            }
          }
        }
      }

      return segment;
    });

    // Build the show config
    const newConfig = {
      showName,
      segments,
      sponsors: showConfig?.sponsors || {},
      quickActions: showConfig?.quickActions || []
    };

    // Save to file
    const configPath = join(__dirname, 'config', 'show-config.json');
    writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    // Reload config (the file watcher will also trigger this)
    loadShowConfig();
    broadcastState();

    res.json({
      success: true,
      message: `Imported ${segments.length} segments`,
      segments: segments.length,
      showName
    });

  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Virtius API proxy (avoids CORS issues)
app.get('/api/virtius/:sessionId', async (req, res) => {
  try {
    const response = await fetch(`https://api.virti.us/session/${req.params.sessionId}/json`);
    if (!response.ok) {
      return res.status(404).json({ error: 'Virtius session not found' });
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Virtius API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch Virtius session' });
  }
});

// Get CSV template
app.get('/api/csv-template', (req, res) => {
  const template = `id,name,type,obsScene,duration,autoAdvance,graphic,graphicData,videoFile,notes
intro,Show Intro,video,Video Scene,0:45,true,,,/path/to/videos/intro.mp4,Intro video plays automatically
welcome,Welcome & Host Intro,live,Talent Camera,,,,,,Welcome viewers and introduce sponsors
event-intro,Event Introduction,graphic,Graphics,8,true,event-bar,,,
team1-stats,Team 1 Stats,graphic,Graphics,10,true,team1-stats,,,
rotation1-floor,Floor Exercise Intro,graphic,Graphics,5,true,event-frame,frameTitle=FLOOR EXERCISE,,
rotation1-floor-live,Floor Exercise,live,Competition Camera,,,,,,Floor exercise routines
halftime-video,Halftime Video,video,Video Scene,2:00,true,,,/path/to/videos/halftime.mp4,Plays sponsor video
halftime,Halftime Break,live,BRB,5:00,false,,,,5 minute break
closing,Closing Remarks,live,Talent Camera,,,,,,Thank viewers and recap
outro,Thanks for Watching,video,Video Scene,0:15,false,,,/path/to/videos/outro.mp4,End card video`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="show-template.csv"');
  res.send(template);
});

// Setup OBS Scene CRUD API routes (OBS-06)
// Pass getter function for obsStateSync since it may be null until competition is activated
setupOBSRoutes(app, obs, () => obsStateSync);

// Redirect Netlify function paths to API endpoints (for compatibility when not on Netlify)
app.get('/.netlify/functions/coordinator-status', (req, res) => {
  res.redirect(307, '/api/coordinator/status');
});
app.post('/.netlify/functions/wake-coordinator', (req, res) => {
  res.redirect(307, '/api/coordinator/wake');
});
app.post('/.netlify/functions/stop-coordinator', (req, res) => {
  res.redirect(307, '/api/coordinator/stop');
});

// Serve React app for all other routes (Express 5 syntax)
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, '..', 'show-controller', 'dist', 'index.html'));
});

// Helper function to fetch and broadcast OBS state for a competition
async function broadcastOBSState(compId, obsConnManager, io) {
  const room = `competition:${compId}`;
  const compObs = obsConnManager.getConnection(compId);

  if (!compObs) {
    console.log(`[broadcastOBSState] No OBS connection for ${compId}`);
    return;
  }

  try {
    // Fetch scene list
    const sceneListResponse = await compObs.call('GetSceneList');
    const currentScene = sceneListResponse.currentProgramSceneName || null;

    // Fetch scene items for each scene
    const scenes = await Promise.all((sceneListResponse.scenes || []).map(async (scene) => {
      let items = [];
      try {
        const itemsResponse = await compObs.call('GetSceneItemList', { sceneName: scene.sceneName });
        items = (itemsResponse.sceneItems || []).map(item => ({
          id: item.sceneItemId,
          sourceName: item.sourceName,
          sourceType: item.sourceType,
          inputKind: item.inputKind,
          enabled: item.sceneItemEnabled,
          locked: item.sceneItemLocked,
          transform: item.sceneItemTransform
        }));
      } catch (itemError) {
        console.log(`[broadcastOBSState] Could not fetch items for scene ${scene.sceneName}: ${itemError.message}`);
      }
      return {
        name: scene.sceneName,
        uuid: scene.sceneUuid,
        index: scene.sceneIndex,
        items
      };
    }));

    // Fetch ALL inputs (sources)
    let inputs = [];
    let audioSources = [];
    try {
      const inputsResponse = await compObs.call('GetInputList');
      inputs = (inputsResponse.inputs || []).map(input => ({
        name: input.inputName,
        kind: input.inputKind,
        uuid: input.inputUuid
      }));
      // Also filter for audio sources separately
      audioSources = inputs.filter(input =>
        input.kind?.includes('audio') ||
        input.kind?.includes('wasapi') ||
        input.kind?.includes('pulse') ||
        input.kind?.includes('coreaudio')
      );
    } catch (audioError) {
      console.log(`[broadcastOBSState] Could not fetch inputs for ${compId}: ${audioError.message}`);
    }

    // Broadcast full state
    const obsState = {
      connected: true,
      connectionError: null,
      scenes,
      currentScene,
      inputs,
      audioSources,
      isStreaming: false,
      isRecording: false
    };

    console.log(`[broadcastOBSState] Broadcasting for ${compId}: ${scenes.length} scenes, current: ${currentScene}, inputs: ${inputs.length}`);
    io.to(room).emit('obs:stateUpdated', obsState);
  } catch (error) {
    console.error(`[broadcastOBSState] Failed to fetch state for ${compId}:`, error.message);
  }
}

// Socket.io connection handling
io.on('connection', async (socket) => {
  // Extract compId from connection query (sent by frontend)
  const clientCompId = socket.handshake.query.compId;
  console.log(`Client connected: ${socket.id} for competition: ${clientCompId || 'none'}`);

  // Track activity on every socket event using socket.io middleware
  socket.use((packet, next) => {
    updateLastActivity();
    const autoShutdown = getAutoShutdownService();
    if (autoShutdown.isInitialized()) {
      autoShutdown.resetActivity();
    }
    next();
  });

  // If client has a compId, try to connect to that competition's VM OBS
  if (clientCompId && clientCompId !== 'local') {
    try {
      // Join a room for this competition to receive targeted broadcasts
      socket.join(`competition:${clientCompId}`);

      // Look up VM for this competition
      const vmPoolManager = getVMPoolManager();
      if (vmPoolManager.isInitialized()) {
        const vm = vmPoolManager.getVMForCompetition(clientCompId);
        if (vm && vm.publicIp) {
          console.log(`[Socket] Competition ${clientCompId} has VM at ${vm.publicIp}`);

          // Connect to OBS on that VM (if not already connected)
          const obsConnManager = getOBSConnectionManager();
          if (!obsConnManager.isConnected(clientCompId)) {
            try {
              await obsConnManager.connectToVM(clientCompId, vm.publicIp);
              console.log(`[Socket] Connected to OBS for competition ${clientCompId}`);
            } catch (obsError) {
              console.warn(`[Socket] Failed to connect to OBS for ${clientCompId}: ${obsError.message}`);
              // Continue without OBS - some features won't work
            }
          }
        } else {
          console.log(`[Socket] No VM assigned to competition ${clientCompId}`);
        }
      }

      // Set active competition so REST API routes can access the competition ID
      configLoader.setActiveCompetition(clientCompId);
      console.log(`[Socket] Active competition set to ${clientCompId}`);

      // Initialize OBS State Sync for this competition (enables REST API routes)
      try {
        await initializeOBSStateSync(clientCompId);
        console.log(`[Socket] OBS State Sync initialized for competition ${clientCompId}`);
      } catch (syncError) {
        console.warn(`[Socket] Failed to initialize OBS State Sync for ${clientCompId}: ${syncError.message}`);
        // Continue - Socket.io events will still work, but REST API endpoints won't
      }
    } catch (error) {
      console.error(`[Socket] Error setting up competition ${clientCompId}:`, error.message);
    }
  }

  // Add client to list
  const clientInfo = {
    id: socket.id,
    role: 'unknown',
    name: 'Unknown',
    compId: clientCompId || null
  };
  showState.connectedClients.push(clientInfo);

  // Send initial state
  socket.emit('connected', {
    clientId: socket.id,
    state: {
      ...showState,
      showConfig: showConfig ? {
        showName: showConfig.showName,
        segments: showConfig.segments,
        sponsors: showConfig.sponsors
      } : null
    }
  });

  // Send initial camera state if available
  if (cameraHealthMonitor) {
    socket.emit('cameraHealth', cameraHealthMonitor.getAllHealth());
  }
  if (cameraRuntimeState) {
    socket.emit('cameraRuntimeState', cameraRuntimeState.getAllState());
  }
  if (cameraFallbackManager) {
    socket.emit('activeFallbacks', cameraFallbackManager.getActiveFallbacks());
  }

  // Send initial timesheet state if available
  if (timesheetEngine) {
    socket.emit('timesheetState', timesheetEngine.getState());
  }

  // Send initial OBS state if available
  // First, try to get OBS state from the competition's VM connection
  if (clientCompId && clientCompId !== 'local') {
    const obsConnManager = getOBSConnectionManager();
    const connState = obsConnManager.getConnectionState(clientCompId);
    if (connState) {
      socket.emit('obs:stateUpdated', {
        connected: connState.connected,
        connectionError: connState.error
      });
    }
  } else if (obsStateSync && obsStateSync.isInitialized()) {
    // Fall back to local OBS state
    socket.emit('obs:stateUpdated', obsStateSync.getState());
  }

  broadcastState();

  // Client identifies themselves
  socket.on('identify', ({ role, name }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client) {
      client.role = role;
      client.name = name;
      console.log(`Client ${socket.id} identified as ${role}: ${name}`);
      broadcastState();
    }
  });

  // Advance to next segment
  socket.on('advance', async () => {
    const success = await advanceSegment(socket.id);
    if (!success) {
      socket.emit('error', { message: 'Cannot advance' });
    }
  });

  // Go to previous segment
  socket.on('previous', async () => {
    const success = await previousSegment();
    if (!success) {
      socket.emit('error', { message: 'Cannot go back' });
    }
  });

  // Jump to specific segment
  socket.on('jumpTo', async ({ segmentId }) => {
    const success = await jumpToSegment(segmentId);
    if (!success) {
      socket.emit('error', { message: `Cannot jump to segment: ${segmentId}` });
    }
  });

  // Override scene (producer only)
  socket.on('overrideScene', async ({ sceneName }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can override scenes' });
      return;
    }

    const success = await switchScene(sceneName);
    if (!success) {
      socket.emit('error', { message: `Failed to switch to scene: ${sceneName}` });
    }
  });

  // Switch scene (alias for overrideScene - used by OBS Manager UI)
  socket.on('switchScene', async ({ sceneName }) => {
    console.log(`[switchScene] Received request to switch to: ${sceneName}`);
    const client = showState.connectedClients.find(c => c.id === socket.id);
    console.log(`[switchScene] Client:`, client ? { id: client.id, role: client.role, compId: client.compId } : 'not found');
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can switch scenes' });
      return;
    }

    // Get the client's competition ID to use the per-competition OBS connection
    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    // Use per-competition OBS connection
    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('SetCurrentProgramScene', { sceneName });
      console.log(`[switchScene] Switched to scene: ${sceneName} for ${clientCompId}`);
    } catch (error) {
      console.error(`[switchScene] Failed to switch scene: ${error.message}`);
      socket.emit('error', { message: `Failed to switch to scene: ${sceneName}` });
    }
  });

  // Create scene (producer only)
  socket.on('obs:createScene', async ({ sceneName }) => {
    console.log(`[createScene] Received request to create: ${sceneName}`);
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can create scenes' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('CreateScene', { sceneName });
      console.log(`[createScene] Created scene: ${sceneName} for ${clientCompId}`);
      // Broadcast updated state to all clients in this competition
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[createScene] Failed to create scene: ${error.message}`);
      socket.emit('error', { message: `Failed to create scene: ${sceneName}` });
    }
  });

  // Delete scene (producer only)
  socket.on('obs:deleteScene', async ({ sceneName }) => {
    console.log(`[deleteScene] Received request to delete: ${sceneName}`);
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can delete scenes' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('RemoveScene', { sceneName });
      console.log(`[deleteScene] Deleted scene: ${sceneName} for ${clientCompId}`);
      // Broadcast updated state to all clients in this competition
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[deleteScene] Failed to delete scene: ${error.message}`);
      socket.emit('error', { message: `Failed to delete scene: ${sceneName}` });
    }
  });

  // Reorder scenes in OBS
  socket.on('obs:reorderScenes', async ({ sceneNames }) => {
    console.log(`[reorderScenes] Received request to reorder scenes:`, sceneNames);
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can reorder scenes' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      // Get current scene list to get UUIDs
      const currentSceneList = await compObs.call('GetSceneList');
      const sceneMap = {};
      currentSceneList.scenes.forEach(scene => {
        sceneMap[scene.sceneName] = scene.sceneUuid;
      });

      // Build new scene list with UUIDs in requested order
      const newSceneList = sceneNames.map(name => ({
        sceneName: name,
        sceneUuid: sceneMap[name]
      })).filter(s => s.sceneUuid); // Only include scenes that exist

      // Note: OBS WebSocket expects scenes in reverse order (last = bottom of list in OBS)
      // The SetSceneList API orders scenes from bottom to top
      await compObs.call('SetSceneList', { scenes: newSceneList.reverse() });
      console.log(`[reorderScenes] Reordered ${newSceneList.length} scenes for ${clientCompId}`);

      // Broadcast updated state to all clients in this competition
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[reorderScenes] Failed to reorder scenes: ${error.message}`);
      socket.emit('error', { message: `Failed to reorder scenes: ${error.message}` });
    }
  });

  // Refresh OBS state (for Refresh button in UI)
  socket.on('obs:refreshState', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const clientCompId = client?.compId;

    if (!clientCompId) {
      console.log('[obs:refreshState] No competition ID for client');
      return;
    }

    console.log(`[obs:refreshState] Refreshing OBS state for ${clientCompId}`);
    const obsConnManager = getOBSConnectionManager();
    await broadcastOBSState(clientCompId, obsConnManager, io);
  });

  // Toggle scene item visibility
  socket.on('obs:toggleItemVisibility', async ({ sceneName, sceneItemId, enabled }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can toggle item visibility' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: enabled });
      console.log(`[toggleItemVisibility] Set item ${sceneItemId} in ${sceneName} to ${enabled ? 'visible' : 'hidden'} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[toggleItemVisibility] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to toggle visibility: ${error.message}` });
    }
  });

  // Toggle scene item lock
  socket.on('obs:toggleItemLock', async ({ sceneName, sceneItemId, locked }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can toggle item lock' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('SetSceneItemLocked', { sceneName, sceneItemId, sceneItemLocked: locked });
      console.log(`[toggleItemLock] Set item ${sceneItemId} in ${sceneName} to ${locked ? 'locked' : 'unlocked'} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[toggleItemLock] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to toggle lock: ${error.message}` });
    }
  });

  // Delete scene item
  socket.on('obs:deleteSceneItem', async ({ sceneName, sceneItemId }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can delete scene items' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('RemoveSceneItem', { sceneName, sceneItemId });
      console.log(`[deleteSceneItem] Removed item ${sceneItemId} from ${sceneName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[deleteSceneItem] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to delete scene item: ${error.message}` });
    }
  });

  // Reorder scene items
  socket.on('obs:reorderSceneItems', async ({ sceneName, sceneItemId, newIndex }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can reorder scene items' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('SetSceneItemIndex', { sceneName, sceneItemId, sceneItemIndex: newIndex });
      console.log(`[reorderSceneItems] Moved item ${sceneItemId} to index ${newIndex} in ${sceneName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[reorderSceneItems] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to reorder scene items: ${error.message}` });
    }
  });

  // Apply transform preset to scene item
  socket.on('obs:applyTransformPreset', async ({ sceneName, sceneItemId, transform }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can apply transform presets' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: transform });
      console.log(`[applyTransformPreset] Applied transform to item ${sceneItemId} in ${sceneName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[applyTransformPreset] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to apply transform: ${error.message}` });
    }
  });

  // Add source to scene
  socket.on('obs:addSourceToScene', async ({ sceneName, sourceName }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can add sources to scenes' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('CreateSceneItem', { sceneName, sourceName });
      console.log(`[addSourceToScene] Added source ${sourceName} to ${sceneName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[addSourceToScene] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to add source: ${error.message}` });
    }
  });

  // Duplicate scene
  socket.on('obs:duplicateScene', async ({ sceneName, newSceneName }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can duplicate scenes' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      // Get items from source scene
      const { sceneItems } = await compObs.call('GetSceneItemList', { sceneName });

      // Create new scene
      await compObs.call('CreateScene', { sceneName: newSceneName });

      // Add each item to new scene (in reverse order to maintain z-order)
      for (const item of sceneItems.reverse()) {
        try {
          const { sceneItemId } = await compObs.call('CreateSceneItem', {
            sceneName: newSceneName,
            sourceName: item.sourceName
          });
          // Apply original transform
          if (item.sceneItemTransform) {
            await compObs.call('SetSceneItemTransform', {
              sceneName: newSceneName,
              sceneItemId,
              sceneItemTransform: item.sceneItemTransform
            });
          }
          // Apply visibility
          await compObs.call('SetSceneItemEnabled', {
            sceneName: newSceneName,
            sceneItemId,
            sceneItemEnabled: item.sceneItemEnabled
          });
        } catch (itemError) {
          console.warn(`[duplicateScene] Could not copy item ${item.sourceName}: ${itemError.message}`);
        }
      }

      console.log(`[duplicateScene] Duplicated ${sceneName} to ${newSceneName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[duplicateScene] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to duplicate scene: ${error.message}` });
    }
  });

  // Rename scene (OBS doesn't have native rename, so we duplicate and delete)
  socket.on('obs:renameScene', async ({ sceneName, newSceneName }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can rename scenes' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      // Get items from source scene
      const { sceneItems } = await compObs.call('GetSceneItemList', { sceneName });

      // Create new scene with new name
      await compObs.call('CreateScene', { sceneName: newSceneName });

      // Copy each item to new scene
      for (const item of sceneItems.reverse()) {
        try {
          const { sceneItemId } = await compObs.call('CreateSceneItem', {
            sceneName: newSceneName,
            sourceName: item.sourceName
          });
          if (item.sceneItemTransform) {
            await compObs.call('SetSceneItemTransform', {
              sceneName: newSceneName,
              sceneItemId,
              sceneItemTransform: item.sceneItemTransform
            });
          }
          await compObs.call('SetSceneItemEnabled', {
            sceneName: newSceneName,
            sceneItemId,
            sceneItemEnabled: item.sceneItemEnabled
          });
        } catch (itemError) {
          console.warn(`[renameScene] Could not copy item ${item.sourceName}: ${itemError.message}`);
        }
      }

      // Delete original scene
      await compObs.call('RemoveScene', { sceneName });

      console.log(`[renameScene] Renamed ${sceneName} to ${newSceneName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[renameScene] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to rename scene: ${error.message}` });
    }
  });

  // Set audio monitor type
  socket.on('obs:setMonitorType', async ({ inputName, monitorType }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can change monitor type' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      await compObs.call('SetInputAudioMonitorType', { inputName, monitorType });
      console.log(`[setMonitorType] Set ${inputName} monitor type to ${monitorType} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[setMonitorType] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set monitor type: ${error.message}` });
    }
  });

  // Take screenshot of current output
  socket.on('obs:takeScreenshot', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can take screenshots' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      // Get current program scene name
      const { currentProgramSceneName } = await compObs.call('GetCurrentProgramScene');

      // Take screenshot of the current program scene
      const response = await compObs.call('GetSourceScreenshot', {
        sourceName: currentProgramSceneName,
        imageFormat: 'png',
        imageWidth: 1920,
        imageHeight: 1080
      });

      console.log(`[takeScreenshot] Captured screenshot of ${currentProgramSceneName} for ${clientCompId}`);

      // Emit screenshot data back to the client (base64 encoded PNG)
      socket.emit('obs:screenshotCaptured', {
        imageData: response.imageData,
        sceneName: currentProgramSceneName,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`[takeScreenshot] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to take screenshot: ${error.message}` });
    }
  });

  // Toggle talent lock
  socket.on('lockTalent', ({ locked }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can lock talent controls' });
      return;
    }

    showState.talentLocked = locked;
    console.log(`Talent controls ${locked ? 'locked' : 'unlocked'}`);
    broadcastState();
  });

  // Toggle pause
  socket.on('togglePause', () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can pause the show' });
      return;
    }

    showState.isPaused = !showState.isPaused;

    if (showState.isPaused) {
      clearAutoAdvance();
    } else if (showState.currentSegment?.autoAdvance && showState.currentSegment?.duration) {
      // Resume auto-advance with remaining time
      const elapsed = (Date.now() - showState.segmentStartTime) / 1000;
      const remaining = showState.currentSegment.duration - elapsed;
      if (remaining > 0) {
        setupAutoAdvance(remaining);
      }
    }

    console.log(`Show ${showState.isPaused ? 'paused' : 'resumed'}`);
    broadcastState();
  });

  // Trigger graphic manually
  socket.on('triggerGraphic', ({ graphic, data }) => {
    io.emit('triggerGraphic', { graphic, data });
    console.log(`Triggered graphic: ${graphic}`);
  });

  // Clear graphic
  socket.on('clearGraphic', () => {
    io.emit('clearGraphic');
    console.log('Cleared graphic');
  });

  // OBS State Sync: Refresh full state from OBS
  socket.on('obs:refreshState', async () => {
    if (obsStateSync && obsStateSync.isInitialized()) {
      try {
        console.log('Client requested OBS state refresh');
        await obsStateSync.refreshFullState();
      } catch (error) {
        console.error('Failed to refresh OBS state:', error);
        socket.emit('error', { message: 'Failed to refresh OBS state' });
      }
    } else {
      console.warn('OBS State Sync not initialized, cannot refresh state');
      socket.emit('error', { message: 'OBS State Sync not initialized' });
    }
  });

  // ============================================
  // Camera Management Socket Events
  // ============================================

  // Reassign apparatus to a camera
  socket.on('reassignApparatus', ({ cameraId, apparatus, assignedBy }) => {
    if (!cameraRuntimeState) {
      socket.emit('error', { message: 'Camera runtime state not initialized' });
      return;
    }
    if (!apparatus || !Array.isArray(apparatus)) {
      socket.emit('error', { message: 'apparatus must be an array of apparatus codes' });
      return;
    }
    const result = cameraRuntimeState.reassignApparatus(cameraId, apparatus, assignedBy || socket.id);
    if (!result) {
      socket.emit('error', { message: `Camera not found: ${cameraId}` });
      return;
    }
    console.log(`Socket: Apparatus reassigned for camera ${cameraId} to [${apparatus.join(', ')}]`);
  });

  // Verify a camera
  socket.on('verifyCamera', ({ cameraId, verifiedBy }) => {
    if (!cameraRuntimeState) {
      socket.emit('error', { message: 'Camera runtime state not initialized' });
      return;
    }
    const result = cameraRuntimeState.verifyCamera(cameraId, verifiedBy || socket.id);
    if (!result) {
      socket.emit('error', { message: `Camera not found: ${cameraId}` });
      return;
    }
    console.log(`Socket: Camera ${cameraId} verified by ${verifiedBy || socket.id}`);
  });

  // Clear fallback for a camera
  socket.on('clearFallback', ({ cameraId }) => {
    if (!cameraFallbackManager) {
      socket.emit('error', { message: 'Camera fallback manager not initialized' });
      return;
    }
    const result = cameraFallbackManager.clearFallback(cameraId);
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }
    console.log(`Socket: Fallback cleared for camera ${cameraId}`);
  });

  // Reset all camera verifications
  socket.on('resetVerifications', () => {
    if (!cameraRuntimeState) {
      socket.emit('error', { message: 'Camera runtime state not initialized' });
      return;
    }
    cameraRuntimeState.resetAllVerifications();
    console.log('Socket: All camera verifications reset');
  });

  // ============================================
  // Timesheet Engine Socket Events
  // ============================================

  // Start show via timesheet engine
  socket.on('startTimesheetShow', async () => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    await timesheetEngine.start();
    console.log('Socket: Timesheet show started');
  });

  // Stop show via timesheet engine
  socket.on('stopTimesheetShow', () => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    timesheetEngine.stop();
    console.log('Socket: Timesheet show stopped');
  });

  // Advance to next segment via timesheet engine
  socket.on('advanceSegment', async () => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const advancedBy = client?.name || socket.id;
    const success = await timesheetEngine.advance(advancedBy);
    if (!success) {
      socket.emit('error', { message: 'Cannot advance segment' });
    }
    console.log(`Socket: Segment advanced by ${advancedBy}`);
  });

  // Go to previous segment via timesheet engine
  socket.on('previousSegment', async () => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const triggeredBy = client?.name || socket.id;
    const success = await timesheetEngine.previous(triggeredBy);
    if (!success) {
      socket.emit('error', { message: 'Cannot go to previous segment' });
    }
    console.log(`Socket: Previous segment triggered by ${triggeredBy}`);
  });

  // Jump to specific segment via timesheet engine
  socket.on('goToSegment', async ({ segmentId }) => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    if (!segmentId) {
      socket.emit('error', { message: 'segmentId is required' });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const triggeredBy = client?.name || socket.id;
    const success = await timesheetEngine.goToSegment(segmentId, triggeredBy);
    if (!success) {
      socket.emit('error', { message: `Cannot jump to segment: ${segmentId}` });
    }
    console.log(`Socket: Jump to segment ${segmentId} by ${triggeredBy}`);
  });

  // Override scene via timesheet engine (producer only)
  socket.on('timesheetOverrideScene', async ({ sceneName }) => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can override scenes' });
      return;
    }
    const triggeredBy = client?.name || socket.id;
    const success = await timesheetEngine.overrideScene(sceneName, triggeredBy);
    if (!success) {
      socket.emit('error', { message: `Failed to override scene: ${sceneName}` });
    }
    console.log(`Socket: Scene overridden to ${sceneName} by ${triggeredBy}`);
  });

  // Override camera via timesheet engine (producer only)
  socket.on('overrideCamera', async ({ cameraId }) => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can override cameras' });
      return;
    }
    const triggeredBy = client?.name || socket.id;
    const success = await timesheetEngine.overrideCamera(cameraId, triggeredBy);
    if (!success) {
      socket.emit('error', { message: `Failed to override camera: ${cameraId}` });
    }
    console.log(`Socket: Camera overridden to ${cameraId} by ${triggeredBy}`);
  });

  // Get current timesheet state
  socket.on('getTimesheetState', () => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    socket.emit('timesheetState', timesheetEngine.getState());
  });

  // Get timesheet overrides history
  socket.on('getTimesheetOverrides', () => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    socket.emit('timesheetOverrides', timesheetEngine.getOverrides());
  });

  // Get timesheet segment history
  socket.on('getTimesheetHistory', () => {
    if (!timesheetEngine) {
      socket.emit('error', { message: 'Timesheet engine not initialized' });
      return;
    }
    socket.emit('timesheetHistory', timesheetEngine.getHistory());
  });

  // Start the show
  socket.on('startShow', async () => {
    showState.isPlaying = true;
    showState.isPaused = false;
    showState.currentSegmentIndex = 0;
    updateCurrentSegment();
    showState.segmentStartTime = Date.now();

    if (showState.currentSegment?.obsScene) {
      await switchScene(showState.currentSegment.obsScene);
    }

    if (showState.currentSegment?.graphic) {
      io.emit('triggerGraphic', {
        graphic: showState.currentSegment.graphic,
        data: showState.currentSegment.graphicData || {}
      });
    }

    if (showState.currentSegment?.autoAdvance && showState.currentSegment?.duration) {
      setupAutoAdvance(showState.currentSegment.duration);
    }

    console.log('Show started');
    broadcastState();
  });

  // Reset show
  socket.on('resetShow', () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can reset the show' });
      return;
    }

    clearAutoAdvance();
    showState.isPlaying = false;
    showState.isPaused = false;
    showState.currentSegmentIndex = 0;
    showState.segmentStartTime = null;
    showState.segmentElapsed = 0;
    updateCurrentSegment();

    console.log('Show reset');
    broadcastState();
  });

  // =====================================================
  // VM Pool Socket Events (P15-03)
  // =====================================================

  // Assign a VM to a competition
  socket.on('assignVM', async ({ competitionId, preferredVmId }) => {
    try {
      const vmPoolManager = getVMPoolManager();
      if (!vmPoolManager.isInitialized()) {
        socket.emit('vmError', { error: 'VM pool not initialized' });
        return;
      }

      const result = await vmPoolManager.assignVM(competitionId, preferredVmId);
      // vmAssigned event is emitted by the pool manager and will be broadcast via event listener
      socket.emit('vmAssignmentResult', result);
    } catch (error) {
      console.error(`[Socket] assignVM failed:`, error.message);
      socket.emit('vmError', {
        error: error.message,
        competitionId
      });
    }
  });

  // Release a VM from a competition
  socket.on('releaseVM', async ({ competitionId }) => {
    try {
      const vmPoolManager = getVMPoolManager();
      if (!vmPoolManager.isInitialized()) {
        socket.emit('vmError', { error: 'VM pool not initialized' });
        return;
      }

      const result = await vmPoolManager.releaseVM(competitionId);
      // vmReleased event is emitted by the pool manager and will be broadcast via event listener
      socket.emit('vmReleaseResult', result);
    } catch (error) {
      console.error(`[Socket] releaseVM failed:`, error.message);
      socket.emit('vmError', {
        error: error.message,
        competitionId
      });
    }
  });

  // Start a stopped VM
  socket.on('startVM', async ({ vmId }) => {
    try {
      const vmPoolManager = getVMPoolManager();
      if (!vmPoolManager.isInitialized()) {
        socket.emit('vmError', { error: 'VM pool not initialized' });
        return;
      }

      const result = await vmPoolManager.startVM(vmId);
      // vmStarting event is emitted by the pool manager and will be broadcast via event listener
      socket.emit('vmStartResult', result);
    } catch (error) {
      console.error(`[Socket] startVM failed:`, error.message);
      socket.emit('vmError', {
        error: error.message,
        vmId
      });
    }
  });

  // Stop a VM
  socket.on('stopVM', async ({ vmId }) => {
    try {
      const vmPoolManager = getVMPoolManager();
      if (!vmPoolManager.isInitialized()) {
        socket.emit('vmError', { error: 'VM pool not initialized' });
        return;
      }

      const result = await vmPoolManager.stopVM(vmId);
      // vmStopping event is emitted by the pool manager and will be broadcast via event listener
      socket.emit('vmStopResult', result);
    } catch (error) {
      console.error(`[Socket] stopVM failed:`, error.message);
      socket.emit('vmError', {
        error: error.message,
        vmId
      });
    }
  });

  // Acknowledge an alert (placeholder for P17)
  socket.on('acknowledgeAlert', ({ competitionId, alertId }) => {
    console.log(`[Socket] acknowledgeAlert: competition=${competitionId}, alert=${alertId}`);
    // Alert service will be implemented in P17-01
    // For now, just acknowledge receipt
    socket.emit('alertAcknowledged', { competitionId, alertId });
  });

  // Request current VM pool status
  socket.on('getVMPoolStatus', () => {
    try {
      const vmPoolManager = getVMPoolManager();
      if (!vmPoolManager.isInitialized()) {
        socket.emit('vmPoolStatus', {
          initialized: false,
          vms: [],
          counts: { total: 0 }
        });
        return;
      }

      socket.emit('vmPoolStatus', vmPoolManager.getPoolStatus());
    } catch (error) {
      console.error(`[Socket] getVMPoolStatus failed:`, error.message);
      socket.emit('vmError', { error: error.message });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    showState.connectedClients = showState.connectedClients.filter(c => c.id !== socket.id);
    broadcastState();
  });
});

// Update segment elapsed time every second
setInterval(() => {
  if (showState.isPlaying && !showState.isPaused && showState.segmentStartTime) {
    showState.segmentElapsed = Math.floor((Date.now() - showState.segmentStartTime) / 1000);
    io.emit('timeUpdate', { elapsed: showState.segmentElapsed });
  }
}, 1000);

// Initialize OBS Connection Manager event forwarding
function initializeOBSConnectionManager() {
  const obsConnManager = getOBSConnectionManager();

  // Forward OBS events to the appropriate competition room
  obsConnManager.on('obsEvent', ({ compId, eventName, data }) => {
    const room = `competition:${compId}`;
    console.log(`[OBSConnManager] Forwarding ${eventName} to room ${room}`);

    // Map OBS events to Socket.io events
    switch (eventName) {
      case 'CurrentProgramSceneChanged':
        io.to(room).emit('sceneChanged', data.sceneName);
        io.to(room).emit('obs:currentSceneChanged', { sceneName: data.sceneName });
        break;
      case 'SceneListChanged':
        io.to(room).emit('obs:sceneListChanged', data);
        break;
      case 'InputVolumeChanged':
        io.to(room).emit('obs:volumeChanged', {
          inputName: data.inputName,
          volumeDb: data.inputVolumeDb,
          volumeMul: data.inputVolumeMul
        });
        break;
      case 'InputMuteStateChanged':
        io.to(room).emit('obs:muteChanged', {
          inputName: data.inputName,
          muted: data.inputMuted
        });
        break;
      case 'StreamStateChanged':
        io.to(room).emit('obs:streamStateChanged', {
          active: data.outputActive,
          state: data.outputState
        });
        break;
      case 'RecordStateChanged':
        io.to(room).emit('obs:recordStateChanged', {
          active: data.outputActive,
          state: data.outputState
        });
        break;
      case 'StudioModeStateChanged':
        io.to(room).emit('obs:studioModeChanged', {
          studioModeEnabled: data.studioModeEnabled
        });
        break;
      case 'CurrentPreviewSceneChanged':
        io.to(room).emit('obs:previewSceneChanged', {
          sceneName: data.sceneName
        });
        break;
      default:
        // Forward unknown events generically
        io.to(room).emit(`obs:${eventName}`, data);
    }
  });

  // Handle connection events
  obsConnManager.on('connected', async ({ compId, vmAddress }) => {
    const room = `competition:${compId}`;
    io.to(room).emit('obs:connected', { connected: true, vmAddress });

    // Fetch and broadcast OBS state when connected
    await broadcastOBSState(compId, obsConnManager, io);
  });

  obsConnManager.on('disconnected', ({ compId }) => {
    const room = `competition:${compId}`;
    io.to(room).emit('obs:disconnected', { connected: false });
  });

  obsConnManager.on('connectionError', ({ compId, error }) => {
    const room = `competition:${compId}`;
    io.to(room).emit('obs:error', { error });
  });

  console.log('[Server] OBS Connection Manager initialized');
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`Show Controller Server running on port ${PORT}`);
  console.log(`Talent View: http://localhost:${PORT}/talent`);
  console.log(`Producer View: http://localhost:${PORT}/producer`);

  // Load and validate show config (exit if invalid on startup)
  loadShowConfig(true);

  // Initialize camera management modules
  initializeCameraModules();

  // Initialize OBS scene generator
  initializeSceneGenerator();

  // Initialize timesheet engine
  initializeTimesheetEngine();

  // Initialize VM pool manager (for VM management features)
  initializeVMPoolManager();

  // Initialize auto-shutdown service (for coordinator mode)
  initializeAutoShutdown();

  // Initialize OBS Connection Manager for per-competition OBS connections
  initializeOBSConnectionManager();

  // Connect to OBS (for local/default OBS)
  connectToOBS();
});
