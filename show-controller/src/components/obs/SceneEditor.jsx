import { useState, useEffect } from 'react';
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';

/**
 * Transform presets matching server/lib/obsSourceManager.js
 */
const TRANSFORM_PRESETS = {
  fullscreen: { label: 'Fullscreen', position: '1920x1080' },
  dualLeft: { label: 'Dual Left', position: '960x1080 (Left)' },
  dualRight: { label: 'Dual Right', position: '960x1080 (Right)' },
  quadTopLeft: { label: 'Quad Top Left', position: '960x540 (TL)' },
  quadTopRight: { label: 'Quad Top Right', position: '960x540 (TR)' },
  quadBottomLeft: { label: 'Quad Bottom Left', position: '960x540 (BL)' },
  quadBottomRight: { label: 'Quad Bottom Right', position: '960x540 (BR)' },
  tripleMain: { label: 'Triple Main', position: '1280x1080 (Main)' },
  tripleTopRight: { label: 'Triple Top Right', position: '640x540 (TR)' },
  tripleBottomRight: { label: 'Triple Bottom Right', position: '640x540 (BR)' }
};

/**
 * SceneEditor - Edit scene items with drag-drop reordering and transform presets
 */
export default function SceneEditor({ sceneName, onClose }) {
  const { obsState, obsConnected } = useOBS();
  const [sceneItems, setSceneItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  // Get scene data from obsState
  useEffect(() => {
    if (!sceneName || !obsState?.scenes) return;

    const scene = obsState.scenes.find(
      s => (s.sceneName || s.name) === sceneName
    );

    if (scene) {
      const items = scene.items || scene.sceneItems || [];
      // Sort by index (OBS renders items bottom-to-top, higher index = on top)
      const sortedItems = [...items].sort((a, b) => {
        const indexA = a.sceneItemIndex ?? a.index ?? 0;
        const indexB = b.sceneItemIndex ?? b.index ?? 0;
        return indexB - indexA; // Reverse sort (highest index first)
      });
      setSceneItems(sortedItems);
    }
  }, [sceneName, obsState]);

  // Get available sources/inputs that could be added to the scene
  const availableInputs = obsState?.inputs || [];
  const usedSourceNames = sceneItems.map(item =>
    item.sourceName || item.inputName || item.name
  );
  const unusedSources = availableInputs.filter(
    input => !usedSourceNames.includes(input.inputName || input.name)
  );

  // Drag and drop handlers
  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetItem) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetItem) return;

    // Reorder items
    const newItems = [...sceneItems];
    const draggedIndex = newItems.findIndex(item => item === draggedItem);
    const targetIndex = newItems.findIndex(item => item === targetItem);

    newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    setSceneItems(newItems);
    setDraggedItem(null);

    // TODO: Call OBS API to reorder scene items
    console.log('Scene items reordered:', newItems);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // Item actions
  const toggleVisibility = (item) => {
    const itemId = item.sceneItemId || item.id;
    const currentEnabled = item.sceneItemEnabled ?? item.enabled ?? true;

    console.log('Toggle visibility:', sceneName, itemId, !currentEnabled);
    // TODO: Call OBS API to toggle visibility
  };

  const toggleLock = (item) => {
    const itemId = item.sceneItemId || item.id;
    const currentLocked = item.sceneItemLocked ?? item.locked ?? false;

    console.log('Toggle lock:', sceneName, itemId, !currentLocked);
    // TODO: Call OBS API to toggle lock
  };

  const deleteItem = (item) => {
    const itemId = item.sceneItemId || item.id;
    const sourceName = item.sourceName || item.inputName || item.name;

    if (confirm(`Delete "${sourceName}" from scene?`)) {
      console.log('Delete item:', sceneName, itemId);
      // TODO: Call OBS API to delete scene item
      setSceneItems(items => items.filter(i => i !== item));
    }
  };

  const applyTransformPreset = (presetName) => {
    if (!selectedItem) return;

    const itemId = selectedItem.sceneItemId || selectedItem.id;
    console.log('Apply transform preset:', sceneName, itemId, presetName);
    // TODO: Call OBS API to apply transform preset
  };

  const addSource = (sourceName) => {
    console.log('Add source to scene:', sceneName, sourceName);
    // TODO: Call OBS API to add source to scene
    setShowAddSource(false);
  };

  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>Connect to OBS to edit scenes</p>
      </div>
    );
  }

  if (!sceneName) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>Select a scene to edit</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-lg">Edit Scene</h3>
          <p className="text-gray-400 text-sm">{sceneName}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Scene Items List */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">Scene Items ({sceneItems.length})</h4>
          <button
            onClick={() => setShowAddSource(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Source
          </button>
        </div>

        {sceneItems.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No items in this scene</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sceneItems.map((item, index) => (
              <SceneItemCard
                key={item.sceneItemId || item.id || index}
                item={item}
                isSelected={selectedItem === item}
                onSelect={() => setSelectedItem(item)}
                onToggleVisibility={() => toggleVisibility(item)}
                onToggleLock={() => toggleLock(item)}
                onDelete={() => deleteItem(item)}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, item)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transform Presets */}
      {selectedItem && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">
            Transform Presets for "{selectedItem.sourceName || selectedItem.inputName || selectedItem.name}"
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(TRANSFORM_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyTransformPreset(key)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-600 text-white text-sm rounded transition-colors text-left"
              >
                <div className="font-medium">{preset.label}</div>
                <div className="text-xs text-gray-400">{preset.position}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {showAddSource && (
        <AddSourceModal
          availableSources={unusedSources}
          onAdd={addSource}
          onClose={() => setShowAddSource(false)}
        />
      )}
    </div>
  );
}

/**
 * SceneItemCard - Individual scene item with drag-drop support
 */
function SceneItemCard({
  item,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}) {
  const sourceName = item.sourceName || item.inputName || item.name;
  const itemId = item.sceneItemId || item.id;
  const enabled = item.sceneItemEnabled ?? item.enabled ?? true;
  const locked = item.sceneItemLocked ?? item.locked ?? false;
  const transform = item.transform || item.sceneItemTransform || {};

  const positionX = transform.positionX ?? transform.x ?? 0;
  const positionY = transform.positionY ?? transform.y ?? 0;

  return (
    <div
      draggable={!locked}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`
        bg-gray-800 rounded-lg p-3 cursor-move
        ${isSelected ? 'ring-2 ring-purple-500' : ''}
        ${!enabled ? 'opacity-50' : ''}
        ${locked ? 'cursor-not-allowed' : 'hover:bg-gray-750'}
        transition-all
      `}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <Bars3Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />

        {/* Source Info */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium truncate">{sourceName}</div>
          <div className="text-xs text-gray-400">
            ID: {itemId} | Position: ({Math.round(positionX)}, {Math.round(positionY)})
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
            title={enabled ? 'Hide' : 'Show'}
          >
            {enabled ? (
              <EyeIcon className="w-5 h-5" />
            ) : (
              <EyeSlashIcon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
            title={locked ? 'Unlock' : 'Lock'}
          >
            {locked ? (
              <LockClosedIcon className="w-5 h-5" />
            ) : (
              <LockOpenIcon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * AddSourceModal - Modal to select and add a source to the scene
 */
function AddSourceModal({ availableSources, onAdd, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Add Source to Scene</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {availableSources.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No available sources to add</p>
            <p className="text-sm mt-2">All inputs are already in this scene</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {availableSources.map((source) => {
              const sourceName = source.inputName || source.name;
              const sourceKind = source.inputKind || source.kind || 'unknown';

              return (
                <button
                  key={sourceName}
                  onClick={() => onAdd(sourceName)}
                  className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <div className="text-white font-medium">{sourceName}</div>
                  <div className="text-xs text-gray-400">{sourceKind}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
