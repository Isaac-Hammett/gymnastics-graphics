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

dotenv.config();

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
    } : null
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
app.post('/api/competitions/:id/activate', (req, res) => {
  const { id } = req.params;

  configLoader.setActiveCompetition(id);
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
    res.json(status.config || {});
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
    const result = await awsService.launchInstance({
      name: name || `gymnastics-vm-${Date.now()}`,
      instanceType,
      tags: {
        ...tags,
        Project: 'gymnastics-graphics',
        ManagedBy: 'vm-pool-manager'
      }
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

// Serve React app for all other routes (Express 5 syntax)
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, '..', 'show-controller', 'dist', 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Add client to list
  const clientInfo = {
    id: socket.id,
    role: 'unknown',
    name: 'Unknown'
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

  // Connect to OBS
  connectToOBS();
});
