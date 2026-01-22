import { useState, useEffect } from 'react';
import {
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  RectangleStackIcon,
  PlusIcon,
  XMarkIcon,
  Cog6ToothIcon,
  Bars3Icon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';
import { useShow } from '../../context/ShowContext';
import SceneThumbnail from './SceneThumbnail';

/**
 * SceneList - Display and manage OBS scenes
 * Groups scenes by category and provides actions: Preview, Edit, Duplicate, Delete
 */
export default function SceneList({ onEditScene, onSceneAction }) {
  const { obsState, obsConnected, switchScene, setPreviewScene, createScene, deleteScene, deleteAllScenes, refreshState, reorderScenes } = useOBS();
  const { socketUrl } = useShow();
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

  // Delete confirmation popover state (inline, positioned near the delete button)
  const [deletePopoverScene, setDeletePopoverScene] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete all scenes modal state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Template-related state
  const [createMode, setCreateMode] = useState('blank'); // 'blank' or 'template'
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Fetch templates when modal opens
  useEffect(() => {
    if (showCreateModal && socketUrl) {
      setIsLoadingTemplates(true);
      fetch(`${socketUrl}/api/obs/templates`)
        .then(res => res.json())
        .then(data => {
          const templateList = Array.isArray(data) ? data : (data.templates || []);
          setTemplates(templateList);
        })
        .catch(err => {
          console.error('Failed to fetch templates:', err);
          setTemplates([]);
        })
        .finally(() => {
          setIsLoadingTemplates(false);
        });
    }
  }, [showCreateModal, socketUrl]);

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
  // Note: We trust the backend category and don't infer from scene names anymore.
  // The coordinator (broadcastOBSState) sets the category based on:
  // - Scene naming conventions (e.g., "Single - ", "Dual - ")
  // - Template scenes stored in Firebase (competitions/{compId}/obs/templateScenes)
  const groupedScenes = categories.map(category => {
    const categoryScenes = scenes.filter(scene => {
      // Trust the backend category, default to 'manual' if not set
      const sceneCategory = scene.category || 'manual';
      return sceneCategory === category.id;
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
    // Toggle inline delete popover for this scene
    if (deletePopoverScene === sceneName) {
      setDeletePopoverScene(null);
    } else {
      setDeletePopoverScene(sceneName);
    }
  };

  const confirmDelete = async (sceneName) => {
    if (!sceneName) return;

    setIsDeleting(true);
    try {
      deleteScene(sceneName);
      // Notify parent if needed
      if (onSceneAction) {
        onSceneAction('delete', sceneName);
      }
      // Wait a moment for OBS to process, then refresh state
      setTimeout(() => {
        refreshState();
      }, 500);
      setDeletePopoverScene(null);
    } catch (error) {
      console.error('Failed to delete scene:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeletePopoverScene(null);
  };

  // Delete all scenes handler
  const handleDeleteAllScenes = async () => {
    setIsDeletingAll(true);
    try {
      deleteAllScenes();
      // Wait for OBS to process, then refresh state
      setTimeout(() => {
        refreshState();
        setShowDeleteAllModal(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to delete all scenes:', error);
    } finally {
      setIsDeletingAll(false);
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
    if (createMode === 'template' && !selectedTemplateId) return;

    setIsCreating(true);
    try {
      // Pass templateId if creating from template
      const templateId = createMode === 'template' ? selectedTemplateId : null;
      createScene(newSceneName.trim(), templateId);
      // Wait a moment for OBS to process, then refresh state
      setTimeout(() => {
        refreshState();
      }, 500);
      // Reset modal state
      setNewSceneName('');
      setCreateMode('blank');
      setSelectedTemplateId('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create scene:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setNewSceneName('');
    setCreateMode('blank');
    setSelectedTemplateId('');
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
          <CreateSceneModal
            isOpen={showCreateModal}
            onClose={resetCreateModal}
            newSceneName={newSceneName}
            setNewSceneName={setNewSceneName}
            createMode={createMode}
            setCreateMode={setCreateMode}
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            isLoadingTemplates={isLoadingTemplates}
            isCreating={isCreating}
            handleCreateScene={handleCreateScene}
          />
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
          {scenes.length > 0 && (
            <button
              onClick={() => setShowDeleteAllModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              Delete All
            </button>
          )}
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
        <CreateSceneModal
          isOpen={showCreateModal}
          onClose={resetCreateModal}
          newSceneName={newSceneName}
          setNewSceneName={setNewSceneName}
          createMode={createMode}
          setCreateMode={setCreateMode}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          isLoadingTemplates={isLoadingTemplates}
          isCreating={isCreating}
          handleCreateScene={handleCreateScene}
        />
      )}

      {/* Delete All Scenes Confirmation Modal */}
      {showDeleteAllModal && (
        <DeleteAllScenesModal
          isOpen={showDeleteAllModal}
          onClose={() => setShowDeleteAllModal(false)}
          onConfirm={handleDeleteAllScenes}
          sceneCount={scenes.length}
          isDeleting={isDeletingAll}
        />
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
          deletePopoverScene={deletePopoverScene}
          onConfirmDelete={confirmDelete}
          onCancelDelete={cancelDelete}
          isDeleting={isDeleting}
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
  draggedScene,
  deletePopoverScene,
  onConfirmDelete,
  onCancelDelete,
  isDeleting
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
                showDeletePopover={deletePopoverScene === sceneName}
                onConfirmDelete={() => onConfirmDelete(sceneName)}
                onCancelDelete={onCancelDelete}
                isDeleting={isDeleting}
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
 * PRD-OBS-11: Added thumbnail support
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
  isDragging,
  showDeletePopover,
  onConfirmDelete,
  onCancelDelete,
  isDeleting
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

        {/* Scene Thumbnail (PRD-OBS-11) */}
        <div className="flex-shrink-0 mr-3">
          <SceneThumbnail
            sceneName={sceneName}
            width={80}
            height={45}
            showHoverPreview={true}
            hoverWidth={320}
            hoverHeight={180}
            className="border border-gray-600"
          />
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
        <div className="flex items-center gap-1 ml-3 relative">
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
            className={`p-2 hover:bg-gray-700 rounded transition-colors ${showDeletePopover ? 'text-red-400 bg-gray-700' : 'text-gray-400 hover:text-red-400'}`}
            title="Delete scene"
          >
            <TrashIcon className="w-5 h-5" />
          </button>

          {/* Inline Delete Confirmation Popover */}
          {showDeletePopover && (
            <div className="absolute right-0 top-full mt-2 z-10 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3">
              <p className="text-white text-sm font-medium mb-1">
                Delete "{sceneName}"?
              </p>
              <p className="text-gray-400 text-xs mb-3">
                This scene has {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={onCancelDelete}
                  className="px-3 py-1 text-gray-400 hover:text-white text-sm transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirmDelete}
                  disabled={isDeleting}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/**
 * CreateSceneModal - Modal for creating a new scene (blank or from template)
 */
function CreateSceneModal({
  isOpen,
  onClose,
  newSceneName,
  setNewSceneName,
  createMode,
  setCreateMode,
  templates,
  selectedTemplateId,
  setSelectedTemplateId,
  isLoadingTemplates,
  isCreating,
  handleCreateScene
}) {
  if (!isOpen) return null;

  const canCreate = newSceneName.trim() &&
    (createMode === 'blank' || (createMode === 'template' && selectedTemplateId));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Create New Scene</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selection */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Creation Method</label>
          <div className="flex gap-2">
            <button
              onClick={() => setCreateMode('blank')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                createMode === 'blank'
                  ? 'bg-green-600 border-green-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              <PlusIcon className="w-5 h-5" />
              Blank Scene
            </button>
            <button
              onClick={() => setCreateMode('template')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                createMode === 'template'
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              <DocumentTextIcon className="w-5 h-5" />
              From Template
            </button>
          </div>
        </div>

        {/* Template Selection (shown only when createMode is 'template') */}
        {createMode === 'template' && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Select Template</label>
            {isLoadingTemplates ? (
              <div className="text-gray-500 text-sm py-2">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-yellow-500 text-sm py-2 px-3 bg-yellow-900/20 rounded-lg border border-yellow-700">
                No templates available. Save your current OBS setup as a template in the Templates tab first.
              </div>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">-- Select a template --</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.description ? `- ${template.description}` : ''}
                  </option>
                ))}
              </select>
            )}
            {selectedTemplateId && templates.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                {(() => {
                  const selected = templates.find(t => t.id === selectedTemplateId);
                  if (!selected) return null;
                  return (
                    <div className="p-2 bg-gray-700/50 rounded-lg">
                      <p className="text-purple-300 font-medium">{selected.name}</p>
                      {selected.description && <p className="text-gray-400 text-xs mt-1">{selected.description}</p>}
                      {selected.scenesCount && <p className="text-gray-500 text-xs mt-1">{selected.scenesCount} scene(s)</p>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Scene Name Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Scene Name</label>
          <input
            type="text"
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) handleCreateScene();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Enter scene name..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateScene}
            disabled={!canCreate || isCreating}
            className={`px-4 py-2 ${
              createMode === 'template' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-green-600 hover:bg-green-500'
            } disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors`}
          >
            {isCreating ? 'Creating...' : createMode === 'template' ? 'Create from Template' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DeleteAllScenesModal - Confirmation modal for deleting all scenes
 */
function DeleteAllScenesModal({
  isOpen,
  onClose,
  onConfirm,
  sceneCount,
  isDeleting
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <TrashIcon className="w-5 h-5 text-red-400" />
            Delete All Scenes
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isDeleting}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-4">
            <p className="text-red-300 font-medium mb-2">
              This will permanently delete all {sceneCount} scenes from OBS.
            </p>
            <p className="text-red-200/80 text-sm">
              This action cannot be undone. A single empty scene will remain as OBS requires at least one scene.
            </p>
          </div>

          <p className="text-gray-400 text-sm">
            If you want to start fresh with a template, you can apply a template after deleting all scenes.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isDeleting ? 'Deleting...' : `Delete All ${sceneCount} Scenes`}
          </button>
        </div>
      </div>
    </div>
  );
}
