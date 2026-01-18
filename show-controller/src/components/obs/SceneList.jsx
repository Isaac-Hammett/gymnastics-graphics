import { useState } from 'react';
import {
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  RectangleStackIcon,
  PlusIcon,
  XMarkIcon,
  Cog6ToothIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';

/**
 * SceneList - Display and manage OBS scenes
 * Groups scenes by category and provides actions: Preview, Edit, Duplicate, Delete
 */
export default function SceneList({ onEditScene, onSceneAction }) {
  const { obsState, obsConnected, switchScene, setPreviewScene, createScene, refreshState, reorderScenes } = useOBS();
  const [expandedCategories, setExpandedCategories] = useState({
    'generated-single': true,
    'generated-multi': true,
    'static': true,
    'graphics': true,
    'manual': true,
    'template': true
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [draggedScene, setDraggedScene] = useState(null);

  // Get scenes from obsState
  const scenes = obsState?.scenes || [];
  const currentScene = obsState?.currentScene;
  const previewScene = obsState?.previewScene;
  const studioModeEnabled = obsState?.studioModeEnabled || false;

  // Category configuration
  const categories = [
    { id: 'generated-single', label: 'Generated Single', color: 'purple' },
    { id: 'generated-multi', label: 'Generated Multi', color: 'blue' },
    { id: 'static', label: 'Static', color: 'green' },
    { id: 'graphics', label: 'Graphics', color: 'yellow' },
    { id: 'manual', label: 'Manual', color: 'gray' },
    { id: 'template', label: 'Template', color: 'pink' }
  ];

  // Group scenes by category
  const groupedScenes = categories.map(category => {
    const categoryScenes = scenes.filter(scene => {
      // If scene has a category property, use it; otherwise try to infer from name
      if (scene.category) {
        return scene.category === category.id;
      }
      // Fallback: infer category from scene name
      const sceneName = scene.sceneName || scene.name || '';
      if (sceneName.startsWith('GS-')) return category.id === 'generated-single';
      if (sceneName.startsWith('GM-')) return category.id === 'generated-multi';
      if (sceneName.startsWith('STATIC-')) return category.id === 'static';
      if (sceneName.startsWith('GFX-')) return category.id === 'graphics';
      if (sceneName.startsWith('TEMPLATE-')) return category.id === 'template';
      return category.id === 'manual';
    });

    return {
      ...category,
      scenes: categoryScenes,
      count: categoryScenes.length
    };
  }).filter(cat => cat.count > 0); // Only show categories with scenes

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Handle scene actions
  const handlePreview = (sceneName) => {
    if (studioModeEnabled) {
      setPreviewScene(sceneName);
    } else {
      // If studio mode is disabled, switch to scene directly
      switchScene(sceneName);
    }
    if (onSceneAction) {
      onSceneAction('preview', sceneName);
    }
  };

  const handleEdit = (sceneName) => {
    if (onEditScene) {
      onEditScene(sceneName);
    }
  };

  const handleRename = (sceneName) => {
    if (onSceneAction) {
      onSceneAction('rename', sceneName);
    }
  };

  const handleDuplicate = (sceneName) => {
    if (onSceneAction) {
      onSceneAction('duplicate', sceneName);
    }
  };

  const handleDelete = (sceneName) => {
    if (onSceneAction) {
      onSceneAction('delete', sceneName);
    }
  };

  // Drag-and-drop handlers for scene reordering
  const handleSceneDragStart = (e, scene) => {
    setDraggedScene(scene);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', scene.sceneName || scene.name);
  };

  const handleSceneDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSceneDrop = (e, targetScene) => {
    e.preventDefault();
    if (!draggedScene || draggedScene === targetScene) {
      setDraggedScene(null);
      return;
    }

    const draggedName = draggedScene.sceneName || draggedScene.name;
    const targetName = targetScene.sceneName || targetScene.name;

    // Create new order of all scenes
    const newScenes = [...scenes];
    const draggedIndex = newScenes.findIndex(s => (s.sceneName || s.name) === draggedName);
    const targetIndex = newScenes.findIndex(s => (s.sceneName || s.name) === targetName);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedScene(null);
      return;
    }

    // Remove dragged scene and insert at target position
    newScenes.splice(draggedIndex, 1);
    newScenes.splice(targetIndex, 0, draggedScene);

    // Extract scene names for the API call
    const sceneNames = newScenes.map(s => s.sceneName || s.name);
    console.log('SceneList: Reordering scenes to', sceneNames);
    reorderScenes(sceneNames);

    setDraggedScene(null);
  };

  const handleSceneDragEnd = () => {
    setDraggedScene(null);
  };

  const handleCreateScene = async () => {
    if (!newSceneName.trim()) return;

    setIsCreating(true);
    try {
      createScene(newSceneName.trim());
      // Wait a moment for OBS to process, then refresh state
      setTimeout(() => {
        refreshState();
      }, 500);
      setNewSceneName('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create scene:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <RectangleStackIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p>Connect to OBS to view scenes</p>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Scenes (0)</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Scene
          </button>
        </div>
        <div className="text-center text-gray-400 py-12">
          <RectangleStackIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p>No scenes found in OBS</p>
          <p className="text-sm mt-2">Click "Create Scene" to add your first scene</p>
        </div>

        {/* Create Scene Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Create New Scene</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSceneName('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Scene Name</label>
                <input
                  type="text"
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateScene();
                    if (e.key === 'Escape') {
                      setShowCreateModal(false);
                      setNewSceneName('');
                    }
                  }}
                  placeholder="Enter scene name..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSceneName('');
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateScene}
                  disabled={!newSceneName.trim() || isCreating}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg">
          Scenes ({scenes.length})
        </h3>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-400">
            {studioModeEnabled ? 'Studio Mode Active' : 'Direct Mode'}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Scene
          </button>
        </div>
      </div>

      {/* Create Scene Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Create New Scene</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewSceneName('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Scene Name</label>
              <input
                type="text"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateScene();
                  if (e.key === 'Escape') {
                    setShowCreateModal(false);
                    setNewSceneName('');
                  }
                }}
                placeholder="Enter scene name..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewSceneName('');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateScene}
                disabled={!newSceneName.trim() || isCreating}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupedScenes.map(category => (
        <CategoryGroup
          key={category.id}
          category={category}
          expanded={expandedCategories[category.id]}
          onToggle={() => toggleCategory(category.id)}
          currentScene={currentScene}
          previewScene={previewScene}
          studioModeEnabled={studioModeEnabled}
          onPreview={handlePreview}
          onEdit={handleEdit}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onDragStart={handleSceneDragStart}
          onDragOver={handleSceneDragOver}
          onDrop={handleSceneDrop}
          onDragEnd={handleSceneDragEnd}
          draggedScene={draggedScene}
        />
      ))}
    </div>
  );
}

/**
 * CategoryGroup - Display scenes grouped by category
 */
function CategoryGroup({
  category,
  expanded,
  onToggle,
  currentScene,
  previewScene,
  studioModeEnabled,
  onPreview,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggedScene
}) {
  const colorClasses = {
    purple: 'bg-purple-600/20 text-purple-300 border-purple-500',
    blue: 'bg-blue-600/20 text-blue-300 border-blue-500',
    green: 'bg-green-600/20 text-green-300 border-green-500',
    yellow: 'bg-yellow-600/20 text-yellow-300 border-yellow-500',
    gray: 'bg-gray-600/20 text-gray-300 border-gray-500',
    pink: 'bg-pink-600/20 text-pink-300 border-pink-500'
  };

  return (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-semibold border ${colorClasses[category.color]}`}>
            {category.label}
          </span>
          <span className="text-white font-medium">{category.count} scenes</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Scene Cards */}
      {expanded && (
        <div className="p-3 space-y-2 bg-gray-800">
          {category.scenes.map(scene => {
            const sceneName = scene.sceneName || scene.name;
            const sceneItems = scene.items || scene.sceneItems || [];
            const sourceCount = sceneItems.length;
            const isActive = sceneName === currentScene;
            const isPreview = sceneName === previewScene;

            return (
              <SceneCard
                key={sceneName}
                scene={scene}
                sceneName={sceneName}
                sourceCount={sourceCount}
                category={category}
                isActive={isActive}
                isPreview={isPreview}
                studioModeEnabled={studioModeEnabled}
                onPreview={() => onPreview(sceneName)}
                onEdit={() => onEdit(sceneName)}
                onRename={() => onRename(sceneName)}
                onDuplicate={() => onDuplicate(sceneName)}
                onDelete={() => onDelete(sceneName)}
                onDragStart={(e) => onDragStart(e, scene)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, scene)}
                onDragEnd={onDragEnd}
                isDragging={draggedScene === scene}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * SceneCard - Individual scene card with actions
 */
function SceneCard({
  scene,
  sceneName,
  sourceCount,
  category,
  isActive,
  isPreview,
  studioModeEnabled,
  onPreview,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging
}) {
  const borderClass = isActive
    ? 'border-green-500 bg-green-900/20'
    : isPreview
    ? 'border-yellow-500 bg-yellow-900/20'
    : 'border-gray-600';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`bg-gray-900 rounded-lg border-2 ${borderClass} p-3 hover:bg-gray-850 transition-colors cursor-move ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        {/* Drag Handle */}
        <div className="flex-shrink-0 mr-2 cursor-grab active:cursor-grabbing">
          <Bars3Icon className="w-5 h-5 text-gray-500 hover:text-gray-300" />
        </div>
        {/* Scene Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-medium truncate">{sceneName}</h4>
            {isActive && (
              <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-semibold rounded">
                LIVE
              </span>
            )}
            {isPreview && studioModeEnabled && (
              <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs font-semibold rounded">
                PREVIEW
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={onPreview}
            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
            title={studioModeEnabled ? 'Set as preview' : 'Switch to scene'}
          >
            <EyeIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
            title="Edit sources"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onRename}
            className="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded transition-colors"
            title="Rename scene"
          >
            <PencilIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
            title="Duplicate scene"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
            title="Delete scene"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
