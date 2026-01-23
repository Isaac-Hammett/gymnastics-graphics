import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  PlusIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { getGraphicsForCompetition, getCategories } from '../lib/graphicsRegistry';

// Hardcoded competition context per PRD (Phase 0B)
const DUMMY_COMPETITION = {
  id: 'pac12-2025',
  name: "Women's Quad Meet",
  type: 'womens-quad',
  teams: {
    1: { name: 'UCLA', logo: 'https://media.virti.us/upload/images/team/ucla-logo.png' },
    2: { name: 'Oregon', logo: 'https://media.virti.us/upload/images/team/oregon-logo.png' },
    3: { name: 'Utah', logo: 'https://media.virti.us/upload/images/team/utah-logo.png' },
    4: { name: 'Arizona', logo: 'https://media.virti.us/upload/images/team/arizona-logo.png' },
  },
};

// Hardcoded OBS scenes per PRD (Phase 0B)
const DUMMY_SCENES = [
  { name: 'Starting Soon', category: 'static' },
  { name: 'Talent Camera', category: 'manual' },
  { name: 'Graphics Fullscreen', category: 'graphics' },
  { name: 'Single - Camera 1', category: 'single' },
  { name: 'Single - Camera 2', category: 'single' },
  { name: 'Single - Camera 3', category: 'single' },
  { name: 'Single - Camera 4', category: 'single' },
  { name: 'Dual View', category: 'multi' },
  { name: 'Quad View', category: 'multi' },
];

// Hardcoded test data per PRD (updated with graphic field structure for Phase 0B)
const DUMMY_SEGMENTS = [
  { id: 'seg-001', name: 'Show Intro', type: 'video', duration: 45, scene: 'Starting Soon', graphic: null, autoAdvance: true },
  { id: 'seg-002', name: 'Team Logos', type: 'static', duration: 10, scene: 'Graphics Fullscreen', graphic: { graphicId: 'logos', params: {} }, autoAdvance: true },
  { id: 'seg-003', name: 'UCLA Coaches', type: 'live', duration: 15, scene: 'Single - Camera 2', graphic: { graphicId: 'team-coaches', params: { teamSlot: 1 } }, autoAdvance: true },
  { id: 'seg-004', name: 'Oregon Coaches', type: 'live', duration: 15, scene: 'Single - Camera 3', graphic: { graphicId: 'team-coaches', params: { teamSlot: 2 } }, autoAdvance: true },
  { id: 'seg-005', name: 'Rotation 1 Summary', type: 'static', duration: 20, scene: 'Graphics Fullscreen', graphic: { graphicId: 'event-summary', params: { summaryMode: 'rotation', summaryRotation: 1, summaryTheme: 'espn' } }, autoAdvance: true },
  { id: 'seg-006', name: 'Floor - Rotation 1', type: 'live', duration: null, scene: 'Quad View', graphic: { graphicId: 'floor', params: {} }, autoAdvance: false },
  { id: 'seg-007', name: 'Commercial Break', type: 'break', duration: 120, scene: 'Starting Soon', graphic: null, autoAdvance: true },
];

// Segment type options
const SEGMENT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'video', label: 'Video' },
  { value: 'live', label: 'Live' },
  { value: 'static', label: 'Static' },
  { value: 'break', label: 'Break' },
  { value: 'hold', label: 'Hold' },
  { value: 'graphic', label: 'Graphic' },
];

// Type badge colors
const TYPE_COLORS = {
  video: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  live: 'bg-green-500/20 text-green-400 border-green-500/30',
  static: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  break: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  hold: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  graphic: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

export default function RundownEditorPage() {
  const { compId } = useParams();

  // State management per PRD
  const [segments, setSegments] = useState(DUMMY_SEGMENTS);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState('');

  // Filtered segments
  const filteredSegments = useMemo(() => {
    return segments.filter(seg => {
      const matchesType = filterType === 'all' || seg.type === filterType;
      const matchesSearch = seg.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [segments, filterType, searchQuery]);

  // Get selected segment for detail panel
  const selectedSegment = useMemo(() => {
    return segments.find(seg => seg.id === selectedSegmentId) || null;
  }, [segments, selectedSegmentId]);

  // Toast helper
  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  }

  // Event handlers per PRD
  function handleSelectSegment(id) {
    setSelectedSegmentId(id);
    setSelectedSegmentIds([]); // Clear multi-select
  }

  function handleMultiSelect(ids) {
    setSelectedSegmentIds(ids);
    setSelectedSegmentId(null);
  }

  function handleReorder(fromIndex, toIndex) {
    const newSegments = [...segments];
    const [removed] = newSegments.splice(fromIndex, 1);
    newSegments.splice(toIndex, 0, removed);
    setSegments(newSegments);
  }

  function handleAddSegment() {
    const newId = `seg-${String(segments.length + 1).padStart(3, '0')}`;
    const newSegment = {
      id: newId,
      name: 'New Segment',
      type: 'live',
      duration: null,
      scene: '',
      graphic: null,
      autoAdvance: false,
    };

    // Insert after selected segment, or at end
    if (selectedSegmentId) {
      const index = segments.findIndex(s => s.id === selectedSegmentId);
      const newSegments = [...segments];
      newSegments.splice(index + 1, 0, newSegment);
      setSegments(newSegments);
    } else {
      setSegments([...segments, newSegment]);
    }

    setSelectedSegmentId(newId);
    showToast('Segment added');
  }

  function handleSaveSegment(updatedSegment) {
    setSegments(segments.map(seg =>
      seg.id === updatedSegment.id ? updatedSegment : seg
    ));
    showToast('Segment saved');
  }

  function handleDeleteSegment(id) {
    if (window.confirm('Are you sure you want to delete this segment?')) {
      setSegments(segments.filter(seg => seg.id !== id));
      if (selectedSegmentId === id) {
        setSelectedSegmentId(null);
      }
      showToast('Segment deleted');
    }
  }

  function handleCancelEdit() {
    setSelectedSegmentId(null);
    setSelectedSegmentIds([]);
  }

  // Toolbar button handlers
  function handleSave() {
    showToast('Rundown saved');
  }

  function handleExportCSV() {
    showToast('Coming soon');
  }

  function handleTemplates() {
    showToast('Coming soon');
  }

  function handleImportCSV() {
    showToast('Coming soon');
  }

  function handleSyncOBS() {
    showToast('Coming soon');
  }

  // Move segment up/down
  function handleMoveUp(index) {
    if (index > 0) {
      handleReorder(index, index - 1);
    }
  }

  function handleMoveDown(index) {
    if (index < segments.length - 1) {
      handleReorder(index, index + 1);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/${compId}/producer`}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">RUNDOWN EDITOR</h1>
              <p className="text-sm text-zinc-500">{compId} - {DUMMY_COMPETITION.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSegment}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Segment
            </button>
            <button
              onClick={handleTemplates}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
              Templates
            </button>
            <button
              onClick={handleImportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={handleSyncOBS}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Sync OBS
            </button>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm focus:outline-none focus:border-blue-500"
            >
              {SEGMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search segments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Segment List (left panel ~60%) */}
        <div className="w-3/5 border-r border-zinc-800 overflow-y-auto">
          <div className="p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
              Segments ({filteredSegments.length})
            </div>
            {filteredSegments.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                {searchQuery || filterType !== 'all'
                  ? 'No segments match your filter'
                  : 'No segments yet. Click "Add Segment" to get started.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSegments.map((segment, index) => {
                  const originalIndex = segments.findIndex(s => s.id === segment.id);
                  const isSelected = selectedSegmentId === segment.id;
                  const isMultiSelected = selectedSegmentIds.includes(segment.id);

                  return (
                    <div
                      key={segment.id}
                      onClick={() => handleSelectSegment(segment.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500'
                          : isMultiSelected
                            ? 'bg-zinc-800 border-blue-500/50'
                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500 font-mono w-6">
                            {String(originalIndex + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <div className="text-white font-medium">{segment.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 text-xs rounded border ${TYPE_COLORS[segment.type] || 'bg-zinc-700 text-zinc-400 border-zinc-600'}`}>
                                {segment.type}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {segment.duration ? `${segment.duration}s` : 'Manual'}
                              </span>
                              {segment.scene && (
                                <span className="text-xs text-zinc-500">
                                  • {segment.scene}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveUp(originalIndex); }}
                            disabled={originalIndex === 0}
                            className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUpIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveDown(originalIndex); }}
                            disabled={originalIndex === segments.length - 1}
                            className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDownIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Segment Detail (right panel ~40%) */}
        <div className="w-2/5 overflow-y-auto">
          <div className="p-4">
            {selectedSegment ? (
              <SegmentDetailPanel
                segment={selectedSegment}
                onSave={handleSaveSegment}
                onDelete={() => handleDeleteSegment(selectedSegment.id)}
                onCancel={handleCancelEdit}
              />
            ) : (
              <div className="text-center py-20 text-zinc-500">
                <div className="text-lg mb-2">No segment selected</div>
                <div className="text-sm">Select a segment from the list to edit its details</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 px-5 py-3 bg-green-500 text-white rounded-lg font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// Scene category labels for display
const SCENE_CATEGORY_LABELS = {
  static: 'Static Scenes',
  manual: 'Manual Control',
  graphics: 'Graphics',
  single: 'Single Camera',
  multi: 'Multi-Camera',
};

// Graphics category labels for display
const GRAPHICS_CATEGORY_LABELS = {
  'pre-meet': 'Pre-Meet',
  'in-meet': 'In-Meet',
  'event-frames': 'Event Frames',
  'frame-overlays': 'Frame Overlays',
  'leaderboards': 'Leaderboards',
  'event-summary': 'Event Summary',
  'stream': 'Stream',
};

// Group scenes by category
function getGroupedScenes() {
  const groups = {};
  DUMMY_SCENES.forEach(scene => {
    if (!groups[scene.category]) {
      groups[scene.category] = [];
    }
    groups[scene.category].push(scene);
  });
  return groups;
}

// Get team names from DUMMY_COMPETITION for graphics filtering
function getTeamNames() {
  const teamNames = {};
  Object.entries(DUMMY_COMPETITION.teams).forEach(([num, team]) => {
    teamNames[num] = team.name;
  });
  return teamNames;
}

// Get graphics grouped by category for the dropdown
function getGroupedGraphics() {
  const compType = DUMMY_COMPETITION.type;
  const teamNames = getTeamNames();
  const graphics = getGraphicsForCompetition(compType, teamNames);

  const groups = {};
  graphics.forEach(graphic => {
    if (!groups[graphic.category]) {
      groups[graphic.category] = [];
    }
    groups[graphic.category].push(graphic);
  });
  return groups;
}

// Placeholder SegmentDetail panel component
function SegmentDetailPanel({ segment, onSave, onDelete, onCancel }) {
  const [formData, setFormData] = useState(segment);
  const groupedScenes = getGroupedScenes();
  const groupedGraphics = getGroupedGraphics();

  // Reset form when segment changes
  useState(() => {
    setFormData(segment);
  }, [segment]);

  // Handle graphic selection change
  function handleGraphicChange(graphicId) {
    if (!graphicId) {
      setFormData({ ...formData, graphic: null });
    } else {
      // Preserve existing params if same graphic, otherwise reset
      const existingParams = formData.graphic?.graphicId === graphicId
        ? formData.graphic.params
        : {};
      setFormData({
        ...formData,
        graphic: { graphicId, params: existingParams }
      });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Edit Segment</h2>
        <button
          onClick={onDelete}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Segment Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {SEGMENT_TYPES.filter(t => t.value !== 'all').map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Duration (seconds)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value ? Number(e.target.value) : null })}
              placeholder="Manual"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* OBS Scene Picker - grouped by category */}
        <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
          <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wide">OBS Scene</label>
          <select
            value={formData.scene}
            onChange={(e) => setFormData({ ...formData, scene: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">(No scene selected)</option>
            {Object.entries(groupedScenes).map(([category, scenes]) => (
              <optgroup key={category} label={SCENE_CATEGORY_LABELS[category] || category}>
                {scenes.map(scene => (
                  <option key={scene.name} value={scene.name}>
                    {scene.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Graphic Picker - grouped by category */}
        <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
          <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wide">Graphic</label>
          <select
            value={formData.graphic?.graphicId || ''}
            onChange={(e) => handleGraphicChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">(None)</option>
            {Object.entries(groupedGraphics).map(([category, graphics]) => (
              <optgroup key={category} label={GRAPHICS_CATEGORY_LABELS[category] || category}>
                {graphics.map(graphic => (
                  <option key={graphic.id} value={graphic.id}>
                    {graphic.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {formData.graphic?.graphicId && (
            <div className="mt-2 text-xs text-zinc-500">
              Selected: {formData.graphic.graphicId}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoAdvance"
            checked={formData.autoAdvance}
            onChange={(e) => setFormData({ ...formData, autoAdvance: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="autoAdvance" className="text-sm text-zinc-300">Auto-advance when duration ends</label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
