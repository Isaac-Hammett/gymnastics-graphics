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

// Load show configuration
function loadShowConfig() {
  try {
    const configPath = join(__dirname, 'config', 'show-config.json');
    const configData = readFileSync(configPath, 'utf-8');
    showConfig = JSON.parse(configData);
    showState.showProgress.total = showConfig.segments.length;
    updateCurrentSegment();
    console.log(`Loaded show config: ${showConfig.showName} with ${showConfig.segments.length} segments`);
    return true;
  } catch (error) {
    console.error('Error loading show config:', error.message);
    return false;
  }
}

// Watch for config changes (hot reload)
watchFile(join(__dirname, 'config', 'show-config.json'), () => {
  console.log('Show config changed, reloading...');
  loadShowConfig();
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

  // Load show config
  loadShowConfig();

  // Connect to OBS
  connectToOBS();
});
