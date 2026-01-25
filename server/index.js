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
import { DEFAULT_PRESETS } from './lib/obsAudioManager.js';
import { encryptStreamKey, decryptStreamKey, isEncryptedKey } from './lib/obsStreamManager.js';
import { mapEditorSegmentsToEngine, validateEngineSegments, diffSegments, detectDuplicateIds, deduplicateSegmentsById } from './lib/segmentMapper.js';
import aiSuggestionService from './lib/aiSuggestionService.js';
import { getOrCreateContextService, getContextService, removeContextService } from './lib/aiContextService.js';

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

// Timesheet Engines (per-competition Map for multi-competition support)
const timesheetEngines = new Map();
// Legacy single-engine reference (for backward compatibility during transition)
let timesheetEngine = null;

// Firebase rundown listeners (per-competition, for live sync - Phase I)
// Stores { unsubscribe: Function, lastSegments: Array } per compId
const rundownListeners = new Map();

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

  // Phase F: Task 64 - Audio cue triggered event (legacy)
  timesheetEngine.on('audioCueTriggered', (data) => {
    console.log(`Timesheet: Audio cue triggered - "${data.audioCue?.songName}"`);
    io.emit('timesheetAudioCueTriggered', data);
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

/**
 * Get or create a TimesheetEngine for a specific competition
 * This is the new multi-competition approach - each competition gets its own engine instance
 *
 * @param {string} compId - Competition ID
 * @param {Object} obsConnectionManager - OBS connection manager for per-competition OBS connections
 * @param {Object} firebase - Firebase database (from productionConfigService.getDb()) for graphics
 * @param {Object} socketIo - Socket.io server for broadcasting
 * @returns {TimesheetEngine} The engine instance for this competition
 *
 * @example
 * const engine = getOrCreateEngine(
 *   'abc123',
 *   obsConnectionManager,
 *   productionConfigService.getDb(),
 *   io
 * );
 */
function getOrCreateEngine(compId, obsConnectionManager, firebase, socketIo) {
  if (!compId) {
    throw new Error('compId is required to get or create a TimesheetEngine');
  }

  if (timesheetEngines.has(compId)) {
    return timesheetEngines.get(compId);
  }

  console.log(`[Timesheet] Creating new engine for competition: ${compId}`);
  console.log(`[Timesheet:${compId}] Firebase instance: ${firebase ? 'provided' : 'NOT PROVIDED'}`);
  console.log(`[Timesheet:${compId}] OBS Connection Manager: ${obsConnectionManager ? 'provided' : 'NOT PROVIDED'}`);

  const engine = new TimesheetEngine({
    compId,
    obsConnectionManager,
    firebase,
    io: socketIo,
    showConfig: { segments: [] } // Start with empty config - segments loaded via loadRundown
  });

  // Wire up timesheet events to broadcast to competition room only
  const roomName = `competition:${compId}`;

  engine.on('tick', (data) => {
    socketIo.to(roomName).emit('timesheetTick', data);
  });

  engine.on('segmentActivated', (data) => {
    console.log(`[Timesheet:${compId}] Segment activated - ${data.segment.name} (${data.reason})`);
    socketIo.to(roomName).emit('timesheetSegmentActivated', data);
    socketIo.to(roomName).emit('timesheetState', engine.getState());
  });

  engine.on('segmentCompleted', async (data) => {
    console.log(`[Timesheet:${compId}] Segment completed - ${data.segmentId} (${data.endReason})`);
    socketIo.to(roomName).emit('timesheetSegmentCompleted', data);

    // Task 38: Log actual segment duration to Firebase in real-time
    // This allows for incremental timing analytics even if the show doesn't complete normally
    if (firebase && compId && engine._currentRunId) {
      try {
        const db = typeof firebase.ref === 'function' ? firebase : firebase.database();
        const timingEntry = {
          segmentId: data.segmentId,
          segmentIndex: data.segmentIndex,
          actualDurationMs: data.durationMs,
          endReason: data.endReason,
          timestamp: Date.now()
        };

        // Push to the segmentTimings array for this run
        const timingsPath = `competitions/${compId}/production/rundown/analytics/${engine._currentRunId}/segmentTimings`;
        await db.ref(timingsPath).push(timingEntry);
        console.log(`[Timesheet:${compId}] Segment timing logged: ${data.segmentId} (${Math.round(data.durationMs / 1000)}s)`);
      } catch (error) {
        console.error(`[Timesheet:${compId}] Failed to log segment timing:`, error.message);
      }
    }
  });

  engine.on('showStarted', async (data) => {
    console.log(`[Timesheet:${compId}] Show started`);
    socketIo.to(roomName).emit('timesheetShowStarted', data);
    socketIo.to(roomName).emit('timesheetState', engine.getState());

    // Task 56: Start AI Context Service for real-time talking points
    try {
      const aiContextService = getOrCreateContextService(compId, {
        io: socketIo,
        engine: engine
      });
      await aiContextService.start();
      console.log(`[Timesheet:${compId}] AI Context Service started`);
    } catch (error) {
      console.error(`[Timesheet:${compId}] Failed to start AI Context Service:`, error.message);
    }

    // Task 38: Create initial run record for real-time timing analytics
    if (firebase && compId) {
      try {
        const runId = `run-${data.timestamp}`;
        engine._currentRunId = runId; // Store run ID on engine for segment timing writes

        const db = typeof firebase.ref === 'function' ? firebase : firebase.database();
        const initialRunData = {
          runId,
          compId,
          isRehearsal: engine.isRehearsalMode,
          startedAt: data.timestamp,
          totalSegments: data.segmentCount,
          status: 'running',
          segmentTimings: {} // Will be populated as segments complete
        };

        const runPath = `competitions/${compId}/production/rundown/analytics/${runId}`;
        await db.ref(runPath).set(initialRunData);
        console.log(`[Timesheet:${compId}] Run started, logging to ${runPath}`);
      } catch (error) {
        console.error(`[Timesheet:${compId}] Failed to create run record:`, error.message);
      }
    }
  });

  engine.on('showStopped', async (data) => {
    console.log(`[Timesheet:${compId}] Show stopped`);
    socketIo.to(roomName).emit('timesheetShowStopped', data);
    socketIo.to(roomName).emit('timesheetState', engine.getState());

    // Task 56: Stop AI Context Service when show stops
    const aiContextService = getContextService(compId);
    if (aiContextService) {
      aiContextService.stop();
      console.log(`[Timesheet:${compId}] AI Context Service stopped`);
    }

    // Save final timing analytics to Firebase for post-show/rehearsal analysis
    // Task 38: Use the run ID from showStarted (real-time logging) or create new if not available
    if (firebase && compId) {
      try {
        const history = engine.getHistory();
        const overrides = engine.getOverrides();
        const isRehearsal = engine.isRehearsalMode;

        // Use existing run ID from showStarted or create fallback
        const runId = engine._currentRunId || `run-${data.timestamp}`;

        // Calculate final analytics to update/merge with real-time data
        const finalAnalytics = {
          stoppedAt: data.timestamp,
          showDurationMs: data.showDurationMs,
          segmentsCompleted: data.segmentsCompleted,
          overrideCount: data.overrideCount,
          status: 'completed',
          // Full segment history with planned durations (enriches real-time segmentTimings)
          segments: history.map(h => ({
            segmentId: h.segmentId,
            segmentName: h.segmentName,
            segmentIndex: h.segmentIndex,
            actualDurationMs: h.durationMs,
            plannedDurationMs: h.plannedDurationMs,
            durationDeltaMs: h.plannedDurationMs ? h.durationMs - h.plannedDurationMs : null,
            endReason: h.endReason,
            startTime: h.startTime,
            endTime: h.endTime
          })),
          overrides: overrides.map(o => ({
            type: o.type,
            timestamp: o.timestamp,
            segmentId: o.segmentId,
            segmentIndex: o.segmentIndex,
            details: {
              fromSegmentId: o.fromSegmentId,
              toSegmentId: o.toSegmentId,
              advancedBy: o.advancedBy,
              triggeredBy: o.triggeredBy
            }
          })),
          summary: {
            totalPlannedDurationMs: history.reduce((sum, h) => sum + (h.plannedDurationMs || 0), 0),
            totalActualDurationMs: history.reduce((sum, h) => sum + (h.durationMs || 0), 0),
            autoAdvanceCount: history.filter(h => h.endReason === 'auto_advanced').length,
            manualAdvanceCount: history.filter(h => h.endReason === 'advanced').length,
            averageDurationDeltaMs: (() => {
              const segmentsWithPlanned = history.filter(h => h.plannedDurationMs);
              if (segmentsWithPlanned.length === 0) return null;
              const totalDelta = segmentsWithPlanned.reduce((sum, h) => sum + (h.durationMs - h.plannedDurationMs), 0);
              return Math.round(totalDelta / segmentsWithPlanned.length);
            })()
          }
        };

        // Update the existing run record (merges with real-time segmentTimings)
        const db = typeof firebase.ref === 'function' ? firebase : firebase.database();
        const analyticsPath = `competitions/${compId}/production/rundown/analytics/${runId}`;
        await db.ref(analyticsPath).update(finalAnalytics);
        console.log(`[Timesheet:${compId}] Timing analytics saved to ${analyticsPath} (${isRehearsal ? 'REHEARSAL' : 'LIVE'})`);

        // Clear the run ID now that the show is complete
        engine._currentRunId = null;
      } catch (error) {
        console.error(`[Timesheet:${compId}] Failed to save timing analytics:`, error.message);
      }
    }
  });

  engine.on('stateChanged', (data) => {
    socketIo.to(roomName).emit('timesheetStateChanged', data);
    socketIo.to(roomName).emit('timesheetState', engine.getState());
  });

  // Task 39: Handle show completion (all segments finished naturally)
  engine.on('showComplete', (data) => {
    console.log(`[Timesheet:${compId}] Show COMPLETE - all ${data.segmentsCompleted} segments finished`);
    socketIo.to(roomName).emit('timesheetShowComplete', data);
    socketIo.to(roomName).emit('timesheetState', engine.getState());
  });

  engine.on('holdStarted', (data) => {
    console.log(`[Timesheet:${compId}] Hold started - ${data.segmentId}`);
    socketIo.to(roomName).emit('timesheetHoldStarted', data);
  });

  engine.on('holdMaxReached', (data) => {
    console.log(`[Timesheet:${compId}] Hold max reached - ${data.segmentId}`);
    socketIo.to(roomName).emit('timesheetHoldMaxReached', data);
  });

  engine.on('autoAdvancing', (data) => {
    console.log(`[Timesheet:${compId}] Auto-advancing from ${data.fromSegmentId} to segment ${data.toSegmentIndex}`);
    socketIo.to(roomName).emit('timesheetAutoAdvancing', data);
  });

  engine.on('overrideRecorded', (data) => {
    console.log(`[Timesheet:${compId}] Override recorded - ${data.type}`);
    socketIo.to(roomName).emit('timesheetOverrideRecorded', data);
  });

  engine.on('sceneChanged', (data) => {
    socketIo.to(roomName).emit('timesheetSceneChanged', data);
  });

  engine.on('sceneOverridden', (data) => {
    console.log(`[Timesheet:${compId}] Scene overridden to ${data.sceneName}`);
    socketIo.to(roomName).emit('timesheetSceneOverridden', data);
  });

  engine.on('cameraOverridden', (data) => {
    console.log(`[Timesheet:${compId}] Camera overridden to ${data.cameraName}`);
    socketIo.to(roomName).emit('timesheetCameraOverridden', data);
  });

  engine.on('graphicTriggered', (data) => {
    socketIo.to(roomName).emit('timesheetGraphicTriggered', data);
  });

  engine.on('videoStarted', (data) => {
    socketIo.to(roomName).emit('timesheetVideoStarted', data);
  });

  // Phase F: Task 64 - Audio cue triggered event
  engine.on('audioCueTriggered', (data) => {
    console.log(`[Timesheet:${compId}] Audio cue triggered: "${data.audioCue?.songName}"`);
    socketIo.to(roomName).emit('timesheetAudioCueTriggered', data);
  });

  engine.on('breakStarted', (data) => {
    console.log(`[Timesheet:${compId}] Break started - ${data.segmentId}`);
    socketIo.to(roomName).emit('timesheetBreakStarted', data);
  });

  engine.on('error', (data) => {
    console.error(`[Timesheet:${compId}] Error: ${data.message}`);
    socketIo.to(roomName).emit('timesheetError', data);
  });

  engine.on('rehearsalModeChanged', (data) => {
    console.log(`[Timesheet:${compId}] Rehearsal mode changed: ${data.isRehearsalMode}`);
    socketIo.to(roomName).emit('rehearsalModeChanged', data);
    // Also broadcast updated state
    socketIo.to(roomName).emit('timesheetState', engine.getState());
  });

  // Task 35: Handle deleted current segment
  engine.on('currentSegmentDeleted', (data) => {
    console.log(`[Timesheet:${compId}] Current segment deleted: ${data.segmentName} (${data.segmentId})`);
    socketIo.to(roomName).emit('timesheetCurrentSegmentDeleted', data);
    // Also broadcast updated state so UI can show the warning
    socketIo.to(roomName).emit('timesheetState', engine.getState());
  });

  timesheetEngines.set(compId, engine);
  console.log(`[Timesheet] Engine created for competition: ${compId} (total engines: ${timesheetEngines.size})`);

  return engine;
}

/**
 * Get an existing TimesheetEngine for a competition (does not create)
 * @param {string} compId - Competition ID
 * @returns {TimesheetEngine|null} The engine instance or null if not found
 */
function getEngine(compId) {
  return timesheetEngines.get(compId) || null;
}

/**
 * Remove a TimesheetEngine for a competition
 * @param {string} compId - Competition ID
 */
function removeEngine(compId) {
  const engine = timesheetEngines.get(compId);
  if (engine) {
    // Stop the engine if running
    if (engine.isRunning) {
      engine.stop();
    }
    // Remove all listeners to prevent memory leaks
    engine.removeAllListeners();
    timesheetEngines.delete(compId);
    console.log(`[Timesheet] Engine removed for competition: ${compId} (remaining engines: ${timesheetEngines.size})`);
  }

  // Clean up Firebase rundown listener (Phase I - Task 28)
  const listener = rundownListeners.get(compId);
  if (listener && listener.unsubscribe) {
    listener.unsubscribe();
    rundownListeners.delete(compId);
    console.log(`[Timesheet] Rundown listener removed for competition: ${compId}`);
  }

  // Task 56: Clean up AI Context Service
  removeContextService(compId);
}

/**
 * Subscribe to Firebase rundown/segments changes for live sync (Phase I - Task 28)
 * Sets up a listener that detects when the rundown is modified in Firebase
 * @param {string} compId - Competition ID
 * @param {Object} db - Firebase database instance
 * @param {Array} initialSegments - The initially loaded segments (for comparison)
 */
function subscribeToRundownChanges(compId, db, initialSegments) {
  if (!compId || !db) {
    console.warn('[Timesheet] Cannot subscribe to rundown changes: missing compId or db');
    return;
  }

  // Remove existing listener if any (e.g., on reload)
  const existingListener = rundownListeners.get(compId);
  if (existingListener && existingListener.unsubscribe) {
    existingListener.unsubscribe();
    console.log(`[Timesheet] Removed existing rundown listener for competition: ${compId}`);
  }

  const segmentsPath = `competitions/${compId}/rundown/segments`;
  const segmentsRef = db.ref(segmentsPath);

  // Store the initial segments for comparison (Task 29 will use this)
  const listenerData = {
    lastSegments: initialSegments,
    unsubscribe: null
  };

  // Set up the Firebase listener
  const onValueCallback = (snapshot) => {
    const newSegmentsData = snapshot.val();

    // Skip the initial callback (we already have this data from loadRundown)
    if (!listenerData.hasReceivedInitial) {
      listenerData.hasReceivedInitial = true;
      console.log(`[Timesheet] Rundown listener initialized for competition: ${compId}`);
      return;
    }

    // Convert Firebase data to array
    let newSegments = [];
    if (newSegmentsData) {
      if (Array.isArray(newSegmentsData)) {
        newSegments = newSegmentsData;
      } else if (typeof newSegmentsData === 'object') {
        newSegments = Object.values(newSegmentsData);
      }
    }

    console.log(`[Timesheet] Rundown changed in Firebase for competition: ${compId} (${newSegments.length} segments)`);

    // Task 37: Detect and handle duplicate segment IDs in incoming data
    const duplicateCheck = detectDuplicateIds(newSegments);
    if (duplicateCheck.hasDuplicates) {
      console.warn(`[Timesheet] WARNING: Duplicate segment IDs in Firebase change for ${compId}:`);
      duplicateCheck.duplicates.forEach(dup => {
        console.warn(`  - ID "${dup.id}" appears ${dup.indices.length} times`);
      });

      // Deduplicate - keep only the first occurrence of each ID
      const { segments: dedupedSegments } = deduplicateSegmentsById(newSegments);
      newSegments = dedupedSegments;
    }

    // Compare new segments to last known segments using deep diff
    const diff = diffSegments(listenerData.lastSegments, newSegments);

    // Get the engine to check current position for filtering past segment changes (Task 36)
    const engine = getEngine(compId);
    const state = engine?.getState();
    const currentIndex = state?.currentSegmentIndex ?? -1;
    const currentSegmentId = state?.currentSegmentId;

    // Task 36: Filter out changes to past segments (already completed)
    // Past segments are those where BOTH old and new positions are before the current segment
    // These changes don't affect the current show execution
    const isPastSegment = (seg) => {
      // For reordered: both old and new index must be before current
      if (seg.oldIndex !== undefined && seg.newIndex !== undefined) {
        return seg.oldIndex < currentIndex && seg.newIndex < currentIndex;
      }
      // For modified: newIndex must be before current (unless it's the current segment)
      if (seg.newIndex !== undefined) {
        return seg.newIndex < currentIndex && seg.id !== currentSegmentId;
      }
      // For removed: index must be before current (unless it was the current segment)
      if (seg.index !== undefined) {
        return seg.index < currentIndex && seg.id !== currentSegmentId;
      }
      return false;
    };

    // Filter out past segment changes
    const filteredReordered = diff.reordered.filter(s => !isPastSegment(s));
    const filteredModified = diff.modified.filter(s => !isPastSegment(s));

    // Log what was filtered out for debugging
    const pastReordered = diff.reordered.filter(s => isPastSegment(s));
    const pastModified = diff.modified.filter(s => isPastSegment(s));

    if (pastReordered.length > 0 || pastModified.length > 0) {
      console.log(`[Timesheet] Ignoring changes to past segments (Task 36):`);
      if (pastReordered.length > 0) {
        console.log(`  Past reordered (ignored): ${pastReordered.map(s => s.name).join(', ')}`);
      }
      if (pastModified.length > 0) {
        console.log(`  Past modified (ignored): ${pastModified.map(s => s.name).join(', ')}`);
      }
    }

    // Create filtered diff with updated hasChanges
    const filteredDiff = {
      ...diff,
      reordered: filteredReordered,
      modified: filteredModified,
      hasChanges: diff.added.length > 0 || diff.removed.length > 0 ||
                  filteredModified.length > 0 || filteredReordered.length > 0
    };

    // Rebuild summary for filtered diff
    const summaryParts = [];
    if (filteredDiff.added.length > 0) summaryParts.push(`${filteredDiff.added.length} added`);
    if (filteredDiff.removed.length > 0) summaryParts.push(`${filteredDiff.removed.length} removed`);
    if (filteredDiff.modified.length > 0) summaryParts.push(`${filteredDiff.modified.length} modified`);
    if (filteredDiff.reordered.length > 0) summaryParts.push(`${filteredDiff.reordered.length} reordered`);
    filteredDiff.summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'No changes';

    if (filteredDiff.hasChanges) {
      console.log(`[Timesheet] Rundown diff for ${compId}: ${filteredDiff.summary}`);
      if (filteredDiff.added.length > 0) {
        console.log(`  Added: ${filteredDiff.added.map(s => s.name).join(', ')}`);
      }
      if (filteredDiff.removed.length > 0) {
        console.log(`  Removed: ${filteredDiff.removed.map(s => s.name).join(', ')}`);
      }
      if (filteredDiff.modified.length > 0) {
        console.log(`  Modified: ${filteredDiff.modified.map(s => `${s.name} (${s.changedFields.join(', ')})`).join(', ')}`);
      }
      if (filteredDiff.reordered.length > 0) {
        console.log(`  Reordered: ${filteredDiff.reordered.map(s => `${s.name} (${s.oldIndex} → ${s.newIndex})`).join(', ')}`);
      }

      // Store the filtered diff result
      listenerData.lastDiff = filteredDiff;

      if (engine) {
        // Determine if changes affect current or upcoming segments
        const affectsCurrent = filteredDiff.removed.some(s => s.id === currentSegmentId) ||
                              filteredDiff.modified.some(s => s.id === currentSegmentId);

        // Segments after current position are "upcoming"
        const affectsUpcoming = filteredDiff.added.length > 0 ||
                               filteredDiff.modified.some(s => s.newIndex > currentIndex) ||
                               filteredDiff.reordered.some(s => s.newIndex > currentIndex);

        // Store extended diff info
        listenerData.lastDiff = {
          ...filteredDiff,
          affectsCurrent,
          affectsUpcoming,
          currentSegmentId,
          currentSegmentIndex: currentIndex
        };

        console.log(`[Timesheet] Affects current: ${affectsCurrent}, affects upcoming: ${affectsUpcoming}`);

        // Emit rundownModified socket event to all clients in this competition room
        const rundownModifiedEvent = {
          added: filteredDiff.added.map(s => s.id),
          removed: filteredDiff.removed.map(s => s.id),
          modified: filteredDiff.modified.map(s => s.id),
          reordered: filteredDiff.reordered.map(s => s.id),
          affectsCurrent,
          affectsUpcoming,
          summary: filteredDiff.summary,
          timestamp: new Date().toISOString(),
          // Include detailed change info for confirmation dialog
          details: {
            added: filteredDiff.added.map(s => ({ id: s.id, name: s.name })),
            removed: filteredDiff.removed.map(s => ({ id: s.id, name: s.name })),
            modified: filteredDiff.modified.map(s => ({ id: s.id, name: s.name, changedFields: s.changedFields })),
            reordered: filteredDiff.reordered.map(s => ({ id: s.id, name: s.name, oldIndex: s.oldIndex, newIndex: s.newIndex }))
          }
        };

        io.to(`competition:${compId}`).emit('rundownModified', rundownModifiedEvent);
        console.log(`[Timesheet] Emitted rundownModified event to competition:${compId}`);
      }
    } else {
      console.log(`[Timesheet] Rundown content unchanged for ${compId} (no relevant changes after filtering past segments)`);
    }

    // Store the new segments for the next comparison
    listenerData.lastSegments = newSegments;
  };

  // Start listening
  segmentsRef.on('value', onValueCallback);

  // Store the unsubscribe function
  listenerData.unsubscribe = () => {
    segmentsRef.off('value', onValueCallback);
  };

  rundownListeners.set(compId, listenerData);
  console.log(`[Timesheet] Subscribed to rundown changes for competition: ${compId}`);
}

/**
 * Get the current rundown listener data for a competition
 * @param {string} compId - Competition ID
 * @returns {Object|null} Listener data with lastSegments, or null if not found
 */
function getRundownListener(compId) {
  return rundownListeners.get(compId) || null;
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

  // Sync legacy showState.obsCurrentScene from new system
  obsStateSync.on('currentSceneChanged', ({ sceneName }) => {
    showState.obsCurrentScene = sceneName;
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
// Note: CurrentProgramSceneChanged is now handled by obsStateSync (line ~3670)
// Legacy showState.obsCurrentScene is synced via obsStateSync.on('currentSceneChanged')

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

// GET /api/vm/:compId/status - Proxy VM status check (avoids Mixed Content in production)
// Frontend calls this instead of hitting the VM directly
app.get('/api/vm/:compId/status', async (req, res) => {
  const { compId } = req.params;

  try {
    const vmPoolManager = getVMPoolManager();
    if (!vmPoolManager.isInitialized()) {
      return res.json({ online: false, noVm: true, error: 'VM pool not initialized' });
    }

    // Find VM assigned to this competition
    let vm = null;
    for (const [, v] of vmPoolManager._vms) {
      if (v.assignedTo === compId) {
        vm = v;
        break;
      }
    }

    if (!vm || !vm.publicIp) {
      return res.json({ online: false, noVm: true });
    }

    // Server-side request to VM (no Mixed Content issues)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`http://${vm.publicIp}:3003/api/status`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return res.json({
          online: true,
          obsConnected: data.obsConnected || false,
          uptime: data.uptime,
          version: data.version
        });
      }
      return res.json({ online: false, error: `HTTP ${response.status}` });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorMessage = fetchError.name === 'AbortError' ? 'Request timeout' : fetchError.message;
      return res.json({ online: false, error: errorMessage });
    }
  } catch (error) {
    console.error(`[API] Failed to check VM status for ${compId}:`, error);
    res.json({ online: false, error: error.message });
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

// Helper function to categorize scene by name (for coordinator)
// Note: This function mirrors the categorization logic from obsStateSync.js
// but operates independently since obsStateSync is only for local development
function categorizeSceneByName(sceneName, templateScenes = []) {
  if (!sceneName) {
    return 'manual';
  }

  // Check if scene is in templateScenes list (from Firebase)
  if (templateScenes && templateScenes.includes(sceneName)) {
    return 'template';
  }

  const name = sceneName.toLowerCase();

  // Generated single-camera scenes
  // Template patterns: "Full Screen - Camera X", "Replay - Camera X"
  // Legacy patterns: "Single - Camera X"
  if (name.startsWith('full screen - ') ||
      name.startsWith('replay - ') ||
      name.startsWith('single - ')) {
    return 'generated-single';
  }

  // Generated multi-camera scenes
  // Template patterns: "Dual View - ...", "Triple View - ...", "Quad View"
  // Legacy patterns: "Dual - ...", "Triple - ...", "Quad - ..."
  if (name.startsWith('dual view') ||
      name.startsWith('triple view') ||
      name.startsWith('quad view') ||
      name === 'quad view' ||
      name.startsWith('dual - ') ||
      name.startsWith('triple - ') ||
      name.startsWith('quad - ')) {
    return 'generated-multi';
  }

  // Static production scenes
  // Template patterns: "Stream Starting Soon", "End Stream"
  // Legacy patterns: "Starting Soon", "BRB", "Thanks for Watching", "Be Right Back"
  const staticScenes = ['starting soon', 'brb', 'thanks for watching', 'be right back', 'end stream'];
  if (staticScenes.some(s => name.includes(s))) {
    return 'static';
  }

  // Graphics-only scenes
  // Template pattern: "Web-graphics-only-no-video"
  // Legacy pattern: "Graphics Fullscreen"
  if (name.includes('graphics fullscreen') ||
      name.includes('web-graphics-only') ||
      name.includes('graphics-only')) {
    return 'graphics';
  }

  // Everything else is manual
  return 'manual';
}

// Helper function to fetch and broadcast OBS state for a competition
async function broadcastOBSState(compId, obsConnManager, io) {
  const room = `competition:${compId}`;
  const compObs = obsConnManager.getConnection(compId);

  if (!compObs) {
    console.log(`[broadcastOBSState] No OBS connection for ${compId}`);
    return;
  }

  try {
    // Fetch template scenes from Firebase for proper categorization
    let templateScenes = [];
    try {
      const db = productionConfigService.getDb();
      if (db) {
        const snapshot = await db.ref(`competitions/${compId}/obs/templateScenes`).once('value');
        templateScenes = snapshot.val() || [];
        if (!Array.isArray(templateScenes)) {
          templateScenes = [];
        }
      }
    } catch (fbError) {
      console.log(`[broadcastOBSState] Could not fetch template scenes: ${fbError.message}`);
    }

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
        sceneName: scene.sceneName, // Include both for compatibility
        uuid: scene.sceneUuid,
        index: scene.sceneIndex,
        items,
        category: categorizeSceneByName(scene.sceneName, templateScenes)
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
      // Include sources that can produce audio: dedicated audio, media sources, and browser sources
      const audioInputs = inputs.filter(input =>
        input.kind?.includes('audio') ||
        input.kind?.includes('wasapi') ||
        input.kind?.includes('pulse') ||
        input.kind?.includes('coreaudio') ||
        input.kind === 'ffmpeg_source' ||     // Media sources (video files, SRT streams)
        input.kind === 'browser_source'        // Browser sources (VDO.Ninja talent)
      );

      // Fetch volume/mute/monitor status for each audio source
      audioSources = await Promise.all(audioInputs.map(async (input) => {
        try {
          const [volumeRes, muteRes, monitorRes] = await Promise.all([
            compObs.call('GetInputVolume', { inputName: input.name }),
            compObs.call('GetInputMute', { inputName: input.name }),
            compObs.call('GetInputAudioMonitorType', { inputName: input.name })
          ]);
          return {
            inputName: input.name,
            kind: input.kind,
            uuid: input.uuid,
            volumeDb: volumeRes.inputVolumeDb ?? 0,
            volumeMul: volumeRes.inputVolumeMul ?? 1,
            muted: muteRes.inputMuted ?? false,
            monitorType: monitorRes.monitorType ?? 'OBS_MONITORING_TYPE_NONE'
          };
        } catch (e) {
          // Source might not have audio capabilities - skip it
          console.log(`[broadcastOBSState] Skipping audio source ${input.name}: ${e.message}`);
          return null;
        }
      }));
      // Filter out nulls (sources that don't have audio)
      audioSources = audioSources.filter(s => s !== null);
    } catch (audioError) {
      console.log(`[broadcastOBSState] Could not fetch inputs for ${compId}: ${audioError.message}`);
    }

    // Fetch transitions (PRD-OBS-05: Transition Management)
    let transitions = [];
    let currentTransition = null;
    let transitionDuration = 300;
    try {
      const transitionResponse = await compObs.call('GetSceneTransitionList');
      transitions = (transitionResponse.transitions || []).map(t => ({
        name: t.transitionName,
        kind: t.transitionKind,
        configurable: t.transitionConfigurable || false
      }));
      currentTransition = transitionResponse.currentSceneTransitionName;
      transitionDuration = transitionResponse.currentSceneTransitionDuration || 300;
    } catch (transitionError) {
      console.log(`[broadcastOBSState] Could not fetch transitions for ${compId}: ${transitionError.message}`);
    }

    // Fetch studio mode state (PRD-OBS-11: Advanced Features)
    let studioModeEnabled = false;
    let previewScene = null;
    try {
      const studioModeResponse = await compObs.call('GetStudioModeEnabled');
      studioModeEnabled = studioModeResponse.studioModeEnabled || false;

      if (studioModeEnabled) {
        const previewResponse = await compObs.call('GetCurrentPreviewScene');
        previewScene = previewResponse.currentPreviewSceneName || null;
      }
    } catch (studioError) {
      console.log(`[broadcastOBSState] Could not fetch studio mode state for ${compId}: ${studioError.message}`);
    }

    // Broadcast full state
    const obsState = {
      connected: true,
      connectionError: null,
      scenes,
      currentScene,
      previewScene,
      studioModeEnabled,
      inputs,
      audioSources,
      transitions,
      currentTransition,
      transitionDuration,
      isStreaming: false,
      isRecording: false
    };

    console.log(`[broadcastOBSState] Broadcasting for ${compId}: ${scenes.length} scenes, current: ${currentScene}, studioMode: ${studioModeEnabled}, inputs: ${inputs.length}`);
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

  // Send initial timesheet state if available (use competition-specific engine)
  const compTimesheetEngine = clientCompId ? getEngine(clientCompId) : timesheetEngine;
  if (compTimesheetEngine) {
    socket.emit('timesheetState', compTimesheetEngine.getState());
  }

  // Send initial OBS state if available
  // First, try to get OBS state from the competition's VM connection
  if (clientCompId && clientCompId !== 'local') {
    const obsConnManager = getOBSConnectionManager();
    const connState = obsConnManager.getConnectionState(clientCompId);
    if (connState) {
      // Send basic connection info immediately
      socket.emit('obs:stateUpdated', {
        connected: connState.connected,
        connectionError: connState.error
      });
      // If connected, also broadcast full OBS state (scenes, current scene, etc.)
      if (connState.connected) {
        broadcastOBSState(clientCompId, obsConnManager, io);
      }
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

  // Create scene (producer only) - supports creating from template
  socket.on('obs:createScene', async ({ sceneName, templateId }) => {
    console.log(`[createScene] Received request to create: ${sceneName}${templateId ? ` from template ${templateId}` : ''}`);
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
      // Create the scene first
      await compObs.call('CreateScene', { sceneName });
      console.log(`[createScene] Created scene: ${sceneName} for ${clientCompId}`);

      // If templateId is provided, copy sources from template to the new scene
      if (templateId) {
        try {
          // Fetch the template from Firebase via productionConfigService
          productionConfigService.initialize();
          if (productionConfigService.isAvailable()) {
            // Use Firebase Admin SDK directly to read template
            const admin = await import('firebase-admin');
            const database = admin.default.database();
            const templateRef = database.ref(`templates/obs/${templateId}`);
            const snapshot = await templateRef.once('value');
            const template = snapshot.val();

            if (template && template.scenes && template.scenes.length > 0) {
              // Use the first scene from the template as the source configuration
              const templateScene = template.scenes[0];
              const items = templateScene.items || templateScene.sceneItems || [];

              console.log(`[createScene] Copying ${items.length} items from template to ${sceneName}`);

              // Add each item from the template to the new scene
              for (const item of items) {
                try {
                  // CreateSceneItem adds an existing input to the scene
                  await compObs.call('CreateSceneItem', {
                    sceneName: sceneName,
                    sourceName: item.sourceName,
                    sceneItemEnabled: item.sceneItemEnabled !== undefined ? item.sceneItemEnabled : true
                  });
                  console.log(`[createScene] Added source ${item.sourceName} to ${sceneName}`);
                } catch (itemError) {
                  // Source might not exist - that's okay, just log and continue
                  console.warn(`[createScene] Could not add source ${item.sourceName}: ${itemError.message}`);
                }
              }
              console.log(`[createScene] Created scene from template: ${sceneName} for ${clientCompId}`);

              // Store scene name in templateScenes list in Firebase for proper categorization
              try {
                const templateScenesRef = database.ref(`competitions/${clientCompId}/obs/templateScenes`);
                const templateScenesSnapshot = await templateScenesRef.once('value');
                let templateScenes = templateScenesSnapshot.val() || [];
                if (!Array.isArray(templateScenes)) {
                  templateScenes = [];
                }
                if (!templateScenes.includes(sceneName)) {
                  templateScenes.push(sceneName);
                  await templateScenesRef.set(templateScenes);
                  console.log(`[createScene] Added ${sceneName} to templateScenes list`);
                }
              } catch (fbError) {
                console.warn(`[createScene] Could not update templateScenes list: ${fbError.message}`);
              }
            } else {
              console.warn(`[createScene] Template ${templateId} has no scenes, created empty scene`);
            }
          } else {
            console.warn('[createScene] Firebase not available, created empty scene');
          }
        } catch (templateError) {
          // Template copy failed but scene was created - log warning but don't fail
          console.warn(`[createScene] Failed to copy template content: ${templateError.message}`);
          socket.emit('obs:warning', { message: `Scene created but template copy failed: ${templateError.message}` });
        }
      }

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

      // Remove scene from templateScenes list in Firebase if present
      try {
        const db = productionConfigService.getDb();
        if (db) {
          const templateScenesRef = db.ref(`competitions/${clientCompId}/obs/templateScenes`);
          const templateScenesSnapshot = await templateScenesRef.once('value');
          let templateScenes = templateScenesSnapshot.val() || [];
          if (Array.isArray(templateScenes) && templateScenes.includes(sceneName)) {
            templateScenes = templateScenes.filter(s => s !== sceneName);
            await templateScenesRef.set(templateScenes);
            console.log(`[deleteScene] Removed ${sceneName} from templateScenes list`);
          }
        }
      } catch (fbError) {
        console.warn(`[deleteScene] Could not update templateScenes list: ${fbError.message}`);
      }

      // Broadcast updated state to all clients in this competition
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[deleteScene] Failed to delete scene: ${error.message}`);
      socket.emit('error', { message: `Failed to delete scene: ${sceneName}` });
    }
  });

  // Delete all scenes (producer only)
  socket.on('obs:deleteAllScenes', async () => {
    console.log(`[deleteAllScenes] Received request to delete all scenes`);
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
      // Get all scenes
      const sceneListResponse = await compObs.call('GetSceneList');
      const scenes = sceneListResponse.scenes || [];
      const currentScene = sceneListResponse.currentProgramSceneName;

      if (scenes.length === 0) {
        socket.emit('obs:deleteAllScenesResult', { success: true, deletedCount: 0, message: 'No scenes to delete' });
        return;
      }

      // OBS requires at least one scene, so we need to create a temporary scene first
      // if we're deleting everything
      const tempSceneName = '__temp_delete_all__';

      // Check if temp scene already exists (from a previous failed attempt)
      const tempSceneExists = scenes.some(s => (s.sceneName || s.name) === tempSceneName);

      if (!tempSceneExists) {
        await compObs.call('CreateScene', { sceneName: tempSceneName });
      }

      // Switch to the temp scene so we can delete all others
      await compObs.call('SetCurrentProgramScene', { sceneName: tempSceneName });

      let deletedCount = 0;
      const errors = [];

      // Delete all original scenes (skip the temp scene if it was pre-existing)
      for (const scene of scenes) {
        const sceneName = scene.sceneName || scene.name;
        // Skip the temp scene - we'll rename it at the end
        if (sceneName === tempSceneName) {
          continue;
        }
        try {
          await compObs.call('RemoveScene', { sceneName });
          deletedCount++;
          console.log(`[deleteAllScenes] Deleted scene: ${sceneName}`);
        } catch (err) {
          console.error(`[deleteAllScenes] Failed to delete scene ${sceneName}: ${err.message}`);
          errors.push({ sceneName, error: err.message });
        }
      }

      // Now delete the temp scene - this will fail because OBS requires at least one scene
      // But that's actually what we want for a clean slate - one empty scene
      // Rename the temp scene to something more user-friendly
      try {
        // Try "Scene 1", then "Scene 2", etc. until we find an available name
        let renamed = false;
        for (let i = 1; i <= 10 && !renamed; i++) {
          try {
            const newName = i === 1 ? 'Scene 1' : `Scene ${i}`;
            await compObs.call('SetSceneName', { sceneName: tempSceneName, newSceneName: newName });
            renamed = true;
            console.log(`[deleteAllScenes] Renamed temp scene to: ${newName}`);
          } catch (renameErr) {
            // Scene name might already exist, try next number
            if (i === 10) {
              console.warn(`[deleteAllScenes] Could not rename temp scene after 10 attempts`);
            }
          }
        }
      } catch (err) {
        // If rename fails, just leave it
        console.warn(`[deleteAllScenes] Could not rename temp scene: ${err.message}`);
      }

      // Clear templateScenes list in Firebase
      try {
        const db = productionConfigService.getDb();
        if (db) {
          const templateScenesRef = db.ref(`competitions/${clientCompId}/obs/templateScenes`);
          await templateScenesRef.set([]);
          console.log(`[deleteAllScenes] Cleared templateScenes list`);
        }
      } catch (fbError) {
        console.warn(`[deleteAllScenes] Could not clear templateScenes list: ${fbError.message}`);
      }

      console.log(`[deleteAllScenes] Deleted ${deletedCount} scenes for ${clientCompId}`);
      socket.emit('obs:deleteAllScenesResult', {
        success: errors.length === 0,
        deletedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Deleted ${deletedCount} scenes${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
      });

      // Broadcast updated state to all clients in this competition
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[deleteAllScenes] Failed to delete all scenes: ${error.message}`);
      socket.emit('error', { message: `Failed to delete all scenes: ${error.message}` });
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

  // Create a new input/source in OBS
  socket.on('obs:createInput', async ({ inputName, inputKind, inputSettings, sceneName }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can create inputs' });
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
      // CreateInput with sceneName will create the input AND add it to the scene
      const params = {
        inputName,
        inputKind,
        inputSettings: inputSettings || {}
      };

      if (sceneName) {
        params.sceneName = sceneName;
      }

      const result = await compObs.call('CreateInput', params);
      console.log(`[createInput] Created input ${inputName} (${inputKind})${sceneName ? ` in scene ${sceneName}` : ''} for ${clientCompId}`, result);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[createInput] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to create input: ${error.message}` });
    }
  });

  // Remove an input entirely from OBS (PRD-OBS-03: Source Management)
  socket.on('obs:removeInput', async ({ inputName }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can remove inputs' });
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
      // RemoveInput removes the input from OBS entirely (from all scenes)
      await compObs.call('RemoveInput', { inputName });
      console.log(`[removeInput] Removed input ${inputName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[removeInput] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to remove input: ${error.message}` });
    }
  });

  // Update input settings (PRD-OBS-03: Source Management)
  socket.on('obs:updateInputSettings', async ({ inputName, inputSettings }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can update input settings' });
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
      // SetInputSettings with overlay: true merges with existing settings
      await compObs.call('SetInputSettings', { inputName, inputSettings, overlay: true });
      console.log(`[updateInputSettings] Updated settings for ${inputName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[updateInputSettings] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to update input settings: ${error.message}` });
    }
  });

  // Get input settings (for SourceEditor to load current values)
  socket.on('obs:getInputSettings', async ({ inputName }, callback) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const clientCompId = client?.compId;

    if (!clientCompId) {
      if (callback) callback({ error: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      if (callback) callback({ error: 'OBS not connected for this competition' });
      return;
    }

    try {
      const response = await compObs.call('GetInputSettings', { inputName });
      console.log(`[getInputSettings] Retrieved settings for ${inputName} for ${clientCompId}`);
      if (callback) {
        callback({
          inputKind: response.inputKind,
          inputSettings: response.inputSettings
        });
      }
    } catch (error) {
      console.error(`[getInputSettings] Failed: ${error.message}`);
      if (callback) callback({ error: error.message });
    }
  });

  // Set scene item transform (PRD-OBS-03: Source Management)
  socket.on('obs:setSceneItemTransform', async ({ sceneName, sceneItemId, transform }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can set scene item transforms' });
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
      console.log(`[setSceneItemTransform] Updated transform for item ${sceneItemId} in ${sceneName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[setSceneItemTransform] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set scene item transform: ${error.message}` });
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

  // Set audio input volume (PRD-OBS-04: Audio Management)
  socket.on('obs:setVolume', async ({ inputName, volumeDb, volumeMul }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can change volume' });
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
      // Build payload - prefer volumeDb if provided, otherwise use volumeMul
      const payload = { inputName };
      if (volumeDb !== undefined) {
        payload.inputVolumeDb = volumeDb;
      } else if (volumeMul !== undefined) {
        payload.inputVolumeMul = volumeMul;
      } else {
        socket.emit('error', { message: 'Must provide volumeDb or volumeMul' });
        return;
      }

      await compObs.call('SetInputVolume', payload);
      console.log(`[setVolume] Set ${inputName} volume to ${volumeDb !== undefined ? volumeDb + 'dB' : volumeMul} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[setVolume] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set volume: ${error.message}` });
    }
  });

  // Set audio input mute state (PRD-OBS-04: Audio Management)
  socket.on('obs:setMute', async ({ inputName, muted }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can mute/unmute audio' });
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
      await compObs.call('SetInputMute', { inputName, inputMuted: muted });
      console.log(`[setMute] Set ${inputName} muted=${muted} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[setMute] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set mute: ${error.message}` });
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

  // Subscribe/unsubscribe from real-time audio level updates (Phase 2)
  socket.on('obs:subscribeAudioLevels', ({ enabled }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const clientCompId = client?.compId;

    if (!clientCompId) {
      console.log(`[subscribeAudioLevels] No compId for socket ${socket.id}`);
      return;
    }

    const obsConnManager = getOBSConnectionManager();

    if (enabled) {
      obsConnManager.subscribeAudioLevels(clientCompId, socket.id);
      console.log(`[subscribeAudioLevels] ${socket.id} subscribed to audio levels for ${clientCompId}`);
    } else {
      obsConnManager.unsubscribeAudioLevels(clientCompId, socket.id);
      console.log(`[subscribeAudioLevels] ${socket.id} unsubscribed from audio levels for ${clientCompId}`);
    }
  });

  // ============================================================================
  // Audio Preset Management (PRD-OBS-04 Phase 1.5)
  // ============================================================================

  // Apply an audio preset (default or user-created)
  socket.on('obs:applyPreset', async ({ presetId }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const clientCompId = client?.compId;

    if (!clientCompId) {
      socket.emit('obs:error', { message: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const connection = obsConnManager.getConnection(clientCompId);

    if (!connection || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('obs:error', { message: 'OBS not connected for this competition' });
      return;
    }

    try {
      console.log(`[applyPreset] Applying preset ${presetId} for ${clientCompId}`);

      // 1. Check default presets first
      let preset = DEFAULT_PRESETS[presetId];

      // 2. If not default, load from Firebase
      if (!preset && productionConfigService.isAvailable()) {
        const db = productionConfigService.getDb();
        const snapshot = await db.ref(`competitions/${clientCompId}/obs/presets/${presetId}`).once('value');
        preset = snapshot.val();
      }

      if (!preset) {
        socket.emit('obs:error', { message: `Preset not found: ${presetId}` });
        return;
      }

      // 3. Apply each source setting via OBS WebSocket
      const sources = Array.isArray(preset.sources) ? preset.sources : Object.values(preset.sources || {});
      let applied = 0;
      const errors = [];

      for (const source of sources) {
        try {
          if (source.volumeDb !== undefined) {
            await connection.call('SetInputVolume', {
              inputName: source.inputName,
              inputVolumeDb: source.volumeDb
            });
          }
          if (source.muted !== undefined) {
            await connection.call('SetInputMute', {
              inputName: source.inputName,
              inputMuted: source.muted
            });
          }
          applied++;
        } catch (err) {
          console.warn(`[applyPreset] Failed to apply to ${source.inputName}: ${err.message}`);
          errors.push({ inputName: source.inputName, error: err.message });
        }
      }

      // 4. Broadcast state update to all clients
      await broadcastOBSState(clientCompId, obsConnManager, io);

      // 5. Send success response
      socket.emit('obs:presetApplied', {
        presetId,
        presetName: preset.name,
        applied,
        total: sources.length,
        errors
      });

      console.log(`[applyPreset] Applied preset "${preset.name}": ${applied}/${sources.length} sources for ${clientCompId}`);
    } catch (error) {
      console.error(`[applyPreset] Error applying preset ${presetId}:`, error.message);
      socket.emit('obs:error', { message: `Failed to apply preset: ${error.message}` });
    }
  });

  // List all audio presets (default + user-created)
  socket.on('obs:listPresets', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const clientCompId = client?.compId;

    if (!clientCompId) {
      socket.emit('obs:error', { message: 'No competition ID for client' });
      return;
    }

    try {
      console.log(`[listPresets] Listing presets for ${clientCompId}`);

      // Get default presets
      const defaultPresets = Object.values(DEFAULT_PRESETS).map(p => ({
        ...p,
        isDefault: true
      }));

      // Get user presets from Firebase
      let userPresets = [];
      if (productionConfigService.isAvailable()) {
        const db = productionConfigService.getDb();
        const snapshot = await db.ref(`competitions/${clientCompId}/obs/presets`).once('value');
        const presetsData = snapshot.val();
        if (presetsData) {
          userPresets = Object.entries(presetsData).map(([id, preset]) => ({
            ...preset,
            id,
            isDefault: false
          }));
        }
      }

      const allPresets = [...defaultPresets, ...userPresets];
      socket.emit('obs:presetsList', { presets: allPresets });

      console.log(`[listPresets] Sent ${allPresets.length} presets (${defaultPresets.length} default, ${userPresets.length} user) for ${clientCompId}`);
    } catch (error) {
      console.error(`[listPresets] Error listing presets:`, error.message);
      socket.emit('obs:error', { message: `Failed to list presets: ${error.message}` });
    }
  });

  // Save current audio mix as a new preset
  socket.on('obs:savePreset', async ({ name, description, sources }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const clientCompId = client?.compId;

    if (!clientCompId) {
      socket.emit('obs:error', { message: 'No competition ID for client' });
      return;
    }

    if (!productionConfigService.isAvailable()) {
      socket.emit('obs:error', { message: 'Firebase not available' });
      return;
    }

    if (!name || !sources || Object.keys(sources).length === 0) {
      socket.emit('obs:error', { message: 'Name and sources are required' });
      return;
    }

    try {
      console.log(`[savePreset] Saving preset "${name}" for ${clientCompId}`);

      const db = productionConfigService.getDb();
      const presetId = `user-${Date.now()}`;

      // Convert sources object to array format
      const sourcesArray = Object.entries(sources).map(([inputName, settings]) => ({
        inputName,
        ...settings
      }));

      const preset = {
        id: presetId,
        name,
        description: description || '',
        sources: sourcesArray,
        createdAt: new Date().toISOString(),
        isDefault: false
      };

      await db.ref(`competitions/${clientCompId}/obs/presets/${presetId}`).set(preset);

      socket.emit('obs:presetSaved', { preset });
      console.log(`[savePreset] Saved preset "${name}" (${presetId}) for ${clientCompId}`);
    } catch (error) {
      console.error(`[savePreset] Error saving preset:`, error.message);
      socket.emit('obs:error', { message: `Failed to save preset: ${error.message}` });
    }
  });

  // Delete a user-created preset
  socket.on('obs:deletePreset', async ({ presetId }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const clientCompId = client?.compId;

    if (!clientCompId) {
      socket.emit('obs:error', { message: 'No competition ID for client' });
      return;
    }

    if (!productionConfigService.isAvailable()) {
      socket.emit('obs:error', { message: 'Firebase not available' });
      return;
    }

    // Prevent deletion of default presets
    if (DEFAULT_PRESETS[presetId]) {
      socket.emit('obs:error', { message: 'Cannot delete default presets' });
      return;
    }

    try {
      console.log(`[deletePreset] Deleting preset ${presetId} for ${clientCompId}`);

      const db = productionConfigService.getDb();
      await db.ref(`competitions/${clientCompId}/obs/presets/${presetId}`).remove();

      socket.emit('obs:presetDeleted', { presetId });
      console.log(`[deletePreset] Deleted preset ${presetId} for ${clientCompId}`);
    } catch (error) {
      console.error(`[deletePreset] Error deleting preset:`, error.message);
      socket.emit('obs:error', { message: `Failed to delete preset: ${error.message}` });
    }
  });

  // ============================================================================
  // Transition Management (PRD-OBS-05)
  // ============================================================================

  // Get available transitions
  socket.on('obs:getTransitions', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
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
      const response = await compObs.call('GetSceneTransitionList');
      const transitions = (response.transitions || []).map(t => ({
        name: t.transitionName,
        kind: t.transitionKind,
        configurable: t.transitionConfigurable || false
      }));
      socket.emit('obs:transitionsList', {
        transitions,
        currentTransition: response.currentSceneTransitionName,
        transitionDuration: response.currentSceneTransitionDuration || 300
      });
      console.log(`[getTransitions] Sent ${transitions.length} transitions for ${clientCompId}`);
    } catch (error) {
      console.error(`[getTransitions] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to get transitions: ${error.message}` });
    }
  });

  // Set current transition (PRD-OBS-05)
  socket.on('obs:setCurrentTransition', async ({ transitionName }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can change transitions' });
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
      await compObs.call('SetCurrentSceneTransition', { transitionName });
      console.log(`[setCurrentTransition] Set transition to ${transitionName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[setCurrentTransition] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set transition: ${error.message}` });
    }
  });

  // Set transition duration (PRD-OBS-05)
  socket.on('obs:setTransitionDuration', async ({ transitionDuration }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can change transition duration' });
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
      await compObs.call('SetCurrentSceneTransitionDuration', { transitionDuration });
      console.log(`[setTransitionDuration] Set duration to ${transitionDuration}ms for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[setTransitionDuration] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set transition duration: ${error.message}` });
    }
  });

  // Set transition settings (PRD-OBS-05)
  socket.on('obs:setTransitionSettings', async ({ transitionName, transitionSettings }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can change transition settings' });
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
      await compObs.call('SetCurrentSceneTransitionSettings', {
        transitionSettings,
        overlay: true
      });
      console.log(`[setTransitionSettings] Updated settings for ${transitionName} for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[setTransitionSettings] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set transition settings: ${error.message}` });
    }
  });

  // Get transition settings (PRD-OBS-11: Stinger Transitions)
  socket.on('obs:getTransitionSettings', async ({ transitionName }, callback) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const clientCompId = client?.compId;
    if (!clientCompId) {
      if (callback) callback({ error: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      if (callback) callback({ error: 'OBS not connected for this competition' });
      return;
    }

    try {
      const response = await compObs.call('GetCurrentSceneTransitionSettings');
      console.log(`[getTransitionSettings] Retrieved settings for ${transitionName} for ${clientCompId}`);
      if (callback) {
        callback({
          transitionName: response.transitionName,
          transitionSettings: response.transitionSettings,
          transitionKind: response.transitionKind
        });
      }
    } catch (error) {
      console.error(`[getTransitionSettings] Failed: ${error.message}`);
      if (callback) callback({ error: `Failed to get transition settings: ${error.message}` });
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

  // ============================================================================
  // Preview System (PRD-OBS-09)
  // ============================================================================

  // Request screenshot for preview (with configurable options)
  socket.on('obs:requestScreenshot', async (options = {}) => {
    const { sceneName = null, imageWidth = 640, imageHeight = 360, imageFormat = 'jpg' } = options;

    // Get compId from socket handshake query (same as other handlers)
    const clientCompId = socket.handshake?.query?.compId;
    if (!clientCompId) {
      socket.emit('obs:screenshotError', { error: 'No competition ID for client' });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('obs:screenshotError', { error: 'OBS not connected for this competition' });
      return;
    }

    try {
      // Get target scene name - use provided sceneName or get current program scene
      let targetScene = sceneName;
      if (!targetScene) {
        const { currentProgramSceneName } = await compObs.call('GetCurrentProgramScene');
        targetScene = currentProgramSceneName;
      }

      // Take screenshot with specified options
      const response = await compObs.call('GetSourceScreenshot', {
        sourceName: targetScene,
        imageFormat: imageFormat === 'jpg' ? 'jpeg' : imageFormat,
        imageWidth,
        imageHeight
      });

      console.log(`[requestScreenshot] Captured ${imageWidth}x${imageHeight} ${imageFormat} of ${targetScene} for ${clientCompId}`);

      // Emit screenshot data back to the requesting client
      socket.emit('obs:screenshotData', {
        success: true,
        imageData: response.imageData,
        sceneName: targetScene,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`[requestScreenshot] Failed: ${error.message}`);
      socket.emit('obs:screenshotError', {
        error: error.message,
        sceneName
      });
    }
  });

  // Request scene thumbnail (PRD-OBS-11: Scene Thumbnails)
  socket.on('obs:requestSceneThumbnail', async (options = {}) => {
    const { sceneName, imageWidth = 80, imageHeight = 45, isHoverPreview = false } = options;

    if (!sceneName) {
      socket.emit('obs:sceneThumbnailError', { error: 'Scene name required', sceneName, isHoverPreview });
      return;
    }

    // Get compId from socket handshake query
    const clientCompId = socket.handshake?.query?.compId;
    if (!clientCompId) {
      socket.emit('obs:sceneThumbnailError', { error: 'No competition ID', sceneName, isHoverPreview });
      return;
    }

    const obsConnManager = getOBSConnectionManager();
    const compObs = obsConnManager.getConnection(clientCompId);

    if (!compObs || !obsConnManager.isConnected(clientCompId)) {
      socket.emit('obs:sceneThumbnailError', { error: 'OBS not connected', sceneName, isHoverPreview });
      return;
    }

    try {
      const response = await compObs.call('GetSourceScreenshot', {
        sourceName: sceneName,
        imageFormat: 'jpeg',
        imageWidth,
        imageHeight
      });

      socket.emit('obs:sceneThumbnailData', {
        success: true,
        imageData: response.imageData,
        sceneName,
        isHoverPreview,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`[requestSceneThumbnail] Failed for ${sceneName}: ${error.message}`);
      socket.emit('obs:sceneThumbnailError', {
        error: error.message,
        sceneName,
        isHoverPreview
      });
    }
  });

  // ============================================================================
  // Studio Mode (PRD-OBS-11: Advanced Features)
  // ============================================================================

  // Enable studio mode
  socket.on('obs:enableStudioMode', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can enable studio mode' });
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
      await compObs.call('SetStudioModeEnabled', { studioModeEnabled: true });
      console.log(`[enableStudioMode] Studio mode enabled for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[enableStudioMode] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to enable studio mode: ${error.message}` });
    }
  });

  // Disable studio mode
  socket.on('obs:disableStudioMode', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can disable studio mode' });
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
      await compObs.call('SetStudioModeEnabled', { studioModeEnabled: false });
      console.log(`[disableStudioMode] Studio mode disabled for ${clientCompId}`);
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[disableStudioMode] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to disable studio mode: ${error.message}` });
    }
  });

  // Set preview scene (only works in studio mode)
  socket.on('obs:setPreviewScene', async ({ sceneName }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can set preview scene' });
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
      await compObs.call('SetCurrentPreviewScene', { sceneName });
      console.log(`[setPreviewScene] Preview scene set to ${sceneName} for ${clientCompId}`);
      // Broadcast updated state (will include new previewScene)
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[setPreviewScene] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set preview scene: ${error.message}` });
    }
  });

  // Transition preview to program (only works in studio mode)
  socket.on('obs:transitionToProgram', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can transition to program' });
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
      await compObs.call('TriggerStudioModeTransition');
      console.log(`[transitionToProgram] Triggered transition for ${clientCompId}`);
      // State will be updated by OBS events (CurrentProgramSceneChanged, etc.)
    } catch (error) {
      console.error(`[transitionToProgram] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to transition: ${error.message}` });
    }
  });

  // ============================================================================
  // Template Auto-Loading (PRD-OBS-11)
  // ============================================================================

  // Set a template as default for specific meet types
  socket.on('obs:setTemplateDefault', async ({ templateId, meetTypes }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can set template defaults' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    if (!templateId || !Array.isArray(meetTypes) || meetTypes.length === 0) {
      socket.emit('error', { message: 'Template ID and meet types array are required' });
      return;
    }

    try {
      productionConfigService.initialize();
      if (!productionConfigService.isAvailable()) {
        socket.emit('error', { message: 'Firebase not available' });
        return;
      }

      const database = productionConfigService.getDb();

      // Get the template to verify it exists
      const templateRef = database.ref(`templates/obs/${templateId}`);
      const templateSnapshot = await templateRef.once('value');
      const template = templateSnapshot.val();

      if (!template) {
        socket.emit('error', { message: `Template not found: ${templateId}` });
        return;
      }

      // Clear this default from any other templates for the same meet types
      const allTemplatesRef = database.ref('templates/obs');
      const allTemplatesSnapshot = await allTemplatesRef.once('value');
      const allTemplates = allTemplatesSnapshot.val() || {};

      for (const [otherTemplateId, otherTemplate] of Object.entries(allTemplates)) {
        if (otherTemplateId !== templateId && otherTemplate.isDefaultFor) {
          // Remove overlapping meet types from other templates
          const updatedIsDefaultFor = otherTemplate.isDefaultFor.filter(mt => !meetTypes.includes(mt));
          if (updatedIsDefaultFor.length !== otherTemplate.isDefaultFor.length) {
            await database.ref(`templates/obs/${otherTemplateId}/isDefaultFor`).set(
              updatedIsDefaultFor.length > 0 ? updatedIsDefaultFor : null
            );
            console.log(`[setTemplateDefault] Cleared ${meetTypes.filter(mt => otherTemplate.isDefaultFor.includes(mt)).join(', ')} from ${otherTemplateId}`);
          }
        }
      }

      // Set the new default
      const currentIsDefaultFor = template.isDefaultFor || [];
      const newIsDefaultFor = [...new Set([...currentIsDefaultFor, ...meetTypes])];
      await templateRef.update({
        isDefaultFor: newIsDefaultFor,
        updatedAt: new Date().toISOString()
      });

      console.log(`[setTemplateDefault] Set ${templateId} as default for ${meetTypes.join(', ')}`);

      // Notify all clients in this competition room
      io.to(`competition:${clientCompId}`).emit('obs:templateDefaultChanged', {
        templateId,
        meetTypes: newIsDefaultFor,
        action: 'set'
      });

      socket.emit('obs:templateDefaultSet', { templateId, meetTypes: newIsDefaultFor });
    } catch (error) {
      console.error(`[setTemplateDefault] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set template default: ${error.message}` });
    }
  });

  // Clear a template's default status for specific meet types
  socket.on('obs:clearTemplateDefault', async ({ templateId, meetTypes }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can clear template defaults' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    if (!templateId || !Array.isArray(meetTypes) || meetTypes.length === 0) {
      socket.emit('error', { message: 'Template ID and meet types array are required' });
      return;
    }

    try {
      productionConfigService.initialize();
      if (!productionConfigService.isAvailable()) {
        socket.emit('error', { message: 'Firebase not available' });
        return;
      }

      const database = productionConfigService.getDb();
      const templateRef = database.ref(`templates/obs/${templateId}`);
      const templateSnapshot = await templateRef.once('value');
      const template = templateSnapshot.val();

      if (!template) {
        socket.emit('error', { message: `Template not found: ${templateId}` });
        return;
      }

      // Remove the specified meet types from isDefaultFor
      const currentIsDefaultFor = template.isDefaultFor || [];
      const newIsDefaultFor = currentIsDefaultFor.filter(mt => !meetTypes.includes(mt));

      await templateRef.update({
        isDefaultFor: newIsDefaultFor.length > 0 ? newIsDefaultFor : null,
        updatedAt: new Date().toISOString()
      });

      console.log(`[clearTemplateDefault] Cleared ${meetTypes.join(', ')} from ${templateId}`);

      // Notify all clients in this competition room
      io.to(`competition:${clientCompId}`).emit('obs:templateDefaultChanged', {
        templateId,
        meetTypes: newIsDefaultFor,
        action: 'clear'
      });

      socket.emit('obs:templateDefaultCleared', { templateId, meetTypes: newIsDefaultFor });
    } catch (error) {
      console.error(`[clearTemplateDefault] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to clear template default: ${error.message}` });
    }
  });

  // Get the default template for a specific meet type
  socket.on('obs:getDefaultTemplate', async ({ meetType }, callback) => {
    if (!meetType) {
      if (callback) callback({ error: 'Meet type is required' });
      return;
    }

    try {
      productionConfigService.initialize();
      if (!productionConfigService.isAvailable()) {
        if (callback) callback({ error: 'Firebase not available' });
        return;
      }

      const database = productionConfigService.getDb();
      const templatesRef = database.ref('templates/obs');
      const templatesSnapshot = await templatesRef.once('value');
      const templates = templatesSnapshot.val() || {};

      // Find templates that are default for this meet type
      const defaultTemplates = Object.values(templates).filter(
        t => t.isDefaultFor && t.isDefaultFor.includes(meetType)
      );

      if (defaultTemplates.length === 0) {
        console.log(`[getDefaultTemplate] No default template for ${meetType}`);
        if (callback) callback({ template: null });
        return;
      }

      // If multiple defaults, use the most recently updated one
      const defaultTemplate = defaultTemplates.sort((a, b) =>
        new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      )[0];

      console.log(`[getDefaultTemplate] Found default template "${defaultTemplate.name}" for ${meetType}`);
      if (callback) callback({ template: defaultTemplate });
    } catch (error) {
      console.error(`[getDefaultTemplate] Failed: ${error.message}`);
      if (callback) callback({ error: error.message });
    }
  });

  // ============================================================================
  // Stream & Recording Control (PRD-OBS-06)
  // ============================================================================

  // Start streaming
  socket.on('obs:startStream', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can start streaming' });
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
      await compObs.call('StartStream');
      console.log(`[startStream] Started streaming for ${clientCompId}`);
      socket.emit('obs:streamStarted');
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[startStream] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to start stream: ${error.message}` });
    }
  });

  // Stop streaming
  socket.on('obs:stopStream', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can stop streaming' });
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
      await compObs.call('StopStream');
      console.log(`[stopStream] Stopped streaming for ${clientCompId}`);
      socket.emit('obs:streamStopped');
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[stopStream] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to stop stream: ${error.message}` });
    }
  });

  // Get stream status
  socket.on('obs:getStreamStatus', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
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
      const response = await compObs.call('GetStreamStatus');
      socket.emit('obs:streamStatus', {
        active: response.outputActive,
        reconnecting: response.outputReconnecting || false,
        timecode: response.outputTimecode || '00:00:00.000',
        duration: response.outputDuration || 0,
        bytes: response.outputBytes || 0,
        skippedFrames: response.outputSkippedFrames || 0,
        totalFrames: response.outputTotalFrames || 0
      });
      console.log(`[getStreamStatus] Sent stream status for ${clientCompId} (active: ${response.outputActive})`);
    } catch (error) {
      console.error(`[getStreamStatus] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to get stream status: ${error.message}` });
    }
  });

  // Get stream settings
  socket.on('obs:getStreamSettings', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
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
      const response = await compObs.call('GetStreamServiceSettings');
      // Mask the stream key
      const settings = { ...response.streamServiceSettings };
      if (settings.key) {
        settings.key = '****' + settings.key.slice(-4);
      }
      socket.emit('obs:streamSettings', {
        serviceType: response.streamServiceType,
        settings
      });
      console.log(`[getStreamSettings] Sent stream settings for ${clientCompId}`);
    } catch (error) {
      console.error(`[getStreamSettings] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to get stream settings: ${error.message}` });
    }
  });

  // Set stream settings
  socket.on('obs:setStreamSettings', async ({ serviceType, settings }) => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can change stream settings' });
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
      await compObs.call('SetStreamServiceSettings', {
        streamServiceType: serviceType,
        streamServiceSettings: settings
      });
      console.log(`[setStreamSettings] Updated stream settings for ${clientCompId} (type: ${serviceType})`);

      // Store encrypted stream key in Firebase for backup/recovery
      if (settings?.key && productionConfigService.isAvailable()) {
        try {
          const encryptedKey = encryptStreamKey(settings.key);
          const db = productionConfigService.getDb();
          if (db) {
            await db.ref(`competitions/${clientCompId}/obs/streamConfig`).update({
              streamKeyEncrypted: encryptedKey,
              serviceType: serviceType,
              server: settings.server || null,
              lastUpdated: new Date().toISOString()
            });
            console.log(`[setStreamSettings] Stored encrypted stream key in Firebase for ${clientCompId}`);
          }
        } catch (fbError) {
          // Don't fail the request if Firebase storage fails - OBS was still updated
          console.warn(`[setStreamSettings] Failed to store encrypted key in Firebase: ${fbError.message}`);
        }
      }

      socket.emit('obs:streamSettingsUpdated', { success: true });
    } catch (error) {
      console.error(`[setStreamSettings] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to set stream settings: ${error.message}` });
    }
  });

  // Restore stream settings from Firebase backup
  socket.on('obs:restoreStreamSettings', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can restore stream settings' });
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

    if (!productionConfigService.isAvailable()) {
      socket.emit('error', { message: 'Firebase not available' });
      return;
    }

    try {
      const db = productionConfigService.getDb();
      const snapshot = await db.ref(`competitions/${clientCompId}/obs/streamConfig`).once('value');
      const config = snapshot.val();

      if (!config || !config.streamKeyEncrypted) {
        socket.emit('error', { message: 'No stored stream configuration found' });
        return;
      }

      // Decrypt the stream key
      const decryptedKey = decryptStreamKey(config.streamKeyEncrypted);

      // Build settings object
      const settings = { key: decryptedKey };
      if (config.server) {
        settings.server = config.server;
      }

      // Apply to OBS
      await compObs.call('SetStreamServiceSettings', {
        streamServiceType: config.serviceType || 'rtmp_common',
        streamServiceSettings: settings
      });

      console.log(`[restoreStreamSettings] Restored stream settings from Firebase for ${clientCompId}`);
      socket.emit('obs:streamSettingsRestored', { success: true, lastUpdated: config.lastUpdated });
    } catch (error) {
      console.error(`[restoreStreamSettings] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to restore stream settings: ${error.message}` });
    }
  });

  // Delete stored stream key from Firebase
  socket.on('obs:deleteStoredStreamKey', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can delete stream keys' });
      return;
    }

    const clientCompId = client?.compId;
    if (!clientCompId) {
      socket.emit('error', { message: 'No competition ID for client' });
      return;
    }

    if (!productionConfigService.isAvailable()) {
      socket.emit('error', { message: 'Firebase not available' });
      return;
    }

    try {
      const db = productionConfigService.getDb();
      await db.ref(`competitions/${clientCompId}/obs/streamConfig/streamKeyEncrypted`).remove();
      console.log(`[deleteStoredStreamKey] Deleted stored stream key for ${clientCompId}`);
      socket.emit('obs:storedStreamKeyDeleted', { success: true });
    } catch (error) {
      console.error(`[deleteStoredStreamKey] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to delete stored stream key: ${error.message}` });
    }
  });

  // Start recording
  socket.on('obs:startRecording', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can start recording' });
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
      await compObs.call('StartRecord');
      console.log(`[startRecording] Started recording for ${clientCompId}`);
      socket.emit('obs:recordingStarted');
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[startRecording] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to start recording: ${error.message}` });
    }
  });

  // Stop recording
  socket.on('obs:stopRecording', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can stop recording' });
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
      const result = await compObs.call('StopRecord');
      console.log(`[stopRecording] Stopped recording for ${clientCompId}, file: ${result.outputPath}`);
      socket.emit('obs:recordingStopped', { path: result.outputPath });
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[stopRecording] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to stop recording: ${error.message}` });
    }
  });

  // Pause recording
  socket.on('obs:pauseRecording', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can pause recording' });
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
      await compObs.call('PauseRecord');
      console.log(`[pauseRecording] Paused recording for ${clientCompId}`);
      socket.emit('obs:recordingPaused');
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[pauseRecording] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to pause recording: ${error.message}` });
    }
  });

  // Resume recording
  socket.on('obs:resumeRecording', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can resume recording' });
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
      await compObs.call('ResumeRecord');
      console.log(`[resumeRecording] Resumed recording for ${clientCompId}`);
      socket.emit('obs:recordingResumed');
      await broadcastOBSState(clientCompId, obsConnManager, io);
    } catch (error) {
      console.error(`[resumeRecording] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to resume recording: ${error.message}` });
    }
  });

  // Get recording status
  socket.on('obs:getRecordingStatus', async () => {
    const client = showState.connectedClients.find(c => c.id === socket.id);
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
      const response = await compObs.call('GetRecordStatus');
      socket.emit('obs:recordingStatus', {
        active: response.outputActive,
        paused: response.outputPaused || false,
        timecode: response.outputTimecode || '00:00:00.000',
        duration: response.outputDuration || 0,
        bytes: response.outputBytes || 0
      });
      console.log(`[getRecordingStatus] Sent recording status for ${clientCompId} (active: ${response.outputActive}, paused: ${response.outputPaused})`);
    } catch (error) {
      console.error(`[getRecordingStatus] Failed: ${error.message}`);
      socket.emit('error', { message: `Failed to get recording status: ${error.message}` });
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
    console.log(`[obs:refreshState] Request from client, compId: ${clientCompId || 'none'}`);

    // First, try competition-based OBS connection (via obsConnectionManager)
    if (clientCompId && clientCompId !== 'local') {
      const obsConnManager = getOBSConnectionManager();
      const connState = obsConnManager.getConnectionState(clientCompId);
      console.log(`[obs:refreshState] Connection state for ${clientCompId}:`, connState ? { connected: connState.connected, error: connState.error } : 'null');

      if (connState && connState.connected) {
        try {
          console.log(`[obs:refreshState] Broadcasting full state for competition ${clientCompId}`);
          await broadcastOBSState(clientCompId, obsConnManager, io);
          return;
        } catch (error) {
          console.error(`[obs:refreshState] Failed to refresh OBS state for ${clientCompId}:`, error);
          socket.emit('error', { message: 'Failed to refresh OBS state' });
          return;
        }
      } else {
        console.log(`[obs:refreshState] OBS not connected for ${clientCompId}, falling back to local`);
      }
    }

    // Fall back to local obsStateSync
    if (obsStateSync && obsStateSync.isInitialized()) {
      try {
        console.log('Client requested OBS state refresh (local)');
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

  // Load rundown from Firebase into the timesheet engine (Task 8)
  socket.on('loadRundown', async ({ compId }) => {
    // Use compId from payload, fallback to socket's competition
    const targetCompId = compId || clientCompId;

    if (!targetCompId) {
      socket.emit('loadRundownResult', {
        success: false,
        error: 'No competition ID provided'
      });
      return;
    }

    try {
      console.log(`[Timesheet] Loading rundown for competition: ${targetCompId}`);

      // Get Firebase database
      const db = productionConfigService.getDb();
      if (!db) {
        socket.emit('loadRundownResult', {
          success: false,
          error: 'Firebase not initialized'
        });
        return;
      }

      // Fetch segments from Firebase
      const segmentsPath = `competitions/${targetCompId}/rundown/segments`;
      const snapshot = await db.ref(segmentsPath).once('value');
      const segmentsData = snapshot.val();

      if (!segmentsData) {
        socket.emit('loadRundownResult', {
          success: false,
          error: 'No rundown found for this competition'
        });
        return;
      }

      // Convert Firebase object to array (if stored as object with keys)
      let segments = [];
      if (Array.isArray(segmentsData)) {
        segments = segmentsData;
      } else if (typeof segmentsData === 'object') {
        // Firebase sometimes stores arrays as objects with numeric keys
        segments = Object.values(segmentsData);
      }

      if (segments.length === 0) {
        socket.emit('loadRundownResult', {
          success: false,
          error: 'Rundown has no segments'
        });
        return;
      }

      console.log(`[Timesheet] Found ${segments.length} segments for competition: ${targetCompId}`);

      // Task 37: Detect and handle duplicate segment IDs
      const duplicateCheck = detectDuplicateIds(segments);
      if (duplicateCheck.hasDuplicates) {
        console.warn(`[Timesheet] WARNING: Duplicate segment IDs detected for ${targetCompId}:`);
        duplicateCheck.duplicates.forEach(dup => {
          console.warn(`  - ID "${dup.id}" appears ${dup.indices.length} times at indices: ${dup.indices.join(', ')} (names: ${dup.names.join(', ')})`);
        });

        // Deduplicate - keep only the first occurrence of each ID
        const { segments: dedupedSegments, removed } = deduplicateSegmentsById(segments);
        if (removed.length > 0) {
          console.warn(`[Timesheet] Removed ${removed.length} duplicate segment(s) - keeping first occurrence of each ID`);
          segments = dedupedSegments;
        }
      }

      // Map Editor segments to Engine format (Task 11)
      const engineSegments = mapEditorSegmentsToEngine(segments);

      // Validate the mapped segments
      const validation = validateEngineSegments(engineSegments);
      if (!validation.valid) {
        console.warn(`[Timesheet] Segment validation warnings for ${targetCompId}:`, validation.errors);
        // Continue anyway - validation warnings are non-fatal
      }

      console.log(`[Timesheet] Mapped ${engineSegments.length} segments to engine format`);

      // Get or create the timesheet engine for this competition
      const obsConnManager = getOBSConnectionManager();
      const engine = getOrCreateEngine(targetCompId, obsConnManager, db, io);

      // Update the engine's show config with the mapped segments
      engine.updateConfig({ segments: engineSegments });

      console.log(`[Timesheet] Rundown loaded successfully for competition: ${targetCompId}`);

      // Subscribe to Firebase rundown changes for live sync (Phase I - Task 28)
      subscribeToRundownChanges(targetCompId, db, segments);

      // Get the updated state to broadcast
      const state = engine.getState();

      // Send success result to the requesting client
      socket.emit('loadRundownResult', {
        success: true,
        segmentCount: engineSegments.length,
        compId: targetCompId
      });

      // Broadcast the updated state to all clients in the competition room
      const roomName = `competition:${targetCompId}`;
      io.to(roomName).emit('timesheetState', {
        ...state,
        segments: engineSegments // Include mapped segments array in state broadcast
      });

    } catch (error) {
      console.error(`[Timesheet] Error loading rundown for ${targetCompId}:`, error.message);
      socket.emit('loadRundownResult', {
        success: false,
        error: `Failed to load rundown: ${error.message}`
      });
    }
  });

  // Get AI-generated segment suggestions for rundown planning (Task 47)
  socket.on('getAISuggestions', async ({ compId, options = {} }) => {
    // Use compId from payload, fallback to socket's competition
    const targetCompId = compId || clientCompId;

    if (!targetCompId) {
      socket.emit('aiSuggestionsResult', {
        success: false,
        error: 'No competition ID provided'
      });
      return;
    }

    try {
      console.log(`[AISuggestions] Generating suggestions for competition: ${targetCompId}`);
      console.log(`[AISuggestions] Options:`, JSON.stringify(options));

      // Call the AI suggestion service
      const result = await aiSuggestionService.generateSuggestions(targetCompId, options);

      if (result.success) {
        console.log(`[AISuggestions] Generated ${result.suggestions.length} suggestions for ${targetCompId}`);
        console.log(`[AISuggestions] By category:`, JSON.stringify(result.meta.byCategory));
      } else {
        console.warn(`[AISuggestions] Failed for ${targetCompId}: ${result.error}`);
      }

      // Send result back to the requesting client
      socket.emit('aiSuggestionsResult', result);

    } catch (error) {
      console.error(`[AISuggestions] Error generating suggestions for ${targetCompId}:`, error.message);
      socket.emit('aiSuggestionsResult', {
        success: false,
        error: `Failed to generate suggestions: ${error.message}`
      });
    }
  });

  // Get AI suggestion count (quick estimate without full generation)
  socket.on('getAISuggestionCount', async ({ compId }) => {
    // Use compId from payload, fallback to socket's competition
    const targetCompId = compId || clientCompId;

    if (!targetCompId) {
      socket.emit('aiSuggestionCountResult', {
        success: false,
        error: 'No competition ID provided'
      });
      return;
    }

    try {
      const result = await aiSuggestionService.getSuggestionCount(targetCompId);
      socket.emit('aiSuggestionCountResult', {
        success: true,
        ...result,
        compId: targetCompId
      });
    } catch (error) {
      socket.emit('aiSuggestionCountResult', {
        success: false,
        error: error.message
      });
    }
  });

  // Task 56: Get current AI context for a competition
  socket.on('getAIContext', ({ compId }) => {
    const targetCompId = compId || clientCompId;

    if (!targetCompId) {
      socket.emit('aiContextResult', {
        success: false,
        error: 'No competition ID provided'
      });
      return;
    }

    const service = getContextService(targetCompId);
    if (!service) {
      socket.emit('aiContextResult', {
        success: true,
        compId: targetCompId,
        context: null,
        isRunning: false,
        message: 'AI Context Service not running (show not started)'
      });
      return;
    }

    socket.emit('aiContextResult', {
      success: true,
      compId: targetCompId,
      context: service.getCurrentContext(),
      isRunning: service.isRunning,
      state: service.getState()
    });
  });

  // Task 56: Request AI context refresh
  socket.on('refreshAIContext', async ({ compId }) => {
    const targetCompId = compId || clientCompId;

    if (!targetCompId) {
      socket.emit('aiContextRefreshResult', {
        success: false,
        error: 'No competition ID provided'
      });
      return;
    }

    const service = getContextService(targetCompId);
    if (!service || !service.isRunning) {
      socket.emit('aiContextRefreshResult', {
        success: false,
        error: 'AI Context Service not running'
      });
      return;
    }

    try {
      await service.refreshContext();
      socket.emit('aiContextRefreshResult', {
        success: true,
        compId: targetCompId,
        context: service.getCurrentContext()
      });
    } catch (error) {
      socket.emit('aiContextRefreshResult', {
        success: false,
        error: error.message
      });
    }
  });

  // Set rehearsal mode for the timesheet engine (Task 20)
  socket.on('setRehearsalMode', ({ enabled, compId }) => {
    // Use compId from payload, fallback to socket's competition
    const targetCompId = compId || clientCompId;

    if (!targetCompId) {
      socket.emit('error', { message: 'No competition ID provided for rehearsal mode' });
      return;
    }

    const engine = getEngine(targetCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine found for competition: ${targetCompId}` });
      return;
    }

    engine.setRehearsalMode(enabled);
    console.log(`Socket: Rehearsal mode ${enabled ? 'enabled' : 'disabled'} for competition ${targetCompId}`);
  });

  // Start show via timesheet engine
  socket.on('startTimesheetShow', async () => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}. Load a rundown first.` });
      return;
    }
    await engine.start();
    console.log(`Socket: Timesheet show started for competition ${clientCompId}`);
  });

  // Stop show via timesheet engine
  socket.on('stopTimesheetShow', () => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    engine.stop();
    console.log(`Socket: Timesheet show stopped for competition ${clientCompId}`);
  });

  // Advance to next segment via timesheet engine
  socket.on('advanceSegment', async () => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const advancedBy = client?.name || socket.id;
    const success = await engine.advance(advancedBy);
    if (!success) {
      socket.emit('error', { message: 'Cannot advance segment' });
    }
    console.log(`Socket: Segment advanced by ${advancedBy} for competition ${clientCompId}`);
  });

  // Go to previous segment via timesheet engine
  socket.on('previousSegment', async () => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const triggeredBy = client?.name || socket.id;
    const success = await engine.previous(triggeredBy);
    if (!success) {
      socket.emit('error', { message: 'Cannot go to previous segment' });
    }
    console.log(`Socket: Previous segment triggered by ${triggeredBy} for competition ${clientCompId}`);
  });

  // Jump to specific segment via timesheet engine
  socket.on('goToSegment', async ({ segmentId }) => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    if (!segmentId) {
      socket.emit('error', { message: 'segmentId is required' });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    const triggeredBy = client?.name || socket.id;
    const success = await engine.goToSegment(segmentId, triggeredBy);
    if (!success) {
      socket.emit('error', { message: `Cannot jump to segment: ${segmentId}` });
    }
    console.log(`Socket: Jump to segment ${segmentId} by ${triggeredBy} for competition ${clientCompId}`);
  });

  // Override scene via timesheet engine (producer only)
  socket.on('timesheetOverrideScene', async ({ sceneName }) => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can override scenes' });
      return;
    }
    const triggeredBy = client?.name || socket.id;
    const success = await engine.overrideScene(sceneName, triggeredBy);
    if (!success) {
      socket.emit('error', { message: `Failed to override scene: ${sceneName}` });
    }
    console.log(`Socket: Scene overridden to ${sceneName} by ${triggeredBy} for competition ${clientCompId}`);
  });

  // Override camera via timesheet engine (producer only)
  socket.on('overrideCamera', async ({ cameraId }) => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    const client = showState.connectedClients.find(c => c.id === socket.id);
    if (client?.role !== 'producer') {
      socket.emit('error', { message: 'Only producers can override cameras' });
      return;
    }
    const triggeredBy = client?.name || socket.id;
    const success = await engine.overrideCamera(cameraId, triggeredBy);
    if (!success) {
      socket.emit('error', { message: `Failed to override camera: ${cameraId}` });
    }
    console.log(`Socket: Camera overridden to ${cameraId} by ${triggeredBy} for competition ${clientCompId}`);
  });

  // Get current timesheet state
  socket.on('getTimesheetState', () => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    socket.emit('timesheetState', engine.getState());
  });

  // Get timesheet overrides history
  socket.on('getTimesheetOverrides', () => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    socket.emit('timesheetOverrides', engine.getOverrides());
  });

  // Get timesheet segment history
  socket.on('getTimesheetHistory', () => {
    // Use competition-specific engine (not legacy timesheetEngine)
    const engine = getEngine(clientCompId);
    if (!engine) {
      socket.emit('error', { message: `No timesheet engine for competition: ${clientCompId}` });
      return;
    }
    socket.emit('timesheetHistory', engine.getHistory());
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

    // Clean up audio level subscriptions
    const obsConnManager = getOBSConnectionManager();
    obsConnManager.unsubscribeAudioLevelsAll(socket.id);

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

  // Handle unexpected connection loss (TCP close or heartbeat failure)
  obsConnManager.on('connectionClosed', ({ compId }) => {
    const room = `competition:${compId}`;
    console.log(`[OBS] Connection closed for ${compId}, notifying clients`);
    io.to(room).emit('obs:disconnected', { connected: false });
  });

  obsConnManager.on('connectionError', ({ compId, error }) => {
    const room = `competition:${compId}`;
    io.to(room).emit('obs:error', { error });
  });

  // Forward audio levels to competition room (Phase 2 - Real-time audio meters)
  obsConnManager.on('audioLevels', ({ compId, levels }) => {
    const room = `competition:${compId}`;
    io.to(room).emit('obs:audioLevels', levels);
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
