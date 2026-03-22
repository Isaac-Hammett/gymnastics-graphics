import { useState, useEffect, useCallback, useRef } from 'react';
import {
  XMarkIcon,
  ArrowPathIcon,
  KeyIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_LABELS,
  SHORTCUT_CONTEXTS,
  formatKeyForDisplay,
} from '../../hooks/useKeyboardShortcuts';

/**
 * KeyboardShortcutsPanel — Modal panel for viewing and customizing keyboard shortcuts
 *
 * Features:
 * - Displays all available shortcuts with their current key mappings
 * - Allows remapping by clicking a key and pressing a new key
 * - Shows conflict warnings when a key is already in use
 * - Reset all to defaults button
 * - Hides camera keys that don't exist for this competition
 *
 * Props:
 * - isOpen: boolean — whether the panel is visible
 * - onClose: () => void — close the panel
 * - shortcuts: Object — current shortcut mappings { action: key }
 * - availableShortcuts: Object — shortcuts filtered by camera count
 * - cameraApparatusMap: Object — { cameraNumber: apparatus } for camera labels
 * - onUpdateShortcut: (action, newKey) => void — update a shortcut
 * - onResetShortcuts: () => void — reset all to defaults
 * - isKeyInUse: (key, excludeAction) => action|null — check for conflicts
 */
export default function KeyboardShortcutsPanel({
  isOpen = false,
  onClose,
  shortcuts = {},
  availableShortcuts = {},
  cameraApparatusMap = {},
  onUpdateShortcut,
  onResetShortcuts,
  isKeyInUse,
}) {
  const [editingAction, setEditingAction] = useState(null);
  const [pendingKey, setPendingKey] = useState(null);
  const [conflictAction, setConflictAction] = useState(null);
  const inputRef = useRef(null);

  // Focus the hidden input when editing starts
  useEffect(() => {
    if (editingAction && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingAction]);

  // Handle keydown when capturing a new key
  const handleKeyCapture = useCallback((e) => {
    if (!editingAction) return;

    e.preventDefault();
    e.stopPropagation();

    // Get the key
    const key = e.key;

    // Ignore modifier keys alone
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) {
      return;
    }

    // Check for conflicts
    const conflict = isKeyInUse?.(key, editingAction);
    if (conflict) {
      setPendingKey(key);
      setConflictAction(conflict);
      return;
    }

    // No conflict, apply immediately
    onUpdateShortcut?.(editingAction, key);
    setEditingAction(null);
    setPendingKey(null);
    setConflictAction(null);
  }, [editingAction, isKeyInUse, onUpdateShortcut]);

  // Handle confirming a conflicting key reassignment
  const handleConfirmConflict = useCallback(() => {
    if (!pendingKey || !editingAction) return;

    // Clear the old binding first, then set the new one
    onUpdateShortcut?.(conflictAction, ''); // Remove from conflicting action
    onUpdateShortcut?.(editingAction, pendingKey);

    setEditingAction(null);
    setPendingKey(null);
    setConflictAction(null);
  }, [pendingKey, editingAction, conflictAction, onUpdateShortcut]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingAction(null);
    setPendingKey(null);
    setConflictAction(null);
  }, []);

  // Start editing a shortcut
  const handleStartEdit = useCallback((action) => {
    setEditingAction(action);
    setPendingKey(null);
    setConflictAction(null);
  }, []);

  // Handle reset all
  const handleResetAll = useCallback(() => {
    onResetShortcuts?.();
    handleCancelEdit();
  }, [onResetShortcuts, handleCancelEdit]);

  // Close panel
  const handleClose = useCallback(() => {
    handleCancelEdit();
    onClose?.();
  }, [onClose, handleCancelEdit]);

  // Get label for an action, with apparatus name for camera shortcuts
  const getActionLabel = useCallback((action) => {
    const cameraMatch = action.match(/^forceCamera(\d+)$/);
    if (cameraMatch) {
      const camNum = parseInt(cameraMatch[1], 10);
      const apparatus = cameraApparatusMap[camNum];
      if (apparatus) {
        return `Force Camera ${camNum} (${apparatus})`;
      }
    }
    return SHORTCUT_LABELS[action] || action;
  }, [cameraApparatusMap]);

  if (!isOpen) return null;

  // Group shortcuts for display
  const cameraShortcuts = [];
  const controlShortcuts = [];

  for (const action of Object.keys(availableShortcuts)) {
    if (action.startsWith('forceCamera')) {
      cameraShortcuts.push(action);
    } else {
      controlShortcuts.push(action);
    }
  }

  // Sort camera shortcuts by number
  cameraShortcuts.sort((a, b) => {
    const numA = parseInt(a.replace('forceCamera', ''), 10);
    const numB = parseInt(b.replace('forceCamera', ''), 10);
    return numA - numB;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800">
          <div className="flex items-center gap-2">
            <KeyIcon className="w-5 h-5 text-zinc-400" />
            <h2 id="shortcuts-title" className="text-lg font-semibold text-white">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden input for key capture */}
        <input
          ref={inputRef}
          type="text"
          className="sr-only"
          onKeyDown={handleKeyCapture}
          onBlur={handleCancelEdit}
          aria-label="Press a key to assign"
        />

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Conflict warning */}
          {conflictAction && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-400 font-medium">
                  Key "{formatKeyForDisplay(pendingKey)}" is already assigned to "{SHORTCUT_LABELS[conflictAction]}"
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleConfirmConflict}
                    className="px-2 py-1 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded transition-colors"
                  >
                    Reassign
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2 py-1 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Camera shortcuts section */}
          {cameraShortcuts.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Camera Controls
              </h3>
              <div className="space-y-1">
                {cameraShortcuts.map((action) => (
                  <ShortcutRow
                    key={action}
                    action={action}
                    label={getActionLabel(action)}
                    context={SHORTCUT_CONTEXTS[action]}
                    currentKey={shortcuts[action]}
                    isEditing={editingAction === action}
                    onStartEdit={() => handleStartEdit(action)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Control shortcuts section */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              Playout Controls
            </h3>
            <div className="space-y-1">
              {controlShortcuts.map((action) => (
                <ShortcutRow
                  key={action}
                  action={action}
                  label={getActionLabel(action)}
                  context={SHORTCUT_CONTEXTS[action]}
                  currentKey={shortcuts[action]}
                  isEditing={editingAction === action}
                  onStartEdit={() => handleStartEdit(action)}
                />
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-zinc-500 mt-4">
            Click on a key to remap it. Press any key to assign. Shortcuts are saved locally.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700 bg-zinc-800">
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ShortcutRow — Single shortcut row with label, context, and key button
 */
function ShortcutRow({ action, label, context, currentKey, isEditing, onStartEdit }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/50">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{label}</div>
        {context && (
          <div className="text-xs text-zinc-500 truncate">{context}</div>
        )}
      </div>
      <button
        onClick={onStartEdit}
        className={`ml-3 px-3 py-1.5 min-w-[60px] text-center text-sm font-mono rounded-lg border transition-colors ${
          isEditing
            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 animate-pulse'
            : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-zinc-500 hover:text-white'
        }`}
        title={isEditing ? 'Press a key...' : `Click to remap`}
      >
        {isEditing ? '...' : formatKeyForDisplay(currentKey) || '-'}
      </button>
    </div>
  );
}
