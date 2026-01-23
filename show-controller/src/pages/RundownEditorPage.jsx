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
  ChevronRightIcon,
  LightBulbIcon,
  PhotoIcon,
  BookmarkIcon,
  XMarkIcon,
  ClockIcon,
  PencilIcon,
  CheckIcon,
  Bars3Icon,
  FolderIcon,
  FolderOpenIcon,
  LockClosedIcon,
  LockOpenIcon,
  ChatBubbleLeftIcon,
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

// Timing mode options (Phase 6: Task 55)
const TIMING_MODES = [
  { value: 'fixed', label: 'Fixed Duration', description: 'Segment has set duration, auto-advances when complete' },
  { value: 'manual', label: 'Manual', description: 'Segment waits for manual trigger to advance' },
  { value: 'follows-previous', label: 'Follows Previous', description: 'Segment starts immediately when previous ends (no gap)' },
];

// Hardcoded test data per PRD (updated with graphic field structure for Phase 0B, bufferAfter for Phase 1, locked/optional/notes for Phase 5, timingMode for Phase 6)
const DUMMY_SEGMENTS = [
  { id: 'seg-001', name: 'Show Intro', type: 'video', duration: 45, scene: 'Starting Soon', graphic: null, autoAdvance: true, bufferAfter: 0, locked: false, optional: false, notes: '', timingMode: 'fixed' },
  { id: 'seg-002', name: 'Team Logos', type: 'static', duration: 10, scene: 'Graphics Fullscreen', graphic: { graphicId: 'logos', params: {} }, autoAdvance: true, bufferAfter: 5, locked: true, optional: false, notes: 'Show all 4 team logos in quad layout', timingMode: 'fixed' },
  { id: 'seg-003', name: 'UCLA Coaches', type: 'live', duration: 15, scene: 'Single - Camera 2', graphic: { graphicId: 'team-coaches', params: { teamSlot: 1 } }, autoAdvance: true, bufferAfter: 0, locked: false, optional: false, notes: '', timingMode: 'follows-previous' },
  { id: 'seg-004', name: 'Oregon Coaches', type: 'live', duration: 15, scene: 'Single - Camera 3', graphic: { graphicId: 'team-coaches', params: { teamSlot: 2 } }, autoAdvance: true, bufferAfter: 10, locked: false, optional: false, notes: 'First year head coach - mention in intro', timingMode: 'fixed' },
  { id: 'seg-005', name: 'Rotation 1 Summary', type: 'static', duration: 20, scene: 'Graphics Fullscreen', graphic: { graphicId: 'event-summary', params: { summaryMode: 'rotation', summaryRotation: 1, summaryTheme: 'espn' } }, autoAdvance: true, bufferAfter: 0, locked: false, optional: false, notes: '', timingMode: 'fixed' },
  { id: 'seg-006', name: 'Floor - Rotation 1', type: 'live', duration: null, scene: 'Quad View', graphic: { graphicId: 'floor', params: {} }, autoAdvance: false, bufferAfter: 0, locked: false, optional: false, notes: '', timingMode: 'manual' },
  { id: 'seg-007', name: 'Commercial Break', type: 'break', duration: 120, scene: 'Starting Soon', graphic: null, autoAdvance: true, bufferAfter: 0, locked: false, optional: true, notes: 'Check with director before taking break', timingMode: 'fixed' }, // Example optional segment
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

// Group color options for segment grouping (Phase 4: Task 7.4)
const GROUP_COLORS = [
  { id: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', header: 'bg-blue-500/20' },
  { id: 'green', bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', header: 'bg-green-500/20' },
  { id: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', header: 'bg-purple-500/20' },
  { id: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', header: 'bg-amber-500/20' },
  { id: 'rose', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', header: 'bg-rose-500/20' },
  { id: 'cyan', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', header: 'bg-cyan-500/20' },
];

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
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null); // For Shift+click range selection
  const [draggedSegmentId, setDraggedSegmentId] = useState(null); // Currently dragged segment (Phase 4)
  const [dragOverIndex, setDragOverIndex] = useState(null); // Index being dragged over (Phase 4)
  const [groups, setGroups] = useState([]); // Segment groups (Phase 4: Task 7.4)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false); // Create group modal (Phase 4: Task 7.4)
  const [excludeOptionalFromRuntime, setExcludeOptionalFromRuntime] = useState(false); // Exclude optional segments from total runtime (Phase 5: Task 8.4)
  const [showSaveSegmentTemplateModal, setShowSaveSegmentTemplateModal] = useState(false); // Save segment as template modal (Phase 7: Task 58)
  const [segmentToSaveAsTemplate, setSegmentToSaveAsTemplate] = useState(null); // Segment being saved as template (Phase 7: Task 58)
  const [showSegmentTemplateLibrary, setShowSegmentTemplateLibrary] = useState(false); // Segment template library modal (Phase 7: Task 59)
  const [segmentTemplates, setSegmentTemplates] = useState([]); // Segment templates from Firebase (Phase 7: Task 59)
  const [loadingSegmentTemplates, setLoadingSegmentTemplates] = useState(false); // Loading state for segment templates (Phase 7: Task 59)
  const [showAddSegmentMenu, setShowAddSegmentMenu] = useState(false); // Dropdown for Add Segment options (Phase 7: Task 59)

  // Filtered segments
  const filteredSegments = useMemo(() => {
    return segments.filter(seg => {
      const matchesType = filterType === 'all' || seg.type === filterType;
      const matchesSearch = seg.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [segments, filterType, searchQuery]);

  // Get selected segment for detail panel (single selection)
  const selectedSegment = useMemo(() => {
    return segments.find(seg => seg.id === selectedSegmentId) || null;
  }, [segments, selectedSegmentId]);

  // Get selected segments for multi-select summary
  const selectedSegments = useMemo(() => {
    return segments.filter(seg => selectedSegmentIds.includes(seg.id));
  }, [segments, selectedSegmentIds]);

  // Calculate total runtime (sum of all segment durations + buffer times)
  // Optionally excludes optional segments when excludeOptionalFromRuntime is true
  const totalRuntime = useMemo(() => {
    return segments.reduce((sum, seg) => {
      // Skip optional segments if the toggle is enabled
      if (excludeOptionalFromRuntime && seg.optional) return sum;
      return sum + (seg.duration || 0) + (seg.bufferAfter || 0);
    }, 0);
  }, [segments, excludeOptionalFromRuntime]);

  // Count of optional segments and their total duration (for display)
  const optionalSegmentsInfo = useMemo(() => {
    const optionalSegs = segments.filter(seg => seg.optional);
    const optionalDuration = optionalSegs.reduce((sum, seg) => sum + (seg.duration || 0) + (seg.bufferAfter || 0), 0);
    return { count: optionalSegs.length, duration: optionalDuration };
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

  // Close Add Segment dropdown when clicking outside (Phase 7: Task 59)
  useEffect(() => {
    function handleClickOutside(event) {
      if (showAddSegmentMenu && !event.target.closest('.add-segment-dropdown')) {
        setShowAddSegmentMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddSegmentMenu]);

  // Event handlers per PRD
  function handleSelectSegment(id) {
    setSelectedSegmentId(id);
    setSelectedSegmentIds([]); // Clear multi-select
    // Update last selected index for shift-click
    const index = segments.findIndex(s => s.id === id);
    setLastSelectedIndex(index);
  }

  function handleMultiSelect(ids) {
    setSelectedSegmentIds(ids);
    setSelectedSegmentId(null);
  }

  // Handle checkbox toggle for multi-select (Task 6.1-6.3)
  function handleCheckboxChange(segmentId, event) {
    const index = segments.findIndex(s => s.id === segmentId);

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift+click: range selection (Task 6.2)
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = segments.slice(start, end + 1).map(s => s.id);
      // Merge with existing selection, avoiding duplicates
      const newSelection = [...new Set([...selectedSegmentIds, ...rangeIds])];
      setSelectedSegmentIds(newSelection);
      setSelectedSegmentId(null);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+click: toggle individual selection (Task 6.3)
      if (selectedSegmentIds.includes(segmentId)) {
        setSelectedSegmentIds(selectedSegmentIds.filter(id => id !== segmentId));
      } else {
        setSelectedSegmentIds([...selectedSegmentIds, segmentId]);
        setSelectedSegmentId(null);
      }
      setLastSelectedIndex(index);
    } else {
      // Regular click: toggle selection
      if (selectedSegmentIds.includes(segmentId)) {
        setSelectedSegmentIds(selectedSegmentIds.filter(id => id !== segmentId));
      } else {
        setSelectedSegmentIds([...selectedSegmentIds, segmentId]);
        setSelectedSegmentId(null);
      }
      setLastSelectedIndex(index);
    }
  }

  // Select all segments
  function handleSelectAll() {
    setSelectedSegmentIds(filteredSegments.map(s => s.id));
    setSelectedSegmentId(null);
  }

  // Deselect all segments
  function handleDeselectAll() {
    setSelectedSegmentIds([]);
  }

  // Bulk delete selected segments (Task 6.6)
  // Respects locked segments (Phase 5: Task 8.2)
  function handleBulkDelete() {
    if (selectedSegmentIds.length === 0) return;

    // Check for locked segments
    const lockedCount = selectedSegmentIds.filter(id =>
      segments.find(s => s.id === id)?.locked
    ).length;

    if (lockedCount === selectedSegmentIds.length) {
      showToast('All selected segments are locked');
      return;
    }

    const deleteCount = selectedSegmentIds.length - lockedCount;
    const message = lockedCount > 0
      ? `Delete ${deleteCount} segment(s)? (${lockedCount} locked segment(s) will be skipped)`
      : `Are you sure you want to delete ${deleteCount} segment(s)?`;

    if (window.confirm(message)) {
      // Only delete unlocked segments
      setSegments(segments.filter(seg =>
        !selectedSegmentIds.includes(seg.id) || seg.locked
      ));
      setSelectedSegmentIds([]);
      showToast(`${deleteCount} segment(s) deleted${lockedCount > 0 ? `, ${lockedCount} locked skipped` : ''}`);
    }
  }

  // Bulk edit type for selected segments (Task 6.6)
  // Respects locked segments (Phase 5: Task 8.2)
  function handleBulkEditType(newType) {
    let updatedCount = 0;
    setSegments(segments.map(seg => {
      if (!selectedSegmentIds.includes(seg.id)) return seg;
      if (seg.locked) return seg; // Skip locked segments
      updatedCount++;
      return { ...seg, type: newType };
    }));
    const lockedCount = selectedSegmentIds.length - updatedCount;
    showToast(`Updated type for ${updatedCount} segment(s)${lockedCount > 0 ? `, ${lockedCount} locked skipped` : ''}`);
  }

  // Bulk edit scene for selected segments (Task 6.6)
  // Respects locked segments (Phase 5: Task 8.2)
  function handleBulkEditScene(newScene) {
    let updatedCount = 0;
    setSegments(segments.map(seg => {
      if (!selectedSegmentIds.includes(seg.id)) return seg;
      if (seg.locked) return seg; // Skip locked segments
      updatedCount++;
      return { ...seg, scene: newScene };
    }));
    const lockedCount = selectedSegmentIds.length - updatedCount;
    showToast(`Updated scene for ${updatedCount} segment(s)${lockedCount > 0 ? `, ${lockedCount} locked skipped` : ''}`);
  }

  // Bulk edit graphic for selected segments (Task 6.6)
  // Respects locked segments (Phase 5: Task 8.2)
  function handleBulkEditGraphic(graphicId) {
    let updatedCount = 0;
    setSegments(segments.map(seg => {
      if (!selectedSegmentIds.includes(seg.id)) return seg;
      if (seg.locked) return seg; // Skip locked segments
      updatedCount++;
      if (!graphicId) {
        return { ...seg, graphic: null };
      }
      return { ...seg, graphic: { graphicId, params: {} } };
    }));
    const lockedCount = selectedSegmentIds.length - updatedCount;
    showToast(`Updated graphic for ${updatedCount} segment(s)${lockedCount > 0 ? `, ${lockedCount} locked skipped` : ''}`);
  }

  // Update duration for a segment in multi-select (Task 6.5)
  // Respects locked segments (Phase 5: Task 8.2)
  function handleMultiSelectDurationChange(segmentId, duration) {
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    setSegments(segments.map(seg =>
      seg.id === segmentId ? { ...seg, duration } : seg
    ));
  }

  function handleReorder(fromIndex, toIndex) {
    // Check if the segment being moved is locked (Phase 5: Task 8.2)
    const segmentToMove = segments[fromIndex];
    if (segmentToMove?.locked) {
      showToast('Cannot move locked segment');
      return;
    }
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
      locked: false,
      optional: false,
      notes: '',
      timingMode: 'manual', // Default to manual for new segments (Phase 6: Task 55)
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
    const segment = segments.find(s => s.id === id);
    if (segment?.locked) {
      showToast('Cannot delete locked segment');
      return;
    }
    if (window.confirm('Are you sure you want to delete this segment?')) {
      setSegments(segments.filter(seg => seg.id !== id));
      if (selectedSegmentId === id) {
        setSelectedSegmentId(null);
      }
      showToast('Segment deleted');
    }
  }

  // Duplicate segment (Phase 5: Task 8.1)
  function handleDuplicateSegment(id) {
    const segmentToDuplicate = segments.find(seg => seg.id === id);
    if (!segmentToDuplicate) return;

    // Generate new ID
    const timestamp = Date.now();
    const newId = `seg-${timestamp}`;

    // Create duplicate with "(copy)" appended to name
    // Note: duplicated segments are unlocked by default but preserve optional status, notes, and timingMode
    const duplicatedSegment = {
      ...segmentToDuplicate,
      id: newId,
      name: `${segmentToDuplicate.name} (copy)`,
      locked: false, // Duplicated segments are always unlocked
      optional: segmentToDuplicate.optional || false, // Preserve optional status
      notes: segmentToDuplicate.notes || '', // Preserve notes (Phase 5: Task 8.5)
      timingMode: segmentToDuplicate.timingMode || 'manual', // Preserve timing mode (Phase 6: Task 55)
      // Deep copy graphic object if it exists
      graphic: segmentToDuplicate.graphic
        ? { ...segmentToDuplicate.graphic, params: { ...segmentToDuplicate.graphic.params } }
        : null,
    };

    // Insert after the original segment
    const originalIndex = segments.findIndex(seg => seg.id === id);
    const newSegments = [...segments];
    newSegments.splice(originalIndex + 1, 0, duplicatedSegment);
    setSegments(newSegments);

    // Select the duplicated segment
    setSelectedSegmentId(newId);
    setSelectedSegmentIds([]);
    showToast('Segment duplicated');
  }

  function handleCancelEdit() {
    setSelectedSegmentId(null);
    setSelectedSegmentIds([]);
  }

  // Toggle segment lock status (Phase 5: Task 8.2, 8.3)
  function handleToggleLock(id) {
    setSegments(segments.map(seg =>
      seg.id === id ? { ...seg, locked: !seg.locked } : seg
    ));
    const segment = segments.find(s => s.id === id);
    showToast(segment?.locked ? 'Segment unlocked' : 'Segment locked');
  }

  // Inline update handlers for segment fields (Phase 2: Inline Editing)
  // These handlers check for locked status (Phase 5: Task 8.2)
  function handleInlineSceneChange(segmentId, scene) {
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    setSegments(segments.map(seg =>
      seg.id === segmentId ? { ...seg, scene } : seg
    ));
  }

  function handleInlineGraphicChange(segmentId, graphicId) {
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    setSegments(segments.map(seg => {
      if (seg.id !== segmentId) return seg;
      if (!graphicId) {
        return { ...seg, graphic: null };
      }
      // Preserve existing params if same graphic, otherwise reset
      const existingParams = seg.graphic?.graphicId === graphicId
        ? seg.graphic.params
        : {};
      return { ...seg, graphic: { graphicId, params: existingParams } };
    }));
  }

  function handleInlineDurationChange(segmentId, duration) {
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    setSegments(segments.map(seg =>
      seg.id === segmentId ? { ...seg, duration } : seg
    ));
  }

  // Inline toggle for auto-advance (Phase 6: Task 57)
  function handleInlineAutoAdvanceChange(segmentId) {
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    setSegments(segments.map(seg =>
      seg.id === segmentId ? { ...seg, autoAdvance: !seg.autoAdvance } : seg
    ));
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
      optional: seg.optional || false,
      notes: seg.notes || '', // Preserve notes (Phase 5: Task 8.5)
      timingMode: seg.timingMode || 'manual', // Preserve timing mode (Phase 6: Task 55)
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
      locked: false, // Segments from templates start unlocked
      optional: seg.optional || false,
      notes: seg.notes || '', // Preserve notes (Phase 5: Task 8.5)
      timingMode: seg.timingMode || 'manual', // Preserve timing mode (Phase 6: Task 55)
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

  // Save segment as template handler (Phase 7: Task 58)
  function handleSaveSegmentAsTemplate(segmentId) {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;
    setSegmentToSaveAsTemplate(segment);
    setShowSaveSegmentTemplateModal(true);
  }

  // Save segment template to Firebase (Phase 7: Task 58)
  async function handleSaveSegmentTemplate(templateName, templateDescription, categoryTag) {
    if (!segmentToSaveAsTemplate) return;

    try {
      const templateId = `seg-tpl-${Date.now()}`;
      const teams = DUMMY_COMPETITION.teams;

      // Abstract team references in segment name
      const abstractedName = abstractTeamReferences(segmentToSaveAsTemplate.name, teams);

      const templateData = {
        id: templateId,
        name: templateName,
        description: templateDescription,
        category: categoryTag || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // The segment configuration
        segment: {
          name: abstractedName,
          type: segmentToSaveAsTemplate.type,
          duration: segmentToSaveAsTemplate.duration,
          scene: segmentToSaveAsTemplate.scene,
          graphic: segmentToSaveAsTemplate.graphic,
          autoAdvance: segmentToSaveAsTemplate.autoAdvance,
          bufferAfter: segmentToSaveAsTemplate.bufferAfter || 0,
          optional: segmentToSaveAsTemplate.optional || false,
          notes: segmentToSaveAsTemplate.notes || '',
          timingMode: segmentToSaveAsTemplate.timingMode || 'manual',
        },
      };

      await set(ref(db, `segmentTemplates/${templateId}`), templateData);
      setShowSaveSegmentTemplateModal(false);
      setSegmentToSaveAsTemplate(null);
      showToast(`Segment template "${templateName}" saved!`);
    } catch (error) {
      console.error('Error saving segment template:', error);
      showToast('Error saving segment template');
    }
  }

  // Load segment templates from Firebase (Phase 7: Task 59)
  async function handleOpenSegmentTemplateLibrary() {
    setShowSegmentTemplateLibrary(true);
    setLoadingSegmentTemplates(true);
    setShowAddSegmentMenu(false);
    try {
      const snapshot = await get(ref(db, 'segmentTemplates'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const templateList = Object.values(data);
        setSegmentTemplates(templateList);
      } else {
        setSegmentTemplates([]);
      }
    } catch (error) {
      console.error('Error loading segment templates:', error);
      showToast('Error loading segment templates');
    }
    setLoadingSegmentTemplates(false);
  }

  // Add a segment from a template (Phase 7: Task 59)
  function handleAddSegmentFromTemplate(template) {
    const teams = DUMMY_COMPETITION.teams;
    const timestamp = Date.now();
    const newId = `seg-${timestamp}`;

    // Resolve team references in segment name
    const resolvedName = resolveTeamReferences(template.segment.name, teams);

    const newSegment = {
      id: newId,
      name: resolvedName,
      type: template.segment.type,
      duration: template.segment.duration,
      scene: template.segment.scene || '',
      graphic: template.segment.graphic,
      autoAdvance: template.segment.autoAdvance || false,
      bufferAfter: template.segment.bufferAfter || 0,
      locked: false,
      optional: template.segment.optional || false,
      notes: template.segment.notes || '',
      timingMode: template.segment.timingMode || 'manual',
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
    setShowSegmentTemplateLibrary(false);
    showToast(`Added segment from template: ${template.name}`);
  }

  // Delete a segment template from Firebase (Phase 7: Task 59)
  async function handleDeleteSegmentTemplate(templateId) {
    if (!window.confirm('Are you sure you want to delete this segment template?')) return;

    try {
      await remove(ref(db, `segmentTemplates/${templateId}`));
      setSegmentTemplates(segmentTemplates.filter(t => t.id !== templateId));
      showToast('Segment template deleted');
    } catch (error) {
      console.error('Error deleting segment template:', error);
      showToast('Error deleting segment template');
    }
  }

  // Group management functions (Phase 4: Tasks 7.4, 7.5)

  // Create a new group from selected segments
  function handleCreateGroup(groupName, colorId) {
    if (selectedSegmentIds.length < 1) return;

    const newGroupId = `group-${Date.now()}`;
    const color = GROUP_COLORS.find(c => c.id === colorId) || GROUP_COLORS[0];

    // Create the group
    const newGroup = {
      id: newGroupId,
      name: groupName,
      colorId: color.id,
      collapsed: false,
    };

    // Assign segments to the group
    setSegments(segments.map(seg =>
      selectedSegmentIds.includes(seg.id) ? { ...seg, groupId: newGroupId } : seg
    ));

    setGroups([...groups, newGroup]);
    setSelectedSegmentIds([]);
    setShowCreateGroupModal(false);
    showToast(`Created group "${groupName}" with ${selectedSegmentIds.length} segment(s)`);
  }

  // Toggle group collapse state
  function handleToggleGroupCollapse(groupId) {
    setGroups(groups.map(g =>
      g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
    ));
  }

  // Remove a group (ungroups the segments, doesn't delete them)
  function handleUngroupSegments(groupId) {
    setSegments(segments.map(seg =>
      seg.groupId === groupId ? { ...seg, groupId: null } : seg
    ));
    setGroups(groups.filter(g => g.id !== groupId));
    showToast('Group removed');
  }

  // Rename a group
  function handleRenameGroup(groupId, newName) {
    setGroups(groups.map(g =>
      g.id === groupId ? { ...g, name: newName } : g
    ));
  }

  // Get segments in a specific group
  function getGroupSegments(groupId) {
    return segments.filter(seg => seg.groupId === groupId);
  }

  // Calculate total duration for a group (Task 7.5)
  function getGroupDuration(groupId) {
    return getGroupSegments(groupId).reduce(
      (sum, seg) => sum + (seg.duration || 0) + (seg.bufferAfter || 0),
      0
    );
  }

  // Get the group for a segment
  function getGroupForSegment(segmentId) {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment?.groupId) return null;
    return groups.find(g => g.id === segment.groupId) || null;
  }

  // Get group color styling
  function getGroupColor(groupId) {
    const group = groups.find(g => g.id === groupId);
    return GROUP_COLORS.find(c => c.id === group?.colorId) || GROUP_COLORS[0];
  }

  // Organize segments into groups and ungrouped for rendering
  const organizedSegments = useMemo(() => {
    const result = [];
    const processedGroupIds = new Set();

    filteredSegments.forEach((segment) => {
      if (segment.groupId) {
        // If this segment belongs to a group we haven't processed yet
        if (!processedGroupIds.has(segment.groupId)) {
          processedGroupIds.add(segment.groupId);
          const group = groups.find(g => g.id === segment.groupId);
          if (group) {
            // Get all segments in this group (maintaining original order)
            const groupSegs = filteredSegments.filter(s => s.groupId === segment.groupId);
            result.push({
              type: 'group',
              group,
              segments: groupSegs,
            });
          }
        }
        // Skip individual segments that are part of a group (they're included above)
      } else {
        // Ungrouped segment
        result.push({
          type: 'segment',
          segment,
        });
      }
    });

    return result;
  }, [filteredSegments, groups]);

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

  // Drag and drop handlers (Phase 4: Task 7.2)
  function handleDragStart(e, segmentId) {
    setDraggedSegmentId(segmentId);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay for visual feedback
    setTimeout(() => {
      const element = document.getElementById(`segment-${segmentId}`);
      if (element) {
        element.style.opacity = '0.5';
      }
    }, 0);
  }

  function handleDragEnd(e) {
    // Reset opacity
    if (draggedSegmentId) {
      const element = document.getElementById(`segment-${draggedSegmentId}`);
      if (element) {
        element.style.opacity = '1';
      }
    }
    setDraggedSegmentId(null);
    setDragOverIndex(null);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }

  function handleDragLeave(e) {
    // Only clear if leaving the segment row entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  }

  function handleDrop(e, targetIndex) {
    e.preventDefault();
    if (draggedSegmentId === null) return;

    const sourceIndex = segments.findIndex(s => s.id === draggedSegmentId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDraggedSegmentId(null);
      setDragOverIndex(null);
      return;
    }

    // Perform the reorder
    handleReorder(sourceIndex, targetIndex);
    setDraggedSegmentId(null);
    setDragOverIndex(null);
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

              {/* Optional Segments Info & Toggle (Phase 5: Task 8.4) */}
              {optionalSegmentsInfo.count > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExcludeOptionalFromRuntime(!excludeOptionalFromRuntime)}
                    className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
                      excludeOptionalFromRuntime
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                    }`}
                    title={excludeOptionalFromRuntime
                      ? 'Optional segments excluded from runtime - click to include'
                      : 'Click to exclude optional segments from runtime'}
                  >
                    <span className={`w-3 h-3 rounded border flex items-center justify-center ${
                      excludeOptionalFromRuntime
                        ? 'bg-amber-500 border-amber-400'
                        : 'border-zinc-500'
                    }`}>
                      {excludeOptionalFromRuntime && (
                        <CheckIcon className="w-2 h-2 text-zinc-900" />
                      )}
                    </span>
                    <span>
                      {optionalSegmentsInfo.count} optional
                      <span className="text-zinc-500 ml-1">
                        ({formatDuration(optionalSegmentsInfo.duration)})
                      </span>
                    </span>
                  </button>
                </div>
              )}

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
            {/* Add Segment Dropdown (Phase 7: Task 59) */}
            <div className="relative add-segment-dropdown">
              <div className="flex">
                <button
                  onClick={handleAddSegment}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-l-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Segment
                </button>
                <button
                  onClick={() => setShowAddSegmentMenu(!showAddSegmentMenu)}
                  className="px-2 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-r-lg border-l border-green-500 transition-colors"
                  title="More add options"
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
              </div>
              {showAddSegmentMenu && (
                <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 w-48 overflow-hidden">
                  <button
                    onClick={() => {
                      handleAddSegment();
                      setShowAddSegmentMenu(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    New Blank Segment
                  </button>
                  <button
                    onClick={handleOpenSegmentTemplateLibrary}
                    className="w-full px-3 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                  >
                    <BookmarkIcon className="w-4 h-4" />
                    From Template...
                  </button>
                </div>
              )}
            </div>
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
              <div className="flex items-center gap-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  Segments ({filteredSegments.length})
                </div>
                {/* Select All / Deselect All buttons */}
                {filteredSegments.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSelectAll}
                      className="px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                    >
                      Select All
                    </button>
                    {selectedSegmentIds.length > 0 && (
                      <>
                        <span className="text-zinc-700">|</span>
                        <button
                          onClick={handleDeselectAll}
                          className="px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                        >
                          Deselect ({selectedSegmentIds.length})
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Column headers for running time */}
              <div className="flex items-center gap-3 text-xs text-zinc-600 uppercase tracking-wide">
                <span className="w-4"></span> {/* Drag handle column */}
                <span className="w-5"></span> {/* Checkbox column */}
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
                {organizedSegments.map((item) => {
                  if (item.type === 'group') {
                    // Render a group with its segments
                    const { group, segments: groupSegs } = item;
                    const groupColor = getGroupColor(group.id);
                    const groupDuration = getGroupDuration(group.id);

                    return (
                      <div
                        key={group.id}
                        className={`rounded-lg border ${groupColor.border} ${groupColor.bg} overflow-hidden`}
                      >
                        {/* Group Header */}
                        <div
                          className={`flex items-center gap-2 px-3 py-2 ${groupColor.header} cursor-pointer`}
                          onClick={() => handleToggleGroupCollapse(group.id)}
                        >
                          {/* Collapse/Expand Icon */}
                          <button className={`p-0.5 ${groupColor.text}`}>
                            {group.collapsed ? (
                              <ChevronRightIcon className="w-4 h-4" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4" />
                            )}
                          </button>
                          {/* Folder Icon */}
                          {group.collapsed ? (
                            <FolderIcon className={`w-4 h-4 ${groupColor.text}`} />
                          ) : (
                            <FolderOpenIcon className={`w-4 h-4 ${groupColor.text}`} />
                          )}
                          {/* Group Name */}
                          <span className={`text-sm font-medium ${groupColor.text}`}>{group.name}</span>
                          {/* Segment Count */}
                          <span className="text-xs text-zinc-500">
                            ({groupSegs.length} segment{groupSegs.length !== 1 ? 's' : ''})
                          </span>
                          {/* Group Duration (Task 7.5) - always visible, emphasized when collapsed */}
                          <span className={`ml-auto text-xs font-mono ${group.collapsed ? groupColor.text + ' font-medium' : 'text-zinc-500'}`}>
                            {formatDuration(groupDuration)}
                          </span>
                          {/* Ungroup Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUngroupSegments(group.id);
                            }}
                            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
                            title="Ungroup segments"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Group Segments (hidden when collapsed) */}
                        {!group.collapsed && (
                          <div className="p-2 space-y-1">
                            {groupSegs.map((segment) => {
                              const originalIndex = segments.findIndex(s => s.id === segment.id);
                              return (
                                <SegmentRow
                                  key={segment.id}
                                  segment={segment}
                                  originalIndex={originalIndex}
                                  segments={segments}
                                  selectedSegmentId={selectedSegmentId}
                                  selectedSegmentIds={selectedSegmentIds}
                                  draggedSegmentId={draggedSegmentId}
                                  dragOverIndex={dragOverIndex}
                                  segmentStartTimes={segmentStartTimes}
                                  onDragStart={handleDragStart}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={handleDragOver}
                                  onDragLeave={handleDragLeave}
                                  onDrop={handleDrop}
                                  onCheckboxChange={handleCheckboxChange}
                                  onSelectSegment={handleSelectSegment}
                                  onInlineSceneChange={handleInlineSceneChange}
                                  onInlineGraphicChange={handleInlineGraphicChange}
                                  onInlineDurationChange={handleInlineDurationChange}
                                  onInlineAutoAdvanceChange={handleInlineAutoAdvanceChange}
                                  onMoveUp={handleMoveUp}
                                  onMoveDown={handleMoveDown}
                                  onDuplicate={handleDuplicateSegment}
                                  onToggleLock={handleToggleLock}
                                  onSaveAsTemplate={handleSaveSegmentAsTemplate}
                                  inGroup={true}
                                  groupColor={groupColor}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    // Render an ungrouped segment
                    const { segment } = item;
                    const originalIndex = segments.findIndex(s => s.id === segment.id);
                    return (
                      <SegmentRow
                        key={segment.id}
                        segment={segment}
                        originalIndex={originalIndex}
                        segments={segments}
                        selectedSegmentId={selectedSegmentId}
                        selectedSegmentIds={selectedSegmentIds}
                        draggedSegmentId={draggedSegmentId}
                        dragOverIndex={dragOverIndex}
                        segmentStartTimes={segmentStartTimes}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onCheckboxChange={handleCheckboxChange}
                        onSelectSegment={handleSelectSegment}
                        onInlineSceneChange={handleInlineSceneChange}
                        onInlineGraphicChange={handleInlineGraphicChange}
                        onInlineDurationChange={handleInlineDurationChange}
                        onInlineAutoAdvanceChange={handleInlineAutoAdvanceChange}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onDuplicate={handleDuplicateSegment}
                        onToggleLock={handleToggleLock}
                        onSaveAsTemplate={handleSaveSegmentAsTemplate}
                        inGroup={false}
                        groupColor={null}
                      />
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>

        {/* Segment Detail / Selection Summary (right panel ~40%) */}
        <div className="w-2/5 overflow-y-auto">
          <div className="p-4">
            {/* Selection Summary shown when 2+ segments selected (Task 6.4) */}
            {selectedSegmentIds.length >= 2 ? (
              <SelectionSummaryPanel
                selectedSegments={selectedSegments}
                segments={segments}
                onDurationChange={handleMultiSelectDurationChange}
                onBulkDelete={handleBulkDelete}
                onBulkEditType={handleBulkEditType}
                onBulkEditScene={handleBulkEditScene}
                onBulkEditGraphic={handleBulkEditGraphic}
                onCreateGroup={() => setShowCreateGroupModal(true)}
                onClose={handleDeselectAll}
                onScrollToSegment={(id) => {
                  // Scroll to segment and flash highlight
                  const element = document.getElementById(`segment-${id}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add('ring-2', 'ring-blue-400');
                    setTimeout(() => element.classList.remove('ring-2', 'ring-blue-400'), 1500);
                  }
                }}
              />
            ) : selectedSegment ? (
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
                <div className="text-xs text-zinc-600 mt-2">Use checkboxes to select multiple segments</div>
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

      {/* Create Group Modal (Phase 4: Task 7.4) */}
      {showCreateGroupModal && (
        <CreateGroupModal
          onCreate={handleCreateGroup}
          onCancel={() => setShowCreateGroupModal(false)}
          selectedCount={selectedSegmentIds.length}
        />
      )}

      {/* Save Segment as Template Modal (Phase 7: Task 58) */}
      {showSaveSegmentTemplateModal && segmentToSaveAsTemplate && (
        <SaveSegmentTemplateModal
          segment={segmentToSaveAsTemplate}
          onSave={handleSaveSegmentTemplate}
          onCancel={() => {
            setShowSaveSegmentTemplateModal(false);
            setSegmentToSaveAsTemplate(null);
          }}
        />
      )}

      {/* Segment Template Library Modal (Phase 7: Task 59) */}
      {showSegmentTemplateLibrary && (
        <SegmentTemplateLibraryModal
          templates={segmentTemplates}
          loading={loadingSegmentTemplates}
          onAdd={handleAddSegmentFromTemplate}
          onDelete={handleDeleteSegmentTemplate}
          onCancel={() => setShowSegmentTemplateLibrary(false)}
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

// Segment Row Component - extracted for use in both grouped and ungrouped contexts
function SegmentRow({
  segment,
  originalIndex,
  segments,
  selectedSegmentId,
  selectedSegmentIds,
  draggedSegmentId,
  dragOverIndex,
  segmentStartTimes,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onCheckboxChange,
  onSelectSegment,
  onInlineSceneChange,
  onInlineGraphicChange,
  onInlineDurationChange,
  onInlineAutoAdvanceChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onToggleLock,
  onSaveAsTemplate,
  inGroup,
  groupColor,
}) {
  const isSelected = selectedSegmentId === segment.id;
  const isMultiSelected = selectedSegmentIds.includes(segment.id);
  const isDraggedOver = dragOverIndex === originalIndex && draggedSegmentId !== segment.id;
  const isDragging = draggedSegmentId === segment.id;
  const isLocked = segment.locked;
  const groupedScenes = getGroupedScenes();
  const groupedGraphics = getGroupedGraphics();

  return (
    <div
      id={`segment-${segment.id}`}
      draggable={!isLocked}
      onDragStart={(e) => isLocked ? e.preventDefault() : onDragStart(e, segment.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, originalIndex)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, originalIndex)}
      className={`p-3 rounded-lg border transition-all ${
        isLocked
          ? 'bg-zinc-900/50 border-zinc-700/50 opacity-75'
          : isDraggedOver
            ? 'border-t-2 border-t-blue-500 border-blue-500/50 bg-blue-600/10'
            : isSelected
              ? 'bg-blue-600/20 border-blue-500'
              : isMultiSelected
                ? 'bg-zinc-800 border-blue-500/50'
                : isDragging
                  ? 'bg-zinc-800 border-zinc-600 opacity-50'
                  : inGroup
                    ? `bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700`
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
      }`}
    >
      {/* Row 1: Drag handle, checkbox, segment number, start time, name, type badge */}
      <div className="flex items-center gap-3 mb-2">
        {/* Drag handle for reordering (Task 7.1) */}
        <div
          className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 touch-none"
          title="Drag to reorder"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Bars3Icon className="w-4 h-4" />
        </div>
        {/* Checkbox for multi-select (Task 6.1) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onCheckboxChange(segment.id, e);
          }}
          className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
            isMultiSelected
              ? 'bg-blue-600 border-blue-500'
              : 'bg-zinc-800 border-zinc-600 hover:border-zinc-500'
          }`}
          title="Click to select, Shift+click for range, Ctrl+click to toggle"
        >
          {isMultiSelected && (
            <CheckIcon className="w-3 h-3 text-white" />
          )}
        </div>
        <span className="text-xs text-zinc-500 font-mono w-6">
          {String(originalIndex + 1).padStart(2, '0')}
        </span>
        {/* Running Time Column - shows cumulative start time */}
        <span className="text-xs text-zinc-400 font-mono w-12 text-right" title="Start time">
          {formatDuration(segmentStartTimes[segment.id] || 0)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium truncate ${isLocked ? 'text-zinc-400' : 'text-white'}`}>{segment.name}</span>
            <span className={`px-2 py-0.5 text-xs rounded border shrink-0 ${TYPE_COLORS[segment.type] || 'bg-zinc-700 text-zinc-400 border-zinc-600'}`}>
              {segment.type}
            </span>
            {/* Lock indicator badge (Phase 5: Task 8.3) */}
            {isLocked && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-zinc-600/30 text-zinc-400 border border-zinc-600/50 shrink-0"
                title="Segment is locked"
              >
                <LockClosedIcon className="w-3 h-3" />
              </span>
            )}
            {/* Optional/Conditional indicator badge (Phase 5: Task 8.4) */}
            {segment.optional && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-amber-500/10 text-amber-400 border border-dashed border-amber-500/40 shrink-0"
                title="Optional segment (if time permits)"
              >
                optional
              </span>
            )}
            {segment.graphic?.graphicId && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-pink-500/20 text-pink-400 border border-pink-500/30 shrink-0"
                title={`Graphic: ${segment.graphic.graphicId}`}
              >
                <PhotoIcon className="w-3 h-3" />
              </span>
            )}
            {segment.bufferAfter > 0 && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 border-dashed shrink-0"
                title={`${segment.bufferAfter}s buffer after this segment`}
              >
                +{segment.bufferAfter}s
              </span>
            )}
            {/* Notes indicator (Phase 5: Task 8.6) */}
            {segment.notes && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0 cursor-help"
                title={segment.notes}
              >
                <ChatBubbleLeftIcon className="w-3 h-3" />
              </span>
            )}
            {/* Timing mode badge (Phase 6: Task 56) */}
            {segment.timingMode === 'manual' && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0 font-medium"
                title="Manual timing - requires manual trigger to advance"
              >
                MANUAL
              </span>
            )}
            {segment.timingMode === 'follows-previous' && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0"
                title="Follows previous - starts immediately when previous segment ends"
              >
                →
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Inline editable fields - OBS Scene, Graphic, Duration, Edit button, Reorder */}
      <div className="flex items-center gap-2 ml-[5.5rem]">
        {/* Inline OBS Scene Dropdown */}
        <select
          value={segment.scene || ''}
          onChange={(e) => {
            e.stopPropagation();
            onInlineSceneChange(segment.id, e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
          className={`px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-blue-500 max-w-[140px] truncate ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isLocked ? 'Segment is locked' : (segment.scene || 'No scene selected')}
        >
          <option value="">Scene...</option>
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

        {/* Inline Graphic Dropdown */}
        <select
          value={segment.graphic?.graphicId || ''}
          onChange={(e) => {
            e.stopPropagation();
            onInlineGraphicChange(segment.id, e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
          className={`px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-blue-500 max-w-[140px] truncate ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isLocked ? 'Segment is locked' : (segment.graphic?.graphicId || 'No graphic selected')}
        >
          <option value="">Graphic...</option>
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

        {/* Inline Duration Input */}
        <input
          type="text"
          value={segment.duration !== null ? `${segment.duration}s` : ''}
          placeholder="Manual"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            const val = e.target.value.replace(/[^\d]/g, '');
            onInlineDurationChange(segment.id, val ? Number(val) : null);
          }}
          disabled={isLocked}
          className={`w-16 px-2 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-center focus:outline-none focus:border-blue-500 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isLocked ? 'Segment is locked' : 'Duration in seconds'}
        />

        {/* Inline Auto-Advance Toggle (Phase 6: Task 57) */}
        <button
          onClick={(e) => { e.stopPropagation(); onInlineAutoAdvanceChange(segment.id); }}
          disabled={isLocked}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
            segment.autoAdvance
              ? 'bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-400'
          } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isLocked ? 'Segment is locked' : (segment.autoAdvance ? 'Auto-advance ON - click to disable' : 'Auto-advance OFF - click to enable')}
        >
          <span className={`w-2 h-2 rounded-full ${segment.autoAdvance ? 'bg-green-400' : 'bg-zinc-600'}`} />
          <span className="font-medium">Auto</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Lock Toggle Button (Phase 5: Task 8.3) */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLock(segment.id); }}
          className={`p-1 rounded transition-colors ${
            isLocked
              ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700'
          }`}
          title={isLocked ? 'Unlock segment' : 'Lock segment'}
        >
          {isLocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
        </button>

        {/* Edit Button - opens full detail panel */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelectSegment(segment.id); }}
          className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
          title="Edit segment details"
        >
          <PencilIcon className="w-4 h-4" />
        </button>

        {/* Duplicate Button (Phase 5: Task 8.1) */}
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(segment.id); }}
          className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
          title="Duplicate segment"
        >
          <DocumentDuplicateIcon className="w-4 h-4" />
        </button>

        {/* Save as Template Button (Phase 7: Task 58) */}
        <button
          onClick={(e) => { e.stopPropagation(); onSaveAsTemplate(segment.id); }}
          className="p-1 text-zinc-500 hover:text-purple-400 hover:bg-purple-500/20 rounded transition-colors"
          title="Save segment as template"
        >
          <BookmarkIcon className="w-4 h-4" />
        </button>

        {/* Reorder buttons */}
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(originalIndex); }}
          disabled={originalIndex === 0 || isLocked}
          className={`p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed ${isLocked ? 'cursor-not-allowed' : ''}`}
          title={isLocked ? 'Segment is locked' : 'Move up'}
        >
          <ChevronUpIcon className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(originalIndex); }}
          disabled={originalIndex === segments.length - 1 || isLocked}
          className={`p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed ${isLocked ? 'cursor-not-allowed' : ''}`}
          title={isLocked ? 'Segment is locked' : 'Move down'}
        >
          <ChevronDownIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Create Group Modal Component (Phase 4: Task 7.4)
function CreateGroupModal({ onCreate, onCancel, selectedCount }) {
  const [groupName, setGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState(GROUP_COLORS[0].id);

  function handleSubmit(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    onCreate(groupName.trim(), selectedColor);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Create Group</h2>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Group Name *</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Rotation 1, Opening Sequence"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">Color</label>
            <div className="flex gap-2">
              {GROUP_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setSelectedColor(color.id)}
                  className={`w-8 h-8 rounded-full ${color.header} border-2 transition-all ${
                    selectedColor === color.id
                      ? `${color.border} ring-2 ring-offset-2 ring-offset-zinc-900 ring-${color.id}-500/50`
                      : 'border-transparent hover:border-zinc-600'
                  }`}
                  title={color.id.charAt(0).toUpperCase() + color.id.slice(1)}
                />
              ))}
            </div>
          </div>

          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="text-sm text-zinc-300">
              <FolderIcon className="w-4 h-4 inline mr-2" />
              {selectedCount} segment{selectedCount !== 1 ? 's' : ''} will be added to this group
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
              disabled={!groupName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Group
            </button>
          </div>
        </form>
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

  const isLocked = segment.locked;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Edit Segment</h2>
        <button
          onClick={onDelete}
          disabled={isLocked}
          className={`p-2 rounded-lg transition-colors ${
            isLocked
              ? 'text-zinc-600 cursor-not-allowed'
              : 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
          }`}
          title={isLocked ? 'Cannot delete locked segment' : 'Delete segment'}
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Locked segment warning (Phase 5: Task 8.2) */}
      {isLocked && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
          <LockClosedIcon className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">
            This segment is locked. Unlock it to make changes.
          </span>
        </div>
      )}

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

        {/* Timing Mode Selector (Phase 6: Task 55) */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Timing Mode
            <span className="ml-1.5 text-zinc-600 font-normal">— how segment timing behaves</span>
          </label>
          <select
            value={formData.timingMode || 'manual'}
            onChange={(e) => setFormData({ ...formData, timingMode: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {TIMING_MODES.map(mode => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
          {/* Show description for selected timing mode */}
          <div className="mt-1.5 text-xs text-zinc-500">
            {TIMING_MODES.find(m => m.value === (formData.timingMode || 'manual'))?.description}
          </div>
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

        {/* Conditional/Optional Toggle (Phase 5: Task 8.4) */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="optional"
            checked={formData.optional || false}
            onChange={(e) => setFormData({ ...formData, optional: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-600 focus:ring-amber-500"
          />
          <label htmlFor="optional" className="text-sm text-zinc-300">
            Optional/backup segment
            <span className="text-xs text-zinc-500 ml-1">(if time permits)</span>
          </label>
        </div>

        {/* Segment Notes/Comments (Phase 5: Task 8.5) */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Notes
            <span className="ml-1.5 text-zinc-600 font-normal">— internal production notes</span>
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add production notes for this segment..."
            rows={3}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-y"
          />
          {formData.notes && (
            <div className="mt-1 text-xs text-zinc-500">
              {formData.notes.length} character{formData.notes.length !== 1 ? 's' : ''}
            </div>
          )}
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

// Segment template categories (Phase 7: Task 58)
const SEGMENT_TEMPLATE_CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'intro', label: 'Intro / Opening' },
  { id: 'team', label: 'Team Segments' },
  { id: 'rotation', label: 'Rotations' },
  { id: 'break', label: 'Breaks / Transitions' },
  { id: 'outro', label: 'Outro / Closing' },
];

// Save Segment as Template Modal Component (Phase 7: Task 58)
function SaveSegmentTemplateModal({ segment, onSave, onCancel }) {
  const [templateName, setTemplateName] = useState(segment.name || '');
  const [templateDescription, setTemplateDescription] = useState('');
  const [categoryTag, setCategoryTag] = useState('general');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!templateName.trim()) return;

    setSaving(true);
    await onSave(templateName.trim(), templateDescription.trim(), categoryTag);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Save Segment as Template</h2>
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
              placeholder="e.g., Team Coaches Intro"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Category</label>
            <select
              value={categoryTag}
              onChange={(e) => setCategoryTag(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {SEGMENT_TEMPLATE_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Description (optional)</label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="e.g., Standard coaches introduction with graphic overlay"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="text-xs text-zinc-400 mb-2">Segment configuration:</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-zinc-500">Type:</div>
              <div className="text-zinc-300">{segment.type}</div>
              <div className="text-zinc-500">Duration:</div>
              <div className="text-zinc-300">{segment.duration ? `${segment.duration}s` : 'Manual'}</div>
              {segment.scene && (
                <>
                  <div className="text-zinc-500">Scene:</div>
                  <div className="text-zinc-300 truncate">{segment.scene}</div>
                </>
              )}
              {segment.graphic?.graphicId && (
                <>
                  <div className="text-zinc-500">Graphic:</div>
                  <div className="text-zinc-300 truncate">{segment.graphic.graphicId}</div>
                </>
              )}
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              Team names will be converted to placeholders for reuse.
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
              className="flex-1 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Selection Summary Panel Component (Phase 3: Multi-Select, Tasks 6.4-6.6)
function SelectionSummaryPanel({
  selectedSegments,
  segments,
  onDurationChange,
  onBulkDelete,
  onBulkEditType,
  onBulkEditScene,
  onBulkEditGraphic,
  onCreateGroup,
  onClose,
  onScrollToSegment
}) {
  const [showBulkTypeDropdown, setShowBulkTypeDropdown] = useState(false);
  const [showBulkSceneDropdown, setShowBulkSceneDropdown] = useState(false);
  const [showBulkGraphicDropdown, setShowBulkGraphicDropdown] = useState(false);

  const groupedScenes = getGroupedScenes();
  const groupedGraphics = getGroupedGraphics();

  // Calculate total duration of selected segments
  const totalSelectedDuration = selectedSegments.reduce(
    (sum, seg) => sum + (seg.duration || 0),
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Selection Summary</h2>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          title="Clear selection"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Selection count */}
      <div className="text-sm text-zinc-400 mb-4">
        {selectedSegments.length} segments selected
      </div>

      {/* Selected segments list with editable durations (Task 6.5) */}
      <div className="space-y-2 mb-4 max-h-[calc(100vh-400px)] overflow-y-auto">
        {selectedSegments.map(segment => {
          const originalIndex = segments.findIndex(s => s.id === segment.id);
          return (
            <div
              key={segment.id}
              className="p-2 bg-zinc-800/50 border border-zinc-700 rounded-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onScrollToSegment(segment.id)}
                    className="text-sm text-white font-medium hover:text-blue-400 transition-colors text-left truncate block w-full"
                    title="Click to scroll to segment"
                  >
                    {String(originalIndex + 1).padStart(2, '0')} {segment.name}
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 text-xs rounded border ${TYPE_COLORS[segment.type] || 'bg-zinc-700 text-zinc-400 border-zinc-600'}`}>
                      {segment.type}
                    </span>
                    {segment.scene && (
                      <span className="text-xs text-zinc-500 truncate">
                        {segment.scene}
                      </span>
                    )}
                  </div>
                </div>
                {/* Editable duration input (Task 6.5) */}
                <div className="shrink-0">
                  <input
                    type="text"
                    value={segment.duration !== null ? `${segment.duration}s` : ''}
                    placeholder="—"
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      onDurationChange(segment.id, val ? Number(val) : null);
                    }}
                    className="w-16 px-2 py-1 text-xs font-mono text-right bg-zinc-900 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-blue-500"
                    title="Duration in seconds"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total duration line */}
      <div className="flex items-center justify-between py-3 border-t border-zinc-700">
        <span className="text-sm text-zinc-400">Total</span>
        <span className="text-sm font-mono font-medium text-white">
          {formatDuration(totalSelectedDuration)}
        </span>
      </div>

      {/* Bulk Actions (Task 6.6) */}
      <div className="pt-4 border-t border-zinc-700 space-y-2">
        {/* Bulk Edit Type */}
        <div className="relative">
          <button
            onClick={() => {
              setShowBulkTypeDropdown(!showBulkTypeDropdown);
              setShowBulkSceneDropdown(false);
              setShowBulkGraphicDropdown(false);
            }}
            className="w-full px-3 py-2 text-sm text-left bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center justify-between"
          >
            <span>Bulk Edit Type</span>
            <ChevronDownIcon className="w-4 h-4" />
          </button>
          {showBulkTypeDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 overflow-hidden">
              {SEGMENT_TYPES.filter(t => t.value !== 'all').map(type => (
                <button
                  key={type.value}
                  onClick={() => {
                    onBulkEditType(type.value);
                    setShowBulkTypeDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Edit Scene */}
        <div className="relative">
          <button
            onClick={() => {
              setShowBulkSceneDropdown(!showBulkSceneDropdown);
              setShowBulkTypeDropdown(false);
              setShowBulkGraphicDropdown(false);
            }}
            className="w-full px-3 py-2 text-sm text-left bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center justify-between"
          >
            <span>Bulk Edit Scene</span>
            <ChevronDownIcon className="w-4 h-4" />
          </button>
          {showBulkSceneDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
              <button
                onClick={() => {
                  onBulkEditScene('');
                  setShowBulkSceneDropdown(false);
                }}
                className="w-full px-3 py-2 text-sm text-left text-zinc-500 hover:bg-zinc-700 transition-colors"
              >
                (Clear scene)
              </button>
              {Object.entries(groupedScenes).map(([category, scenes]) => (
                <div key={category}>
                  <div className="px-3 py-1 text-xs text-zinc-500 bg-zinc-900 uppercase">
                    {SCENE_CATEGORY_LABELS[category] || category}
                  </div>
                  {scenes.map(scene => (
                    <button
                      key={scene.name}
                      onClick={() => {
                        onBulkEditScene(scene.name);
                        setShowBulkSceneDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {scene.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Edit Graphic */}
        <div className="relative">
          <button
            onClick={() => {
              setShowBulkGraphicDropdown(!showBulkGraphicDropdown);
              setShowBulkTypeDropdown(false);
              setShowBulkSceneDropdown(false);
            }}
            className="w-full px-3 py-2 text-sm text-left bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center justify-between"
          >
            <span>Bulk Edit Graphic</span>
            <ChevronDownIcon className="w-4 h-4" />
          </button>
          {showBulkGraphicDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
              <button
                onClick={() => {
                  onBulkEditGraphic('');
                  setShowBulkGraphicDropdown(false);
                }}
                className="w-full px-3 py-2 text-sm text-left text-zinc-500 hover:bg-zinc-700 transition-colors"
              >
                (Clear graphic)
              </button>
              {Object.entries(groupedGraphics).map(([category, graphics]) => (
                <div key={category}>
                  <div className="px-3 py-1 text-xs text-zinc-500 bg-zinc-900 uppercase">
                    {GRAPHICS_CATEGORY_LABELS[category] || category}
                  </div>
                  {graphics.map(graphic => (
                    <button
                      key={graphic.id}
                      onClick={() => {
                        onBulkEditGraphic(graphic.id);
                        setShowBulkGraphicDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {graphic.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Group Selected button (Phase 4: Task 7.4) */}
        <button
          onClick={onCreateGroup}
          className="w-full px-3 py-2 text-sm bg-blue-600/20 border border-blue-600/50 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-2"
        >
          <FolderIcon className="w-4 h-4" />
          Group {selectedSegments.length} Segment{selectedSegments.length !== 1 ? 's' : ''}
        </button>

        {/* Delete All button */}
        <button
          onClick={onBulkDelete}
          className="w-full px-3 py-2 text-sm bg-red-600/20 border border-red-600/50 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors flex items-center justify-center gap-2"
        >
          <TrashIcon className="w-4 h-4" />
          Delete {selectedSegments.length} Segment{selectedSegments.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

// Segment Template Library Modal Component (Phase 7: Task 59)
function SegmentTemplateLibraryModal({ templates, loading, onAdd, onDelete, onCancel }) {
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Filter templates by category
  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  // Group templates by category for display
  const templatesByCategory = filteredTemplates.reduce((acc, template) => {
    const cat = template.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Segment Template Library</h2>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="px-4 pt-3 pb-2 border-b border-zinc-800">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              All
            </button>
            {SEGMENT_TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-zinc-500">
              Loading templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-zinc-500 mb-2">
                {selectedCategory === 'all' ? 'No segment templates saved yet' : 'No templates in this category'}
              </div>
              <div className="text-xs text-zinc-600">
                Use the bookmark icon on any segment to save it as a template.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedCategory === 'all' ? (
                // Show grouped by category when "All" is selected
                Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                  <div key={category}>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                      {SEGMENT_TEMPLATE_CATEGORIES.find(c => c.id === category)?.label || 'General'}
                    </div>
                    <div className="space-y-2">
                      {categoryTemplates.map(template => (
                        <SegmentTemplateCard
                          key={template.id}
                          template={template}
                          onAdd={onAdd}
                          onDelete={onDelete}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // Show flat list when category is selected
                <div className="space-y-2">
                  {filteredTemplates.map(template => (
                    <SegmentTemplateCard
                      key={template.id}
                      template={template}
                      onAdd={onAdd}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500">
            Click "Add" to insert the template as a new segment in your rundown.
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual Segment Template Card (Phase 7: Task 59)
function SegmentTemplateCard({ template, onAdd, onDelete }) {
  return (
    <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white truncate">{template.name}</span>
            <span className={`px-1.5 py-0.5 text-xs rounded border ${TYPE_COLORS[template.segment?.type] || 'bg-zinc-700 text-zinc-400 border-zinc-600'}`}>
              {template.segment?.type || 'unknown'}
            </span>
          </div>
          {template.description && (
            <div className="text-sm text-zinc-500 mb-2 line-clamp-1">
              {template.description}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {template.segment?.duration && (
              <span>{template.segment.duration}s</span>
            )}
            {template.segment?.scene && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="truncate">{template.segment.scene}</span>
              </>
            )}
            {template.segment?.graphic?.graphicId && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="inline-flex items-center gap-1 text-pink-400">
                  <PhotoIcon className="w-3 h-3" />
                  {template.segment.graphic.graphicId}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onAdd(template)}
            className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
          >
            Add
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
}
