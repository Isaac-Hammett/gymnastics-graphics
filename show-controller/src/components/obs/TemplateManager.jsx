import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  CameraIcon,
  PhotoIcon,
  InformationCircleIcon,
  XMarkIcon,
  TrashIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useOBS } from '../../context/OBSContext';
import { useShow } from '../../context/ShowContext';
import { useCompetition } from '../../context/CompetitionContext';

/**
 * TemplateManager - Manage OBS scene templates
 * Allows applying pre-configured templates and saving current state as template
 */
export default function TemplateManager() {
  const { obsConnected, obsState, autoLoadEnabled, setAutoLoadTemplateEnabled, autoAppliedTemplate, getDefaultTemplate, resetAutoApplyState } = useOBS();
  const { compId, socketUrl, socket } = useShow();
  const { competitionConfig } = useCompetition();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [applyWarnings, setApplyWarnings] = useState([]); // Detailed errors/warnings from template apply
  const [settingDefault, setSettingDefault] = useState(null); // templateId being set as default

  // Modal states
  const [showApplyModal, setShowApplyModal] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateDescription, setSaveTemplateDescription] = useState('');
  const [saveTemplateMeetTypes, setSaveTemplateMeetTypes] = useState([]);
  const [showDefaultModal, setShowDefaultModal] = useState(null); // Template for default settings

  // Available meet types
  const meetTypes = ['mens-dual', 'womens-dual', 'mens-tri', 'womens-tri', 'mens-quad', 'womens-quad'];

  // Current competition's meet type
  const currentMeetType = competitionConfig?.compType || null;

  // Auto-apply tracking
  const hasAttemptedAutoApply = useRef(false);
  const [autoApplyStatus, setAutoApplyStatus] = useState(null); // null, 'applying', 'applied', 'skipped', 'error'

  // Fetch templates on mount
  useEffect(() => {
    if (obsConnected) {
      fetchTemplates();
    }
  }, [obsConnected]);

  // PRD-OBS-11: Auto-apply default template when OBS connects with empty scenes
  useEffect(() => {
    // Don't auto-apply if:
    // - Not connected
    // - Already attempted
    // - Auto-load disabled
    // - No meet type configured
    // - Already have scenes
    if (!obsConnected || hasAttemptedAutoApply.current || !autoLoadEnabled || !currentMeetType) {
      return;
    }

    // Check if OBS has scenes - only auto-apply to fresh OBS
    const scenes = obsState?.scenes || [];
    if (scenes.length > 0) {
      console.log('TemplateManager: OBS has existing scenes, skipping auto-apply');
      hasAttemptedAutoApply.current = true;
      setAutoApplyStatus('skipped');
      return;
    }

    // Mark as attempted to prevent re-runs
    hasAttemptedAutoApply.current = true;

    // Try to get and apply default template
    const autoApplyDefaultTemplate = async () => {
      setAutoApplyStatus('applying');

      try {
        // Get the default template for this meet type
        const defaultTemplate = await getDefaultTemplate(currentMeetType);

        if (!defaultTemplate) {
          console.log(`TemplateManager: No default template for ${currentMeetType}`);
          setAutoApplyStatus('skipped');
          return;
        }

        console.log(`TemplateManager: Auto-applying template "${defaultTemplate.name}" for ${currentMeetType}`);

        // Apply the template
        const response = await fetch(`${socketUrl}/api/obs/templates/${defaultTemplate.id}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitionId: compId })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to apply template: ${response.statusText}`);
        }

        const data = await response.json();
        const scenesCreated = data.result?.scenesCreated || 0;

        console.log(`TemplateManager: Auto-applied template "${defaultTemplate.name}" - ${scenesCreated} scenes created`);
        setAutoApplyStatus('applied');
        setSuccess(`Auto-loaded template "${defaultTemplate.name}" (${scenesCreated} scenes)`);
        setTimeout(() => setSuccess(null), 8000);

        // Notify other clients
        if (socket) {
          socket.emit('obs:templateAutoApplied', {
            templateId: defaultTemplate.id,
            competitionId: compId
          });
        }
      } catch (err) {
        console.error('TemplateManager: Failed to auto-apply template:', err);
        setAutoApplyStatus('error');
        // Don't show error to user for auto-apply failures - it's not critical
      }
    };

    // Small delay to ensure OBS state is fully loaded
    const timer = setTimeout(autoApplyDefaultTemplate, 1000);
    return () => clearTimeout(timer);
  }, [obsConnected, autoLoadEnabled, currentMeetType, obsState?.scenes?.length, socketUrl, compId, socket, getDefaultTemplate]);

  // Reset auto-apply state when competition changes
  useEffect(() => {
    hasAttemptedAutoApply.current = false;
    setAutoApplyStatus(null);
    if (resetAutoApplyState) resetAutoApplyState();
  }, [compId, resetAutoApplyState]);

  // Listen for template default changes from other clients
  useEffect(() => {
    if (!socket) return;

    const handleTemplateDefaultChanged = (data) => {
      console.log('TemplateManager: Template default changed', data);
      // Refresh templates to get updated isDefaultFor
      fetchTemplates();
    };

    socket.on('obs:templateDefaultChanged', handleTemplateDefaultChanged);

    return () => {
      socket.off('obs:templateDefaultChanged', handleTemplateDefaultChanged);
    };
  }, [socket]);

  // Set a template as default for specified meet types
  const handleSetTemplateDefault = useCallback(async (templateId, selectedMeetTypes) => {
    if (!socket || !templateId || selectedMeetTypes.length === 0) return;

    setSettingDefault(templateId);
    setError(null);

    return new Promise((resolve) => {
      const handleSuccess = (data) => {
        console.log('TemplateManager: Template default set', data);
        setSuccess(`Template set as default for ${selectedMeetTypes.join(', ')}`);
        setTimeout(() => setSuccess(null), 5000);
        setSettingDefault(null);
        fetchTemplates(); // Refresh to show updated defaults
        resolve(true);
      };

      const handleError = (data) => {
        console.error('TemplateManager: Failed to set template default', data);
        setError(data.message || 'Failed to set template default');
        setSettingDefault(null);
        resolve(false);
      };

      // Listen for response
      socket.once('obs:templateDefaultSet', handleSuccess);
      socket.once('error', handleError);

      // Send the request
      socket.emit('obs:setTemplateDefault', { templateId, meetTypes: selectedMeetTypes });

      // Timeout after 10 seconds
      setTimeout(() => {
        socket.off('obs:templateDefaultSet', handleSuccess);
        socket.off('error', handleError);
        setSettingDefault(null);
        resolve(false);
      }, 10000);
    });
  }, [socket]);

  // Clear a template's default status for specified meet types
  const handleClearTemplateDefault = useCallback(async (templateId, selectedMeetTypes) => {
    if (!socket || !templateId || selectedMeetTypes.length === 0) return;

    setSettingDefault(templateId);
    setError(null);

    return new Promise((resolve) => {
      const handleSuccess = (data) => {
        console.log('TemplateManager: Template default cleared', data);
        setSuccess(`Default status cleared for ${selectedMeetTypes.join(', ')}`);
        setTimeout(() => setSuccess(null), 5000);
        setSettingDefault(null);
        fetchTemplates(); // Refresh to show updated defaults
        resolve(true);
      };

      const handleError = (data) => {
        console.error('TemplateManager: Failed to clear template default', data);
        setError(data.message || 'Failed to clear template default');
        setSettingDefault(null);
        resolve(false);
      };

      // Listen for response
      socket.once('obs:templateDefaultCleared', handleSuccess);
      socket.once('error', handleError);

      // Send the request
      socket.emit('obs:clearTemplateDefault', { templateId, meetTypes: selectedMeetTypes });

      // Timeout after 10 seconds
      setTimeout(() => {
        socket.off('obs:templateDefaultCleared', handleSuccess);
        socket.off('error', handleError);
        setSettingDefault(null);
        resolve(false);
      }, 10000);
    });
  }, [socket]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${socketUrl}/api/obs/templates`);
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }
      const data = await response.json();
      // API returns {templates: [...]} but we need the array
      const templateList = Array.isArray(data) ? data : (data.templates || []);
      setTemplates(templateList);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (templateId) => {
    setError(null);
    setSuccess(null);
    setApplying(templateId);

    try {
      const response = await fetch(`${socketUrl}/api/obs/templates/${templateId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          competitionId: compId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to apply template: ${response.statusText}`);
      }

      const data = await response.json();
      const scenesCreated = data.result?.scenesCreated || 0;
      const inputsCreated = data.result?.inputsCreated || 0;
      const errors = data.result?.errors || [];

      // Store warnings for detailed display
      setApplyWarnings(errors);

      if (errors.length > 0) {
        setSuccess(`Template applied with warnings: ${scenesCreated} scenes, ${inputsCreated} inputs created. ${errors.length} items skipped.`);
      } else {
        setSuccess(`Template applied successfully: ${scenesCreated} scenes, ${inputsCreated} inputs created`);
      }
      setShowApplyModal(null);

      // Clear success message after 8 seconds (longer to allow reading warnings)
      setTimeout(() => {
        setSuccess(null);
        setApplyWarnings([]);
      }, errors.length > 0 ? 10000 : 5000);
    } catch (err) {
      console.error('Error applying template:', err);
      setError(err.message);
    } finally {
      setApplying(null);
    }
  };

  const handleSaveTemplate = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      // Validate inputs
      if (!saveTemplateName.trim()) {
        throw new Error('Template name is required');
      }
      if (saveTemplateMeetTypes.length === 0) {
        throw new Error('Select at least one meet type');
      }

      const response = await fetch(`${socketUrl}/api/obs/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: saveTemplateName.trim(),
          description: saveTemplateDescription.trim(),
          meetTypes: saveTemplateMeetTypes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save template: ${response.statusText}`);
      }

      const data = await response.json();
      setSuccess(`Template "${data.name}" saved successfully`);
      setShowSaveModal(false);
      setSaveTemplateName('');
      setSaveTemplateDescription('');
      setSaveTemplateMeetTypes([]);
      fetchTemplates(); // Refresh template list

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    setError(null);
    setSuccess(null);
    setDeleting(templateId);

    try {
      const response = await fetch(`${socketUrl}/api/obs/templates/${encodeURIComponent(templateId)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete template: ${response.statusText}`);
      }

      setSuccess('Template deleted successfully');
      setShowDeleteModal(null);
      fetchTemplates(); // Refresh template list

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const toggleMeetType = (meetType) => {
    setSaveTemplateMeetTypes(prev =>
      prev.includes(meetType)
        ? prev.filter(t => t !== meetType)
        : [...prev, meetType]
    );
  };

  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <ExclamationTriangleIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-lg font-semibold text-white mb-2">OBS Not Connected</p>
        <p>Connect to OBS to manage templates</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Template Manager</h3>
          <p className="text-gray-400 text-sm mt-1">Apply pre-configured scene templates or save current setup</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-load toggle */}
          <label className="flex items-center gap-2 cursor-pointer" title="Auto-load default template when OBS connects with no scenes">
            <input
              type="checkbox"
              checked={autoLoadEnabled}
              onChange={(e) => setAutoLoadTemplateEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800"
            />
            <span className="text-gray-400 text-sm">Auto-load</span>
          </label>
          <button
            onClick={fetchTemplates}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Save Current as Template
          </button>
        </div>
      </div>

      {/* Auto-apply status banner */}
      {autoApplyStatus === 'applying' && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 flex items-center gap-3">
          <ArrowPathIcon className="w-5 h-5 text-blue-400 animate-spin" />
          <div className="text-blue-300 text-sm">Auto-loading default template for {currentMeetType}...</div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-red-300 font-semibold">Error</div>
            <div className="text-red-200/80 text-sm">{error}</div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-100"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <div className={`${applyWarnings.length > 0 ? 'bg-yellow-900/20 border-yellow-700' : 'bg-green-900/20 border-green-700'} border rounded-lg p-4`}>
          <div className="flex items-start gap-3">
            {applyWarnings.length > 0 ? (
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className={`${applyWarnings.length > 0 ? 'text-yellow-300' : 'text-green-300'} font-semibold`}>
                {applyWarnings.length > 0 ? 'Applied with Warnings' : 'Success'}
              </div>
              <div className={`${applyWarnings.length > 0 ? 'text-yellow-200/80' : 'text-green-200/80'} text-sm`}>{success}</div>
            </div>
            <button
              onClick={() => { setSuccess(null); setApplyWarnings([]); }}
              className={`${applyWarnings.length > 0 ? 'text-yellow-300 hover:text-yellow-100' : 'text-green-300 hover:text-green-100'}`}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Detailed warnings list */}
          {applyWarnings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-yellow-700/50">
              <div className="text-yellow-300 text-xs font-medium mb-2">Skipped Items:</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {applyWarnings.map((warning, idx) => (
                  <div key={idx} className="text-yellow-200/70 text-xs flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    <span>{typeof warning === 'string' ? warning : (warning.message || warning.error || JSON.stringify(warning))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates List */}
      <div className="bg-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <DocumentDuplicateIcon className="w-5 h-5 text-gray-300" />
          <h4 className="text-white font-semibold">
            Available Templates ({templates.length})
          </h4>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <ArrowPathIcon className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
            <div className="text-gray-400">Loading templates...</div>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <DocumentDuplicateIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <div className="text-gray-400">No templates available</div>
            <div className="text-gray-500 text-sm mt-1">Save your current OBS setup as a template to get started</div>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onApply={() => setShowApplyModal(template)}
                onDelete={() => setShowDeleteModal(template)}
                onSetDefault={() => setShowDefaultModal(template)}
                isApplying={applying === template.id}
                isDeleting={deleting === template.id}
                isSettingDefault={settingDefault === template.id}
                currentMeetType={currentMeetType}
              />
            ))}
          </div>
        )}
      </div>

      {/* Apply Template Confirmation Modal */}
      {showApplyModal && (
        <ApplyTemplateModal
          template={showApplyModal}
          onConfirm={() => handleApplyTemplate(showApplyModal.id)}
          onCancel={() => setShowApplyModal(null)}
          isApplying={applying === showApplyModal.id}
        />
      )}

      {/* Save Template Modal */}
      {showSaveModal && (
        <SaveTemplateModal
          name={saveTemplateName}
          description={saveTemplateDescription}
          meetTypes={saveTemplateMeetTypes}
          availableMeetTypes={meetTypes}
          onNameChange={setSaveTemplateName}
          onDescriptionChange={setSaveTemplateDescription}
          onToggleMeetType={toggleMeetType}
          onSave={handleSaveTemplate}
          onCancel={() => {
            setShowSaveModal(false);
            setSaveTemplateName('');
            setSaveTemplateDescription('');
            setSaveTemplateMeetTypes([]);
          }}
          isSaving={saving}
        />
      )}

      {/* Delete Template Confirmation Modal */}
      {showDeleteModal && (
        <DeleteTemplateModal
          template={showDeleteModal}
          onConfirm={() => handleDeleteTemplate(showDeleteModal.id)}
          onCancel={() => setShowDeleteModal(null)}
          isDeleting={deleting === showDeleteModal.id}
        />
      )}

      {/* Set Default Template Modal */}
      {showDefaultModal && (
        <SetDefaultModal
          template={showDefaultModal}
          availableMeetTypes={meetTypes}
          onSetDefault={async (selectedTypes) => {
            const success = await handleSetTemplateDefault(showDefaultModal.id, selectedTypes);
            if (success) setShowDefaultModal(null);
          }}
          onClearDefault={async (selectedTypes) => {
            const success = await handleClearTemplateDefault(showDefaultModal.id, selectedTypes);
            if (success) setShowDefaultModal(null);
          }}
          onCancel={() => setShowDefaultModal(null)}
          isSettingDefault={settingDefault === showDefaultModal.id}
        />
      )}
    </div>
  );
}

/**
 * TemplateCard - Individual template card with metadata
 */
function TemplateCard({ template, onApply, onDelete, onSetDefault, isApplying, isDeleting, isSettingDefault, currentMeetType }) {
  // Check if this template is default for the current meet type
  const isDefaultForCurrentMeet = currentMeetType && template.isDefaultFor?.includes(currentMeetType);
  const hasAnyDefaults = template.isDefaultFor && template.isDefaultFor.length > 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h5 className="text-white font-medium">{template.name}</h5>
            {isDefaultForCurrentMeet && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-600/20 border border-yellow-600 text-yellow-300 text-xs font-semibold rounded">
                <StarIconSolid className="w-3 h-3" />
                DEFAULT
              </span>
            )}
            {hasAnyDefaults && !isDefaultForCurrentMeet && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-600/20 border border-gray-500 text-gray-400 text-xs rounded">
                <StarIcon className="w-3 h-3" />
                Default for: {template.isDefaultFor.join(', ')}
              </span>
            )}
          </div>

          {template.description && (
            <p className="text-gray-400 text-sm mb-3">{template.description}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {template.meetTypes?.map(type => (
              <span
                key={type}
                className={`px-2 py-1 text-xs rounded border ${
                  template.isDefaultFor?.includes(type)
                    ? 'bg-yellow-600/20 text-yellow-300 border-yellow-600/50'
                    : 'bg-gray-700 text-gray-300 border-gray-600'
                }`}
              >
                {type}
                {template.isDefaultFor?.includes(type) && ' ★'}
              </span>
            ))}
          </div>

          {/* Template Requirements */}
          <div className="space-y-2">
            {template.requirements?.cameras && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <CameraIcon className="w-4 h-4" />
                <span>{template.requirements.cameras.length} cameras needed</span>
              </div>
            )}
            {template.requirements?.assets && template.requirements.assets.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <PhotoIcon className="w-4 h-4" />
                <span>{template.requirements.assets.length} assets required</span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="text-gray-500 text-xs mt-3">
            {template.createdAt && (
              <span>Created {new Date(template.createdAt).toLocaleDateString()}</span>
            )}
            {template.scenesCount && (
              <>
                <span> • </span>
                <span>{template.scenesCount} scenes</span>
              </>
            )}
            {template.scenes?.length > 0 && !template.scenesCount && (
              <>
                <span> • </span>
                <span>{template.scenes.length} scenes</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onApply}
              disabled={isApplying || isDeleting || isSettingDefault}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {isApplying ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <DocumentDuplicateIcon className="w-5 h-5" />
                  Apply
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              disabled={isApplying || isDeleting || isSettingDefault}
              className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 disabled:bg-gray-700 disabled:text-gray-500 text-red-400 hover:text-red-300 font-medium rounded-lg transition-colors border border-red-600/30"
              title="Delete template"
            >
              {isDeleting ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <TrashIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <button
            onClick={onSetDefault}
            disabled={isApplying || isDeleting || isSettingDefault}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              hasAnyDefaults
                ? 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-600/30'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'
            }`}
            title="Set as default template for meet types"
          >
            {isSettingDefault ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : hasAnyDefaults ? (
              <StarIconSolid className="w-4 h-4" />
            ) : (
              <StarIcon className="w-4 h-4" />
            )}
            {hasAnyDefaults ? 'Edit Defaults' : 'Set as Default'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Get human-friendly source type name from OBS inputKind
 */
function getSourceTypeName(inputKind) {
  const typeMap = {
    'ffmpeg_source': 'Media Source',
    'browser_source': 'Browser Source',
    'image_source': 'Image',
    'color_source': 'Color Source',
    'text_gdiplus': 'Text (GDI+)',
    'text_ft2_source': 'Text (FreeType 2)',
    'dshow_input': 'Video Capture Device',
    'wasapi_input_capture': 'Audio Input Capture',
    'wasapi_output_capture': 'Audio Output Capture',
    'monitor_capture': 'Display Capture',
    'window_capture': 'Window Capture',
    'game_capture': 'Game Capture',
    'ndi_source': 'NDI Source',
    'vlc_source': 'VLC Video Source'
  };
  return typeMap[inputKind] || inputKind || 'Source';
}

/**
 * ApplyTemplateModal - Confirmation dialog for applying templates
 */
function ApplyTemplateModal({ template, onConfirm, onCancel, isApplying }) {
  const scenes = template.scenes || [];
  const inputs = template.inputs || [];

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 overflow-y-auto">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-900/20 flex items-center justify-center flex-shrink-0">
              <InformationCircleIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg mb-2">Apply Template</h3>
              <p className="text-gray-400 text-sm mb-4">
                Apply <span className="text-white font-medium">"{template.name}"</span> to create scenes and sources in OBS.
              </p>

              {/* Template Preview */}
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="text-gray-300 text-sm font-medium mb-3">This will create:</div>

                {/* Scenes List */}
                <div className="mb-4">
                  <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                    Scenes ({scenes.length})
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {scenes.map((scene, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-gray-300 text-sm">
                        <span className="text-purple-400">•</span>
                        <span>{scene.sceneName || scene}</span>
                        {scene.items && scene.items.length > 0 && (
                          <span className="text-gray-500 text-xs">({scene.items.length} items)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inputs List */}
                {inputs.length > 0 && (
                  <div>
                    <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                      Inputs ({inputs.length})
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {inputs.map((input, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-gray-300 text-sm">
                          <span className="text-blue-400">•</span>
                          <span>{input.inputName}</span>
                          <span className="text-gray-500 text-xs">({getSourceTypeName(input.inputKind)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transitions */}
                {template.transitions && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="text-gray-400 text-xs">
                      Transition: {template.transitions.currentTransitionName || 'Fade'} ({template.transitions.currentTransitionDuration || 300}ms)
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-yellow-200 text-sm">
                  Existing scenes with the same names will be skipped. Your current OBS setup will not be affected.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isApplying}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isApplying}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
            >
              {isApplying ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply Template'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SaveTemplateModal - Modal for saving current OBS state as template
 */
function SaveTemplateModal({
  name,
  description,
  meetTypes,
  availableMeetTypes,
  onNameChange,
  onDescriptionChange,
  onToggleMeetType,
  onSave,
  onCancel,
  isSaving
}) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-gray-800 rounded-lg max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-white font-semibold text-lg mb-4">Save Current Setup as Template</h3>

          <div className="space-y-4 mb-6">
            {/* Template Name */}
            <div>
              <label className="block text-white font-medium mb-2">
                Template Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g., Dual Meet Standard Setup"
                className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Template Description */}
            <div>
              <label className="block text-white font-medium mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Describe what this template includes..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
              />
            </div>

            {/* Meet Types */}
            <div>
              <label className="block text-white font-medium mb-2">
                Meet Types <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableMeetTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => onToggleMeetType(type)}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                      meetTypes.includes(type)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Select which meet types this template is suitable for
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
            >
              {isSaving ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <PlusIcon className="w-5 h-5" />
                  Save Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DeleteTemplateModal - Confirmation dialog for deleting templates
 */
function DeleteTemplateModal({ template, onConfirm, onCancel, isDeleting }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-gray-800 rounded-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <TrashIcon className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg mb-2">Delete Template</h3>
              <p className="text-gray-400 text-sm mb-4">
                Are you sure you want to delete the template <span className="text-white font-medium">"{template.name}"</span>?
              </p>

              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-red-200 text-sm">
                  This action cannot be undone. The template will be permanently deleted.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
            >
              {isDeleting ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <TrashIcon className="w-5 h-5" />
                  Delete Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SetDefaultModal - Configure which meet types this template is default for
 */
function SetDefaultModal({ template, availableMeetTypes, onSetDefault, onClearDefault, onCancel, isSettingDefault }) {
  const [selectedTypes, setSelectedTypes] = useState(template.isDefaultFor || []);
  const originalDefaults = template.isDefaultFor || [];

  const toggleMeetType = (meetType) => {
    setSelectedTypes(prev =>
      prev.includes(meetType)
        ? prev.filter(t => t !== meetType)
        : [...prev, meetType]
    );
  };

  // Only show meet types that are compatible with this template
  const compatibleMeetTypes = availableMeetTypes.filter(
    mt => template.meetTypes?.includes(mt)
  );

  const handleSave = () => {
    // Find types to add (newly selected)
    const typesToAdd = selectedTypes.filter(t => !originalDefaults.includes(t));
    // Find types to remove (were selected, now not)
    const typesToRemove = originalDefaults.filter(t => !selectedTypes.includes(t));

    if (typesToAdd.length > 0) {
      onSetDefault(typesToAdd);
    }
    if (typesToRemove.length > 0 && typesToAdd.length === 0) {
      onClearDefault(typesToRemove);
    }
    if (typesToAdd.length === 0 && typesToRemove.length === 0) {
      onCancel();
    }
  };

  const hasChanges = JSON.stringify(selectedTypes.sort()) !== JSON.stringify(originalDefaults.sort());

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-gray-800 rounded-lg max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-900/20 flex items-center justify-center flex-shrink-0">
              <StarIconSolid className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg mb-2">Set Default Template</h3>
              <p className="text-gray-400 text-sm">
                Select which meet types should auto-load <span className="text-white font-medium">"{template.name}"</span> when OBS connects.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-white font-medium mb-3">
              Auto-load for these meet types:
            </label>

            {compatibleMeetTypes.length === 0 ? (
              <div className="text-gray-400 text-sm bg-gray-900 rounded-lg p-4">
                This template has no compatible meet types configured.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {compatibleMeetTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => toggleMeetType(type)}
                    disabled={isSettingDefault}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                      selectedTypes.includes(type)
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <span>{type}</span>
                    {selectedTypes.includes(type) && (
                      <CheckCircleIcon className="w-5 h-5" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <p className="text-gray-500 text-xs mt-3">
              Only one template can be default per meet type. Setting a new default will clear the previous one.
            </p>
          </div>

          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-4 flex items-start gap-2">
            <InformationCircleIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-blue-200 text-sm">
              Default templates auto-apply when OBS connects to a competition with no existing scenes.
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isSettingDefault}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSettingDefault || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
            >
              {isSettingDefault ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <StarIconSolid className="w-5 h-5" />
                  Save Defaults
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
