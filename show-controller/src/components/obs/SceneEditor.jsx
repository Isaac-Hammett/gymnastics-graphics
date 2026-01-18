import { useState, useEffect } from 'react';
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  Bars3Icon,
  SwatchIcon,
  GlobeAltIcon,
  FilmIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';

/**
 * Source types that can be created
 */
const SOURCE_TYPES = [
  {
    kind: 'color_source_v3',
    label: 'Color Source',
    description: 'Solid color background',
    icon: SwatchIcon,
    defaultSettings: { color: 0xFF0000FF } // Red (ABGR format)
  },
  {
    kind: 'browser_source',
    label: 'Browser Source',
    description: 'Web page or HTML overlay',
    icon: GlobeAltIcon,
    defaultSettings: { url: 'https://example.com', width: 1920, height: 1080, fps: 30 }
  },
  {
    kind: 'ffmpeg_source',
    label: 'Media/SRT Source',
    description: 'Video stream or media file',
    icon: FilmIcon,
    defaultSettings: { is_local_file: false, input: '', buffering_mb: 2, reconnect_delay_sec: 5, hw_decode: true }
  },
  {
    kind: 'image_source',
    label: 'Image Source',
    description: 'Static image file',
    icon: PhotoIcon,
    defaultSettings: { file: '' }
  }
];

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
  const {
    obsState,
    obsConnected,
    toggleItemVisibility,
    toggleItemLock,
    deleteSceneItem,
    reorderSceneItems,
    applyTransformPreset: applyTransformPresetAction,
    addSourceToScene,
    createInput
  } = useOBS();
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

    // Call OBS API to reorder scene items
    // OBS uses index 0 = bottom, so calculate new index from position in reversed list
    const itemId = draggedItem.sceneItemId || draggedItem.id;
    const newIndex = newItems.length - 1 - targetIndex;
    reorderSceneItems(sceneName, itemId, newIndex);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // Item actions
  const handleToggleVisibility = (item) => {
    const itemId = item.sceneItemId || item.id;
    const currentEnabled = item.sceneItemEnabled ?? item.enabled ?? true;
    toggleItemVisibility(sceneName, itemId, !currentEnabled);
  };

  const handleToggleLock = (item) => {
    const itemId = item.sceneItemId || item.id;
    const currentLocked = item.sceneItemLocked ?? item.locked ?? false;
    toggleItemLock(sceneName, itemId, !currentLocked);
  };

  const handleDeleteItem = (item) => {
    const itemId = item.sceneItemId || item.id;
    const sourceName = item.sourceName || item.inputName || item.name;

    if (confirm(`Delete "${sourceName}" from scene?`)) {
      deleteSceneItem(sceneName, itemId);
      setSceneItems(items => items.filter(i => i !== item));
    }
  };

  const handleApplyTransformPreset = (presetName) => {
    if (!selectedItem) return;

    const itemId = selectedItem.sceneItemId || selectedItem.id;
    // Map preset name to OBS transform values
    const transformMap = {
      fullscreen: { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1 },
      dualLeft: { positionX: 0, positionY: 0, scaleX: 0.5, scaleY: 1 },
      dualRight: { positionX: 960, positionY: 0, scaleX: 0.5, scaleY: 1 },
      quadTopLeft: { positionX: 0, positionY: 0, scaleX: 0.5, scaleY: 0.5 },
      quadTopRight: { positionX: 960, positionY: 0, scaleX: 0.5, scaleY: 0.5 },
      quadBottomLeft: { positionX: 0, positionY: 540, scaleX: 0.5, scaleY: 0.5 },
      quadBottomRight: { positionX: 960, positionY: 540, scaleX: 0.5, scaleY: 0.5 },
      tripleMain: { positionX: 0, positionY: 0, scaleX: 0.667, scaleY: 1 },
      tripleTopRight: { positionX: 1280, positionY: 0, scaleX: 0.333, scaleY: 0.5 },
      tripleBottomRight: { positionX: 1280, positionY: 540, scaleX: 0.333, scaleY: 0.5 }
    };
    const transform = transformMap[presetName] || transformMap.fullscreen;
    applyTransformPresetAction(sceneName, itemId, transform);
  };

  const handleAddSource = (sourceName) => {
    addSourceToScene(sceneName, sourceName);
    setShowAddSource(false);
  };

  const handleCreateInput = (inputName, inputKind, inputSettings) => {
    createInput(inputName, inputKind, inputSettings, sceneName);
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
                onToggleVisibility={() => handleToggleVisibility(item)}
                onToggleLock={() => handleToggleLock(item)}
                onDelete={() => handleDeleteItem(item)}
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
                onClick={() => handleApplyTransformPreset(key)}
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
          onAddExisting={handleAddSource}
          onCreateNew={handleCreateInput}
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
 * Supports both adding existing sources and creating new ones
 */
function AddSourceModal({ availableSources, onAddExisting, onCreateNew, onClose }) {
  const [mode, setMode] = useState('select'); // 'select' | 'existing' | 'create'
  const [selectedType, setSelectedType] = useState(null);
  const [inputName, setInputName] = useState('');
  const [inputSettings, setInputSettings] = useState({});

  const handleSelectType = (sourceType) => {
    setSelectedType(sourceType);
    setInputName(`New ${sourceType.label}`);
    setInputSettings({ ...sourceType.defaultSettings });
    setMode('create');
  };

  const handleCreate = () => {
    if (!inputName.trim() || !selectedType) return;
    onCreateNew(inputName.trim(), selectedType.kind, inputSettings);
  };

  const renderModeSelector = () => (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm">Choose how to add a source:</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode('create')}
          className="flex flex-col items-center gap-2 p-4 bg-purple-600/20 border-2 border-purple-500 hover:bg-purple-600/30 rounded-lg transition-colors"
        >
          <PlusIcon className="w-8 h-8 text-purple-400" />
          <span className="text-white font-medium">Create New Source</span>
          <span className="text-xs text-gray-400">Choose source type</span>
        </button>
        <button
          onClick={() => setMode('existing')}
          disabled={availableSources.length === 0}
          className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
            availableSources.length === 0
              ? 'bg-gray-800 border-gray-700 cursor-not-allowed opacity-50'
              : 'bg-blue-600/20 border-blue-500 hover:bg-blue-600/30'
          }`}
        >
          <Bars3Icon className="w-8 h-8 text-blue-400" />
          <span className="text-white font-medium">Add Existing</span>
          <span className="text-xs text-gray-400">
            {availableSources.length === 0 ? 'None available' : `${availableSources.length} available`}
          </span>
        </button>
      </div>
    </div>
  );

  const renderTypeSelector = () => (
    <div className="space-y-4">
      <button
        onClick={() => setMode('select')}
        className="text-sm text-blue-400 hover:text-blue-300"
      >
        ← Back
      </button>
      <p className="text-gray-400 text-sm">Select source type to create:</p>
      <div className="grid grid-cols-2 gap-3">
        {SOURCE_TYPES.map((sourceType) => {
          const Icon = sourceType.icon;
          return (
            <button
              key={sourceType.kind}
              onClick={() => handleSelectType(sourceType)}
              className="flex flex-col items-center gap-2 p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-purple-500 rounded-lg transition-colors"
            >
              <Icon className="w-8 h-8 text-purple-400" />
              <span className="text-white font-medium">{sourceType.label}</span>
              <span className="text-xs text-gray-400 text-center">{sourceType.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderExistingSources = () => (
    <div className="space-y-4">
      <button
        onClick={() => setMode('select')}
        className="text-sm text-blue-400 hover:text-blue-300"
      >
        ← Back
      </button>
      {availableSources.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <p>No available sources to add</p>
          <p className="text-sm mt-2">All inputs are already in this scene</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableSources.map((source) => {
            const sourceName = source.inputName || source.name;
            const sourceKind = source.inputKind || source.kind || 'unknown';

            return (
              <button
                key={sourceName}
                onClick={() => onAddExisting(sourceName)}
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
  );

  const renderCreateForm = () => (
    <div className="space-y-4">
      <button
        onClick={() => {
          setSelectedType(null);
          setMode('create');
        }}
        className="text-sm text-blue-400 hover:text-blue-300"
      >
        ← Change type
      </button>

      <div className="flex items-center gap-3 p-3 bg-purple-600/20 border border-purple-500 rounded-lg">
        {selectedType && <selectedType.icon className="w-6 h-6 text-purple-400" />}
        <div>
          <div className="text-white font-medium">{selectedType?.label}</div>
          <div className="text-xs text-gray-400">{selectedType?.description}</div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Source Name</label>
        <input
          type="text"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
          placeholder="Enter source name..."
          autoFocus
        />
      </div>

      {/* Type-specific settings */}
      {selectedType?.kind === 'color_source_v3' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
          <div className="flex gap-2">
            {['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#000000'].map((color) => (
              <button
                key={color}
                onClick={() => {
                  // Convert hex to OBS color format (ABGR)
                  const r = parseInt(color.slice(1, 3), 16);
                  const g = parseInt(color.slice(3, 5), 16);
                  const b = parseInt(color.slice(5, 7), 16);
                  const obsColor = (255 << 24) | (b << 16) | (g << 8) | r; // ABGR with full alpha
                  setInputSettings({ ...inputSettings, color: obsColor >>> 0 }); // >>> 0 to ensure unsigned
                }}
                className="w-8 h-8 rounded border-2 border-gray-600 hover:border-white transition-colors"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}

      {selectedType?.kind === 'browser_source' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">URL</label>
            <input
              type="url"
              value={inputSettings.url || ''}
              onChange={(e) => setInputSettings({ ...inputSettings, url: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              placeholder="https://example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Width</label>
              <input
                type="number"
                value={inputSettings.width || 1920}
                onChange={(e) => setInputSettings({ ...inputSettings, width: parseInt(e.target.value) || 1920 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Height</label>
              <input
                type="number"
                value={inputSettings.height || 1080}
                onChange={(e) => setInputSettings({ ...inputSettings, height: parseInt(e.target.value) || 1080 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </>
      )}

      {selectedType?.kind === 'ffmpeg_source' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">SRT URL / Media Path</label>
          <input
            type="text"
            value={inputSettings.input || ''}
            onChange={(e) => setInputSettings({ ...inputSettings, input: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            placeholder="srt://192.168.1.10:9000 or /path/to/file.mp4"
          />
        </div>
      )}

      {selectedType?.kind === 'image_source' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Image File Path</label>
          <input
            type="text"
            value={inputSettings.file || ''}
            onChange={(e) => setInputSettings({ ...inputSettings, file: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            placeholder="/path/to/image.png"
          />
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={!inputName.trim()}
        className={`w-full py-2 font-medium rounded-lg transition-colors ${
          inputName.trim()
            ? 'bg-purple-600 hover:bg-purple-700 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        Create Source
      </button>
    </div>
  );

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

        {mode === 'select' && renderModeSelector()}
        {mode === 'create' && !selectedType && renderTypeSelector()}
        {mode === 'create' && selectedType && renderCreateForm()}
        {mode === 'existing' && renderExistingSources()}
      </div>
    </div>
  );
}
