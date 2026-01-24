/**
 * Segment Mapper - Converts Rundown Editor segments to Timesheet Engine format
 *
 * PRD: PRD-Rundown-System-2026-01-23.md
 * Task: 11 - Create segment mapper
 *
 * The Rundown Editor and Timesheet Engine use slightly different field names.
 * This module provides utilities to convert between formats.
 *
 * Editor Format (stored in Firebase):
 *   - scene: OBS scene name
 *   - graphic: { graphicId: string, params: object } | null
 *   - timingMode: 'fixed' | 'manual'
 *   - autoAdvance: boolean (legacy, may exist)
 *
 * Engine Format (used by TimesheetEngine):
 *   - obsScene: OBS scene name
 *   - graphic: string (graphic identifier)
 *   - graphicData: object (graphic parameters)
 *   - autoAdvance: boolean
 */

/**
 * Convert a single segment from Editor format to Engine format
 * @param {Object} editorSegment - Segment in Rundown Editor format
 * @returns {Object} Segment in Timesheet Engine format
 */
function mapEditorToEngine(editorSegment) {
  if (!editorSegment) {
    return null;
  }

  const engineSegment = {
    // Direct copy fields
    id: editorSegment.id,
    name: editorSegment.name,
    type: editorSegment.type,
    duration: editorSegment.duration,
    notes: editorSegment.notes || '',

    // Mapped fields
    obsScene: editorSegment.scene || null,

    // Graphic mapping: { graphicId, params } -> separate fields
    graphic: editorSegment.graphic?.graphicId || null,
    graphicData: editorSegment.graphic?.params || {},

    // Timing mode mapping: 'fixed' -> true, 'manual' -> false
    // If timingMode is not set, check legacy autoAdvance field, default to false
    autoAdvance: editorSegment.timingMode
      ? editorSegment.timingMode === 'fixed'
      : (editorSegment.autoAdvance ?? false),
  };

  // Preserve optional fields if present
  if (editorSegment.bufferAfter !== undefined) {
    engineSegment.bufferAfter = editorSegment.bufferAfter;
  }
  if (editorSegment.locked !== undefined) {
    engineSegment.locked = editorSegment.locked;
  }
  if (editorSegment.optional !== undefined) {
    engineSegment.optional = editorSegment.optional;
  }
  if (editorSegment.minDuration !== undefined) {
    engineSegment.minDuration = editorSegment.minDuration;
  }
  if (editorSegment.maxDuration !== undefined) {
    engineSegment.maxDuration = editorSegment.maxDuration;
  }

  return engineSegment;
}

/**
 * Convert an array of segments from Editor format to Engine format
 * @param {Array} editorSegments - Array of segments in Rundown Editor format
 * @returns {Array} Array of segments in Timesheet Engine format
 */
function mapEditorSegmentsToEngine(editorSegments) {
  if (!Array.isArray(editorSegments)) {
    return [];
  }
  return editorSegments.map(mapEditorToEngine).filter(Boolean);
}

/**
 * Convert a single segment from Engine format back to Editor format
 * Useful for displaying engine state in the UI
 * @param {Object} engineSegment - Segment in Timesheet Engine format
 * @returns {Object} Segment in Rundown Editor format
 */
function mapEngineToEditor(engineSegment) {
  if (!engineSegment) {
    return null;
  }

  const editorSegment = {
    // Direct copy fields
    id: engineSegment.id,
    name: engineSegment.name,
    type: engineSegment.type,
    duration: engineSegment.duration,
    notes: engineSegment.notes || '',

    // Mapped fields
    scene: engineSegment.obsScene || '',

    // Graphic mapping: separate fields -> { graphicId, params }
    graphic: engineSegment.graphic
      ? { graphicId: engineSegment.graphic, params: engineSegment.graphicData || {} }
      : null,

    // autoAdvance -> timingMode
    timingMode: engineSegment.autoAdvance ? 'fixed' : 'manual',
    autoAdvance: engineSegment.autoAdvance,
  };

  // Preserve optional fields if present
  if (engineSegment.bufferAfter !== undefined) {
    editorSegment.bufferAfter = engineSegment.bufferAfter;
  }
  if (engineSegment.locked !== undefined) {
    editorSegment.locked = engineSegment.locked;
  }
  if (engineSegment.optional !== undefined) {
    editorSegment.optional = engineSegment.optional;
  }
  if (engineSegment.minDuration !== undefined) {
    editorSegment.minDuration = engineSegment.minDuration;
  }
  if (engineSegment.maxDuration !== undefined) {
    editorSegment.maxDuration = engineSegment.maxDuration;
  }

  return editorSegment;
}

/**
 * Convert an array of segments from Engine format to Editor format
 * @param {Array} engineSegments - Array of segments in Timesheet Engine format
 * @returns {Array} Array of segments in Rundown Editor format
 */
function mapEngineSegmentsToEditor(engineSegments) {
  if (!Array.isArray(engineSegments)) {
    return [];
  }
  return engineSegments.map(mapEngineToEditor).filter(Boolean);
}

/**
 * Validate a segment has required fields for the Engine
 * @param {Object} segment - Segment to validate (in Engine format)
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
function validateEngineSegment(segment) {
  const errors = [];

  if (!segment) {
    return { valid: false, errors: ['Segment is null or undefined'] };
  }

  if (!segment.id) {
    errors.push('Missing required field: id');
  }
  if (!segment.name) {
    errors.push('Missing required field: name');
  }
  if (!segment.type) {
    errors.push('Missing required field: type');
  }

  // Duration can be null/0 for untimed segments, but warn if missing for timed types
  if (segment.type === 'video' && !segment.duration) {
    errors.push('Video segment missing duration');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate an array of segments, returning detailed results
 * @param {Array} segments - Segments to validate (in Engine format)
 * @returns {{ valid: boolean, totalSegments: number, validCount: number, invalidCount: number, errors: Array }}
 */
function validateEngineSegments(segments) {
  if (!Array.isArray(segments)) {
    return {
      valid: false,
      totalSegments: 0,
      validCount: 0,
      invalidCount: 0,
      errors: [{ index: -1, message: 'Segments is not an array' }]
    };
  }

  const allErrors = [];
  let validCount = 0;

  segments.forEach((segment, index) => {
    const result = validateEngineSegment(segment);
    if (result.valid) {
      validCount++;
    } else {
      result.errors.forEach(error => {
        allErrors.push({
          index,
          segmentId: segment?.id || 'unknown',
          segmentName: segment?.name || 'unnamed',
          message: error
        });
      });
    }
  });

  return {
    valid: allErrors.length === 0,
    totalSegments: segments.length,
    validCount,
    invalidCount: segments.length - validCount,
    errors: allErrors
  };
}

module.exports = {
  mapEditorToEngine,
  mapEditorSegmentsToEngine,
  mapEngineToEditor,
  mapEngineSegmentsToEditor,
  validateEngineSegment,
  validateEngineSegments
};
