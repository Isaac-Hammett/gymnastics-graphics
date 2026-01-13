/**
 * Show Configuration Schema Validator
 *
 * Validates show-config.json against the expected schema for camera management
 * and timesheet-driven show control.
 */

// Valid apparatus codes
const MENS_APPARATUS = ['FX', 'PH', 'SR', 'VT', 'PB', 'HB'];
const WOMENS_APPARATUS = ['VT', 'UB', 'BB', 'FX'];
const ALL_APPARATUS = [...new Set([...MENS_APPARATUS, ...WOMENS_APPARATUS])];

// Valid segment types
const SEGMENT_TYPES = ['static', 'live', 'multi', 'hold', 'break', 'video', 'graphic'];

// Valid health status values
const HEALTH_STATUS_VALUES = ['healthy', 'degraded', 'reconnecting', 'offline', 'unknown'];

/**
 * Validate a single camera configuration
 * @param {Object} camera - Camera configuration object
 * @param {number} index - Index in cameras array
 * @param {string[]} allCameraIds - Array of all camera IDs for fallback validation
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateCamera(camera, index, allCameraIds) {
  const errors = [];
  const prefix = `cameras[${index}]`;

  // Required fields
  if (!camera.id) {
    errors.push(`${prefix}: missing required field 'id'`);
  } else if (typeof camera.id !== 'string') {
    errors.push(`${prefix}.id: must be a string`);
  }

  if (!camera.name) {
    errors.push(`${prefix}: missing required field 'name'`);
  } else if (typeof camera.name !== 'string') {
    errors.push(`${prefix}.name: must be a string`);
  }

  // SRT connection details (optional but recommended)
  if (camera.srtPort !== undefined && typeof camera.srtPort !== 'number') {
    errors.push(`${prefix}.srtPort: must be a number`);
  }

  if (camera.srtUrl !== undefined && typeof camera.srtUrl !== 'string') {
    errors.push(`${prefix}.srtUrl: must be a string`);
  }

  // Expected apparatus (optional)
  if (camera.expectedApparatus !== undefined) {
    if (!Array.isArray(camera.expectedApparatus)) {
      errors.push(`${prefix}.expectedApparatus: must be an array`);
    } else {
      camera.expectedApparatus.forEach((apparatus, i) => {
        if (!ALL_APPARATUS.includes(apparatus)) {
          errors.push(`${prefix}.expectedApparatus[${i}]: invalid apparatus code '${apparatus}'. Valid codes: ${ALL_APPARATUS.join(', ')}`);
        }
      });
    }
  }

  // Fallback camera (optional)
  if (camera.fallbackCameraId !== undefined) {
    if (typeof camera.fallbackCameraId !== 'string') {
      errors.push(`${prefix}.fallbackCameraId: must be a string`);
    } else if (!allCameraIds.includes(camera.fallbackCameraId)) {
      errors.push(`${prefix}.fallbackCameraId: references non-existent camera '${camera.fallbackCameraId}'`);
    } else if (camera.fallbackCameraId === camera.id) {
      errors.push(`${prefix}.fallbackCameraId: camera cannot be its own fallback`);
    }
  }

  // Health thresholds (optional)
  if (camera.healthThresholds !== undefined) {
    if (typeof camera.healthThresholds !== 'object' || camera.healthThresholds === null) {
      errors.push(`${prefix}.healthThresholds: must be an object`);
    } else {
      if (camera.healthThresholds.minBitrate !== undefined && typeof camera.healthThresholds.minBitrate !== 'number') {
        errors.push(`${prefix}.healthThresholds.minBitrate: must be a number`);
      }
      if (camera.healthThresholds.maxPacketLoss !== undefined && typeof camera.healthThresholds.maxPacketLoss !== 'number') {
        errors.push(`${prefix}.healthThresholds.maxPacketLoss: must be a number`);
      }
      if (camera.healthThresholds.reconnectWindowMs !== undefined && typeof camera.healthThresholds.reconnectWindowMs !== 'number') {
        errors.push(`${prefix}.healthThresholds.reconnectWindowMs: must be a number`);
      }
    }
  }

  return errors;
}

/**
 * Validate nimble server configuration
 * @param {Object} nimbleServer - Nimble server configuration
 * @returns {string[]} Array of error messages
 */
function validateNimbleServer(nimbleServer) {
  const errors = [];

  if (nimbleServer === undefined) {
    return errors; // Optional block
  }

  if (typeof nimbleServer !== 'object' || nimbleServer === null) {
    errors.push('nimbleServer: must be an object');
    return errors;
  }

  if (nimbleServer.host !== undefined && typeof nimbleServer.host !== 'string') {
    errors.push('nimbleServer.host: must be a string');
  }

  if (nimbleServer.statsPort !== undefined && typeof nimbleServer.statsPort !== 'number') {
    errors.push('nimbleServer.statsPort: must be a number');
  }

  if (nimbleServer.pollIntervalMs !== undefined && typeof nimbleServer.pollIntervalMs !== 'number') {
    errors.push('nimbleServer.pollIntervalMs: must be a number');
  }

  return errors;
}

/**
 * Validate audio configuration
 * @param {Object} audioConfig - Audio configuration
 * @returns {string[]} Array of error messages
 */
function validateAudioConfig(audioConfig) {
  const errors = [];

  if (audioConfig === undefined) {
    return errors; // Optional block
  }

  if (typeof audioConfig !== 'object' || audioConfig === null) {
    errors.push('audioConfig: must be an object');
    return errors;
  }

  // Validate venue audio
  if (audioConfig.venue !== undefined) {
    if (typeof audioConfig.venue !== 'object' || audioConfig.venue === null) {
      errors.push('audioConfig.venue: must be an object');
    } else {
      if (audioConfig.venue.sourceName !== undefined && typeof audioConfig.venue.sourceName !== 'string') {
        errors.push('audioConfig.venue.sourceName: must be a string');
      }
      if (audioConfig.venue.defaultVolume !== undefined && typeof audioConfig.venue.defaultVolume !== 'number') {
        errors.push('audioConfig.venue.defaultVolume: must be a number');
      }
    }
  }

  // Validate commentary audio
  if (audioConfig.commentary !== undefined) {
    if (typeof audioConfig.commentary !== 'object' || audioConfig.commentary === null) {
      errors.push('audioConfig.commentary: must be an object');
    } else {
      if (audioConfig.commentary.sourceName !== undefined && typeof audioConfig.commentary.sourceName !== 'string') {
        errors.push('audioConfig.commentary.sourceName: must be a string');
      }
      if (audioConfig.commentary.defaultVolume !== undefined && typeof audioConfig.commentary.defaultVolume !== 'number') {
        errors.push('audioConfig.commentary.defaultVolume: must be a number');
      }
    }
  }

  return errors;
}

/**
 * Validate graphics overlay configuration
 * @param {Object} graphicsOverlay - Graphics overlay configuration
 * @returns {string[]} Array of error messages
 */
function validateGraphicsOverlay(graphicsOverlay) {
  const errors = [];

  if (graphicsOverlay === undefined) {
    return errors; // Optional block
  }

  if (typeof graphicsOverlay !== 'object' || graphicsOverlay === null) {
    errors.push('graphicsOverlay: must be an object');
    return errors;
  }

  if (graphicsOverlay.url !== undefined && typeof graphicsOverlay.url !== 'string') {
    errors.push('graphicsOverlay.url: must be a string');
  }

  if (graphicsOverlay.queryParams !== undefined) {
    if (typeof graphicsOverlay.queryParams !== 'object' || graphicsOverlay.queryParams === null) {
      errors.push('graphicsOverlay.queryParams: must be an object');
    }
  }

  return errors;
}

/**
 * Validate transitions configuration
 * @param {Object} transitions - Transitions configuration
 * @returns {string[]} Array of error messages
 */
function validateTransitions(transitions) {
  const errors = [];

  if (transitions === undefined) {
    return errors; // Optional block
  }

  if (typeof transitions !== 'object' || transitions === null) {
    errors.push('transitions: must be an object');
    return errors;
  }

  const transitionTypes = ['default', 'toBreak', 'fromBreak'];
  transitionTypes.forEach(type => {
    if (transitions[type] !== undefined) {
      if (typeof transitions[type] !== 'object' || transitions[type] === null) {
        errors.push(`transitions.${type}: must be an object`);
      } else {
        if (transitions[type].type !== undefined && !['cut', 'fade'].includes(transitions[type].type)) {
          errors.push(`transitions.${type}.type: must be 'cut' or 'fade'`);
        }
        if (transitions[type].durationMs !== undefined && typeof transitions[type].durationMs !== 'number') {
          errors.push(`transitions.${type}.durationMs: must be a number`);
        }
      }
    }
  });

  return errors;
}

/**
 * Validate a single segment configuration
 * @param {Object} segment - Segment configuration object
 * @param {number} index - Index in segments array
 * @param {string[]} allCameraIds - Array of all camera IDs for reference validation
 * @returns {string[]} Array of error messages
 */
function validateSegment(segment, index, allCameraIds) {
  const errors = [];
  const prefix = `segments[${index}]`;

  // Required fields
  if (!segment.id) {
    errors.push(`${prefix}: missing required field 'id'`);
  } else if (typeof segment.id !== 'string') {
    errors.push(`${prefix}.id: must be a string`);
  }

  if (!segment.name) {
    errors.push(`${prefix}: missing required field 'name'`);
  } else if (typeof segment.name !== 'string') {
    errors.push(`${prefix}.name: must be a string`);
  }

  // Segment type (optional, defaults to 'live')
  if (segment.type !== undefined && !SEGMENT_TYPES.includes(segment.type)) {
    errors.push(`${prefix}.type: invalid type '${segment.type}'. Valid types: ${SEGMENT_TYPES.join(', ')}`);
  }

  // Duration
  if (segment.duration !== undefined && segment.duration !== null && typeof segment.duration !== 'number') {
    errors.push(`${prefix}.duration: must be a number or null`);
  }

  // Auto advance
  if (segment.autoAdvance !== undefined && typeof segment.autoAdvance !== 'boolean') {
    errors.push(`${prefix}.autoAdvance: must be a boolean`);
  }

  // OBS scene
  if (segment.obsScene !== undefined && segment.obsScene !== null && typeof segment.obsScene !== 'string') {
    errors.push(`${prefix}.obsScene: must be a string or null`);
  }

  // Camera ID reference (new field)
  if (segment.cameraId !== undefined) {
    if (typeof segment.cameraId !== 'string') {
      errors.push(`${prefix}.cameraId: must be a string`);
    } else if (allCameraIds.length > 0 && !allCameraIds.includes(segment.cameraId)) {
      errors.push(`${prefix}.cameraId: references non-existent camera '${segment.cameraId}'`);
    }
  }

  // Multiple camera IDs (for multi-view segments)
  if (segment.cameraIds !== undefined) {
    if (!Array.isArray(segment.cameraIds)) {
      errors.push(`${prefix}.cameraIds: must be an array`);
    } else {
      segment.cameraIds.forEach((camId, i) => {
        if (typeof camId !== 'string') {
          errors.push(`${prefix}.cameraIds[${i}]: must be a string`);
        } else if (allCameraIds.length > 0 && !allCameraIds.includes(camId)) {
          errors.push(`${prefix}.cameraIds[${i}]: references non-existent camera '${camId}'`);
        }
      });
    }
  }

  // Intended apparatus (for segment metadata)
  if (segment.intendedApparatus !== undefined) {
    if (!Array.isArray(segment.intendedApparatus)) {
      errors.push(`${prefix}.intendedApparatus: must be an array`);
    } else {
      segment.intendedApparatus.forEach((apparatus, i) => {
        if (!ALL_APPARATUS.includes(apparatus)) {
          errors.push(`${prefix}.intendedApparatus[${i}]: invalid apparatus code '${apparatus}'`);
        }
      });
    }
  }

  // Hold segment specific fields
  if (segment.type === 'hold') {
    if (segment.minDuration !== undefined && typeof segment.minDuration !== 'number') {
      errors.push(`${prefix}.minDuration: must be a number`);
    }
    if (segment.maxDuration !== undefined && typeof segment.maxDuration !== 'number') {
      errors.push(`${prefix}.maxDuration: must be a number`);
    }
  }

  // Transition override
  if (segment.transition !== undefined) {
    if (typeof segment.transition !== 'object' || segment.transition === null) {
      errors.push(`${prefix}.transition: must be an object`);
    } else {
      if (segment.transition.type !== undefined && !['cut', 'fade'].includes(segment.transition.type)) {
        errors.push(`${prefix}.transition.type: must be 'cut' or 'fade'`);
      }
      if (segment.transition.durationMs !== undefined && typeof segment.transition.durationMs !== 'number') {
        errors.push(`${prefix}.transition.durationMs: must be a number`);
      }
    }
  }

  return errors;
}

/**
 * Validate the entire show configuration
 * @param {Object} config - Show configuration object
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
function validateShowConfig(config) {
  const errors = [];

  // Config must be an object
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be an object'] };
  }

  // Show name (required)
  if (!config.showName) {
    errors.push('Missing required field: showName');
  } else if (typeof config.showName !== 'string') {
    errors.push('showName: must be a string');
  }

  // Segments (required)
  if (!config.segments) {
    errors.push('Missing required field: segments');
  } else if (!Array.isArray(config.segments)) {
    errors.push('segments: must be an array');
  }

  // Get all camera IDs for reference validation
  const allCameraIds = (config.cameras || [])
    .filter(c => c && c.id)
    .map(c => c.id);

  // Validate cameras (optional but recommended for new features)
  if (config.cameras !== undefined) {
    if (!Array.isArray(config.cameras)) {
      errors.push('cameras: must be an array');
    } else {
      // First pass: collect all camera IDs
      const cameraIds = config.cameras.filter(c => c && c.id).map(c => c.id);

      // Check for duplicate camera IDs
      const duplicateIds = cameraIds.filter((id, index) => cameraIds.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        errors.push(`cameras: duplicate camera IDs found: ${[...new Set(duplicateIds)].join(', ')}`);
      }

      // Second pass: validate each camera
      config.cameras.forEach((camera, index) => {
        errors.push(...validateCamera(camera, index, cameraIds));
      });
    }
  }

  // Validate nimble server config
  errors.push(...validateNimbleServer(config.nimbleServer));

  // Validate audio config
  errors.push(...validateAudioConfig(config.audioConfig));

  // Validate graphics overlay
  errors.push(...validateGraphicsOverlay(config.graphicsOverlay));

  // Validate transitions
  errors.push(...validateTransitions(config.transitions));

  // Validate segments
  if (Array.isArray(config.segments)) {
    // Check for duplicate segment IDs
    const segmentIds = config.segments.filter(s => s && s.id).map(s => s.id);
    const duplicateSegmentIds = segmentIds.filter((id, index) => segmentIds.indexOf(id) !== index);
    if (duplicateSegmentIds.length > 0) {
      errors.push(`segments: duplicate segment IDs found: ${[...new Set(duplicateSegmentIds)].join(', ')}`);
    }

    // Validate each segment
    config.segments.forEach((segment, index) => {
      errors.push(...validateSegment(segment, index, allCameraIds));
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Export for both CommonJS and ES modules
export { validateShowConfig, MENS_APPARATUS, WOMENS_APPARATUS, ALL_APPARATUS, SEGMENT_TYPES };
export default { validateShowConfig, MENS_APPARATUS, WOMENS_APPARATUS, ALL_APPARATUS, SEGMENT_TYPES };
