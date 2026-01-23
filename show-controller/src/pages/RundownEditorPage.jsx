import { useState, useMemo, useEffect } from 'react';
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
  LightBulbIcon,
  PhotoIcon,
  BookmarkIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { getGraphicsForCompetition, getCategories, getRecommendedGraphic, getGraphicById, GRAPHICS } from '../lib/graphicsRegistry';
import { db, ref, set, get, push, remove } from '../lib/firebase';

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

// Hardcoded test data per PRD (updated with graphic field structure for Phase 0B, bufferAfter for Phase 1)
const DUMMY_SEGMENTS = [
  { id: 'seg-001', name: 'Show Intro', type: 'video', duration: 45, scene: 'Starting Soon', graphic: null, autoAdvance: true, bufferAfter: 0 },
  { id: 'seg-002', name: 'Team Logos', type: 'static', duration: 10, scene: 'Graphics Fullscreen', graphic: { graphicId: 'logos', params: {} }, autoAdvance: true, bufferAfter: 5 },
  { id: 'seg-003', name: 'UCLA Coaches', type: 'live', duration: 15, scene: 'Single - Camera 2', graphic: { graphicId: 'team-coaches', params: { teamSlot: 1 } }, autoAdvance: true, bufferAfter: 0 },
  { id: 'seg-004', name: 'Oregon Coaches', type: 'live', duration: 15, scene: 'Single - Camera 3', graphic: { graphicId: 'team-coaches', params: { teamSlot: 2 } }, autoAdvance: true, bufferAfter: 10 },
  { id: 'seg-005', name: 'Rotation 1 Summary', type: 'static', duration: 20, scene: 'Graphics Fullscreen', graphic: { graphicId: 'event-summary', params: { summaryMode: 'rotation', summaryRotation: 1, summaryTheme: 'espn' } }, autoAdvance: true, bufferAfter: 0 },
  { id: 'seg-006', name: 'Floor - Rotation 1', type: 'live', duration: null, scene: 'Quad View', graphic: { graphicId: 'floor', params: {} }, autoAdvance: false, bufferAfter: 0 },
  { id: 'seg-007', name: 'Commercial Break', type: 'break', duration: 120, scene: 'Starting Soon', graphic: null, autoAdvance: true, bufferAfter: 0 },
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
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [targetDuration, setTargetDuration] = useState(null); // Target show duration in seconds
  const [showTargetInput, setShowTargetInput] = useState(false); // Toggle for target duration input

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

  // Calculate total runtime (sum of all segment durations + buffer times)
  const totalRuntime = useMemo(() => {
    return segments.reduce((sum, seg) => sum + (seg.duration || 0) + (seg.bufferAfter || 0), 0);
  }, [segments]);

  // Calculate cumulative start times for each segment (for running time column)
  // Includes buffer times from previous segments
  const segmentStartTimes = useMemo(() => {
    const startTimes = {};
    let cumulativeTime = 0;
    segments.forEach(seg => {
      startTimes[seg.id] = cumulativeTime;
      cumulativeTime += (seg.duration || 0) + (seg.bufferAfter || 0);
    });
    return startTimes;
  }, [segments]);

  // Calculate over/under and color state for target duration
  const runtimeStatus = useMemo(() => {
    if (!targetDuration) return null;

    const diff = totalRuntime - targetDuration;
    const percentOfTarget = (totalRuntime / targetDuration) * 100;

    // Determine color state based on percentage of target
    // Green: <= 95% of target
    // Yellow: 95-100% of target (approaching limit)
    // Red: > 100% of target (over)
    let color;
    if (percentOfTarget > 100) {
      color = 'red';
    } else if (percentOfTarget >= 95) {
      color = 'yellow';
    } else {
      color = 'green';
    }

    return {
      diff,
      percentOfTarget,
      color,
      isOver: diff > 0,
      isUnder: diff < 0,
      isExact: diff === 0,
    };
  }, [totalRuntime, targetDuration]);

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
      bufferAfter: 0,
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

  async function handleTemplates() {
    setShowTemplateLibrary(true);
    setLoadingTemplates(true);
    try {
      const snapshot = await get(ref(db, 'rundownTemplates'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const templateList = Object.values(data).map(t => t.metadata);
        setTemplates(templateList);
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      showToast('Error loading templates');
    }
    setLoadingTemplates(false);
  }

  function handleSaveAsTemplate() {
    setShowSaveTemplateModal(true);
  }

  // Abstract team references in segment name
  // e.g., "UCLA Coaches" -> "{team1} Coaches" if UCLA is team 1
  function abstractTeamReferences(segmentName, teams) {
    let abstractedName = segmentName;
    Object.entries(teams).forEach(([slot, team]) => {
      const regex = new RegExp(team.name, 'gi');
      abstractedName = abstractedName.replace(regex, `{team${slot}}`);
    });
    return abstractedName;
  }

  // Create template segments from current rundown
  function createTemplateSegments(currentSegments, teams) {
    return currentSegments.map((seg, index) => ({
      id: `tpl-${String(index + 1).padStart(3, '0')}`,
      name: abstractTeamReferences(seg.name, teams),
      type: seg.type,
      duration: seg.duration,
      scene: seg.scene,
      graphic: seg.graphic,
      autoAdvance: seg.autoAdvance,
      bufferAfter: seg.bufferAfter || 0,
    }));
  }

  // Determine competition types compatible with this template
  function getCompatibleTypes(compType) {
    // Extract gender and team count
    const isWomens = compType.startsWith('womens-');
    const isMens = compType.startsWith('mens-');
    const teamCount = compType.includes('dual') ? 2 :
                      compType.includes('tri') ? 3 :
                      compType.includes('quad') ? 4 :
                      compType.includes('-5') ? 5 :
                      compType.includes('-6') ? 6 : 2;

    // Templates are compatible with same gender, same or more teams
    const types = [];
    const genderPrefix = isWomens ? 'womens-' : isMens ? 'mens-' : '';

    if (teamCount <= 2) types.push(`${genderPrefix}dual`);
    if (teamCount <= 3) types.push(`${genderPrefix}tri`);
    if (teamCount <= 4) types.push(`${genderPrefix}quad`);
    if (teamCount <= 5) types.push(`${genderPrefix}5`);
    if (teamCount <= 6) types.push(`${genderPrefix}6`);

    return types;
  }

  // Calculate total duration
  function calculateTotalDuration(segs) {
    return segs.reduce((sum, seg) => sum + (seg.duration || 0), 0);
  }

  async function handleSaveTemplate(templateName, templateDescription) {
    try {
      const templateId = templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const teams = DUMMY_COMPETITION.teams;

      const templateData = {
        metadata: {
          id: templateId,
          name: templateName,
          description: templateDescription,
          competitionTypes: getCompatibleTypes(DUMMY_COMPETITION.type),
          teamCount: Object.keys(teams).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDuration: calculateTotalDuration(segments),
        },
        segments: createTemplateSegments(segments, teams),
      };

      await set(ref(db, `rundownTemplates/${templateId}`), templateData);
      setShowSaveTemplateModal(false);
      showToast(`Template "${templateName}" saved!`);
    } catch (error) {
      console.error('Error saving template:', error);
      showToast('Error saving template');
    }
  }

  // Resolve team references in segment name
  // e.g., "{team1} Coaches" -> "UCLA Coaches" using actual competition teams
  function resolveTeamReferences(segmentName, teams) {
    let resolvedName = segmentName;
    Object.entries(teams).forEach(([slot, team]) => {
      const placeholder = new RegExp(`\\{team${slot}\\}`, 'gi');
      resolvedName = resolvedName.replace(placeholder, team.name);
    });
    return resolvedName;
  }

  // Create rundown segments from template
  function createSegmentsFromTemplate(templateSegments, teams) {
    return templateSegments.map((seg, index) => ({
      id: `seg-${String(index + 1).padStart(3, '0')}`,
      name: resolveTeamReferences(seg.name, teams),
      type: seg.type,
      duration: seg.duration,
      scene: seg.scene,
      graphic: seg.graphic,
      autoAdvance: seg.autoAdvance,
      bufferAfter: seg.bufferAfter || 0,
    }));
  }

  // Check if template is compatible with current competition
  function isTemplateCompatible(template) {
    const compType = DUMMY_COMPETITION.type;
    const teamCount = Object.keys(DUMMY_COMPETITION.teams).length;

    // Check competition type compatibility
    if (template.competitionTypes && !template.competitionTypes.includes(compType)) {
      // Also check for gender match
      const isWomensComp = compType.startsWith('womens-');
      const isMensComp = compType.startsWith('mens-');
      const hasCompatibleGender = template.competitionTypes.some(t =>
        (isWomensComp && t.startsWith('womens-')) ||
        (isMensComp && t.startsWith('mens-'))
      );
      if (!hasCompatibleGender) return false;
    }

    // Check team count compatibility
    if (template.teamCount && template.teamCount > teamCount) {
      return false;
    }

    return true;
  }

  async function handleLoadTemplate(templateId) {
    try {
      const snapshot = await get(ref(db, `rundownTemplates/${templateId}`));
      if (!snapshot.exists()) {
        showToast('Template not found');
        return;
      }

      const templateData = snapshot.val();
      const teams = DUMMY_COMPETITION.teams;

      // Create new segments from template
      const newSegments = createSegmentsFromTemplate(templateData.segments, teams);
      setSegments(newSegments);
      setSelectedSegmentId(null);
      setShowTemplateLibrary(false);
      showToast(`Loaded template: ${templateData.metadata.name}`);
    } catch (error) {
      console.error('Error loading template:', error);
      showToast('Error loading template');
    }
  }

  async function handleDeleteTemplate(templateId) {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      await remove(ref(db, `rundownTemplates/${templateId}`));
      setTemplates(templates.filter(t => t.id !== templateId));
      showToast('Template deleted');
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast('Error deleting template');
    }
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
            {/* Total Runtime Display with Target Duration */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-2 border rounded-lg ${
                runtimeStatus?.color === 'red'
                  ? 'bg-red-500/10 border-red-500/50'
                  : runtimeStatus?.color === 'yellow'
                    ? 'bg-yellow-500/10 border-yellow-500/50'
                    : runtimeStatus?.color === 'green'
                      ? 'bg-green-500/10 border-green-500/50'
                      : 'bg-zinc-800/50 border-zinc-700'
              }`}>
                <ClockIcon className={`w-4 h-4 ${
                  runtimeStatus?.color === 'red'
                    ? 'text-red-400'
                    : runtimeStatus?.color === 'yellow'
                      ? 'text-yellow-400'
                      : runtimeStatus?.color === 'green'
                        ? 'text-green-400'
                        : 'text-zinc-400'
                }`} />
                <div className="text-sm">
                  <span className="text-zinc-400">Runtime:</span>
                  <span className={`ml-1.5 font-mono font-medium ${
                    runtimeStatus?.color === 'red'
                      ? 'text-red-300'
                      : runtimeStatus?.color === 'yellow'
                        ? 'text-yellow-300'
                        : runtimeStatus?.color === 'green'
                          ? 'text-green-300'
                          : 'text-white'
                  }`}>{formatDuration(totalRuntime)}</span>
                  {targetDuration && (
                    <span className="text-zinc-500 ml-1">/ {formatDuration(targetDuration)}</span>
                  )}
                </div>
                {/* Over/Under Indicator */}
                {runtimeStatus && (
                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                    runtimeStatus.color === 'red'
                      ? 'bg-red-500/20 text-red-300'
                      : runtimeStatus.color === 'yellow'
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-green-500/20 text-green-300'
                  }`}>
                    {runtimeStatus.isOver
                      ? `+${formatDuration(runtimeStatus.diff)}`
                      : runtimeStatus.isUnder
                        ? `-${formatDuration(Math.abs(runtimeStatus.diff))}`
                        : 'On Target'}
                  </span>
                )}
              </div>

              {/* Target Duration Input Toggle */}
              {showTargetInput ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="H:MM:SS"
                    defaultValue={targetDuration ? formatDuration(targetDuration) : ''}
                    onBlur={(e) => {
                      const parsed = parseDuration(e.target.value);
                      setTargetDuration(parsed);
                      if (!parsed) setShowTargetInput(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const parsed = parseDuration(e.target.value);
                        setTargetDuration(parsed);
                        setShowTargetInput(false);
                      } else if (e.key === 'Escape') {
                        setShowTargetInput(false);
                      }
                    }}
                    className="w-24 px-2 py-1 text-sm font-mono bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowTargetInput(false)}
                    className="p-1 text-zinc-500 hover:text-zinc-300"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTargetInput(true)}
                  className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                  title="Set target duration"
                >
                  {targetDuration ? 'Edit target' : '+ Target'}
                </button>
              )}
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
              onClick={handleSaveAsTemplate}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <BookmarkIcon className="w-4 h-4" />
              Save as Template
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
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">
                Segments ({filteredSegments.length})
              </div>
              {/* Column headers for running time */}
              <div className="flex items-center gap-3 text-xs text-zinc-600 uppercase tracking-wide">
                <span className="w-6">#</span>
                <span className="w-12 text-right">Start</span>
              </div>
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
                          {/* Running Time Column - shows cumulative start time */}
                          <span className="text-xs text-zinc-400 font-mono w-12 text-right" title="Start time">
                            {formatDuration(segmentStartTimes[segment.id] || 0)}
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
                              {segment.graphic?.graphicId && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-pink-500/20 text-pink-400 border border-pink-500/30"
                                  title={`Graphic: ${segment.graphic.graphicId}`}
                                >
                                  <PhotoIcon className="w-3 h-3" />
                                </span>
                              )}
                              {segment.bufferAfter > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 border-dashed"
                                  title={`${segment.bufferAfter}s buffer after this segment`}
                                >
                                  +{segment.bufferAfter}s
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

      {/* Save as Template Modal */}
      {showSaveTemplateModal && (
        <SaveTemplateModal
          onSave={handleSaveTemplate}
          onCancel={() => setShowSaveTemplateModal(false)}
          segmentCount={segments.length}
          totalDuration={calculateTotalDuration(segments)}
        />
      )}

      {/* Template Library Modal */}
      {showTemplateLibrary && (
        <TemplateLibraryModal
          templates={templates}
          loading={loadingTemplates}
          onLoad={handleLoadTemplate}
          onDelete={handleDeleteTemplate}
          onCancel={() => setShowTemplateLibrary(false)}
          isCompatible={isTemplateCompatible}
        />
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

// Get the base graphic ID from an expanded team graphic ID
// e.g., "team1-stats" -> "team-stats", "team2-coaches" -> "team-coaches"
function getBaseGraphicId(graphicId) {
  const teamMatch = graphicId.match(/^team\d+-(.+)$/);
  if (teamMatch) {
    return `team-${teamMatch[1]}`;
  }
  return graphicId;
}

// Get user-editable params for a graphic (excluding auto-filled competition params)
function getUserEditableParams(graphicId) {
  const baseId = getBaseGraphicId(graphicId);
  const graphic = GRAPHICS[baseId];
  if (!graphic?.params) return [];

  const editableParams = [];
  for (const [key, schema] of Object.entries(graphic.params)) {
    // Skip params that are auto-filled from competition config
    if (schema.source === 'competition') continue;
    // Skip teamSlot for now - it's handled by the graphic ID expansion (team1-coaches, team2-coaches, etc.)
    if (key === 'teamSlot') continue;

    editableParams.push({ key, ...schema });
  }
  return editableParams;
}

// Component for rendering parameter inputs based on graphic schema
function GraphicParamInputs({ graphicId, params, onChange }) {
  const editableParams = getUserEditableParams(graphicId);

  if (editableParams.length === 0) {
    return null;
  }

  const handleParamChange = (key, value) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-700">
      <div className="text-xs text-zinc-500 mb-2">Parameters</div>
      <div className="space-y-3">
        {editableParams.map(param => (
          <div key={param.key}>
            <label className="block text-xs text-zinc-400 mb-1">
              {param.label || param.key}
            </label>
            {param.type === 'enum' && param.options ? (
              <select
                value={params[param.key] || param.default || ''}
                onChange={(e) => handleParamChange(param.key, e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {param.options.map(option => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            ) : param.type === 'number' ? (
              <input
                type="number"
                value={params[param.key] ?? param.default ?? ''}
                min={param.min}
                max={param.max}
                onChange={(e) => handleParamChange(param.key, e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            ) : (
              <input
                type="text"
                value={params[param.key] || param.default || ''}
                onChange={(e) => handleParamChange(param.key, e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Placeholder SegmentDetail panel component
function SegmentDetailPanel({ segment, onSave, onDelete, onCancel }) {
  const [formData, setFormData] = useState(segment);
  const groupedScenes = getGroupedScenes();
  const groupedGraphics = getGroupedGraphics();

  // Reset form when segment changes
  useEffect(() => {
    setFormData(segment);
  }, [segment]);

  // Get smart recommendation based on segment name
  const recommendation = getRecommendedGraphic(
    formData.name,
    DUMMY_COMPETITION.type,
    getTeamNames()
  );

  // Only show recommendation if confidence is high enough and graphic isn't already selected
  const showRecommendation = recommendation &&
    recommendation.confidence >= 0.2 &&
    formData.graphic?.graphicId !== recommendation.id;

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

        {/* Buffer/Pad Time */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Buffer After (seconds)
            <span className="ml-1.5 text-zinc-600 font-normal">— gap before next segment</span>
          </label>
          <input
            type="number"
            min="0"
            value={formData.bufferAfter || ''}
            onChange={(e) => setFormData({ ...formData, bufferAfter: e.target.value ? Number(e.target.value) : 0 })}
            placeholder="0"
            className="w-32 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
          {formData.bufferAfter > 0 && (
            <div className="mt-1 text-xs text-amber-400/70">
              +{formData.bufferAfter}s buffer adds to total runtime
            </div>
          )}
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

          {/* Smart Recommendation */}
          {showRecommendation && (
            <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LightBulbIcon className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-300">
                  Suggested: <span className="font-medium">{recommendation.label}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleGraphicChange(recommendation.id)}
                className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/30 transition-colors"
              >
                Use
              </button>
            </div>
          )}

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
          {/* Parameter Inputs - shown when graphic is selected */}
          {formData.graphic?.graphicId && (
            <GraphicParamInputs
              graphicId={formData.graphic.graphicId}
              params={formData.graphic.params || {}}
              onChange={(newParams) => setFormData({
                ...formData,
                graphic: { ...formData.graphic, params: newParams }
              })}
            />
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

// Format duration in seconds to readable format
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// Parse duration string (H:MM:SS, M:SS, or just seconds) to seconds
function parseDuration(str) {
  if (!str || !str.trim()) return null;

  const trimmed = str.trim();

  // Try parsing as just a number (seconds)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Try parsing as M:SS or MM:SS
  const minSecMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (minSecMatch) {
    const minutes = parseInt(minSecMatch[1], 10);
    const seconds = parseInt(minSecMatch[2], 10);
    return minutes * 60 + seconds;
  }

  // Try parsing as H:MM:SS
  const hourMinSecMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hourMinSecMatch) {
    const hours = parseInt(hourMinSecMatch[1], 10);
    const minutes = parseInt(hourMinSecMatch[2], 10);
    const seconds = parseInt(hourMinSecMatch[3], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

// Save as Template Modal Component
function SaveTemplateModal({ onSave, onCancel, segmentCount, totalDuration }) {
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!templateName.trim()) return;

    setSaving(true);
    await onSave(templateName.trim(), templateDescription.trim());
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Save as Template</h2>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Template Name *</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Standard Dual Meet"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Description (optional)</label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="e.g., Basic dual meet format with intros, rotations, and breaks"
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="text-xs text-zinc-400 mb-2">Template will include:</div>
            <div className="flex items-center gap-4 text-sm text-zinc-300">
              <span>{segmentCount} segments</span>
              <span className="text-zinc-600">•</span>
              <span>{formatDuration(totalDuration)} total</span>
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              Team names will be converted to placeholders for reuse with any competition.
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!templateName.trim() || saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Template Library Modal Component
function TemplateLibraryModal({ templates, loading, onLoad, onDelete, onCancel, isCompatible }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Template Library</h2>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-zinc-500">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-zinc-500 mb-2">No templates saved yet</div>
              <div className="text-xs text-zinc-600">
                Use "Save as Template" to save your current rundown structure for reuse.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(template => {
                const compatible = isCompatible(template);
                return (
                  <div
                    key={template.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      compatible
                        ? 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                        : 'bg-zinc-800/30 border-zinc-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">{template.name}</span>
                          {!compatible && (
                            <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
                              Incompatible
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <div className="text-sm text-zinc-500 mt-1 line-clamp-2">
                            {template.description}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                          <span>{template.teamCount || '?'} teams</span>
                          <span className="text-zinc-700">•</span>
                          <span>{formatDuration(template.estimatedDuration)}</span>
                          {template.competitionTypes && (
                            <>
                              <span className="text-zinc-700">•</span>
                              <span className="truncate">{template.competitionTypes.join(', ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onLoad(template.id)}
                          disabled={!compatible}
                          className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => onDelete(template.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-700 transition-colors"
                          title="Delete template"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500">
            Loading a template will replace your current rundown. Make sure to save first if needed.
          </div>
        </div>
      </div>
    </div>
  );
}
