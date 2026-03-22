import { useEffect, useCallback, useState, useMemo } from 'react';

/**
 * Default keyboard shortcut mappings
 * Action -> Key mapping
 */
export const DEFAULT_SHORTCUTS = {
  forceCamera1: '1',
  forceCamera2: '2',
  forceCamera3: '3',
  forceCamera4: '4',
  forceCamera5: '5',
  forceCamera6: '6',
  skip: 's',
  pause: ' ', // Space
  releaseOverride: 'Escape',
  flagMoment: 'f',
  showShortcuts: '?',
};

/**
 * Human-readable labels for each action
 */
export const SHORTCUT_LABELS = {
  forceCamera1: 'Force Camera 1',
  forceCamera2: 'Force Camera 2',
  forceCamera3: 'Force Camera 3',
  forceCamera4: 'Force Camera 4',
  forceCamera5: 'Force Camera 5',
  forceCamera6: 'Force Camera 6',
  skip: 'Skip Current',
  pause: 'Pause/Resume',
  releaseOverride: 'Release Override',
  flagMoment: 'Flag Moment',
  showShortcuts: 'Show Shortcuts',
};

/**
 * Context descriptions for each action
 */
export const SHORTCUT_CONTEXTS = {
  forceCamera1: 'Switch to camera 1 (override)',
  forceCamera2: 'Switch to camera 2 (override)',
  forceCamera3: 'Switch to camera 3 (override)',
  forceCamera4: 'Switch to camera 4 (override)',
  forceCamera5: 'Switch to camera 5 (override)',
  forceCamera6: 'Switch to camera 6 (override)',
  skip: 'Skip current clip/content',
  pause: 'Toggle pause/resume',
  releaseOverride: 'Release override, return to autonomous',
  flagMoment: 'Flag current playback time ±4s',
  showShortcuts: 'Open keyboard shortcuts panel',
};

const LOCAL_STORAGE_KEY = 'playout-keyboard-shortcuts';

/**
 * Format a key for display
 * @param {string} key - The key code/name
 * @returns {string} Display-friendly key name
 */
export function formatKeyForDisplay(key) {
  if (key === ' ') return 'Space';
  if (key === 'Escape') return 'Esc';
  if (key === '?') return '?';
  return key.toUpperCase();
}

/**
 * useKeyboardShortcuts - Hook for keyboard shortcut handling during playout
 *
 * Features:
 * - Document-level keydown listener
 * - Skips when input/select/textarea focused
 * - Modal exception: only Escape when dialog open
 * - preventDefault on all handled keys
 * - localStorage persistence for custom mappings
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Whether shortcuts are active (typically isPlayoutActive)
 * @param {boolean} options.isDialogOpen - Whether a modal dialog is currently open
 * @param {number} options.cameraCount - Number of available cameras (to hide non-existent camera keys)
 * @param {Object} options.handlers - Action handlers
 * @param {Function} options.handlers.onForceCamera - (cameraNumber) => void
 * @param {Function} options.handlers.onSkip - () => void
 * @param {Function} options.handlers.onPause - () => void
 * @param {Function} options.handlers.onReleaseOverride - () => void
 * @param {Function} options.handlers.onFlagMoment - () => void
 * @param {Function} options.handlers.onShowShortcuts - () => void
 *
 * @returns {Object} Shortcut state and actions
 */
export function useKeyboardShortcuts({
  enabled = false,
  isDialogOpen = false,
  cameraCount = 6,
  handlers = {},
} = {}) {
  // Load shortcuts from localStorage or use defaults
  const [shortcuts, setShortcuts] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all keys exist
        return { ...DEFAULT_SHORTCUTS, ...parsed };
      }
    } catch (e) {
      console.warn('[useKeyboardShortcuts] Failed to load shortcuts from localStorage:', e);
    }
    return { ...DEFAULT_SHORTCUTS };
  });

  // Track if user has seen the first-time toast
  const [hasSeenHint, setHasSeenHint] = useState(() => {
    try {
      return localStorage.getItem('playout-shortcuts-hint-seen') === 'true';
    } catch {
      return false;
    }
  });

  // Build reverse mapping: key -> action
  const keyToAction = useMemo(() => {
    const map = {};
    for (const [action, key] of Object.entries(shortcuts)) {
      // Normalize key to lowercase for comparison (except special keys)
      const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
      map[normalizedKey] = action;
    }
    return map;
  }, [shortcuts]);

  // Get available shortcuts (filtering out cameras that don't exist)
  const availableShortcuts = useMemo(() => {
    const available = {};
    for (const [action, key] of Object.entries(shortcuts)) {
      // Check if this is a camera action
      const cameraMatch = action.match(/^forceCamera(\d+)$/);
      if (cameraMatch) {
        const camNum = parseInt(cameraMatch[1], 10);
        if (camNum <= cameraCount) {
          available[action] = key;
        }
        // Skip cameras beyond cameraCount
      } else {
        available[action] = key;
      }
    }
    return available;
  }, [shortcuts, cameraCount]);

  // Handle keydown events
  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    // Check if focus is on an input element
    const tagName = e.target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
      return;
    }

    // Normalize key for lookup
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    // Modal exception: when dialog is open, only allow Escape
    if (isDialogOpen) {
      if (key === 'Escape' && handlers.onReleaseOverride) {
        e.preventDefault();
        handlers.onReleaseOverride();
      }
      return;
    }

    // Look up action for this key
    const action = keyToAction[key];
    if (!action) return;

    // Check if action is available (camera count check)
    if (!(action in availableShortcuts)) return;

    // Prevent default browser behavior
    e.preventDefault();

    // Execute the appropriate handler
    switch (action) {
      case 'forceCamera1':
        handlers.onForceCamera?.(1);
        break;
      case 'forceCamera2':
        handlers.onForceCamera?.(2);
        break;
      case 'forceCamera3':
        handlers.onForceCamera?.(3);
        break;
      case 'forceCamera4':
        handlers.onForceCamera?.(4);
        break;
      case 'forceCamera5':
        handlers.onForceCamera?.(5);
        break;
      case 'forceCamera6':
        handlers.onForceCamera?.(6);
        break;
      case 'skip':
        handlers.onSkip?.();
        break;
      case 'pause':
        handlers.onPause?.();
        break;
      case 'releaseOverride':
        handlers.onReleaseOverride?.();
        break;
      case 'flagMoment':
        handlers.onFlagMoment?.();
        break;
      case 'showShortcuts':
        handlers.onShowShortcuts?.();
        break;
      default:
        break;
    }
  }, [enabled, isDialogOpen, keyToAction, availableShortcuts, handlers]);

  // Attach keydown listener to document
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // Update a single shortcut
  const updateShortcut = useCallback((action, newKey) => {
    setShortcuts((prev) => {
      const updated = { ...prev, [action]: newKey };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('[useKeyboardShortcuts] Failed to save shortcuts to localStorage:', e);
      }
      return updated;
    });
  }, []);

  // Reset all shortcuts to defaults
  const resetShortcuts = useCallback(() => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {
      console.warn('[useKeyboardShortcuts] Failed to remove shortcuts from localStorage:', e);
    }
  }, []);

  // Mark hint as seen
  const markHintSeen = useCallback(() => {
    setHasSeenHint(true);
    try {
      localStorage.setItem('playout-shortcuts-hint-seen', 'true');
    } catch (e) {
      // Ignore
    }
  }, []);

  // Check if a key is already in use by another action
  const isKeyInUse = useCallback((key, excludeAction) => {
    const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
    for (const [action, assignedKey] of Object.entries(shortcuts)) {
      if (action === excludeAction) continue;
      const normalizedAssigned = assignedKey.length === 1 ? assignedKey.toLowerCase() : assignedKey;
      if (normalizedAssigned === normalizedKey) {
        return action;
      }
    }
    return null;
  }, [shortcuts]);

  return {
    // Current shortcuts
    shortcuts,
    availableShortcuts,

    // Labels and contexts
    labels: SHORTCUT_LABELS,
    contexts: SHORTCUT_CONTEXTS,

    // First-time hint
    hasSeenHint,
    markHintSeen,

    // Actions
    updateShortcut,
    resetShortcuts,
    isKeyInUse,

    // Utility
    formatKeyForDisplay,
  };
}

export default useKeyboardShortcuts;
