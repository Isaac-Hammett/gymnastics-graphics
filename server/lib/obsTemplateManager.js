/**
 * OBS Template Manager
 *
 * Manages OBS scene templates for quick setup of production configurations.
 * Provides capabilities for:
 * - Creating templates from current OBS state
 * - Applying templates with variable substitution
 * - Managing template library in Firebase
 * - Validating template requirements (cameras, assets)
 *
 * Templates allow saving complete OBS configurations including:
 * - Scene layouts
 * - Input configurations
 * - Transition settings
 * - Asset references
 *
 * @module obsTemplateManager
 */

/**
 * Template variable patterns supported:
 * - {{assets.music.filename}} - Reference to asset from manifest
 * - {{cameras.camera1.url}} - Reference to camera config
 * - {{config.competition.name}} - Reference to competition config
 * - {{config.competition.shortName}} - Competition short name
 */

/**
 * OBS Template Manager class
 * Provides template management operations
 */
export class OBSTemplateManager {
  constructor(obs, stateSync, productionConfigService = null) {
    this.obs = obs;           // OBS WebSocket instance
    this.stateSync = stateSync; // OBSStateSync instance for cached state
    this.productionConfigService = productionConfigService; // Firebase service for template storage
  }

  /**
   * Get Firebase database reference
   * @private
   * @returns {Object} Firebase database reference
   */
  _getDatabase() {
    if (!this.productionConfigService) {
      throw new Error('Production config service not available');
    }

    const db = this.productionConfigService.initialize();
    if (!db) {
      throw new Error('Firebase database not available');
    }

    return db;
  }

  /**
   * List all available templates from Firebase
   * @returns {Promise<Array>} Array of template objects
   */
  async listTemplates() {
    try {
      const database = this._getDatabase();

      const snapshot = await database.ref('templates/obs').once('value');
      const templatesObj = snapshot.val() || {};

      // Convert to array
      const templates = Object.values(templatesObj);

      console.log(`[OBSTemplateManager] Listed ${templates.length} templates`);

      return templates;
    } catch (error) {
      console.error('[OBSTemplateManager] Failed to list templates:', error.message);
      throw error;
    }
  }

  /**
   * Get a specific template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object|null>} Template object or null if not found
   */
  async getTemplate(templateId) {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    try {
      const database = this._getDatabase();

      const snapshot = await database.ref(`templates/obs/${templateId}`).once('value');
      const template = snapshot.val();

      if (!template) {
        console.log(`[OBSTemplateManager] Template ${templateId} not found`);
        return null;
      }

      console.log(`[OBSTemplateManager] Retrieved template "${template.name}" (${templateId})`);
      return template;
    } catch (error) {
      console.error(`[OBSTemplateManager] Failed to get template ${templateId}:`, error.message);
      throw error;
    }
  }

  /**
   * Create a template from current OBS state
   * @param {string} name - Template name
   * @param {string} description - Template description
   * @param {Array} meetTypes - Compatible meet types (e.g., ['mens-dual', 'womens-dual'])
   * @param {Object} options - Additional options (createdBy, version)
   * @returns {Promise<Object>} Created template object
   */
  async createTemplate(name, description, meetTypes = [], options = {}) {
    if (!name) {
      throw new Error('Template name is required');
    }

    if (!description) {
      throw new Error('Template description is required');
    }

    // Check if OBS is connected
    const state = this.stateSync.getState();
    if (!state.connected) {
      throw new Error('OBS is not connected');
    }

    try {
      console.log(`[OBSTemplateManager] Creating template "${name}" from current OBS state`);

      // Generate template ID
      const templateId = `template-${Date.now()}`;

      // Capture current OBS state
      const scenes = await this._captureScenes();
      const inputs = await this._captureInputs();
      const transitions = await this._captureTransitions();

      // Extract requirements from captured state
      const requirements = this._extractRequirements(scenes, inputs);

      // Build template object
      const template = {
        id: templateId,
        name,
        description,
        meetTypes: Array.isArray(meetTypes) ? meetTypes : [],
        createdAt: new Date().toISOString(),
        createdBy: options.createdBy || 'system',
        version: options.version || '1.0',
        requirements,
        scenes,
        inputs,
        transitions
      };

      // Save to Firebase
      const database = this._getDatabase();
      await database.ref(`templates/obs/${templateId}`).set(template);

      console.log(`[OBSTemplateManager] Template "${name}" created successfully (${templateId})`);

      return template;
    } catch (error) {
      console.error(`[OBSTemplateManager] Failed to create template "${name}":`, error.message);
      throw error;
    }
  }

  /**
   * Apply a template to current OBS instance
   * @param {string} templateId - Template ID to apply
   * @param {Object} context - Context for variable substitution
   * @returns {Promise<Object>} Result with counts and errors
   */
  async applyTemplate(templateId, context = {}) {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    try {
      console.log(`[OBSTemplateManager] Applying template ${templateId}`);

      // Load template
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Validate template has proper structure
      if (!template.scenes || !Array.isArray(template.scenes)) {
        throw new Error('Template has no scenes defined');
      }

      if (template.scenes.length === 0) {
        throw new Error('Template has empty scenes array');
      }

      // Check if scenes are objects (proper format) or strings (legacy format)
      const firstScene = template.scenes[0];
      if (typeof firstScene === 'string') {
        throw new Error(
          'Template uses legacy format (scene names only). ' +
          'Please delete this template and re-save from a configured OBS instance.'
        );
      }

      if (!firstScene.sceneName) {
        throw new Error('Template scenes missing required sceneName property');
      }

      // Validate requirements
      const validationResult = await this.validateRequirements(template);
      if (!validationResult.valid) {
        throw new Error(`Template requirements not met: ${validationResult.errors.join(', ')}`);
      }

      // Resolve variables in template
      const resolvedTemplate = this.resolveVariables(template, context);

      // Apply template
      const result = {
        scenesCreated: 0,
        inputsCreated: 0,
        inputsUpdated: 0,
        transitionsConfigured: 0,
        errors: []
      };

      // Get input definitions for passing to scene creation
      const inputDefs = resolvedTemplate.inputs || [];

      // First pass: Apply audio settings to any inputs that already exist
      // (inputs will be created during scene processing if they don't exist)
      if (inputDefs.length > 0) {
        for (const input of inputDefs) {
          try {
            const existed = await this._applyInput(input);
            if (existed) {
              result.inputsUpdated++;
            }
          } catch (error) {
            console.warn(`[OBSTemplateManager] Failed to apply input settings for ${input.inputName}:`, error.message);
            // Don't add to errors - input will be created during scene processing
          }
        }
      }

      // Apply scenes (this will create inputs as needed)
      let scenesProcessed = 0;
      if (resolvedTemplate.scenes && Array.isArray(resolvedTemplate.scenes)) {
        for (const scene of resolvedTemplate.scenes) {
          try {
            const wasCreated = await this._applyScene(scene, inputDefs);
            if (wasCreated) {
              result.scenesCreated++;
            }
            scenesProcessed++;
          } catch (error) {
            console.warn(`[OBSTemplateManager] Failed to apply scene ${scene.sceneName}:`, error.message);
            result.errors.push({
              type: 'scene',
              name: scene.sceneName,
              error: error.message
            });
          }
        }
      }

      // Count how many inputs were created (those that didn't exist before)
      // We can estimate this by checking which inputs exist now that we defined
      for (const input of inputDefs) {
        try {
          await this.obs.call('GetInputSettings', { inputName: input.inputName });
          // Input exists - if it wasn't in the "updated" count, we created it
        } catch (error) {
          // Input still doesn't exist - it was never used in any scene
        }
      }
      result.inputsCreated = inputDefs.length - result.inputsUpdated;

      // Apply transitions
      if (resolvedTemplate.transitions) {
        try {
          await this._applyTransitions(resolvedTemplate.transitions);
          result.transitionsConfigured = 1;
        } catch (error) {
          console.warn('[OBSTemplateManager] Failed to apply transitions:', error.message);
          result.errors.push({
            type: 'transitions',
            error: error.message
          });
        }
      }

      console.log(`[OBSTemplateManager] Template applied: ${result.scenesCreated} scenes, ${result.inputsCreated} inputs, ${result.transitionsConfigured} transitions configured`);

      return result;
    } catch (error) {
      console.error(`[OBSTemplateManager] Failed to apply template ${templateId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a template from Firebase
   * @param {string} templateId - Template ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteTemplate(templateId) {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    try {
      const database = this._getDatabase();

      // Check if template exists
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Delete from Firebase
      await database.ref(`templates/obs/${templateId}`).remove();

      console.log(`[OBSTemplateManager] Template ${templateId} deleted`);

      return true;
    } catch (error) {
      console.error(`[OBSTemplateManager] Failed to delete template ${templateId}:`, error.message);
      throw error;
    }
  }

  /**
   * Resolve variables in template with context values
   * @param {Object} template - Template object with variables
   * @param {Object} context - Context object with values
   * @returns {Object} Template with resolved variables
   */
  resolveVariables(template, context) {
    if (!template || typeof template !== 'object') {
      throw new Error('Template must be an object');
    }

    if (!context || typeof context !== 'object') {
      throw new Error('Context must be an object');
    }

    // Deep clone template to avoid mutations
    const resolved = JSON.parse(JSON.stringify(template));

    // Recursive variable resolver
    const resolve = (obj) => {
      if (typeof obj === 'string') {
        // Match {{variable.path}} patterns
        return obj.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
          const value = this._getNestedValue(context, path.trim());
          if (value === undefined) {
            console.warn(`[OBSTemplateManager] Variable not found in context: ${path}`);
            return match; // Leave unresolved
          }
          return value;
        });
      } else if (Array.isArray(obj)) {
        return obj.map(item => resolve(item));
      } else if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = resolve(value);
        }
        return result;
      }
      return obj;
    };

    return resolve(resolved);
  }

  /**
   * Validate template requirements against current OBS state
   * @param {Object} template - Template to validate
   * @returns {Promise<Object>} Validation result {valid: boolean, errors: []}
   */
  async validateRequirements(template) {
    if (!template || typeof template !== 'object') {
      throw new Error('Template must be an object');
    }

    const errors = [];
    const requirements = template.requirements || {};

    try {
      // Get current OBS state
      const state = this.stateSync.getState();

      // Validate cameras
      if (requirements.cameras && Array.isArray(requirements.cameras)) {
        // Check if required camera inputs exist
        const inputNames = state.inputs.map(i => i.inputName);
        for (const cameraName of requirements.cameras) {
          if (!inputNames.includes(cameraName)) {
            errors.push(`Required camera not found: ${cameraName}`);
          }
        }
      }

      // Validate assets
      if (requirements.assets && typeof requirements.assets === 'object') {
        // Get competition ID from stateSync
        const compId = this.stateSync.compId;
        if (compId) {
          const database = this._getDatabase();

          for (const [assetType, filenames] of Object.entries(requirements.assets)) {
            if (Array.isArray(filenames)) {
              // Get assets of this type from Firebase
              const snapshot = await database.ref(`competitions/${compId}/obs/assets/${assetType}`).once('value');
              const assets = snapshot.val() || [];
              const assetFilenames = assets.map(a => a.filename);

              // Check each required file
              for (const filename of filenames) {
                if (!assetFilenames.includes(filename)) {
                  errors.push(`Required ${assetType} asset not found: ${filename}`);
                }
              }
            }
          }
        } else {
          console.warn('[OBSTemplateManager] No competition ID available for asset validation');
        }
      }

      const valid = errors.length === 0;

      if (valid) {
        console.log(`[OBSTemplateManager] Template "${template.name}" requirements validated successfully`);
      } else {
        console.warn(`[OBSTemplateManager] Template "${template.name}" validation failed: ${errors.length} errors`);
      }

      return {
        valid,
        errors
      };
    } catch (error) {
      console.error('[OBSTemplateManager] Failed to validate requirements:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Capture current scenes from OBS
   * @private
   * @returns {Promise<Array>} Array of scene configurations
   */
  async _captureScenes() {
    const sceneListResponse = await this.obs.call('GetSceneList');
    const scenes = [];

    for (const scene of sceneListResponse.scenes) {
      const sceneItemsResponse = await this.obs.call('GetSceneItemList', {
        sceneName: scene.sceneName
      });

      scenes.push({
        sceneName: scene.sceneName,
        sceneIndex: scene.sceneIndex,
        items: sceneItemsResponse.sceneItems
      });
    }

    return scenes;
  }

  /**
   * Capture current inputs from OBS
   * @private
   * @returns {Promise<Array>} Array of input configurations
   */
  async _captureInputs() {
    const inputListResponse = await this.obs.call('GetInputList');
    const inputs = inputListResponse.inputs;

    // Fetch settings for each input
    const inputsWithSettings = await Promise.all(
      inputs.map(async (input) => {
        try {
          const settingsResponse = await this.obs.call('GetInputSettings', {
            inputName: input.inputName
          });
          return {
            ...input,
            inputSettings: settingsResponse.inputSettings
          };
        } catch (error) {
          console.warn(`[OBSTemplateManager] Failed to get settings for input ${input.inputName}:`, error.message);
          return input;
        }
      })
    );

    return inputsWithSettings;
  }

  /**
   * Capture current transition settings from OBS
   * @private
   * @returns {Promise<Object>} Transition configuration
   */
  async _captureTransitions() {
    const transitionListResponse = await this.obs.call('GetSceneTransitionList');
    return {
      currentTransition: transitionListResponse.currentSceneTransitionName,
      // Provide default of 0 if duration is undefined to prevent Firebase serialization errors
      currentTransitionDuration: transitionListResponse.currentSceneTransitionDuration ?? 0,
      transitions: transitionListResponse.transitions || []
    };
  }

  /**
   * Extract requirements from captured OBS state
   * @private
   * @param {Array} scenes - Captured scenes
   * @param {Array} inputs - Captured inputs
   * @returns {Object} Requirements object
   */
  _extractRequirements(scenes, inputs) {
    const requirements = {
      cameras: [],
      assets: {
        music: [],
        stingers: [],
        backgrounds: [],
        logos: []
      }
    };

    // Extract camera inputs (any video capture device)
    const cameraKinds = [
      'dshow_input',
      'av_capture_input',
      'v4l2_input'
    ];

    for (const input of inputs) {
      if (cameraKinds.includes(input.inputKind)) {
        requirements.cameras.push(input.inputName);
      }
    }

    // Extract asset references from inputs
    // Look for media sources and browser sources that might reference assets
    const mediaKinds = ['ffmpeg_source', 'browser_source'];

    for (const input of inputs) {
      if (mediaKinds.includes(input.inputKind) && input.inputSettings) {
        // Check for file paths in settings
        const settings = input.inputSettings;
        if (settings.local_file) {
          // Extract filename from path
          const filename = settings.local_file.split(/[\\/]/).pop();
          if (filename) {
            // Categorize by extension
            if (filename.match(/\.(mp3|wav|flac)$/i)) {
              requirements.assets.music.push(filename);
            } else if (filename.match(/\.(mp4|mov|avi)$/i)) {
              requirements.assets.stingers.push(filename);
            } else if (filename.match(/\.(png|jpg|jpeg|gif)$/i)) {
              requirements.assets.backgrounds.push(filename);
            }
          }
        }
      }
    }

    return requirements;
  }

  /**
   * Apply an input configuration to OBS
   * NOTE: Inputs cannot be created without a scene context in OBS WebSocket.
   * Inputs are created during _applySceneItem() when adding items to scenes.
   * This method only applies audio settings (volume, mute) to existing inputs.
   * @private
   * @param {Object} input - Input configuration
   * @returns {Promise<boolean>} True if input exists and settings were applied
   */
  async _applyInput(input) {
    // Check if input already exists
    try {
      await this.obs.call('GetInputSettings', { inputName: input.inputName });

      // Input exists - update input settings (URL, etc.) if present
      if (input.inputSettings && Object.keys(input.inputSettings).length > 0) {
        try {
          await this.obs.call('SetInputSettings', {
            inputName: input.inputName,
            inputSettings: input.inputSettings
          });
          console.log(`[OBSTemplateManager] Updated settings for "${input.inputName}"`);
        } catch (settingsError) {
          console.warn(`[OBSTemplateManager] Failed to update settings for ${input.inputName}:`, settingsError.message);
        }
      }

      // Apply audio settings if present
      if (input.volume !== undefined) {
        try {
          // OBS uses inputVolumeMul for multiplier (0.0 to 1.0+)
          await this.obs.call('SetInputVolume', {
            inputName: input.inputName,
            inputVolumeMul: input.volume
          });
          console.log(`[OBSTemplateManager] Set volume for "${input.inputName}" to ${input.volume}`);
        } catch (volError) {
          console.warn(`[OBSTemplateManager] Failed to set volume for ${input.inputName}:`, volError.message);
        }
      }

      if (input.muted !== undefined) {
        try {
          await this.obs.call('SetInputMute', {
            inputName: input.inputName,
            inputMuted: input.muted
          });
          console.log(`[OBSTemplateManager] Set mute for "${input.inputName}" to ${input.muted}`);
        } catch (muteError) {
          console.warn(`[OBSTemplateManager] Failed to set mute for ${input.inputName}:`, muteError.message);
        }
      }

      console.log(`[OBSTemplateManager] Input "${input.inputName}" already exists, settings applied`);
      return true;
    } catch (error) {
      // Input doesn't exist - it will be created when processing scene items
      console.log(`[OBSTemplateManager] Input "${input.inputName}" doesn't exist yet, will be created with first scene item`);
      return false;
    }
  }

  /**
   * Apply a scene configuration to OBS
   * @private
   * @param {Object} scene - Scene configuration
   * @param {Array} inputs - Input definitions from template for creating sources
   * @returns {Promise<boolean>} True if scene was created, false if it already existed
   */
  async _applyScene(scene, inputs = []) {
    let sceneCreated = false;
    let existingItems = [];

    // Check if scene already exists
    try {
      const existingScene = await this.obs.call('GetSceneItemList', { sceneName: scene.sceneName });
      existingItems = existingScene.sceneItems || [];
      console.log(`[OBSTemplateManager] Scene "${scene.sceneName}" already exists with ${existingItems.length} items, will add missing sources`);
    } catch (error) {
      // Scene doesn't exist, create it
      await this.obs.call('CreateScene', {
        sceneName: scene.sceneName
      });
      sceneCreated = true;
      console.log(`[OBSTemplateManager] Created scene "${scene.sceneName}"`);
    }

    // Get names of sources already in this scene
    const existingSourceNames = new Set(existingItems.map(item => item.sourceName));

    // Add scene items (skip if source already exists in this scene)
    let itemsAdded = 0;
    if (scene.items && Array.isArray(scene.items)) {
      for (const item of scene.items) {
        // Skip if this source is already in the scene
        if (existingSourceNames.has(item.sourceName)) {
          console.log(`[OBSTemplateManager] Source "${item.sourceName}" already in scene "${scene.sceneName}", skipping`);
          continue;
        }

        try {
          const sceneItemId = await this._applySceneItem(scene.sceneName, item, inputs);

          // Apply transform if present and item was created
          if (sceneItemId && item.sceneItemTransform) {
            try {
              await this.obs.call('SetSceneItemTransform', {
                sceneName: scene.sceneName,
                sceneItemId: sceneItemId,
                sceneItemTransform: item.sceneItemTransform
              });
            } catch (transformError) {
              console.warn(`[OBSTemplateManager] Failed to set transform for ${item.sourceName}:`, transformError.message);
            }
          }

          if (sceneItemId) {
            itemsAdded++;
          }
        } catch (error) {
          console.warn(`[OBSTemplateManager] Failed to add item ${item.sourceName} to scene ${scene.sceneName}:`, error.message);
        }
      }
    }

    if (sceneCreated) {
      console.log(`[OBSTemplateManager] Scene "${scene.sceneName}" created with ${itemsAdded} items`);
    } else if (itemsAdded > 0) {
      console.log(`[OBSTemplateManager] Added ${itemsAdded} items to existing scene "${scene.sceneName}"`);
    }

    return sceneCreated;
  }

  /**
   * Apply a single scene item, creating the input if it doesn't exist
   * @private
   * @param {string} sceneName - Scene to add item to
   * @param {Object} item - Scene item configuration
   * @param {Array} inputs - Input definitions from template
   * @returns {Promise<number|null>} Scene item ID if created, null otherwise
   */
  async _applySceneItem(sceneName, item, inputs) {
    // Check if input/source already exists
    let inputExists = false;
    try {
      await this.obs.call('GetInputSettings', { inputName: item.sourceName });
      inputExists = true;
    } catch (error) {
      // Input doesn't exist
    }

    let sceneItemId = null;

    if (inputExists) {
      // Input exists, add it to this scene using CreateSceneItem
      try {
        const result = await this.obs.call('CreateSceneItem', {
          sceneName: sceneName,
          sourceName: item.sourceName,
          sceneItemEnabled: item.sceneItemEnabled !== undefined ? item.sceneItemEnabled : true
        });
        sceneItemId = result.sceneItemId;
        console.log(`[OBSTemplateManager] Added existing input "${item.sourceName}" to scene "${sceneName}"`);
      } catch (error) {
        // May fail if item already in scene
        console.warn(`[OBSTemplateManager] Could not add ${item.sourceName} to ${sceneName}:`, error.message);
      }
    } else {
      // Input doesn't exist - need to create it with this scene as context
      // Look up input definition from template
      const inputDef = inputs.find(i => i.inputName === item.sourceName);
      if (inputDef) {
        try {
          const result = await this.obs.call('CreateInput', {
            sceneName: sceneName,
            inputName: inputDef.inputName,
            inputKind: inputDef.inputKind,
            inputSettings: inputDef.inputSettings || {},
            sceneItemEnabled: item.sceneItemEnabled !== undefined ? item.sceneItemEnabled : true
          });
          sceneItemId = result.sceneItemId;
          console.log(`[OBSTemplateManager] Created input "${inputDef.inputName}" in scene "${sceneName}"`);

          // Apply audio settings if present
          if (inputDef.volume !== undefined) {
            try {
              await this.obs.call('SetInputVolume', {
                inputName: inputDef.inputName,
                inputVolumeMul: inputDef.volume
              });
            } catch (volError) {
              console.warn(`[OBSTemplateManager] Failed to set volume for ${inputDef.inputName}:`, volError.message);
            }
          }
          if (inputDef.muted !== undefined) {
            try {
              await this.obs.call('SetInputMute', {
                inputName: inputDef.inputName,
                inputMuted: inputDef.muted
              });
            } catch (muteError) {
              console.warn(`[OBSTemplateManager] Failed to set mute for ${inputDef.inputName}:`, muteError.message);
            }
          }
        } catch (createError) {
          console.warn(`[OBSTemplateManager] Failed to create input ${inputDef.inputName}:`, createError.message);
        }
      } else {
        console.warn(`[OBSTemplateManager] No input definition found for "${item.sourceName}", cannot create`);
      }
    }

    return sceneItemId;
  }

  /**
   * Apply transition settings to OBS
   * @private
   * @param {Object} transitions - Transition configuration
   * @returns {Promise<void>}
   */
  async _applyTransitions(transitions) {
    if (transitions.currentTransition) {
      await this.obs.call('SetCurrentSceneTransition', {
        transitionName: transitions.currentTransition
      });
      console.log(`[OBSTemplateManager] Set current transition to "${transitions.currentTransition}"`);
    }

    if (transitions.currentTransitionDuration !== undefined) {
      await this.obs.call('SetCurrentSceneTransitionDuration', {
        transitionDuration: transitions.currentTransitionDuration
      });
      console.log(`[OBSTemplateManager] Set transition duration to ${transitions.currentTransitionDuration}ms`);
    }
  }

  /**
   * Get nested value from object using dot notation path
   * @private
   * @param {Object} obj - Object to search
   * @param {string} path - Dot notation path (e.g., 'assets.music.filename')
   * @returns {*} Value at path or undefined
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

export default OBSTemplateManager;
