/**
 * OBS Scene Generator Module
 * Automatically generates OBS scenes from camera configuration
 *
 * Scene types:
 * - Single camera scenes for each camera
 * - Dual camera combinations
 * - Triple camera combinations (if >= 3 cameras)
 * - Quad camera combinations (if >= 4 cameras)
 * - Static scenes (Starting Soon, BRB, Thanks)
 * - Graphics Fullscreen scene
 */

import { EventEmitter } from 'events';

/**
 * Transform presets for scene layouts (1920x1080 canvas)
 */
const TRANSFORM_PRESETS = {
  fullscreen: {
    positionX: 0,
    positionY: 0,
    scaleX: 1,
    scaleY: 1,
    width: 1920,
    height: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 1920,
    boundsHeight: 1080
  },
  dualLeft: {
    positionX: 0,
    positionY: 0,
    scaleX: 0.5,
    scaleY: 1,
    width: 960,
    height: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 1080
  },
  dualRight: {
    positionX: 960,
    positionY: 0,
    scaleX: 0.5,
    scaleY: 1,
    width: 960,
    height: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 1080
  },
  quadTopLeft: {
    positionX: 0,
    positionY: 0,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 960,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 540
  },
  quadTopRight: {
    positionX: 960,
    positionY: 0,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 960,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 540
  },
  quadBottomLeft: {
    positionX: 0,
    positionY: 540,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 960,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 540
  },
  quadBottomRight: {
    positionX: 960,
    positionY: 540,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 960,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 540
  },
  tripleMain: {
    positionX: 0,
    positionY: 0,
    scaleX: 0.6667,
    scaleY: 1,
    width: 1280,
    height: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 1280,
    boundsHeight: 1080
  },
  tripleTopRight: {
    positionX: 1280,
    positionY: 0,
    scaleX: 0.3333,
    scaleY: 0.5,
    width: 640,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 640,
    boundsHeight: 540
  },
  tripleBottomRight: {
    positionX: 1280,
    positionY: 540,
    scaleX: 0.3333,
    scaleY: 0.5,
    width: 640,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 640,
    boundsHeight: 540
  }
};

/**
 * Static scene definitions
 * Updated to match template naming conventions (see server/config/sceneTemplates/)
 */
const STATIC_SCENES = [
  { name: 'Stream Starting Soon', type: 'static' },
  { name: 'End Stream', type: 'static' }
];

/**
 * Get all combinations of items from an array
 * @param {Array} arr - Source array
 * @param {number} size - Combination size
 * @returns {Array<Array>} Array of combinations
 */
function getCombinations(arr, size) {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];

  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, size - 1).map(combo => [first, ...combo]);
  const withoutFirst = getCombinations(rest, size);

  return [...withFirst, ...withoutFirst];
}

/**
 * OBS Scene Generator class
 * Generates scenes automatically from camera configuration
 */
export class OBSSceneGenerator extends EventEmitter {
  constructor(obs, config = {}) {
    super();
    this.obs = obs;
    this.config = config;
    this.cameras = config.cameras || [];
    this.graphicsOverlay = config.graphicsOverlay || null;
    this.generatedScenes = new Set();
  }

  /**
   * Update configuration (for hot-reload support)
   * @param {Object} config - New show config
   */
  updateConfig(config) {
    this.config = config;
    this.cameras = config.cameras || [];
    this.graphicsOverlay = config.graphicsOverlay || null;
  }

  /**
   * Build graphics URL with query params
   * @returns {string|null} Full graphics URL
   */
  buildGraphicsUrl() {
    if (!this.graphicsOverlay?.url) return null;

    const url = new URL(this.graphicsOverlay.url);
    if (this.graphicsOverlay.queryParams) {
      Object.entries(this.graphicsOverlay.queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }

  /**
   * Check if a scene exists in OBS
   * @param {string} sceneName - Scene name to check
   * @returns {Promise<boolean>} True if scene exists
   */
  async sceneExists(sceneName) {
    try {
      const { scenes } = await this.obs.call('GetSceneList');
      return scenes.some(scene => scene.sceneName === sceneName);
    } catch (error) {
      console.error(`Error checking scene existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a new scene in OBS
   * @param {string} sceneName - Name for the new scene
   * @returns {Promise<boolean>} True if created successfully
   */
  async createScene(sceneName) {
    try {
      await this.obs.call('CreateScene', { sceneName });
      return true;
    } catch (error) {
      if (error.code === 601) {
        // Scene already exists
        return false;
      }
      throw error;
    }
  }

  /**
   * Create an SRT source input for a camera
   * @param {Object} camera - Camera configuration
   * @returns {Promise<string>} Input name
   */
  async createCameraInput(camera) {
    const inputName = `SRT - ${camera.name}`;

    try {
      // Check if input already exists
      try {
        await this.obs.call('GetInputSettings', { inputName });
        return inputName; // Already exists
      } catch (e) {
        // Input doesn't exist, create it
      }

      await this.obs.call('CreateInput', {
        sceneName: null, // Create without adding to scene
        inputName,
        inputKind: 'ffmpeg_source',
        inputSettings: {
          input: camera.srtUrl,
          is_local_file: false,
          buffering_mb: 2,
          reconnect_delay_sec: 5,
          restart_on_activate: false,
          hw_decode: true
        }
      });

      return inputName;
    } catch (error) {
      console.error(`Error creating camera input for ${camera.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a source to a scene with transform
   * @param {string} sceneName - Target scene name
   * @param {string} sourceName - Source input name
   * @param {Object} transform - Transform preset
   * @returns {Promise<number>} Scene item ID
   */
  async addSourceToScene(sceneName, sourceName, transform) {
    try {
      const { sceneItemId } = await this.obs.call('CreateSceneItem', {
        sceneName,
        sourceName,
        sceneItemEnabled: true
      });

      // Apply transform
      await this.obs.call('SetSceneItemTransform', {
        sceneName,
        sceneItemId,
        sceneItemTransform: transform
      });

      return sceneItemId;
    } catch (error) {
      console.error(`Error adding source ${sourceName} to scene ${sceneName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add graphics overlay browser source to a scene
   * @param {string} sceneName - Target scene name
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<number|null>} Scene item ID or null
   */
  async addGraphicsOverlay(sceneName, graphicsUrl) {
    if (!graphicsUrl) return null;

    const inputName = 'Graphics Overlay';

    try {
      // Ensure graphics input exists
      try {
        await this.obs.call('GetInputSettings', { inputName });
      } catch (e) {
        // Create the browser source
        await this.obs.call('CreateInput', {
          sceneName: null,
          inputName,
          inputKind: 'browser_source',
          inputSettings: {
            url: graphicsUrl,
            width: 1920,
            height: 1080,
            fps: 30,
            css: '',
            shutdown: false,
            restart_when_active: false
          }
        });
      }

      // Add to scene at fullscreen, on top
      const { sceneItemId } = await this.obs.call('CreateSceneItem', {
        sceneName,
        sourceName: inputName,
        sceneItemEnabled: true
      });

      // Apply fullscreen transform
      await this.obs.call('SetSceneItemTransform', {
        sceneName,
        sceneItemId,
        sceneItemTransform: TRANSFORM_PRESETS.fullscreen
      });

      // Ensure it's on top
      await this.obs.call('SetSceneItemIndex', {
        sceneName,
        sceneItemId,
        sceneItemIndex: 0 // Top of the stack
      });

      return sceneItemId;
    } catch (error) {
      console.error(`Error adding graphics overlay to ${sceneName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a single-camera scene
   * Uses template naming: "Full Screen - Camera X"
   * @param {Object} camera - Camera configuration
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<Object>} Result object
   */
  async createSingleCameraScene(camera, graphicsUrl) {
    // Use template naming convention (e.g., "Full Screen - Camera A")
    const sceneName = `Full Screen - ${camera.name}`;

    if (await this.sceneExists(sceneName)) {
      return { scene: sceneName, status: 'skipped', reason: 'exists' };
    }

    try {
      await this.createScene(sceneName);
      const inputName = `SRT - ${camera.name}`;

      // Add camera source at fullscreen
      await this.addSourceToScene(sceneName, inputName, TRANSFORM_PRESETS.fullscreen);

      // Add graphics overlay
      await this.addGraphicsOverlay(sceneName, graphicsUrl);

      this.generatedScenes.add(sceneName);
      this.emit('sceneCreated', { scene: sceneName, type: 'single', cameras: [camera.id] });

      return { scene: sceneName, status: 'created', type: 'single' };
    } catch (error) {
      return { scene: sceneName, status: 'failed', error: error.message };
    }
  }

  /**
   * Create a replay scene
   * Uses template naming: "Replay - Camera X"
   * Replay scenes are fullscreen single-camera views intended for replay playback
   * @param {Object} camera - Camera configuration
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<Object>} Result object
   */
  async createReplayScene(camera, graphicsUrl) {
    const sceneName = `Replay - ${camera.name}`;

    if (await this.sceneExists(sceneName)) {
      return { scene: sceneName, status: 'skipped', reason: 'exists' };
    }

    try {
      await this.createScene(sceneName);
      const inputName = `SRT - ${camera.name}`;

      // Add camera source at fullscreen
      await this.addSourceToScene(sceneName, inputName, TRANSFORM_PRESETS.fullscreen);

      // Add graphics overlay
      await this.addGraphicsOverlay(sceneName, graphicsUrl);

      this.generatedScenes.add(sceneName);
      this.emit('sceneCreated', { scene: sceneName, type: 'replay', cameras: [camera.id] });

      return { scene: sceneName, status: 'created', type: 'replay' };
    } catch (error) {
      return { scene: sceneName, status: 'failed', error: error.message };
    }
  }

  /**
   * Create a dual-meet specific scene with featured camera position
   * Uses template naming: "Dual View - Camera X - Left" or "Dual View - Camera X - Right"
   * This is for dual meets where there are only 2 cameras, showing which camera is featured
   * @param {Object} featuredCam - Featured camera configuration
   * @param {Object} otherCam - Other camera configuration
   * @param {string} position - 'Left' or 'Right' (position of featured camera)
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<Object>} Result object
   */
  async createDualMeetScene(featuredCam, otherCam, position, graphicsUrl) {
    const sceneName = `Dual View - ${featuredCam.name} - ${position}`;

    if (await this.sceneExists(sceneName)) {
      return { scene: sceneName, status: 'skipped', reason: 'exists' };
    }

    try {
      await this.createScene(sceneName);

      // Position cameras based on featured camera position
      if (position === 'Left') {
        await this.addSourceToScene(sceneName, `SRT - ${featuredCam.name}`, TRANSFORM_PRESETS.dualLeft);
        await this.addSourceToScene(sceneName, `SRT - ${otherCam.name}`, TRANSFORM_PRESETS.dualRight);
      } else {
        await this.addSourceToScene(sceneName, `SRT - ${otherCam.name}`, TRANSFORM_PRESETS.dualLeft);
        await this.addSourceToScene(sceneName, `SRT - ${featuredCam.name}`, TRANSFORM_PRESETS.dualRight);
      }

      // Add graphics overlay
      await this.addGraphicsOverlay(sceneName, graphicsUrl);

      this.generatedScenes.add(sceneName);
      this.emit('sceneCreated', { scene: sceneName, type: 'dual-meet', cameras: [featuredCam.id, otherCam.id] });

      return { scene: sceneName, status: 'created', type: 'dual-meet' };
    } catch (error) {
      return { scene: sceneName, status: 'failed', error: error.message };
    }
  }

  /**
   * Create a dual-camera scene
   * Uses template naming: "Dual View - Camera X & Camera Y"
   * @param {Object} cam1 - First camera configuration
   * @param {Object} cam2 - Second camera configuration
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<Object>} Result object
   */
  async createDualCameraScene(cam1, cam2, graphicsUrl) {
    // Use template naming convention (e.g., "Dual View - Camera A & Camera B")
    const sceneName = `Dual View - ${cam1.name} & ${cam2.name}`;

    if (await this.sceneExists(sceneName)) {
      return { scene: sceneName, status: 'skipped', reason: 'exists' };
    }

    try {
      await this.createScene(sceneName);

      // Add left camera
      await this.addSourceToScene(sceneName, `SRT - ${cam1.name}`, TRANSFORM_PRESETS.dualLeft);

      // Add right camera
      await this.addSourceToScene(sceneName, `SRT - ${cam2.name}`, TRANSFORM_PRESETS.dualRight);

      // Add graphics overlay
      await this.addGraphicsOverlay(sceneName, graphicsUrl);

      this.generatedScenes.add(sceneName);
      this.emit('sceneCreated', { scene: sceneName, type: 'dual', cameras: [cam1.id, cam2.id] });

      return { scene: sceneName, status: 'created', type: 'dual' };
    } catch (error) {
      return { scene: sceneName, status: 'failed', error: error.message };
    }
  }

  /**
   * Create a triple-camera scene
   * Uses template naming: "Triple View - Camera X Y Z"
   * @param {Object} cam1 - Main (large) camera configuration
   * @param {Object} cam2 - Top-right camera configuration
   * @param {Object} cam3 - Bottom-right camera configuration
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<Object>} Result object
   */
  async createTriCameraScene(cam1, cam2, cam3, graphicsUrl) {
    // Use template naming convention (e.g., "Triple View - Camera A B C")
    const sceneName = `Triple View - ${cam1.name} ${cam2.name} ${cam3.name}`;

    if (await this.sceneExists(sceneName)) {
      return { scene: sceneName, status: 'skipped', reason: 'exists' };
    }

    try {
      await this.createScene(sceneName);

      // Add main camera (large, left side)
      await this.addSourceToScene(sceneName, `SRT - ${cam1.name}`, TRANSFORM_PRESETS.tripleMain);

      // Add top-right camera
      await this.addSourceToScene(sceneName, `SRT - ${cam2.name}`, TRANSFORM_PRESETS.tripleTopRight);

      // Add bottom-right camera
      await this.addSourceToScene(sceneName, `SRT - ${cam3.name}`, TRANSFORM_PRESETS.tripleBottomRight);

      // Add graphics overlay
      await this.addGraphicsOverlay(sceneName, graphicsUrl);

      this.generatedScenes.add(sceneName);
      this.emit('sceneCreated', { scene: sceneName, type: 'triple', cameras: [cam1.id, cam2.id, cam3.id] });

      return { scene: sceneName, status: 'created', type: 'triple' };
    } catch (error) {
      return { scene: sceneName, status: 'failed', error: error.message };
    }
  }

  /**
   * Create a quad-camera scene
   * Uses template naming: "Quad View"
   * @param {Array<Object>} cameras - Array of 4 camera configurations [TL, TR, BL, BR]
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<Object>} Result object
   */
  async createQuadCameraScene(cameras, graphicsUrl) {
    if (cameras.length !== 4) {
      return { scene: null, status: 'failed', error: 'Quad scene requires exactly 4 cameras' };
    }

    const [camTL, camTR, camBL, camBR] = cameras;
    // Use template naming convention - just "Quad View" (no camera names)
    const sceneName = 'Quad View';

    if (await this.sceneExists(sceneName)) {
      return { scene: sceneName, status: 'skipped', reason: 'exists' };
    }

    try {
      await this.createScene(sceneName);

      // Add cameras in quad layout
      await this.addSourceToScene(sceneName, `SRT - ${camTL.name}`, TRANSFORM_PRESETS.quadTopLeft);
      await this.addSourceToScene(sceneName, `SRT - ${camTR.name}`, TRANSFORM_PRESETS.quadTopRight);
      await this.addSourceToScene(sceneName, `SRT - ${camBL.name}`, TRANSFORM_PRESETS.quadBottomLeft);
      await this.addSourceToScene(sceneName, `SRT - ${camBR.name}`, TRANSFORM_PRESETS.quadBottomRight);

      // Add graphics overlay
      await this.addGraphicsOverlay(sceneName, graphicsUrl);

      this.generatedScenes.add(sceneName);
      this.emit('sceneCreated', { scene: sceneName, type: 'quad', cameras: cameras.map(c => c.id) });

      return { scene: sceneName, status: 'created', type: 'quad' };
    } catch (error) {
      return { scene: sceneName, status: 'failed', error: error.message };
    }
  }

  /**
   * Create a static scene (no camera, just placeholder/graphics)
   * @param {string} name - Scene name
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<Object>} Result object
   */
  async createStaticScene(name, graphicsUrl) {
    if (await this.sceneExists(name)) {
      return { scene: name, status: 'skipped', reason: 'exists' };
    }

    try {
      await this.createScene(name);

      // Static scenes typically have a color source or image background
      // For now, just add graphics overlay if available
      if (graphicsUrl) {
        await this.addGraphicsOverlay(name, graphicsUrl);
      }

      this.generatedScenes.add(name);
      this.emit('sceneCreated', { scene: name, type: 'static', cameras: [] });

      return { scene: name, status: 'created', type: 'static' };
    } catch (error) {
      return { scene: name, status: 'failed', error: error.message };
    }
  }

  /**
   * Create Graphics Fullscreen scene
   * Uses template naming: "Web-graphics-only-no-video"
   * @param {string} graphicsUrl - Graphics overlay URL
   * @returns {Promise<Object>} Result object
   */
  async createGraphicsFullscreenScene(graphicsUrl) {
    // Use template naming convention
    const sceneName = 'Web-graphics-only-no-video';

    if (await this.sceneExists(sceneName)) {
      return { scene: sceneName, status: 'skipped', reason: 'exists' };
    }

    if (!graphicsUrl) {
      return { scene: sceneName, status: 'failed', error: 'No graphics URL configured' };
    }

    try {
      await this.createScene(sceneName);

      // Create dedicated browser source for fullscreen graphics
      const inputName = 'Web Graphics Source';
      try {
        await this.obs.call('CreateInput', {
          sceneName: null,
          inputName,
          inputKind: 'browser_source',
          inputSettings: {
            url: graphicsUrl,
            width: 1920,
            height: 1080,
            fps: 30,
            css: '',
            shutdown: false,
            restart_when_active: false
          }
        });
      } catch (e) {
        // Input may already exist
      }

      await this.addSourceToScene(sceneName, inputName, TRANSFORM_PRESETS.fullscreen);

      this.generatedScenes.add(sceneName);
      this.emit('sceneCreated', { scene: sceneName, type: 'graphics', cameras: [] });

      return { scene: sceneName, status: 'created', type: 'graphics' };
    } catch (error) {
      return { scene: sceneName, status: 'failed', error: error.message };
    }
  }

  /**
   * Preview what scenes would be generated
   * @param {Object} options - Generation options
   * @returns {Object} Preview of scenes to be created
   */
  previewScenes(options = {}) {
    const { types = ['single', 'dual', 'triple', 'quad', 'static', 'graphics', 'replay'] } = options;
    const preview = {
      single: [],
      dual: [],
      triple: [],
      quad: [],
      static: [],
      graphics: [],
      replay: [],
      totals: { single: 0, dual: 0, triple: 0, quad: 0, static: 0, graphics: 0, replay: 0, total: 0 }
    };

    // Single camera scenes (template naming: "Full Screen - Camera X")
    if (types.includes('single')) {
      this.cameras.forEach(camera => {
        preview.single.push(`Full Screen - ${camera.name}`);
      });
      preview.totals.single = preview.single.length;
    }

    // Dual camera combinations
    // For 2 cameras: use dual-meet naming (Camera X - Left/Right)
    // For 3+ cameras: use combination naming (Camera X & Camera Y)
    if (types.includes('dual') && this.cameras.length >= 2) {
      if (this.cameras.length === 2) {
        // Dual-meet style: "Dual View - Camera A - Left", "Dual View - Camera A - Right"
        this.cameras.forEach(camera => {
          preview.dual.push(`Dual View - ${camera.name} - Left`);
          preview.dual.push(`Dual View - ${camera.name} - Right`);
        });
      } else {
        // Quad/tri-meet style: "Dual View - Camera A & Camera B"
        const dualCombos = getCombinations(this.cameras, 2);
        dualCombos.forEach(([cam1, cam2]) => {
          preview.dual.push(`Dual View - ${cam1.name} & ${cam2.name}`);
        });
      }
      preview.totals.dual = preview.dual.length;
    }

    // Triple camera combinations (template naming: "Triple View - Camera X Y Z")
    if (types.includes('triple') && this.cameras.length >= 3) {
      const tripleCombos = getCombinations(this.cameras, 3);
      tripleCombos.forEach(([cam1, cam2, cam3]) => {
        preview.triple.push(`Triple View - ${cam1.name} ${cam2.name} ${cam3.name}`);
      });
      preview.totals.triple = preview.triple.length;
    }

    // Quad camera combinations (template naming: "Quad View")
    if (types.includes('quad') && this.cameras.length >= 4) {
      // Only one Quad View scene regardless of camera count
      preview.quad.push('Quad View');
      preview.totals.quad = 1;
    }

    // Static scenes (template naming: "Stream Starting Soon", "End Stream")
    if (types.includes('static')) {
      STATIC_SCENES.forEach(scene => {
        preview.static.push(scene.name);
      });
      preview.totals.static = preview.static.length;
    }

    // Graphics fullscreen (template naming: "Web-graphics-only-no-video")
    if (types.includes('graphics')) {
      preview.graphics.push('Web-graphics-only-no-video');
      preview.totals.graphics = 1;
    }

    // Replay scenes (template naming: "Replay - Camera X")
    if (types.includes('replay')) {
      this.cameras.forEach(camera => {
        preview.replay.push(`Replay - ${camera.name}`);
      });
      preview.totals.replay = preview.replay.length;
    }

    preview.totals.total = Object.values(preview.totals).reduce((a, b) => a + b, 0) - preview.totals.total;

    return preview;
  }

  /**
   * Generate all scenes based on camera configuration
   * @param {Object} showConfig - Show configuration (optional, uses internal if not provided)
   * @returns {Promise<Object>} Generation report
   */
  async generateAllScenes(showConfig = null) {
    if (showConfig) {
      this.updateConfig(showConfig);
    }

    const graphicsUrl = this.buildGraphicsUrl();
    const results = {
      created: [],
      skipped: [],
      failed: [],
      summary: { created: 0, skipped: 0, failed: 0, total: 0 }
    };

    // Create camera inputs first
    for (const camera of this.cameras) {
      try {
        await this.createCameraInput(camera);
      } catch (error) {
        console.error(`Failed to create input for ${camera.name}: ${error.message}`);
      }
    }

    // Generate static scenes
    for (const staticScene of STATIC_SCENES) {
      const result = await this.createStaticScene(staticScene.name, graphicsUrl);
      this.categorizeResult(result, results);
    }

    // Generate single camera scenes
    for (const camera of this.cameras) {
      const result = await this.createSingleCameraScene(camera, graphicsUrl);
      this.categorizeResult(result, results);
    }

    // Generate dual camera combinations
    // For 2 cameras: use dual-meet naming (Camera X - Left/Right)
    // For 3+ cameras: use combination naming (Camera X & Camera Y)
    if (this.cameras.length === 2) {
      // Dual-meet: create scenes for each camera in left and right positions
      const [camA, camB] = this.cameras;
      // Camera A - Left (Camera A on left, Camera B on right)
      let result = await this.createDualMeetScene(camA, camB, 'Left', graphicsUrl);
      this.categorizeResult(result, results);
      // Camera A - Right (Camera B on left, Camera A on right)
      result = await this.createDualMeetScene(camA, camB, 'Right', graphicsUrl);
      this.categorizeResult(result, results);
      // Camera B - Left (Camera B on left, Camera A on right)
      result = await this.createDualMeetScene(camB, camA, 'Left', graphicsUrl);
      this.categorizeResult(result, results);
      // Camera B - Right (Camera A on left, Camera B on right)
      result = await this.createDualMeetScene(camB, camA, 'Right', graphicsUrl);
      this.categorizeResult(result, results);
    } else if (this.cameras.length >= 3) {
      // Tri/Quad-meet: create all camera pair combinations
      const dualCombos = getCombinations(this.cameras, 2);
      for (const [cam1, cam2] of dualCombos) {
        const result = await this.createDualCameraScene(cam1, cam2, graphicsUrl);
        this.categorizeResult(result, results);
      }
    }

    // Generate triple camera combinations
    if (this.cameras.length >= 3) {
      const tripleCombos = getCombinations(this.cameras, 3);
      for (const [cam1, cam2, cam3] of tripleCombos) {
        const result = await this.createTriCameraScene(cam1, cam2, cam3, graphicsUrl);
        this.categorizeResult(result, results);
      }
    }

    // Generate quad camera combinations
    if (this.cameras.length >= 4) {
      const quadCombos = getCombinations(this.cameras, 4);
      for (const cameras of quadCombos) {
        const result = await this.createQuadCameraScene(cameras, graphicsUrl);
        this.categorizeResult(result, results);
      }
    }

    // Generate replay scenes
    for (const camera of this.cameras) {
      const result = await this.createReplayScene(camera, graphicsUrl);
      this.categorizeResult(result, results);
    }

    // Generate graphics fullscreen scene
    const graphicsResult = await this.createGraphicsFullscreenScene(graphicsUrl);
    this.categorizeResult(graphicsResult, results);

    // Update summary
    results.summary.created = results.created.length;
    results.summary.skipped = results.skipped.length;
    results.summary.failed = results.failed.length;
    results.summary.total = results.summary.created + results.summary.skipped + results.summary.failed;

    this.emit('generationComplete', results);

    return results;
  }

  /**
   * Categorize a result into created/skipped/failed
   * @param {Object} result - Scene creation result
   * @param {Object} results - Results accumulator
   */
  categorizeResult(result, results) {
    if (result.status === 'created') {
      results.created.push(result);
    } else if (result.status === 'skipped') {
      results.skipped.push(result);
    } else {
      results.failed.push(result);
    }
  }

  /**
   * Delete all generated scenes
   * @returns {Promise<Object>} Deletion report
   */
  async deleteGeneratedScenes() {
    const results = { deleted: [], failed: [] };

    for (const sceneName of this.generatedScenes) {
      try {
        await this.obs.call('RemoveScene', { sceneName });
        results.deleted.push(sceneName);
      } catch (error) {
        results.failed.push({ scene: sceneName, error: error.message });
      }
    }

    this.generatedScenes.clear();
    this.emit('scenesDeleted', results);

    return results;
  }

  /**
   * Get list of generated scene names
   * @returns {Array<string>} Scene names
   */
  getGeneratedScenes() {
    return Array.from(this.generatedScenes);
  }
}

export default OBSSceneGenerator;
