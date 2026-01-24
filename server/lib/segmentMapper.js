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
 *   - audioCue: { songName: string, inPoint: string, outPoint: string } | null (Phase F)
 *
 * Engine Format (used by TimesheetEngine):
 *   - obsScene: OBS scene name
 *   - graphic: string (graphic identifier)
 *   - graphicData: object (graphic parameters)
 *   - autoAdvance: boolean
 *   - audioCue: { songName: string, inPoint: string, outPoint: string } | null (Phase F)
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
    script: editorSegment.script || '', // Phase E: Task 49 - script for talent/teleprompter
    talent: editorSegment.talent || [], // Phase E: Task 52 - talent assignment for segments
    audioCue: editorSegment.audioCue || null, // Phase F: Task 63 - audio cue for segment start

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
    script: engineSegment.script || '', // Phase E: Task 49 - script for talent/teleprompter
    talent: engineSegment.talent || [], // Phase E: Task 52 - talent assignment for segments
    audioCue: engineSegment.audioCue || null, // Phase F: Task 63 - audio cue for segment start

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

/**
 * Deep equality check for two values
 * Handles objects, arrays, and primitives
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} True if deeply equal
 */
function deepEqual(a, b) {
  // Primitives and null/undefined
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // Arrays
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  // Objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => deepEqual(a[key], b[key]));
}

/**
 * Compare two segments and return an object describing the changes
 * @param {Object} oldSegment - Previous segment state
 * @param {Object} newSegment - New segment state
 * @returns {{ hasChanges: boolean, changedFields: string[] }} Change details
 */
function compareSegments(oldSegment, newSegment) {
  if (!oldSegment || !newSegment) {
    return { hasChanges: true, changedFields: ['*'] };
  }

  const changedFields = [];

  // Fields to compare (both direct and mapped)
  const fieldsToCompare = [
    'name', 'type', 'duration', 'notes', 'script', 'talent', 'audioCue',
    'scene', 'obsScene',
    'graphic', 'graphicData',
    'timingMode', 'autoAdvance',
    'bufferAfter', 'locked', 'optional', 'minDuration', 'maxDuration'
  ];

  for (const field of fieldsToCompare) {
    if (!deepEqual(oldSegment[field], newSegment[field])) {
      changedFields.push(field);
    }
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields
  };
}

/**
 * Detect duplicate segment IDs in an array
 * @param {Array} segments - Array of segments to check
 * @returns {{ hasDuplicates: boolean, duplicates: Array<{ id: string, indices: number[], names: string[] }> }}
 */
function detectDuplicateIds(segments) {
  if (!Array.isArray(segments)) {
    return { hasDuplicates: false, duplicates: [] };
  }

  // Count occurrences of each ID
  const idOccurrences = new Map();
  segments.forEach((seg, index) => {
    if (!seg || !seg.id) return;

    if (!idOccurrences.has(seg.id)) {
      idOccurrences.set(seg.id, { indices: [], names: [] });
    }
    idOccurrences.get(seg.id).indices.push(index);
    idOccurrences.get(seg.id).names.push(seg.name || 'Unnamed');
  });

  // Find duplicates (IDs that appear more than once)
  const duplicates = [];
  for (const [id, data] of idOccurrences) {
    if (data.indices.length > 1) {
      duplicates.push({
        id,
        indices: data.indices,
        names: data.names
      });
    }
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates
  };
}

/**
 * Deduplicate segments by ID, keeping only the first occurrence of each ID
 * This is a safety measure to handle corrupted data gracefully
 * @param {Array} segments - Array of segments that may contain duplicates
 * @returns {{ segments: Array, removed: Array<{ id: string, index: number, name: string }> }}
 */
function deduplicateSegmentsById(segments) {
  if (!Array.isArray(segments)) {
    return { segments: [], removed: [] };
  }

  const seenIds = new Set();
  const deduped = [];
  const removed = [];

  segments.forEach((seg, index) => {
    if (!seg || !seg.id) {
      // Keep segments without IDs (shouldn't happen, but be safe)
      deduped.push(seg);
      return;
    }

    if (seenIds.has(seg.id)) {
      // Duplicate - record but skip
      removed.push({
        id: seg.id,
        index,
        name: seg.name || 'Unnamed'
      });
    } else {
      seenIds.add(seg.id);
      deduped.push(seg);
    }
  });

  return { segments: deduped, removed };
}

/**
 * Compare two arrays of segments and produce a diff summary
 *
 * @param {Array} oldSegments - Previously loaded segments
 * @param {Array} newSegments - New segments from Firebase
 * @returns {{
 *   hasChanges: boolean,
 *   added: Array<{ id: string, name: string, index: number }>,
 *   removed: Array<{ id: string, name: string, index: number }>,
 *   modified: Array<{ id: string, name: string, oldIndex: number, newIndex: number, changedFields: string[] }>,
 *   reordered: Array<{ id: string, name: string, oldIndex: number, newIndex: number }>,
 *   summary: string
 * }}
 */
function diffSegments(oldSegments, newSegments) {
  // Handle null/undefined inputs
  const oldArray = Array.isArray(oldSegments) ? oldSegments : [];
  const newArray = Array.isArray(newSegments) ? newSegments : [];

  // Build lookup maps by ID
  const oldById = new Map(oldArray.map((seg, index) => [seg.id, { segment: seg, index }]));
  const newById = new Map(newArray.map((seg, index) => [seg.id, { segment: seg, index }]));

  const added = [];
  const removed = [];
  const modified = [];
  const reordered = [];

  // Find removed and modified segments
  for (const [id, { segment: oldSeg, index: oldIndex }] of oldById) {
    const newEntry = newById.get(id);
    if (!newEntry) {
      // Segment was removed
      removed.push({
        id,
        name: oldSeg.name || 'Unnamed',
        index: oldIndex
      });
    } else {
      const { segment: newSeg, index: newIndex } = newEntry;

      // Check for content modifications
      const comparison = compareSegments(oldSeg, newSeg);
      if (comparison.hasChanges) {
        modified.push({
          id,
          name: newSeg.name || oldSeg.name || 'Unnamed',
          oldIndex,
          newIndex,
          changedFields: comparison.changedFields
        });
      } else if (oldIndex !== newIndex) {
        // Position changed but content is the same
        reordered.push({
          id,
          name: newSeg.name || 'Unnamed',
          oldIndex,
          newIndex
        });
      }
    }
  }

  // Find added segments
  for (const [id, { segment: newSeg, index: newIndex }] of newById) {
    if (!oldById.has(id)) {
      added.push({
        id,
        name: newSeg.name || 'Unnamed',
        index: newIndex
      });
    }
  }

  // Sort results by index for consistency
  added.sort((a, b) => a.index - b.index);
  removed.sort((a, b) => a.index - b.index);
  modified.sort((a, b) => a.newIndex - b.newIndex);
  reordered.sort((a, b) => a.newIndex - b.newIndex);

  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0 || reordered.length > 0;

  // Build human-readable summary
  const summaryParts = [];
  if (added.length > 0) {
    summaryParts.push(`${added.length} added`);
  }
  if (removed.length > 0) {
    summaryParts.push(`${removed.length} removed`);
  }
  if (modified.length > 0) {
    summaryParts.push(`${modified.length} modified`);
  }
  if (reordered.length > 0) {
    summaryParts.push(`${reordered.length} reordered`);
  }
  const summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'No changes';

  return {
    hasChanges,
    added,
    removed,
    modified,
    reordered,
    summary
  };
}

export {
  mapEditorToEngine,
  mapEditorSegmentsToEngine,
  mapEngineToEditor,
  mapEngineSegmentsToEditor,
  validateEngineSegment,
  validateEngineSegments,
  deepEqual,
  compareSegments,
  diffSegments,
  detectDuplicateIds,
  deduplicateSegmentsById
};
