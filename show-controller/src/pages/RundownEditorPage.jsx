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
  ArrowPathRoundedSquareIcon,
  UserIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  PrinterIcon,
  TableCellsIcon,
  Bars4Icon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { getGraphicsForCompetition, getCategories, getRecommendedGraphic, getGraphicById, GRAPHICS } from '../lib/graphicsRegistry';
import { db, ref, set, get, push, remove, update, onValue, onDisconnect } from '../lib/firebase';

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

// User roles for collaboration (Phase 8: Task 66)
// Higher index = higher privilege
const USER_ROLES = [
  { id: 'viewer', label: 'Viewer', description: 'View only, no edits', canEdit: false, canLock: false, canApprove: false },
  { id: 'editor', label: 'Editor', description: 'Edit segments, cannot lock or approve', canEdit: true, canLock: false, canApprove: false },
  { id: 'producer', label: 'Producer', description: 'Edit all segments, lock/unlock, approve', canEdit: true, canLock: true, canApprove: true },
  { id: 'owner', label: 'Owner', description: 'Full access, manage permissions', canEdit: true, canLock: true, canApprove: true },
];

// Approval workflow statuses (Phase 8: Task 69)
// Defines the rundown approval states and their behaviors
const APPROVAL_STATUSES = [
  {
    id: 'draft',
    label: 'Draft',
    description: 'Work in progress, fully editable',
    color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40',
    icon: 'pencil',
    allowEdits: true,
  },
  {
    id: 'in-review',
    label: 'In Review',
    description: 'Submitted for approval, limited edits',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: 'clock',
    allowEdits: false, // Only producers/owners can edit when in review
  },
  {
    id: 'approved',
    label: 'Approved',
    description: 'Reviewed and approved, locked for edits',
    color: 'bg-green-500/20 text-green-300 border-green-500/40',
    icon: 'check',
    allowEdits: false,
  },
  {
    id: 'locked',
    label: 'Locked',
    description: 'Final version, no edits allowed',
    color: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: 'lock',
    allowEdits: false,
  },
];

// Get approval status by ID
function getApprovalStatusById(statusId) {
  return APPROVAL_STATUSES.find(s => s.id === statusId) || APPROVAL_STATUSES[0]; // Default to draft
}

// Get role by ID
function getRoleById(roleId) {
  return USER_ROLES.find(r => r.id === roleId) || USER_ROLES[0]; // Default to viewer
}

// Role badge colors for presence indicators
const ROLE_COLORS = {
  owner: 'ring-amber-400',
  producer: 'ring-purple-400',
  editor: 'ring-blue-400',
  viewer: 'ring-zinc-400',
};

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

// Row background colors by segment type (Phase 10: Task 77)
// Subtle left border + very faint background tint for type differentiation
const TYPE_ROW_COLORS = {
  video: { border: 'border-l-purple-500', bg: 'bg-purple-500/5' },
  live: { border: 'border-l-green-500', bg: 'bg-green-500/5' },
  static: { border: 'border-l-blue-500', bg: 'bg-blue-500/5' },
  break: { border: 'border-l-yellow-500', bg: 'bg-yellow-500/5' },
  hold: { border: 'border-l-orange-500', bg: 'bg-orange-500/5' },
  graphic: { border: 'border-l-pink-500', bg: 'bg-pink-500/5' },
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
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false); // Edit rundown template modal (Phase 7: Task 61)
  const [templateToEdit, setTemplateToEdit] = useState(null); // Rundown template being edited (Phase 7: Task 61)
  const [showEditSegmentTemplateModal, setShowEditSegmentTemplateModal] = useState(false); // Edit segment template modal (Phase 7: Task 61)
  const [segmentTemplateToEdit, setSegmentTemplateToEdit] = useState(null); // Segment template being edited (Phase 7: Task 61)
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false); // Recurrence pattern modal (Phase 7: Task 62)
  const [isLoadingRundown, setIsLoadingRundown] = useState(true); // Loading state for Firebase sync (Phase 8: Task 63)
  const [isSyncing, setIsSyncing] = useState(false); // Indicates if currently syncing to Firebase (Phase 8: Task 63)
  const [presenceList, setPresenceList] = useState([]); // List of users currently viewing (Phase 8: Task 64)
  const [mySessionId] = useState(() => `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`); // Unique session ID (Phase 8: Task 64)
  const [myRole, setMyRole] = useState('editor'); // Current user's role (Phase 8: Task 66) - default to editor for prototype
  const [showRoleSelector, setShowRoleSelector] = useState(false); // Toggle role selector dropdown (Phase 8: Task 66)
  const [showHistoryModal, setShowHistoryModal] = useState(false); // Toggle change history modal (Phase 8: Task 67)
  const [changeHistory, setChangeHistory] = useState([]); // Change history entries (Phase 8: Task 67)
  const [loadingHistory, setLoadingHistory] = useState(false); // Loading state for history (Phase 8: Task 67)
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState(false); // Confirm restore modal (Phase 8: Task 68)
  const [entryToRestore, setEntryToRestore] = useState(null); // History entry to restore (Phase 8: Task 68)
  const [approvalStatus, setApprovalStatus] = useState('draft'); // Rundown approval status (Phase 8: Task 69)
  const [showApprovalMenu, setShowApprovalMenu] = useState(false); // Toggle approval actions dropdown (Phase 8: Task 69)
  const [showRejectModal, setShowRejectModal] = useState(false); // Reject with reason modal (Phase 8: Task 69)
  const [rejectReason, setRejectReason] = useState(''); // Reason for rejection (Phase 8: Task 69)
  const [showImportCSVModal, setShowImportCSVModal] = useState(false); // CSV import modal (Phase 9: Task 73)
  const [importCSVData, setImportCSVData] = useState(null); // Parsed CSV data for import (Phase 9: Task 73)
  const [importCSVMapping, setImportCSVMapping] = useState({}); // Field mapping for CSV import (Phase 9: Task 73)
  const [showImportJSONModal, setShowImportJSONModal] = useState(false); // JSON import modal (Phase 9: Task 74)
  const [importJSONData, setImportJSONData] = useState(null); // Parsed JSON data for import (Phase 9: Task 74)
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'timeline' (Phase 10: Task 75)
  const [timelineZoom, setTimelineZoom] = useState(100); // Zoom level percentage for timeline view (Phase 10: Task 75)

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

  // Compute which segments other users have selected (Phase 8: Task 65)
  // Returns a map of segmentId -> array of users who have that segment selected
  const otherUsersSelections = useMemo(() => {
    const selections = {};
    presenceList.forEach(user => {
      // Skip current user's selections
      if (user.sessionId === mySessionId) return;

      // Add single selection
      if (user.selectedSegmentId) {
        if (!selections[user.selectedSegmentId]) {
          selections[user.selectedSegmentId] = [];
        }
        selections[user.selectedSegmentId].push(user);
      }

      // Add multi-selections
      if (user.selectedSegmentIds && Array.isArray(user.selectedSegmentIds)) {
        user.selectedSegmentIds.forEach(segId => {
          if (!selections[segId]) {
            selections[segId] = [];
          }
          // Avoid duplicates if segId equals selectedSegmentId
          if (!selections[segId].some(u => u.sessionId === user.sessionId)) {
            selections[segId].push(user);
          }
        });
      }
    });
    return selections;
  }, [presenceList, mySessionId]);

  // Toast helper
  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  }

  // Permission check helpers (Phase 8: Task 66)
  const currentRole = useMemo(() => getRoleById(myRole), [myRole]);
  const canEdit = currentRole.canEdit;
  const canLock = currentRole.canLock;
  const canApprove = currentRole.canApprove; // Phase 8: Task 69

  // Get current approval status object (Phase 8: Task 69)
  const currentApprovalStatus = useMemo(() => getApprovalStatusById(approvalStatus), [approvalStatus]);

  // Check if action is allowed based on role and approval status (Phase 8: Task 66 & 69)
  function checkPermission(action, showWarning = true) {
    // Check role permissions first
    if (action === 'edit' && !canEdit) {
      if (showWarning) showToast('Permission denied: Viewers cannot edit');
      return false;
    }
    if (action === 'lock' && !canLock) {
      if (showWarning) showToast('Permission denied: Only producers and owners can lock/unlock');
      return false;
    }
    if (action === 'approve' && !canApprove) {
      if (showWarning) showToast('Permission denied: Only producers and owners can approve/reject');
      return false;
    }

    // Check approval status permissions (Phase 8: Task 69)
    if (action === 'edit') {
      // Locked status: no edits allowed
      if (approvalStatus === 'locked') {
        if (showWarning) showToast('Rundown is locked. Unlock to make changes.');
        return false;
      }
      // Approved status: only owners can edit
      if (approvalStatus === 'approved' && myRole !== 'owner') {
        if (showWarning) showToast('Rundown is approved. Only owners can edit.');
        return false;
      }
      // In Review status: only producers and owners can edit
      if (approvalStatus === 'in-review' && !canLock) {
        if (showWarning) showToast('Rundown is in review. Only producers and owners can edit.');
        return false;
      }
    }
    return true;
  }

  // Firebase real-time sync for rundown segments (Phase 8: Task 63)
  // This useEffect sets up a listener that syncs segments bidirectionally with Firebase
  useEffect(() => {
    if (!compId) return;

    const rundownRef = ref(db, `competitions/${compId}/rundown/segments`);
    const groupsRef = ref(db, `competitions/${compId}/rundown/groups`);
    const statusRef = ref(db, `competitions/${compId}/rundown/approvalStatus`); // Phase 8: Task 69

    setIsLoadingRundown(true);

    // Subscribe to segments changes
    const unsubscribeSegments = onValue(rundownRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Firebase stores arrays as objects with numeric keys, convert back to array
        const segmentArray = Array.isArray(data)
          ? data.filter(Boolean) // Filter out any null entries
          : Object.values(data);
        setSegments(segmentArray);
      } else {
        // No data in Firebase yet, initialize with dummy data and save to Firebase
        setSegments(DUMMY_SEGMENTS);
        // Save initial data to Firebase
        set(rundownRef, DUMMY_SEGMENTS).catch(err => {
          console.error('Error initializing rundown in Firebase:', err);
        });
      }
      setIsLoadingRundown(false);
    }, (error) => {
      console.error('Error loading rundown from Firebase:', error);
      showToast('Error loading rundown');
      setIsLoadingRundown(false);
    });

    // Subscribe to approval status changes (Phase 8: Task 69)
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        setApprovalStatus(snapshot.val());
      } else {
        setApprovalStatus('draft');
      }
    }, (error) => {
      console.error('Error loading approval status from Firebase:', error);
    });

    // Subscribe to groups changes
    const unsubscribeGroups = onValue(groupsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const groupsArray = Array.isArray(data)
          ? data.filter(Boolean)
          : Object.values(data);
        setGroups(groupsArray);
      } else {
        setGroups([]);
      }
    }, (error) => {
      console.error('Error loading groups from Firebase:', error);
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribeSegments();
      unsubscribeGroups();
      unsubscribeStatus();
    };
  }, [compId]);

  // Firebase presence tracking for multi-user awareness (Phase 8: Task 64)
  // This useEffect manages the current user's presence and subscribes to other users' presence
  useEffect(() => {
    if (!compId) return;

    const presenceRef = ref(db, `competitions/${compId}/rundown/presence/${mySessionId}`);
    const allPresenceRef = ref(db, `competitions/${compId}/rundown/presence`);

    // Generate a random color for this user's avatar
    const userColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500'];
    const userColor = userColors[Math.floor(Math.random() * userColors.length)];

    // Set this user's presence data
    const presenceData = {
      sessionId: mySessionId,
      joinedAt: Date.now(),
      lastActivity: Date.now(),
      color: userColor,
      // In the future, this could include user name/email from auth
      displayName: `User ${mySessionId.slice(-4).toUpperCase()}`,
      // Selection state for cursor/selection sharing (Phase 8: Task 65)
      selectedSegmentId: null,
      selectedSegmentIds: [],
      // Role for permission control (Phase 8: Task 66)
      role: myRole,
    };

    // Write presence and set up auto-cleanup on disconnect
    set(presenceRef, presenceData).catch(err => {
      console.error('Error setting presence:', err);
    });

    // Set up onDisconnect to remove presence when user leaves
    onDisconnect(presenceRef).remove().catch(err => {
      console.error('Error setting onDisconnect:', err);
    });

    // Update lastActivity periodically to indicate user is still active
    const activityInterval = setInterval(() => {
      update(presenceRef, { lastActivity: Date.now() }).catch(() => {
        // Ignore errors from activity updates
      });
    }, 30000); // Update every 30 seconds

    // Subscribe to all users' presence
    const unsubscribePresence = onValue(allPresenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const presenceArray = Object.values(data).filter(p => {
          // Filter out stale presence (older than 2 minutes with no activity)
          const isRecent = Date.now() - p.lastActivity < 120000;
          return isRecent;
        });
        setPresenceList(presenceArray);
      } else {
        setPresenceList([]);
      }
    }, (error) => {
      console.error('Error loading presence:', error);
    });

    // Cleanup on unmount
    return () => {
      clearInterval(activityInterval);
      unsubscribePresence();
      // Remove presence when leaving
      remove(presenceRef).catch(() => {
        // Ignore errors during cleanup
      });
    };
  }, [compId, mySessionId]);

  // Sync selection state and role to presence (Phase 8: Task 65 & 66)
  // This useEffect updates the current user's presence with their selection and role
  useEffect(() => {
    if (!compId) return;

    const presenceRef = ref(db, `competitions/${compId}/rundown/presence/${mySessionId}`);

    // Update selection and role in presence data
    update(presenceRef, {
      selectedSegmentId: selectedSegmentId || null,
      selectedSegmentIds: selectedSegmentIds || [],
      role: myRole,
      lastActivity: Date.now(),
    }).catch(() => {
      // Ignore errors - presence update is not critical
    });
  }, [compId, mySessionId, selectedSegmentId, selectedSegmentIds, myRole]);

  // Helper function to log a change to Firebase history (Phase 8: Task 67)
  // Creates an entry in competitions/{compId}/rundown/history
  // Updated (Phase 8: Task 68) - Now stores snapshots for rollback capability
  async function logChange(action, details = {}, snapshotData = null) {
    if (!compId) return;

    const historyEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      details,
      timestamp: Date.now(),
      user: {
        sessionId: mySessionId,
        displayName: presenceList.find(p => p.sessionId === mySessionId)?.displayName || `User ${mySessionId.slice(-4).toUpperCase()}`,
        role: myRole,
      },
    };

    // If snapshot data is provided, store it for rollback capability (Phase 8: Task 68)
    // Snapshots include current state BEFORE the change was made
    if (snapshotData) {
      historyEntry.snapshot = snapshotData;
    }

    try {
      // Use push to add to history array (keeps last 100 entries via Firebase rules or client-side cleanup)
      const historyRef = ref(db, `competitions/${compId}/rundown/history`);
      await push(historyRef, historyEntry);
    } catch (error) {
      console.error('Error logging change to history:', error);
      // Don't show toast for history errors - non-critical
    }
  }

  // Helper function to sync segments to Firebase (Phase 8: Task 63)
  // This is called by all segment-modifying handlers
  // Updated to accept optional action description for history logging (Phase 8: Task 67)
  // Updated (Phase 8: Task 68) - Now creates snapshot before change for rollback
  async function syncSegmentsToFirebase(newSegments, action = null, details = {}, skipSnapshot = false) {
    if (!compId) return;
    setIsSyncing(true);
    try {
      await set(ref(db, `competitions/${compId}/rundown/segments`), newSegments);
      // Log the change if action is provided
      if (action) {
        // Create snapshot of state BEFORE change for rollback (Phase 8: Task 68)
        // We store the CURRENT state (which is about to become the "before" state)
        // Skip snapshot for restore operations to prevent circular references
        const snapshotData = skipSnapshot ? null : {
          segments: segments, // Current segments before update
          groups: groups,     // Current groups
        };
        await logChange(action, details, snapshotData);
      }
    } catch (error) {
      console.error('Error syncing segments to Firebase:', error);
      showToast('Error saving changes');
    }
    setIsSyncing(false);
  }

  // Helper function to sync groups to Firebase (Phase 8: Task 63)
  // Updated to accept optional action description for history logging (Phase 8: Task 67)
  // Updated (Phase 8: Task 68) - Now creates snapshot before change for rollback
  async function syncGroupsToFirebase(newGroups, action = null, details = {}, skipSnapshot = false) {
    if (!compId) return;
    try {
      await set(ref(db, `competitions/${compId}/rundown/groups`), newGroups);
      // Log the change if action is provided
      if (action) {
        // Create snapshot of state BEFORE change for rollback (Phase 8: Task 68)
        // Skip snapshot for restore operations to prevent circular references
        const snapshotData = skipSnapshot ? null : {
          segments: segments,
          groups: groups,
        };
        await logChange(action, details, snapshotData);
      }
    } catch (error) {
      console.error('Error syncing groups to Firebase:', error);
    }
  }

  // Load change history from Firebase (Phase 8: Task 67)
  async function loadChangeHistory() {
    if (!compId) return;
    setLoadingHistory(true);
    try {
      const historyRef = ref(db, `competitions/${compId}/rundown/history`);
      const snapshot = await get(historyRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const historyArray = Object.values(data)
          .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
          .slice(0, 100); // Limit to last 100 entries
        setChangeHistory(historyArray);
      } else {
        setChangeHistory([]);
      }
    } catch (error) {
      console.error('Error loading change history:', error);
      showToast('Error loading history');
    }
    setLoadingHistory(false);
  }

  // Handle opening history modal (Phase 8: Task 67)
  function handleOpenHistory() {
    setShowHistoryModal(true);
    loadChangeHistory();
  }

  // Handle initiating a restore from history (Phase 8: Task 68)
  // This opens the confirmation modal before actually restoring
  function handleInitiateRestore(entry) {
    if (!entry.snapshot) {
      showToast('This entry has no snapshot to restore');
      return;
    }
    // Check permissions - only editors and above can restore
    if (!checkPermission('edit')) {
      showToast('Viewers cannot restore versions');
      return;
    }
    setEntryToRestore(entry);
    setShowRestoreConfirmModal(true);
  }

  // Handle confirming and executing the restore (Phase 8: Task 68)
  async function handleConfirmRestore() {
    if (!entryToRestore?.snapshot) {
      showToast('No snapshot to restore');
      setShowRestoreConfirmModal(false);
      setEntryToRestore(null);
      return;
    }

    const { segments: snapshotSegments, groups: snapshotGroups } = entryToRestore.snapshot;

    try {
      // Restore segments (use skipSnapshot=true to avoid nested snapshots, but still log)
      if (snapshotSegments && Array.isArray(snapshotSegments)) {
        setSegments(snapshotSegments);
        await syncSegmentsToFirebase(
          snapshotSegments,
          'Restore to previous version',
          {
            restoredFrom: entryToRestore.action,
            restoredTimestamp: entryToRestore.timestamp,
            segmentCount: snapshotSegments.length,
          },
          true // skipSnapshot - restore logs itself but doesn't store another snapshot
        );
      }

      // Restore groups if present
      if (snapshotGroups && Array.isArray(snapshotGroups)) {
        setGroups(snapshotGroups);
        await syncGroupsToFirebase(snapshotGroups, null, {}, true); // Don't double-log
      }

      showToast('Restored to previous version');
      setShowRestoreConfirmModal(false);
      setEntryToRestore(null);
      // Refresh history to show the restore action
      loadChangeHistory();
    } catch (error) {
      console.error('Error restoring version:', error);
      showToast('Error restoring version');
    }
  }

  // Handle canceling the restore (Phase 8: Task 68)
  function handleCancelRestore() {
    setShowRestoreConfirmModal(false);
    setEntryToRestore(null);
  }

  // Approval workflow handlers (Phase 8: Task 69)

  // Sync approval status to Firebase
  async function syncApprovalStatusToFirebase(newStatus, action = null, details = {}) {
    if (!compId) return;
    try {
      await set(ref(db, `competitions/${compId}/rundown/approvalStatus`), newStatus);
      // Log the change
      if (action) {
        await logChange(action, {
          newStatus,
          ...details,
        });
      }
    } catch (error) {
      console.error('Error syncing approval status to Firebase:', error);
      showToast('Error updating approval status');
    }
  }

  // Submit rundown for review
  function handleSubmitForReview() {
    if (!checkPermission('edit')) return;
    if (approvalStatus !== 'draft') {
      showToast('Only draft rundowns can be submitted for review');
      return;
    }
    syncApprovalStatusToFirebase('in-review', 'Submit for review', {
      previousStatus: approvalStatus,
      segmentCount: segments.length,
    });
    setShowApprovalMenu(false);
    showToast('Rundown submitted for review');
  }

  // Approve the rundown
  function handleApprove() {
    if (!checkPermission('approve')) return;
    if (approvalStatus !== 'in-review') {
      showToast('Only rundowns in review can be approved');
      return;
    }
    syncApprovalStatusToFirebase('approved', 'Approve rundown', {
      previousStatus: approvalStatus,
    });
    setShowApprovalMenu(false);
    showToast('Rundown approved');
  }

  // Open reject modal (requires reason)
  function handleOpenRejectModal() {
    if (!checkPermission('approve')) return;
    if (approvalStatus !== 'in-review') {
      showToast('Only rundowns in review can be rejected');
      return;
    }
    setRejectReason('');
    setShowRejectModal(true);
    setShowApprovalMenu(false);
  }

  // Confirm rejection with reason
  function handleConfirmReject() {
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection');
      return;
    }
    syncApprovalStatusToFirebase('draft', 'Reject rundown', {
      previousStatus: approvalStatus,
      reason: rejectReason.trim(),
    });
    setShowRejectModal(false);
    setRejectReason('');
    showToast('Rundown rejected and returned to draft');
  }

  // Cancel rejection
  function handleCancelReject() {
    setShowRejectModal(false);
    setRejectReason('');
  }

  // Lock the rundown (from approved status)
  function handleLockRundown() {
    if (!checkPermission('lock')) return;
    if (approvalStatus !== 'approved') {
      showToast('Only approved rundowns can be locked');
      return;
    }
    syncApprovalStatusToFirebase('locked', 'Lock rundown', {
      previousStatus: approvalStatus,
    });
    setShowApprovalMenu(false);
    showToast('Rundown locked');
  }

  // Unlock the rundown (only owners)
  function handleUnlockRundown() {
    if (myRole !== 'owner') {
      showToast('Only owners can unlock rundowns');
      return;
    }
    // Ask for confirmation
    if (!window.confirm('Unlock this rundown? It will return to draft status and can be edited.')) {
      return;
    }
    syncApprovalStatusToFirebase('draft', 'Unlock rundown', {
      previousStatus: approvalStatus,
    });
    setShowApprovalMenu(false);
    showToast('Rundown unlocked and returned to draft');
  }

  // Return to draft (from in-review or approved, not locked)
  function handleReturnToDraft() {
    if (!checkPermission('approve')) return;
    if (approvalStatus === 'draft') {
      showToast('Rundown is already a draft');
      return;
    }
    if (approvalStatus === 'locked') {
      showToast('Locked rundowns must be unlocked first');
      return;
    }
    syncApprovalStatusToFirebase('draft', 'Return to draft', {
      previousStatus: approvalStatus,
    });
    setShowApprovalMenu(false);
    showToast('Rundown returned to draft');
  }

  // Close Add Segment dropdown when clicking outside (Phase 7: Task 59)
  useEffect(() => {
    function handleClickOutside(event) {
      if (showAddSegmentMenu && !event.target.closest('.add-segment-dropdown')) {
        setShowAddSegmentMenu(false);
      }
      // Close role selector when clicking outside (Phase 8: Task 66)
      if (showRoleSelector && !event.target.closest('.role-selector-dropdown')) {
        setShowRoleSelector(false);
      }
      // Close approval menu when clicking outside (Phase 8: Task 69)
      if (showApprovalMenu && !event.target.closest('.approval-menu-dropdown')) {
        setShowApprovalMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddSegmentMenu, showRoleSelector, showApprovalMenu]);

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
  // Respects locked segments (Phase 5: Task 8.2) and role permissions (Phase 8: Task 66)
  function handleBulkDelete() {
    if (selectedSegmentIds.length === 0) return;
    if (!checkPermission('edit')) return;

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
      // Get names of segments being deleted for history
      const deletedSegmentNames = segments
        .filter(seg => selectedSegmentIds.includes(seg.id) && !seg.locked)
        .map(seg => seg.name);
      // Only delete unlocked segments
      const newSegments = segments.filter(seg =>
        !selectedSegmentIds.includes(seg.id) || seg.locked
      );
      syncSegmentsToFirebase(newSegments, 'Bulk delete segments', {
        segmentCount: deleteCount,
        segmentNames: deletedSegmentNames.slice(0, 5), // Limit to first 5 for brevity
      });
      setSelectedSegmentIds([]);
      showToast(`${deleteCount} segment(s) deleted${lockedCount > 0 ? `, ${lockedCount} locked skipped` : ''}`);
    }
  }

  // Bulk edit type for selected segments (Task 6.6)
  // Respects locked segments (Phase 5: Task 8.2) and role permissions (Phase 8: Task 66)
  function handleBulkEditType(newType) {
    if (!checkPermission('edit')) return;
    let updatedCount = 0;
    const newSegments = segments.map(seg => {
      if (!selectedSegmentIds.includes(seg.id)) return seg;
      if (seg.locked) return seg; // Skip locked segments
      updatedCount++;
      return { ...seg, type: newType };
    });
    syncSegmentsToFirebase(newSegments, 'Bulk edit type', {
      segmentCount: updatedCount,
      newType,
    });
    const lockedCount = selectedSegmentIds.length - updatedCount;
    showToast(`Updated type for ${updatedCount} segment(s)${lockedCount > 0 ? `, ${lockedCount} locked skipped` : ''}`);
  }

  // Bulk edit scene for selected segments (Task 6.6)
  // Respects locked segments (Phase 5: Task 8.2) and role permissions (Phase 8: Task 66)
  function handleBulkEditScene(newScene) {
    if (!checkPermission('edit')) return;
    let updatedCount = 0;
    const newSegments = segments.map(seg => {
      if (!selectedSegmentIds.includes(seg.id)) return seg;
      if (seg.locked) return seg; // Skip locked segments
      updatedCount++;
      return { ...seg, scene: newScene };
    });
    syncSegmentsToFirebase(newSegments, 'Bulk edit scene', {
      segmentCount: updatedCount,
      newScene,
    });
    const lockedCount = selectedSegmentIds.length - updatedCount;
    showToast(`Updated scene for ${updatedCount} segment(s)${lockedCount > 0 ? `, ${lockedCount} locked skipped` : ''}`);
  }

  // Bulk edit graphic for selected segments (Task 6.6)
  // Respects locked segments (Phase 5: Task 8.2) and role permissions (Phase 8: Task 66)
  function handleBulkEditGraphic(graphicId) {
    if (!checkPermission('edit')) return;
    let updatedCount = 0;
    const newSegments = segments.map(seg => {
      if (!selectedSegmentIds.includes(seg.id)) return seg;
      if (seg.locked) return seg; // Skip locked segments
      updatedCount++;
      if (!graphicId) {
        return { ...seg, graphic: null };
      }
      return { ...seg, graphic: { graphicId, params: {} } };
    });
    syncSegmentsToFirebase(newSegments, 'Bulk edit graphic', {
      segmentCount: updatedCount,
      graphicId: graphicId || 'None',
    });
    const lockedCount = selectedSegmentIds.length - updatedCount;
    showToast(`Updated graphic for ${updatedCount} segment(s)${lockedCount > 0 ? `, ${lockedCount} locked skipped` : ''}`);
  }

  // Update duration for a segment in multi-select (Task 6.5)
  // Respects locked segments (Phase 5: Task 8.2) and role permissions (Phase 8: Task 66)
  function handleMultiSelectDurationChange(segmentId, duration) {
    if (!checkPermission('edit')) return;
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    const newSegments = segments.map(seg =>
      seg.id === segmentId ? { ...seg, duration } : seg
    );
    syncSegmentsToFirebase(newSegments);
  }

  function handleReorder(fromIndex, toIndex) {
    // Check role permissions (Phase 8: Task 66)
    if (!checkPermission('edit')) return;
    // Check if the segment being moved is locked (Phase 5: Task 8.2)
    const segmentToMove = segments[fromIndex];
    if (segmentToMove?.locked) {
      showToast('Cannot move locked segment');
      return;
    }
    const newSegments = [...segments];
    const [removed] = newSegments.splice(fromIndex, 1);
    newSegments.splice(toIndex, 0, removed);
    syncSegmentsToFirebase(newSegments, 'Reorder segment', {
      segmentName: segmentToMove.name,
      fromPosition: fromIndex + 1,
      toPosition: toIndex + 1,
    });
  }

  function handleAddSegment() {
    // Check role permissions (Phase 8: Task 66)
    if (!checkPermission('edit')) return;
    // Use timestamp for unique ID to avoid collisions with multiple users
    const newId = `seg-${Date.now()}`;
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
    let newSegments;
    let position;
    if (selectedSegmentId) {
      const index = segments.findIndex(s => s.id === selectedSegmentId);
      position = index + 2;
      newSegments = [...segments];
      newSegments.splice(index + 1, 0, newSegment);
    } else {
      position = segments.length + 1;
      newSegments = [...segments, newSegment];
    }
    syncSegmentsToFirebase(newSegments, 'Add segment', {
      segmentName: newSegment.name,
      position,
    });

    setSelectedSegmentId(newId);
    showToast('Segment added');
  }

  function handleSaveSegment(updatedSegment) {
    // Check role permissions (Phase 8: Task 66)
    if (!checkPermission('edit')) return;
    const oldSegment = segments.find(seg => seg.id === updatedSegment.id);
    const newSegments = segments.map(seg =>
      seg.id === updatedSegment.id ? updatedSegment : seg
    );
    syncSegmentsToFirebase(newSegments, 'Edit segment', {
      segmentName: updatedSegment.name,
      changes: getSegmentChanges(oldSegment, updatedSegment),
    });
    showToast('Segment saved');
  }

  // Helper to describe what changed in a segment (Phase 8: Task 67)
  function getSegmentChanges(oldSeg, newSeg) {
    if (!oldSeg) return ['Created'];
    const changes = [];
    if (oldSeg.name !== newSeg.name) changes.push(`name: "${oldSeg.name}" → "${newSeg.name}"`);
    if (oldSeg.type !== newSeg.type) changes.push(`type: ${oldSeg.type} → ${newSeg.type}`);
    if (oldSeg.duration !== newSeg.duration) changes.push(`duration: ${oldSeg.duration || 'none'}s → ${newSeg.duration || 'none'}s`);
    if (oldSeg.scene !== newSeg.scene) changes.push(`scene: "${oldSeg.scene || 'none'}" → "${newSeg.scene || 'none'}"`);
    if (oldSeg.graphic?.graphicId !== newSeg.graphic?.graphicId) {
      changes.push(`graphic: ${oldSeg.graphic?.graphicId || 'none'} → ${newSeg.graphic?.graphicId || 'none'}`);
    }
    if (oldSeg.timingMode !== newSeg.timingMode) changes.push(`timing: ${oldSeg.timingMode} → ${newSeg.timingMode}`);
    if (oldSeg.optional !== newSeg.optional) changes.push(`optional: ${newSeg.optional ? 'yes' : 'no'}`);
    if (oldSeg.locked !== newSeg.locked) changes.push(`locked: ${newSeg.locked ? 'yes' : 'no'}`);
    return changes.length > 0 ? changes : ['No changes'];
  }

  function handleDeleteSegment(id) {
    // Check role permissions (Phase 8: Task 66)
    if (!checkPermission('edit')) return;
    const segment = segments.find(s => s.id === id);
    if (segment?.locked) {
      showToast('Cannot delete locked segment');
      return;
    }
    if (window.confirm('Are you sure you want to delete this segment?')) {
      const newSegments = segments.filter(seg => seg.id !== id);
      syncSegmentsToFirebase(newSegments, 'Delete segment', {
        segmentName: segment.name,
      });
      if (selectedSegmentId === id) {
        setSelectedSegmentId(null);
      }
      showToast('Segment deleted');
    }
  }

  // Duplicate segment (Phase 5: Task 8.1)
  function handleDuplicateSegment(id) {
    // Check role permissions (Phase 8: Task 66)
    if (!checkPermission('edit')) return;
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
    syncSegmentsToFirebase(newSegments, 'Duplicate segment', {
      originalName: segmentToDuplicate.name,
      newName: duplicatedSegment.name,
    });

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
  // Only producers and owners can lock/unlock (Phase 8: Task 66)
  function handleToggleLock(id) {
    if (!checkPermission('lock')) return;
    const segment = segments.find(s => s.id === id);
    const newLocked = !segment?.locked;
    const newSegments = segments.map(seg =>
      seg.id === id ? { ...seg, locked: newLocked } : seg
    );
    syncSegmentsToFirebase(newSegments, newLocked ? 'Lock segment' : 'Unlock segment', {
      segmentName: segment?.name,
    });
    showToast(segment?.locked ? 'Segment unlocked' : 'Segment locked');
  }

  // Inline update handlers for segment fields (Phase 2: Inline Editing)
  // These handlers check for locked status (Phase 5: Task 8.2) and role permissions (Phase 8: Task 66)
  function handleInlineSceneChange(segmentId, scene) {
    if (!checkPermission('edit')) return;
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    const newSegments = segments.map(seg =>
      seg.id === segmentId ? { ...seg, scene } : seg
    );
    syncSegmentsToFirebase(newSegments);
  }

  function handleInlineGraphicChange(segmentId, graphicId) {
    if (!checkPermission('edit')) return;
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    const newSegments = segments.map(seg => {
      if (seg.id !== segmentId) return seg;
      if (!graphicId) {
        return { ...seg, graphic: null };
      }
      // Preserve existing params if same graphic, otherwise reset
      const existingParams = seg.graphic?.graphicId === graphicId
        ? seg.graphic.params
        : {};
      return { ...seg, graphic: { graphicId, params: existingParams } };
    });
    syncSegmentsToFirebase(newSegments);
  }

  function handleInlineDurationChange(segmentId, duration) {
    if (!checkPermission('edit')) return;
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    const newSegments = segments.map(seg =>
      seg.id === segmentId ? { ...seg, duration } : seg
    );
    syncSegmentsToFirebase(newSegments);
  }

  // Inline toggle for auto-advance (Phase 6: Task 57)
  function handleInlineAutoAdvanceChange(segmentId) {
    if (!checkPermission('edit')) return;
    const segment = segments.find(s => s.id === segmentId);
    if (segment?.locked) {
      showToast('Cannot edit locked segment');
      return;
    }
    const newSegments = segments.map(seg =>
      seg.id === segmentId ? { ...seg, autoAdvance: !seg.autoAdvance } : seg
    );
    syncSegmentsToFirebase(newSegments);
  }

  // Toolbar button handlers
  function handleSave() {
    showToast('Rundown saved');
  }

  // Export rundown to CSV (Phase 9: Task 71)
  function handleExportCSV() {
    // CSV headers
    const headers = [
      '#',
      'Start Time',
      'Name',
      'Type',
      'Duration (s)',
      'Duration',
      'OBS Scene',
      'Graphic',
      'Auto-Advance',
      'Timing Mode',
      'Optional',
      'Locked',
      'Buffer After (s)',
      'Notes'
    ];

    // Build CSV rows
    const rows = segments.map((seg, index) => {
      const startTime = formatDuration(segmentStartTimes[seg.id] || 0);
      const duration = seg.duration ? formatDuration(seg.duration) : 'MANUAL';
      const durationSeconds = seg.duration || 0;
      const graphicId = seg.graphic?.graphicId || '';
      const timingMode = seg.timingMode || 'fixed';

      return [
        String(index + 1).padStart(2, '0'),
        startTime,
        seg.name,
        seg.type,
        durationSeconds,
        duration,
        seg.scene || '',
        graphicId,
        seg.autoAdvance ? 'Yes' : 'No',
        timingMode,
        seg.optional ? 'Yes' : 'No',
        seg.locked ? 'Yes' : 'No',
        seg.bufferAfter || 0,
        seg.notes || ''
      ];
    });

    // Escape CSV field values (handle commas, quotes, newlines)
    const escapeCSV = (value) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with competition name and date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedName = DUMMY_COMPETITION.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    link.download = `rundown-${sanitizedName}-${dateStr}.csv`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('CSV exported');
  }

  // Export rundown to JSON for backup/API integration (Phase 9: Task 72)
  function handleExportJSON() {
    // Build export object with all rundown data
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      competition: {
        id: compId,
        name: DUMMY_COMPETITION.name,
        type: DUMMY_COMPETITION.type,
        teams: DUMMY_COMPETITION.teams,
      },
      rundown: {
        totalRuntime: totalRuntime,
        targetDuration: targetDuration,
        approvalStatus: approvalStatus,
        segments: segments.map((seg, index) => ({
          ...seg,
          order: index + 1,
          startTime: segmentStartTimes[seg.id] || 0,
        })),
        groups: groups,
      },
    };

    // Create JSON content with pretty formatting
    const jsonContent = JSON.stringify(exportData, null, 2);

    // Create download link
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with competition name and date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedName = DUMMY_COMPETITION.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    link.download = `rundown-${sanitizedName}-${dateStr}.json`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('JSON exported');
  }

  // Export rundown to PDF using browser print dialog (Phase 9: Task 70)
  function handleExportPDF() {
    // Generate print-friendly HTML
    const printContent = generatePrintableRundown();

    // Open a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      showToast('Please allow popups to export PDF');
      return;
    }

    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for content to load then trigger print
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
    };
  }

  // Generate print-friendly HTML for PDF export (Phase 9: Task 70)
  function generatePrintableRundown() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build rows for each segment (optionally within groups)
    let segmentRows = '';
    let segmentNumber = 1;

    // Simple flat list (groups support can be added later)
    segments.forEach((seg) => {
      const startTime = formatDuration(segmentStartTimes[seg.id] || 0);
      const duration = seg.duration ? formatDuration(seg.duration) : 'MANUAL';
      const typeBadge = seg.type.toUpperCase();
      const optionalClass = seg.optional ? 'optional' : '';
      const lockedClass = seg.locked ? 'locked' : '';
      const notes = seg.notes ? `<div class="notes">${seg.notes}</div>` : '';
      const graphicInfo = seg.graphic?.graphicId ? `<span class="graphic">${seg.graphic.graphicId}</span>` : '';
      const sceneInfo = seg.scene ? `<span class="scene">${seg.scene}</span>` : '';

      segmentRows += `
        <tr class="${optionalClass} ${lockedClass}">
          <td class="num">${String(segmentNumber).padStart(2, '0')}</td>
          <td class="start">${startTime}</td>
          <td class="name">
            ${seg.name}
            ${seg.optional ? '<span class="optional-badge">OPTIONAL</span>' : ''}
            ${seg.locked ? '<span class="locked-badge">LOCKED</span>' : ''}
            ${notes}
          </td>
          <td class="type"><span class="type-badge type-${seg.type}">${typeBadge}</span></td>
          <td class="duration">${duration}</td>
          <td class="scene">${sceneInfo}</td>
          <td class="graphic">${graphicInfo}</td>
        </tr>
      `;
      segmentNumber++;
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rundown - ${DUMMY_COMPETITION.name}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1a1a1a;
      padding: 20px;
    }
    .header {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #333;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .header .competition {
      font-size: 18px;
      color: #555;
      margin-bottom: 10px;
    }
    .header .meta {
      display: flex;
      gap: 30px;
      font-size: 12px;
      color: #666;
    }
    .header .meta span {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .header .meta strong {
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
      border-bottom: 2px solid #ccc;
    }
    .num {
      width: 40px;
      text-align: center;
      font-weight: 600;
      color: #888;
    }
    .start {
      width: 70px;
      font-family: monospace;
      font-size: 11px;
    }
    .name {
      min-width: 200px;
      font-weight: 500;
    }
    .type {
      width: 80px;
    }
    .duration {
      width: 70px;
      font-family: monospace;
      font-size: 11px;
      text-align: center;
    }
    .scene {
      width: 120px;
      font-size: 10px;
      color: #666;
    }
    .graphic {
      width: 100px;
      font-size: 10px;
      color: #666;
    }
    .type-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .type-video { background: #e9d5ff; color: #7c3aed; }
    .type-live { background: #d1fae5; color: #059669; }
    .type-static { background: #dbeafe; color: #2563eb; }
    .type-break { background: #fef3c7; color: #d97706; }
    .type-hold { background: #fed7aa; color: #ea580c; }
    .type-graphic { background: #fce7f3; color: #db2777; }
    .optional-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 1px 4px;
      font-size: 8px;
      font-weight: 600;
      background: #fef3c7;
      color: #92400e;
      border-radius: 2px;
    }
    .locked-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 1px 4px;
      font-size: 8px;
      font-weight: 600;
      background: #fee2e2;
      color: #991b1b;
      border-radius: 2px;
    }
    tr.optional {
      background: #fffbeb;
    }
    tr.locked td {
      color: #888;
    }
    .notes {
      margin-top: 4px;
      font-size: 10px;
      font-style: italic;
      color: #666;
      padding-left: 10px;
      border-left: 2px solid #ddd;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #888;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 0; }
      .header { page-break-after: avoid; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RUNDOWN</h1>
    <div class="competition">${DUMMY_COMPETITION.name}</div>
    <div class="meta">
      <span><strong>Total Runtime:</strong> ${formatDuration(totalRuntime)}</span>
      ${targetDuration ? `<span><strong>Target:</strong> ${formatDuration(targetDuration)}</span>` : ''}
      <span><strong>Segments:</strong> ${segments.length}</span>
      ${optionalSegmentsInfo.count > 0 ? `<span><strong>Optional:</strong> ${optionalSegmentsInfo.count} (${formatDuration(optionalSegmentsInfo.duration)})</span>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th class="start">Start</th>
        <th class="name">Segment</th>
        <th class="type">Type</th>
        <th class="duration">Duration</th>
        <th class="scene">Scene</th>
        <th class="graphic">Graphic</th>
      </tr>
    </thead>
    <tbody>
      ${segmentRows}
    </tbody>
  </table>

  <div class="footer">
    <span>Generated: ${dateStr} at ${timeStr}</span>
    <span>commentarygraphic.com</span>
  </div>
</body>
</html>
    `;
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
      syncSegmentsToFirebase(newSegments);
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

  // Open edit modal for rundown template (Phase 7: Task 61)
  function handleEditTemplate(template) {
    setTemplateToEdit(template);
    setShowEditTemplateModal(true);
  }

  // Update rundown template in Firebase (Phase 7: Task 61)
  async function handleUpdateTemplate(templateId, updatedData) {
    try {
      const updates = {
        'metadata/name': updatedData.name,
        'metadata/description': updatedData.description || '',
        'metadata/updatedAt': new Date().toISOString(),
      };
      await update(ref(db, `rundownTemplates/${templateId}`), updates);
      // Update local state
      setTemplates(templates.map(t =>
        t.id === templateId
          ? { ...t, name: updatedData.name, description: updatedData.description }
          : t
      ));
      setShowEditTemplateModal(false);
      setTemplateToEdit(null);
      showToast('Template updated');
    } catch (error) {
      console.error('Error updating template:', error);
      showToast('Error updating template');
    }
  }

  // Import from CSV (Phase 9: Task 73)
  function handleImportCSV() {
    // Create hidden file input and trigger click
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsedData = parseCSV(text);

        if (parsedData.rows.length === 0) {
          showToast('CSV file is empty');
          return;
        }

        // Auto-detect column mappings based on header names
        const autoMapping = autoDetectCSVMapping(parsedData.headers);

        setImportCSVData(parsedData);
        setImportCSVMapping(autoMapping);
        setShowImportCSVModal(true);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        showToast('Error parsing CSV file');
      }
    };
    input.click();
  }

  // Parse CSV text into headers and rows
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    // Parse CSV line handling quoted values
    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const values = parseLine(line);
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });

    return { headers, rows };
  }

  // Auto-detect mapping based on common header names
  function autoDetectCSVMapping(headers) {
    const mapping = {};
    const headerLower = headers.map(h => h.toLowerCase());

    // Field detection patterns
    const patterns = {
      name: ['name', 'segment', 'title', 'description'],
      type: ['type', 'segment type'],
      duration: ['duration', 'duration (s)', 'time', 'length'],
      scene: ['scene', 'obs scene', 'obs'],
      graphic: ['graphic', 'graphics', 'overlay'],
      notes: ['notes', 'note', 'comments', 'comment'],
      autoAdvance: ['auto-advance', 'auto advance', 'autoadvance', 'auto'],
      optional: ['optional', 'backup', 'conditional'],
      locked: ['locked', 'lock'],
      timingMode: ['timing mode', 'timing', 'mode'],
      bufferAfter: ['buffer', 'buffer after', 'pad', 'gap'],
    };

    for (const [field, keywords] of Object.entries(patterns)) {
      const matchIndex = headerLower.findIndex(h =>
        keywords.some(k => h.includes(k))
      );
      if (matchIndex !== -1) {
        mapping[field] = headers[matchIndex];
      }
    }

    return mapping;
  }

  // Handle CSV import confirmation
  function handleConfirmCSVImport(mode) {
    if (!importCSVData || !importCSVMapping.name) {
      showToast('Please map the Name field');
      return;
    }

    const newSegments = importCSVData.rows.map((row, index) => {
      // Parse duration - handle various formats
      let duration = null;
      if (importCSVMapping.duration && row[importCSVMapping.duration]) {
        const durationStr = row[importCSVMapping.duration];
        // Try to parse as number first (seconds)
        const numDuration = parseFloat(durationStr);
        if (!isNaN(numDuration)) {
          duration = Math.round(numDuration);
        } else {
          // Try to parse as M:SS or H:MM:SS
          duration = parseDurationString(durationStr);
        }
      }

      // Parse boolean fields
      const parseBoolean = (value) => {
        if (!value) return false;
        const lower = value.toLowerCase().trim();
        return lower === 'yes' || lower === 'true' || lower === '1' || lower === 'y';
      };

      // Parse timing mode
      let timingMode = 'fixed';
      if (importCSVMapping.timingMode && row[importCSVMapping.timingMode]) {
        const mode = row[importCSVMapping.timingMode].toLowerCase().trim();
        if (mode === 'manual') timingMode = 'manual';
        else if (mode === 'follows-previous' || mode === 'follows previous') timingMode = 'follows-previous';
      }

      // Parse buffer after
      let bufferAfter = 0;
      if (importCSVMapping.bufferAfter && row[importCSVMapping.bufferAfter]) {
        bufferAfter = parseInt(row[importCSVMapping.bufferAfter], 10) || 0;
      }

      return {
        id: `seg-import-${Date.now()}-${index}`,
        name: row[importCSVMapping.name] || `Segment ${index + 1}`,
        type: row[importCSVMapping.type]?.toLowerCase() || 'live',
        duration: duration,
        scene: row[importCSVMapping.scene] || '',
        graphic: row[importCSVMapping.graphic] ? { graphicId: row[importCSVMapping.graphic], params: {} } : null,
        autoAdvance: importCSVMapping.autoAdvance ? parseBoolean(row[importCSVMapping.autoAdvance]) : true,
        optional: importCSVMapping.optional ? parseBoolean(row[importCSVMapping.optional]) : false,
        locked: importCSVMapping.locked ? parseBoolean(row[importCSVMapping.locked]) : false,
        notes: row[importCSVMapping.notes] || '',
        timingMode: timingMode,
        bufferAfter: bufferAfter,
      };
    });

    if (mode === 'replace') {
      setSegments(newSegments);
      showToast(`Imported ${newSegments.length} segments (replaced)`);
    } else {
      setSegments([...segments, ...newSegments]);
      showToast(`Imported ${newSegments.length} segments (appended)`);
    }

    setShowImportCSVModal(false);
    setImportCSVData(null);
    setImportCSVMapping({});
  }

  // Parse duration string like "1:30" or "1:30:00" to seconds
  function parseDurationString(str) {
    if (!str) return null;
    const parts = str.split(':').map(p => parseInt(p.trim(), 10));
    if (parts.some(isNaN)) return null;

    if (parts.length === 2) {
      // M:SS
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // H:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 1) {
      return parts[0];
    }
    return null;
  }

  // Cancel CSV import
  function handleCancelCSVImport() {
    setShowImportCSVModal(false);
    setImportCSVData(null);
    setImportCSVMapping({});
  }

  // Import rundown from JSON backup (Phase 9: Task 74)
  function handleImportJSON() {
    // Create hidden file input and trigger click
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate JSON structure
        const validationErrors = validateJSONImport(data);
        if (validationErrors.length > 0) {
          showToast(`Invalid JSON: ${validationErrors[0]}`);
          return;
        }

        setImportJSONData(data);
        setShowImportJSONModal(true);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        showToast('Error parsing JSON file');
      }
    };
    input.click();
  }

  // Validate JSON import structure (Phase 9: Task 74)
  function validateJSONImport(data) {
    const errors = [];

    if (!data) {
      errors.push('File is empty');
      return errors;
    }

    // Check for required top-level fields
    if (!data.rundown) {
      errors.push('Missing "rundown" section');
      return errors;
    }

    if (!data.rundown.segments || !Array.isArray(data.rundown.segments)) {
      errors.push('Missing or invalid "segments" array');
      return errors;
    }

    if (data.rundown.segments.length === 0) {
      errors.push('No segments found in the file');
      return errors;
    }

    // Check each segment has required fields
    for (let i = 0; i < data.rundown.segments.length; i++) {
      const seg = data.rundown.segments[i];
      if (!seg.name || typeof seg.name !== 'string') {
        errors.push(`Segment ${i + 1} is missing a valid name`);
        break;
      }
    }

    return errors;
  }

  // Confirm JSON import (Phase 9: Task 74)
  function handleConfirmJSONImport(mode, options = {}) {
    if (!importJSONData?.rundown?.segments) {
      showToast('No segments to import');
      return;
    }

    // Process segments from JSON
    const importedSegments = importJSONData.rundown.segments.map((seg, index) => ({
      // Use existing id or generate new one
      id: options.preserveIds && seg.id ? seg.id : `seg-import-${Date.now()}-${index}`,
      name: seg.name || `Segment ${index + 1}`,
      type: seg.type || 'live',
      duration: typeof seg.duration === 'number' ? seg.duration : null,
      scene: seg.scene || '',
      graphic: seg.graphic || null,
      autoAdvance: typeof seg.autoAdvance === 'boolean' ? seg.autoAdvance : true,
      optional: typeof seg.optional === 'boolean' ? seg.optional : false,
      locked: typeof seg.locked === 'boolean' ? seg.locked : false,
      notes: seg.notes || '',
      timingMode: seg.timingMode || 'fixed',
      bufferAfter: typeof seg.bufferAfter === 'number' ? seg.bufferAfter : 0,
    }));

    // Process groups if importing them
    let importedGroups = [];
    if (options.importGroups && importJSONData.rundown.groups) {
      importedGroups = importJSONData.rundown.groups.map((group, index) => ({
        id: options.preserveIds && group.id ? group.id : `group-import-${Date.now()}-${index}`,
        name: group.name || `Group ${index + 1}`,
        segmentIds: group.segmentIds || [],
        color: group.color || 'zinc',
        collapsed: typeof group.collapsed === 'boolean' ? group.collapsed : false,
      }));
    }

    if (mode === 'replace') {
      setSegments(importedSegments);
      if (options.importGroups) {
        setGroups(importedGroups);
      }
      // Optionally restore other settings
      if (options.importSettings) {
        if (importJSONData.rundown.targetDuration) {
          setTargetDuration(importJSONData.rundown.targetDuration);
          setShowTargetDuration(true);
        }
        if (importJSONData.rundown.approvalStatus) {
          setApprovalStatus(importJSONData.rundown.approvalStatus);
        }
      }
      showToast(`Imported ${importedSegments.length} segments (replaced)`);
    } else {
      setSegments([...segments, ...importedSegments]);
      if (options.importGroups && importedGroups.length > 0) {
        setGroups([...groups, ...importedGroups]);
      }
      showToast(`Imported ${importedSegments.length} segments (appended)`);
    }

    setShowImportJSONModal(false);
    setImportJSONData(null);
  }

  // Cancel JSON import (Phase 9: Task 74)
  function handleCancelJSONImport() {
    setShowImportJSONModal(false);
    setImportJSONData(null);
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
    let newSegments;
    if (selectedSegmentId) {
      const index = segments.findIndex(s => s.id === selectedSegmentId);
      newSegments = [...segments];
      newSegments.splice(index + 1, 0, newSegment);
    } else {
      newSegments = [...segments, newSegment];
    }
    syncSegmentsToFirebase(newSegments);

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

  // Open edit modal for segment template (Phase 7: Task 61)
  function handleEditSegmentTemplate(template) {
    setSegmentTemplateToEdit(template);
    setShowEditSegmentTemplateModal(true);
  }

  // Update segment template in Firebase (Phase 7: Task 61)
  async function handleUpdateSegmentTemplate(templateId, updatedData) {
    try {
      const updates = {
        name: updatedData.name,
        description: updatedData.description || '',
        category: updatedData.category || 'general',
        updatedAt: new Date().toISOString(),
      };
      await update(ref(db, `segmentTemplates/${templateId}`), updates);
      // Update local state
      setSegmentTemplates(segmentTemplates.map(t =>
        t.id === templateId
          ? { ...t, ...updates }
          : t
      ));
      setShowEditSegmentTemplateModal(false);
      setSegmentTemplateToEdit(null);
      showToast('Segment template updated');
    } catch (error) {
      console.error('Error updating segment template:', error);
      showToast('Error updating segment template');
    }
  }

  // Create repeated segments with recurrence pattern (Phase 7: Task 62)
  function handleCreateRecurringSegments(namePattern, count, type, duration, scene) {
    if (!namePattern.trim() || count < 1) return;

    const baseTimestamp = Date.now();
    const newSegments = [];

    for (let i = 1; i <= count; i++) {
      // Replace {n} or {N} with the current number in the name pattern
      const segmentName = namePattern.replace(/\{[nN]\}/g, String(i));

      const newSegment = {
        id: `seg-${baseTimestamp}-${i}`,
        name: segmentName,
        type: type || 'live',
        duration: duration || null,
        scene: scene || '',
        graphic: null,
        autoAdvance: duration ? true : false,
        bufferAfter: 0,
        locked: false,
        optional: false,
        notes: '',
        timingMode: duration ? 'fixed' : 'manual',
      };

      newSegments.push(newSegment);
    }

    // Insert after selected segment, or at end
    let finalSegments;
    if (selectedSegmentId) {
      const index = segments.findIndex(s => s.id === selectedSegmentId);
      finalSegments = [...segments];
      finalSegments.splice(index + 1, 0, ...newSegments);
    } else {
      finalSegments = [...segments, ...newSegments];
    }
    syncSegmentsToFirebase(finalSegments, 'Create recurring segments', {
      pattern: namePattern,
      count,
      segmentNames: newSegments.map(s => s.name).slice(0, 3),
    });

    // Select the first new segment
    setSelectedSegmentId(newSegments[0].id);
    setShowRecurrenceModal(false);
    showToast(`Created ${count} segment(s)`);
  }

  // Group management functions (Phase 4: Tasks 7.4, 7.5)

  // Create a new group from selected segments
  function handleCreateGroup(groupName, colorId) {
    if (!checkPermission('edit')) return;
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
    const segmentCount = selectedSegmentIds.length;
    const newSegments = segments.map(seg =>
      selectedSegmentIds.includes(seg.id) ? { ...seg, groupId: newGroupId } : seg
    );
    syncSegmentsToFirebase(newSegments, 'Create group', {
      groupName,
      segmentCount,
    });

    const newGroups = [...groups, newGroup];
    syncGroupsToFirebase(newGroups);
    setSelectedSegmentIds([]);
    setShowCreateGroupModal(false);
    showToast(`Created group "${groupName}" with ${segmentCount} segment(s)`);
  }

  // Toggle group collapse state - no history needed (UI preference)
  function handleToggleGroupCollapse(groupId) {
    const newGroups = groups.map(g =>
      g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
    );
    syncGroupsToFirebase(newGroups);
  }

  // Remove a group (ungroups the segments, doesn't delete them)
  function handleUngroupSegments(groupId) {
    if (!checkPermission('edit')) return;
    const group = groups.find(g => g.id === groupId);
    const segmentCount = segments.filter(s => s.groupId === groupId).length;
    const newSegments = segments.map(seg =>
      seg.groupId === groupId ? { ...seg, groupId: null } : seg
    );
    syncSegmentsToFirebase(newSegments, 'Remove group', {
      groupName: group?.name || 'Unknown',
      segmentCount,
    });
    const newGroups = groups.filter(g => g.id !== groupId);
    syncGroupsToFirebase(newGroups);
    showToast('Group removed');
  }

  // Rename a group
  function handleRenameGroup(groupId, newName) {
    if (!checkPermission('edit')) return;
    const group = groups.find(g => g.id === groupId);
    const oldName = group?.name || 'Unknown';
    const newGroups = groups.map(g =>
      g.id === groupId ? { ...g, name: newName } : g
    );
    syncGroupsToFirebase(newGroups, 'Rename group', {
      oldName,
      newName,
    });
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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">RUNDOWN EDITOR</h1>
                {/* Sync indicator (Phase 8: Task 63) */}
                {isSyncing && (
                  <ArrowPathIcon className="w-4 h-4 text-blue-400 animate-spin" title="Syncing..." />
                )}
                {/* Presence indicators with roles (Phase 8: Task 64 & 66) */}
                {presenceList.length > 0 && (
                  <div className="flex items-center gap-1 ml-2">
                    <div className="flex -space-x-2">
                      {presenceList.slice(0, 5).map((user) => {
                        const userRole = getRoleById(user.role || 'viewer');
                        const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS.viewer;
                        return (
                          <div
                            key={user.sessionId}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white border-2 border-zinc-900 ${user.color} ${
                              user.sessionId === mySessionId ? `ring-2 ${roleColor}` : ''
                            }`}
                            title={`${user.displayName}${user.sessionId === mySessionId ? ' (you)' : ''} - ${userRole.label}`}
                          >
                            {user.displayName.slice(-2)}
                          </div>
                        );
                      })}
                      {presenceList.length > 5 && (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-zinc-300 bg-zinc-700 border-2 border-zinc-900"
                          title={`${presenceList.length - 5} more users`}
                        >
                          +{presenceList.length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500 ml-1">
                      {presenceList.length === 1 ? '1 viewer' : `${presenceList.length} viewers`}
                    </span>
                  </div>
                )}
                {/* Role Selector (Phase 8: Task 66) */}
                <div className="relative ml-2 role-selector-dropdown">
                  <button
                    onClick={() => setShowRoleSelector(!showRoleSelector)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      myRole === 'owner' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                      myRole === 'producer' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                      myRole === 'editor' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                      'bg-zinc-700/50 text-zinc-400 border-zinc-600'
                    }`}
                    title={`Your role: ${currentRole.label} - ${currentRole.description}`}
                  >
                    <UserIcon className="w-3 h-3" />
                    <span>{currentRole.label}</span>
                    <ChevronDownIcon className="w-3 h-3" />
                  </button>
                  {showRoleSelector && (
                    <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[180px]">
                      <div className="p-1">
                        {USER_ROLES.map(role => (
                          <button
                            key={role.id}
                            onClick={() => {
                              setMyRole(role.id);
                              setShowRoleSelector(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between hover:bg-zinc-700 transition-colors ${
                              myRole === role.id ? 'bg-zinc-700' : ''
                            }`}
                          >
                            <div>
                              <div className={`font-medium ${
                                role.id === 'owner' ? 'text-amber-300' :
                                role.id === 'producer' ? 'text-purple-300' :
                                role.id === 'editor' ? 'text-blue-300' :
                                'text-zinc-400'
                              }`}>{role.label}</div>
                              <div className="text-xs text-zinc-500">{role.description}</div>
                            </div>
                            {myRole === role.id && (
                              <CheckIcon className="w-4 h-4 text-green-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Approval Status Indicator with Actions (Phase 8: Task 69) */}
                <div className="relative ml-2 approval-menu-dropdown">
                  <button
                    onClick={() => setShowApprovalMenu(!showApprovalMenu)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors ${currentApprovalStatus.color}`}
                    title={`Status: ${currentApprovalStatus.label} - ${currentApprovalStatus.description}`}
                  >
                    {currentApprovalStatus.icon === 'pencil' && (
                      <PencilIcon className="w-3 h-3" />
                    )}
                    {currentApprovalStatus.icon === 'clock' && (
                      <ClockIcon className="w-3 h-3" />
                    )}
                    {currentApprovalStatus.icon === 'check' && (
                      <ShieldCheckIcon className="w-3 h-3" />
                    )}
                    {currentApprovalStatus.icon === 'lock' && (
                      <LockClosedIcon className="w-3 h-3" />
                    )}
                    <span>{currentApprovalStatus.label}</span>
                    <ChevronDownIcon className="w-3 h-3" />
                  </button>
                  {showApprovalMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[200px]">
                      <div className="p-2 border-b border-zinc-700">
                        <div className="text-xs text-zinc-500">Current Status</div>
                        <div className={`text-sm font-medium mt-0.5 ${
                          approvalStatus === 'draft' ? 'text-zinc-300' :
                          approvalStatus === 'in-review' ? 'text-amber-300' :
                          approvalStatus === 'approved' ? 'text-green-300' :
                          'text-red-300'
                        }`}>
                          {currentApprovalStatus.label}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">{currentApprovalStatus.description}</div>
                      </div>
                      <div className="p-1">
                        {/* Draft actions */}
                        {approvalStatus === 'draft' && (
                          <button
                            onClick={handleSubmitForReview}
                            disabled={!canEdit}
                            className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ClockIcon className="w-4 h-4 text-amber-400" />
                            <span>Submit for Review</span>
                          </button>
                        )}
                        {/* In Review actions */}
                        {approvalStatus === 'in-review' && (
                          <>
                            {canApprove && (
                              <>
                                <button
                                  onClick={handleApprove}
                                  className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                                >
                                  <CheckIcon className="w-4 h-4 text-green-400" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={handleOpenRejectModal}
                                  className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                                >
                                  <XMarkIcon className="w-4 h-4 text-red-400" />
                                  <span>Reject...</span>
                                </button>
                              </>
                            )}
                            {canApprove && (
                              <button
                                onClick={handleReturnToDraft}
                                className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                              >
                                <PencilIcon className="w-4 h-4 text-zinc-400" />
                                <span>Return to Draft</span>
                              </button>
                            )}
                          </>
                        )}
                        {/* Approved actions */}
                        {approvalStatus === 'approved' && (
                          <>
                            {canLock && (
                              <button
                                onClick={handleLockRundown}
                                className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                              >
                                <LockClosedIcon className="w-4 h-4 text-red-400" />
                                <span>Lock Rundown</span>
                              </button>
                            )}
                            {canApprove && (
                              <button
                                onClick={handleReturnToDraft}
                                className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                              >
                                <PencilIcon className="w-4 h-4 text-zinc-400" />
                                <span>Return to Draft</span>
                              </button>
                            )}
                          </>
                        )}
                        {/* Locked actions */}
                        {approvalStatus === 'locked' && myRole === 'owner' && (
                          <button
                            onClick={handleUnlockRundown}
                            className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                          >
                            <LockOpenIcon className="w-4 h-4 text-amber-400" />
                            <span>Unlock Rundown</span>
                          </button>
                        )}
                        {/* No actions available message */}
                        {approvalStatus === 'locked' && myRole !== 'owner' && (
                          <div className="px-3 py-2 text-xs text-zinc-500">
                            Only owners can unlock
                          </div>
                        )}
                        {approvalStatus === 'in-review' && !canApprove && (
                          <div className="px-3 py-2 text-xs text-zinc-500">
                            Waiting for approval...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
            {/* History button (Phase 8: Task 67) */}
            <button
              onClick={handleOpenHistory}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
              title="View change history"
            >
              <DocumentTextIcon className="w-4 h-4" />
              History
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <PrinterIcon className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <TableCellsIcon className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export JSON
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
                  <div className="border-t border-zinc-700 my-1" />
                  <button
                    onClick={() => {
                      setShowRecurrenceModal(true);
                      setShowAddSegmentMenu(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                  >
                    <ArrowPathRoundedSquareIcon className="w-4 h-4" />
                    Repeat Segment...
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
              onClick={handleImportJSON}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Import JSON
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
            {/* View Toggle (Phase 10: Task 75) */}
            <div className="flex items-center border border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700'
                }`}
                title="List View"
              >
                <Bars4Icon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-2 text-sm transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700'
                }`}
                title="Timeline View"
              >
                <ChartBarIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Segment List / Timeline (left panel ~60%) */}
        <div className="w-3/5 border-r border-zinc-800 overflow-y-auto">
          {viewMode === 'timeline' ? (
            // Timeline View (Phase 10: Task 75)
            <TimelineView
              segments={filteredSegments}
              segmentStartTimes={segmentStartTimes}
              totalRuntime={totalRuntime}
              selectedSegmentId={selectedSegmentId}
              selectedSegmentIds={selectedSegmentIds}
              onSelectSegment={handleSelectSegment}
              isLoading={isLoadingRundown}
              searchQuery={searchQuery}
              filterType={filterType}
              zoom={timelineZoom}
              onZoomChange={setTimelineZoom}
            />
          ) : (
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
            {isLoadingRundown ? (
              <div className="text-center py-12 text-zinc-500">
                <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
                <div>Loading rundown...</div>
              </div>
            ) : filteredSegments.length === 0 ? (
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
                                  otherUsersSelections={otherUsersSelections}
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
                        otherUsersSelections={otherUsersSelections}
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
          )}
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
          onEdit={handleEditTemplate}
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
          onEdit={handleEditSegmentTemplate}
          onCancel={() => setShowSegmentTemplateLibrary(false)}
        />
      )}

      {/* Edit Rundown Template Modal (Phase 7: Task 61) */}
      {showEditTemplateModal && templateToEdit && (
        <EditTemplateModal
          template={templateToEdit}
          onSave={handleUpdateTemplate}
          onCancel={() => {
            setShowEditTemplateModal(false);
            setTemplateToEdit(null);
          }}
        />
      )}

      {/* Edit Segment Template Modal (Phase 7: Task 61) */}
      {showEditSegmentTemplateModal && segmentTemplateToEdit && (
        <EditSegmentTemplateModal
          template={segmentTemplateToEdit}
          onSave={handleUpdateSegmentTemplate}
          onCancel={() => {
            setShowEditSegmentTemplateModal(false);
            setSegmentTemplateToEdit(null);
          }}
        />
      )}

      {/* Recurrence Pattern Modal (Phase 7: Task 62) */}
      {showRecurrenceModal && (
        <RecurrencePatternModal
          onCreate={handleCreateRecurringSegments}
          onCancel={() => setShowRecurrenceModal(false)}
        />
      )}

      {/* Change History Modal (Phase 8: Task 67) */}
      {showHistoryModal && (
        <ChangeHistoryModal
          history={changeHistory}
          loading={loadingHistory}
          onRefresh={loadChangeHistory}
          onCancel={() => setShowHistoryModal(false)}
          onRestore={handleInitiateRestore}
          canRestore={checkPermission('edit')}
        />
      )}

      {/* Restore Confirm Modal (Phase 8: Task 68) */}
      {showRestoreConfirmModal && (
        <RestoreConfirmModal
          entry={entryToRestore}
          onConfirm={handleConfirmRestore}
          onCancel={handleCancelRestore}
        />
      )}

      {/* Reject Reason Modal (Phase 8: Task 69) */}
      {showRejectModal && (
        <RejectReasonModal
          reason={rejectReason}
          setReason={setRejectReason}
          onConfirm={handleConfirmReject}
          onCancel={handleCancelReject}
        />
      )}

      {/* Import CSV Modal (Phase 9: Task 73) */}
      {showImportCSVModal && importCSVData && (
        <ImportCSVModal
          data={importCSVData}
          mapping={importCSVMapping}
          setMapping={setImportCSVMapping}
          onConfirm={handleConfirmCSVImport}
          onCancel={handleCancelCSVImport}
        />
      )}

      {/* Import JSON Modal (Phase 9: Task 74) */}
      {showImportJSONModal && importJSONData && (
        <ImportJSONModal
          data={importJSONData}
          onConfirm={handleConfirmJSONImport}
          onCancel={handleCancelJSONImport}
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
  otherUsersSelections,
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

  // Get other users who have this segment selected (Phase 8: Task 65)
  const otherUsersHere = otherUsersSelections?.[segment.id] || [];

  return (
    <div
      id={`segment-${segment.id}`}
      draggable={!isLocked}
      onDragStart={(e) => isLocked ? e.preventDefault() : onDragStart(e, segment.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, originalIndex)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, originalIndex)}
      className={`p-3 rounded-lg border-l-2 border transition-all ${
        isLocked
          ? 'bg-zinc-900/50 border-zinc-700/50 border-l-zinc-600 opacity-75'
          : isDraggedOver
            ? 'border-t-2 border-t-blue-500 border-blue-500/50 border-l-blue-500 bg-blue-600/10'
            : isSelected
              ? `border-blue-500 ${TYPE_ROW_COLORS[segment.type]?.border || 'border-l-blue-500'} ${TYPE_ROW_COLORS[segment.type]?.bg || ''} bg-blend-overlay bg-blue-600/20`
              : isMultiSelected
                ? `border-blue-500/50 ${TYPE_ROW_COLORS[segment.type]?.border || 'border-l-blue-500/50'} ${TYPE_ROW_COLORS[segment.type]?.bg || 'bg-zinc-800'}`
                : isDragging
                  ? `border-zinc-600 ${TYPE_ROW_COLORS[segment.type]?.border || 'border-l-zinc-600'} bg-zinc-800 opacity-50`
                  : otherUsersHere.length > 0
                    ? `${TYPE_ROW_COLORS[segment.type]?.bg || 'bg-zinc-900'} border-l-2 ${otherUsersHere[0].color.replace('bg-', 'border-')} border-t-zinc-800 border-r-zinc-800 border-b-zinc-800`
                    : inGroup
                      ? `${TYPE_ROW_COLORS[segment.type]?.bg || 'bg-zinc-900/50'} ${TYPE_ROW_COLORS[segment.type]?.border || 'border-l-zinc-800/50'} border-zinc-800/50 hover:border-zinc-700`
                      : `${TYPE_ROW_COLORS[segment.type]?.bg || 'bg-zinc-900'} ${TYPE_ROW_COLORS[segment.type]?.border || 'border-l-zinc-800'} border-zinc-800 hover:border-zinc-700`
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
            {/* Other users' selection indicator (Phase 8: Task 65) */}
            {otherUsersHere.length > 0 && (
              <div
                className="inline-flex items-center gap-0.5 ml-auto shrink-0"
                title={`Selected by: ${otherUsersHere.map(u => u.displayName).join(', ')}`}
              >
                {otherUsersHere.slice(0, 3).map((user) => (
                  <div
                    key={user.sessionId}
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium text-white ${user.color} ring-1 ring-zinc-900`}
                  >
                    {user.displayName.slice(-2)}
                  </div>
                ))}
                {otherUsersHere.length > 3 && (
                  <span className="text-[10px] text-zinc-400 ml-0.5">
                    +{otherUsersHere.length - 3}
                  </span>
                )}
              </div>
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

// Timeline View Component (Phase 10: Task 75)
// Gantt-style horizontal timeline showing segment durations proportionally
function TimelineView({
  segments,
  segmentStartTimes,
  totalRuntime,
  selectedSegmentId,
  selectedSegmentIds,
  onSelectSegment,
  isLoading,
  searchQuery,
  filterType,
  zoom,
  onZoomChange,
}) {
  // Timeline bar colors by segment type
  const TIMELINE_COLORS = {
    video: 'bg-purple-500 hover:bg-purple-400',
    live: 'bg-green-500 hover:bg-green-400',
    static: 'bg-blue-500 hover:bg-blue-400',
    break: 'bg-yellow-500 hover:bg-yellow-400',
    hold: 'bg-orange-500 hover:bg-orange-400',
    graphic: 'bg-pink-500 hover:bg-pink-400',
  };

  // Calculate the width percentage for a segment based on its duration
  const getBarWidth = (duration) => {
    if (!totalRuntime || !duration) return 0;
    return (duration / totalRuntime) * 100;
  };

  // Calculate the left position percentage for a segment
  const getBarLeft = (segmentId) => {
    if (!totalRuntime) return 0;
    const startTime = segmentStartTimes[segmentId] || 0;
    return (startTime / totalRuntime) * 100;
  };

  // Time markers for the timeline header
  const timeMarkers = useMemo(() => {
    if (!totalRuntime) return [];
    const markers = [];
    // Create markers at regular intervals
    const interval = totalRuntime > 3600 ? 600 : totalRuntime > 600 ? 120 : 30; // 10min, 2min, or 30sec intervals
    for (let t = 0; t <= totalRuntime; t += interval) {
      markers.push({
        time: t,
        position: (t / totalRuntime) * 100,
      });
    }
    return markers;
  }, [totalRuntime]);

  // Format time for markers
  const formatTimeMarker = (seconds) => {
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}:${m.toString().padStart(2, '0')}`;
    } else {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="text-center py-12 text-zinc-500">
          <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
          <div>Loading rundown...</div>
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-12 text-zinc-500">
          {searchQuery || filterType !== 'all'
            ? 'No segments match your filter'
            : 'No segments yet. Click "Add Segment" to get started.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Timeline Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">
          Timeline ({segments.length} segments)
        </div>
        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Zoom:</span>
          <input
            type="range"
            min="50"
            max="200"
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs text-zinc-400 w-8">{zoom}%</span>
        </div>
      </div>

      {/* Time Scale Header */}
      <div className="relative h-6 mb-2 border-b border-zinc-700">
        {timeMarkers.map((marker) => (
          <div
            key={marker.time}
            className="absolute text-[10px] text-zinc-500 transform -translate-x-1/2"
            style={{ left: `${marker.position}%` }}
          >
            {formatTimeMarker(marker.time)}
          </div>
        ))}
      </div>

      {/* Timeline Container */}
      <div
        className="relative overflow-x-auto"
        style={{ minWidth: `${zoom}%` }}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          {timeMarkers.map((marker) => (
            <div
              key={marker.time}
              className="absolute top-0 bottom-0 w-px bg-zinc-800"
              style={{ left: `${marker.position}%` }}
            />
          ))}
        </div>

        {/* Segment Bars */}
        <div className="space-y-1">
          {segments.map((segment, index) => {
            const isSelected = selectedSegmentId === segment.id;
            const isMultiSelected = selectedSegmentIds.includes(segment.id);
            const barWidth = getBarWidth(segment.duration || 30); // Default 30s for null duration
            const barLeft = getBarLeft(segment.id);
            const typeColor = TIMELINE_COLORS[segment.type] || 'bg-zinc-500 hover:bg-zinc-400';

            return (
              <div
                key={segment.id}
                className="relative h-8 flex items-center"
              >
                {/* Segment Number Label */}
                <div className="absolute left-0 w-8 text-xs text-zinc-500 font-mono">
                  {String(index + 1).padStart(2, '0')}
                </div>

                {/* Bar Container */}
                <div className="ml-10 flex-1 relative h-6">
                  {/* Segment Bar */}
                  <button
                    onClick={() => onSelectSegment(segment.id)}
                    className={`absolute h-full rounded transition-all cursor-pointer flex items-center ${typeColor} ${
                      isSelected || isMultiSelected
                        ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-zinc-950'
                        : ''
                    } ${segment.optional ? 'opacity-60' : ''} ${
                      segment.locked ? 'opacity-80' : ''
                    }`}
                    style={{
                      left: `${barLeft}%`,
                      width: `${Math.max(barWidth, 1)}%`, // Minimum 1% width for visibility
                      minWidth: '20px', // Minimum pixel width for very short segments
                    }}
                    title={`${segment.name} (${formatDuration(segment.duration || 0)})`}
                  >
                    {/* Segment Name (truncated) */}
                    <span className="px-2 text-xs text-white truncate font-medium">
                      {segment.name}
                    </span>

                    {/* Lock indicator */}
                    {segment.locked && (
                      <LockClosedIcon className="w-3 h-3 text-white/70 mr-1 flex-shrink-0" />
                    )}
                  </button>

                  {/* Buffer visualization */}
                  {segment.bufferAfter > 0 && (
                    <div
                      className="absolute h-full bg-zinc-700/50 border-l border-dashed border-zinc-600"
                      style={{
                        left: `${barLeft + barWidth}%`,
                        width: `${getBarWidth(segment.bufferAfter)}%`,
                      }}
                      title={`Buffer: ${formatDuration(segment.bufferAfter)}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-500 mb-2">Legend:</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(TIMELINE_COLORS).map(([type, colorClass]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${colorClass.split(' ')[0]}`} />
              <span className="text-xs text-zinc-400 capitalize">{type}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-zinc-700/50 border border-dashed border-zinc-600 rounded" />
            <span className="text-xs text-zinc-400">Buffer</span>
          </div>
        </div>
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
function TemplateLibraryModal({ templates, loading, onLoad, onDelete, onEdit, onCancel, isCompatible }) {
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
                          onClick={() => onEdit(template)}
                          className="p-1.5 text-zinc-500 hover:text-blue-400 rounded-lg hover:bg-zinc-700 transition-colors"
                          title="Edit template"
                        >
                          <PencilIcon className="w-4 h-4" />
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
function SegmentTemplateLibraryModal({ templates, loading, onAdd, onDelete, onEdit, onCancel }) {
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
                          onEdit={onEdit}
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
                      onEdit={onEdit}
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
function SegmentTemplateCard({ template, onAdd, onDelete, onEdit }) {
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
            onClick={() => onEdit(template)}
            className="p-1.5 text-zinc-500 hover:text-blue-400 rounded-lg hover:bg-zinc-700 transition-colors"
            title="Edit template"
          >
            <PencilIcon className="w-4 h-4" />
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

// Edit Rundown Template Modal Component (Phase 7: Task 61)
function EditTemplateModal({ template, onSave, onCancel }) {
  const [templateName, setTemplateName] = useState(template.name || '');
  const [templateDescription, setTemplateDescription] = useState(template.description || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!templateName.trim()) return;

    setSaving(true);
    await onSave(template.id, {
      name: templateName.trim(),
      description: templateDescription.trim(),
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Edit Template</h2>
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
            <div className="text-xs text-zinc-400 mb-2">Template info:</div>
            <div className="flex items-center gap-4 text-sm text-zinc-300">
              <span>{template.teamCount || '?'} teams</span>
              <span className="text-zinc-600">•</span>
              <span>{formatDuration(template.estimatedDuration)} total</span>
            </div>
            {template.competitionTypes && (
              <div className="text-xs text-zinc-500 mt-2">
                Compatible with: {template.competitionTypes.join(', ')}
              </div>
            )}
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
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Segment Template Modal Component (Phase 7: Task 61)
function EditSegmentTemplateModal({ template, onSave, onCancel }) {
  const [templateName, setTemplateName] = useState(template.name || '');
  const [templateDescription, setTemplateDescription] = useState(template.description || '');
  const [categoryTag, setCategoryTag] = useState(template.category || 'general');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!templateName.trim()) return;

    setSaving(true);
    await onSave(template.id, {
      name: templateName.trim(),
      description: templateDescription.trim(),
      category: categoryTag,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Edit Segment Template</h2>
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
              <div className="text-zinc-300">{template.segment?.type || 'unknown'}</div>
              <div className="text-zinc-500">Duration:</div>
              <div className="text-zinc-300">{template.segment?.duration ? `${template.segment.duration}s` : 'Manual'}</div>
              {template.segment?.scene && (
                <>
                  <div className="text-zinc-500">Scene:</div>
                  <div className="text-zinc-300 truncate">{template.segment.scene}</div>
                </>
              )}
              {template.segment?.graphic?.graphicId && (
                <>
                  <div className="text-zinc-500">Graphic:</div>
                  <div className="text-zinc-300 truncate">{template.segment.graphic.graphicId}</div>
                </>
              )}
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
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Recurrence Pattern Modal Component (Phase 7: Task 62)
function RecurrencePatternModal({ onCreate, onCancel }) {
  const [namePattern, setNamePattern] = useState('Rotation {n}');
  const [count, setCount] = useState(6);
  const [segmentType, setSegmentType] = useState('live');
  const [duration, setDuration] = useState('');

  // Generate preview of segment names
  const preview = useMemo(() => {
    const names = [];
    for (let i = 1; i <= Math.min(count, 8); i++) {
      names.push(namePattern.replace(/\{[nN]\}/g, String(i)));
    }
    if (count > 8) {
      names.push('...');
    }
    return names;
  }, [namePattern, count]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!namePattern.trim() || count < 1) return;

    const parsedDuration = duration ? parseInt(duration, 10) || null : null;
    onCreate(namePattern.trim(), count, segmentType, parsedDuration, '');
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Create Repeated Segments</h2>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Name Pattern *</label>
            <input
              type="text"
              value={namePattern}
              onChange={(e) => setNamePattern(e.target.value)}
              placeholder="e.g., Rotation {n}"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="text-xs text-zinc-500 mt-1">
              Use <code className="px-1 bg-zinc-800 rounded">{'{n}'}</code> for the segment number
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Number of Segments *</label>
              <input
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={(e) => setCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Duration (seconds)</label>
              <input
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Manual"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Segment Type</label>
            <select
              value={segmentType}
              onChange={(e) => setSegmentType(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="live">Live</option>
              <option value="static">Static</option>
              <option value="video">Video</option>
              <option value="break">Break</option>
              <option value="hold">Hold</option>
              <option value="graphic">Graphic</option>
            </select>
          </div>

          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="text-xs text-zinc-400 mb-2">Preview ({count} segments):</div>
            <div className="flex flex-wrap gap-1.5">
              {preview.map((name, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-zinc-700 text-zinc-300 rounded"
                >
                  {name}
                </span>
              ))}
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
              disabled={!namePattern.trim() || count < 1}
              className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create {count} Segment{count !== 1 ? 's' : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Change History Modal (Phase 8: Task 67)
// Displays a log of all changes made to the rundown
// Updated (Phase 8: Task 68) - Added onRestore callback and restore button for rollback
function ChangeHistoryModal({ history, loading, onRefresh, onCancel, onRestore, canRestore }) {
  // Format timestamp to readable date/time
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Show relative time for recent changes
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Show date for older changes
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // Get icon and color for action type
  function getActionStyle(action) {
    if (action.includes('Delete') || action.includes('Remove')) {
      return { color: 'text-red-400', bgColor: 'bg-red-500/10' };
    }
    if (action.includes('Add') || action.includes('Create') || action.includes('Duplicate')) {
      return { color: 'text-green-400', bgColor: 'bg-green-500/10' };
    }
    if (action.includes('Lock')) {
      return { color: 'text-amber-400', bgColor: 'bg-amber-500/10' };
    }
    if (action.includes('Unlock')) {
      return { color: 'text-blue-400', bgColor: 'bg-blue-500/10' };
    }
    return { color: 'text-zinc-400', bgColor: 'bg-zinc-500/10' };
  }

  // Format details object into readable strings
  function formatDetails(details) {
    if (!details) return null;
    const items = [];

    if (details.segmentName) items.push(details.segmentName);
    if (details.segmentCount) items.push(`${details.segmentCount} segment(s)`);
    if (details.groupName) items.push(`"${details.groupName}"`);
    if (details.newType) items.push(`type: ${details.newType}`);
    if (details.newScene) items.push(`scene: ${details.newScene}`);
    if (details.graphicId) items.push(`graphic: ${details.graphicId}`);
    if (details.fromPosition && details.toPosition) {
      items.push(`#${details.fromPosition} → #${details.toPosition}`);
    }
    if (details.changes && details.changes.length > 0 && details.changes[0] !== 'No changes') {
      items.push(...details.changes.slice(0, 2)); // Show first 2 changes
      if (details.changes.length > 2) items.push(`+${details.changes.length - 2} more`);
    }
    if (details.segmentNames && details.segmentNames.length > 0) {
      items.push(details.segmentNames.slice(0, 2).join(', '));
      if (details.segmentNames.length > 2) items.push(`+${details.segmentNames.length - 2} more`);
    }

    return items.length > 0 ? items : null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Change History</h2>
            <button
              onClick={onRefresh}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
              title="Refresh history"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
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
              <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <DocumentTextIcon className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <div className="text-zinc-500 mb-1">No changes recorded yet</div>
              <div className="text-xs text-zinc-600">
                Changes to segments will appear here.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => {
                const style = getActionStyle(entry.action);
                const details = formatDetails(entry.details);
                return (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-lg border border-zinc-800 ${style.bgColor} transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${style.color}`}>
                          {entry.action}
                        </div>
                        {details && (
                          <div className="text-xs text-zinc-400 mt-0.5 truncate">
                            {details.join(' • ')}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-zinc-500">
                          {formatTimestamp(entry.timestamp)}
                        </div>
                        <div className="text-xs text-zinc-600 mt-0.5">
                          {entry.user?.displayName || 'Unknown'}
                          <span className="ml-1 text-zinc-700">({entry.user?.role || 'viewer'})</span>
                        </div>
                        {/* Restore button - only shown if entry has snapshot (Phase 8: Task 68) */}
                        {entry.snapshot && canRestore && (
                          <button
                            onClick={() => onRestore(entry)}
                            className="mt-1.5 px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors border border-blue-500/30"
                            title="Restore to state before this change"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              {history.length > 0 ? `${history.length} change${history.length !== 1 ? 's' : ''} shown` : ''}
            </div>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Restore Confirm Modal (Phase 8: Task 68)
// Confirmation dialog before restoring to a previous version
function RestoreConfirmModal({ entry, onConfirm, onCancel }) {
  if (!entry) return null;

  // Format timestamp for display
  const restoreDate = new Date(entry.timestamp);
  const formattedDate = restoreDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Count segments/groups in snapshot
  const segmentCount = entry.snapshot?.segments?.length || 0;
  const groupCount = entry.snapshot?.groups?.length || 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Restore to Previous Version?</h2>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-zinc-300 text-sm">
            This will restore the rundown to the state <strong>before</strong> the following change was made:
          </p>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
            <div className="font-medium text-amber-400 text-sm">{entry.action}</div>
            <div className="text-xs text-zinc-500 mt-1">
              {formattedDate} by {entry.user?.displayName || 'Unknown'}
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="text-blue-400 text-sm font-medium mb-1">Snapshot contents:</div>
            <div className="text-xs text-zinc-400">
              {segmentCount} segment{segmentCount !== 1 ? 's' : ''}
              {groupCount > 0 && `, ${groupCount} group${groupCount !== 1 ? 's' : ''}`}
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="text-red-400 text-sm">
              Warning: This will overwrite all current segments and groups. This action cannot be undone.
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
          >
            Restore Version
          </button>
        </div>
      </div>
    </div>
  );
}

// Reject Reason Modal (Phase 8: Task 69)
// Modal for entering rejection reason when rejecting a rundown
function RejectReasonModal({ reason, setReason, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Reject Rundown</h2>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-zinc-300 text-sm">
            Please provide a reason for rejecting this rundown. This will be logged in the change history.
          </p>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Rejection Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 resize-none"
              autoFocus
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="text-amber-400 text-sm">
              The rundown will be returned to draft status and can be edited again.
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim()}
            className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// Import CSV Modal Component (Phase 9: Task 73)
function ImportCSVModal({ data, mapping, setMapping, onConfirm, onCancel }) {
  const [importMode, setImportMode] = useState('append'); // 'append' or 'replace'
  const [validationErrors, setValidationErrors] = useState([]);

  // Available fields that can be mapped
  const mappableFields = [
    { id: 'name', label: 'Name', required: true },
    { id: 'type', label: 'Type', required: false },
    { id: 'duration', label: 'Duration', required: false },
    { id: 'scene', label: 'OBS Scene', required: false },
    { id: 'graphic', label: 'Graphic', required: false },
    { id: 'notes', label: 'Notes', required: false },
    { id: 'autoAdvance', label: 'Auto-Advance', required: false },
    { id: 'optional', label: 'Optional', required: false },
    { id: 'locked', label: 'Locked', required: false },
    { id: 'timingMode', label: 'Timing Mode', required: false },
    { id: 'bufferAfter', label: 'Buffer After', required: false },
  ];

  // Validate current mapping
  useEffect(() => {
    const errors = [];
    if (!mapping.name) {
      errors.push('Name field is required');
    }
    setValidationErrors(errors);
  }, [mapping]);

  // Handle mapping change
  function handleMappingChange(fieldId, csvColumn) {
    setMapping(prev => ({
      ...prev,
      [fieldId]: csvColumn || undefined,
    }));
  }

  // Get preview of first 3 rows with current mapping
  const previewRows = data.rows.slice(0, 5);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-white">Import CSV</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{data.rows.length} rows found</p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {/* Field Mapping Section */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Map CSV Columns to Fields</h3>
            <div className="grid grid-cols-2 gap-3">
              {mappableFields.map(field => (
                <div key={field.id} className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400 w-28 flex-shrink-0">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <select
                    value={mapping[field.id] || ''}
                    onChange={(e) => handleMappingChange(field.id, e.target.value)}
                    className={`flex-1 px-2 py-1.5 bg-zinc-800 border rounded-lg text-sm focus:outline-none focus:border-blue-500 ${
                      field.required && !mapping[field.id]
                        ? 'border-red-500/50 text-red-300'
                        : 'border-zinc-700 text-white'
                    }`}
                  >
                    <option value="">-- Not Mapped --</option>
                    {data.headers.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Section */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Preview (First 5 Rows)</h3>
            <div className="border border-zinc-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">#</th>
                      {mappableFields.filter(f => mapping[f.id]).map(field => (
                        <th key={field.id} className="px-3 py-2 text-left text-zinc-400 font-medium">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/50">
                        <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                        {mappableFields.filter(f => mapping[f.id]).map(field => (
                          <td key={field.id} className="px-3 py-2 text-zinc-300 max-w-[200px] truncate">
                            {row[mapping[field.id]] || <span className="text-zinc-600">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!mapping.name && (
                <div className="p-4 bg-zinc-800/50 text-center text-zinc-500 text-sm">
                  Map at least the Name field to see preview
                </div>
              )}
            </div>
          </div>

          {/* Import Mode Section */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Import Mode</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={importMode === 'append'}
                  onChange={(e) => setImportMode(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 focus:ring-blue-500"
                />
                <span className="text-zinc-300 text-sm">Append to existing segments</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={(e) => setImportMode(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 focus:ring-blue-500"
                />
                <span className="text-zinc-300 text-sm">Replace all segments</span>
              </label>
            </div>
            {importMode === 'replace' && (
              <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <span className="text-amber-400 text-xs">Warning: This will remove all existing segments</span>
              </div>
            )}
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-red-400 text-sm font-medium mb-1">Please fix the following:</div>
              <ul className="list-disc list-inside text-red-300 text-sm">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(importMode)}
            disabled={validationErrors.length > 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Import {data.rows.length} Segments
          </button>
        </div>
      </div>
    </div>
  );
}

// Import JSON Modal Component (Phase 9: Task 74)
function ImportJSONModal({ data, onConfirm, onCancel }) {
  const [importMode, setImportMode] = useState('replace'); // 'append' or 'replace' (default to replace for backup restore)
  const [importGroups, setImportGroups] = useState(true); // Whether to import groups
  const [importSettings, setImportSettings] = useState(true); // Whether to import settings (targetDuration, approvalStatus)
  const [preserveIds, setPreserveIds] = useState(true); // Whether to preserve segment IDs

  const segments = data?.rundown?.segments || [];
  const groups = data?.rundown?.groups || [];
  const competition = data?.competition || {};

  // Format duration for display
  function formatDurationPreview(seconds) {
    if (!seconds && seconds !== 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-white">Import JSON Backup</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {segments.length} segments{groups.length > 0 && `, ${groups.length} groups`}
              {competition.name && ` from "${competition.name}"`}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {/* File Info Section */}
          {data.version && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-zinc-500">Format Version:</span>
                  <span className="text-zinc-300 ml-2">{data.version}</span>
                </div>
                {data.exportedAt && (
                  <div>
                    <span className="text-zinc-500">Exported:</span>
                    <span className="text-zinc-300 ml-2">
                      {new Date(data.exportedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {competition.type && (
                  <div>
                    <span className="text-zinc-500">Competition Type:</span>
                    <span className="text-zinc-300 ml-2">{competition.type}</span>
                  </div>
                )}
                {data.rundown?.totalRuntime && (
                  <div>
                    <span className="text-zinc-500">Total Runtime:</span>
                    <span className="text-zinc-300 ml-2">
                      {formatDurationPreview(data.rundown.totalRuntime)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview Section */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Segments Preview (First 5)</h3>
            <div className="border border-zinc-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">#</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Name</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Type</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Duration</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Scene</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {segments.slice(0, 5).map((seg, idx) => (
                      <tr key={seg.id || idx} className="hover:bg-zinc-800/50">
                        <td className="px-3 py-2 text-zinc-500">{seg.order || idx + 1}</td>
                        <td className="px-3 py-2 text-zinc-300 max-w-[200px] truncate">{seg.name}</td>
                        <td className="px-3 py-2 text-zinc-400">{seg.type || '-'}</td>
                        <td className="px-3 py-2 text-zinc-400">
                          {seg.duration ? formatDurationPreview(seg.duration) : '-'}
                        </td>
                        <td className="px-3 py-2 text-zinc-400 max-w-[150px] truncate">
                          {seg.scene || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {segments.length > 5 && (
                <div className="p-2 bg-zinc-800/50 text-center text-zinc-500 text-sm">
                  ... and {segments.length - 5} more segments
                </div>
              )}
            </div>
          </div>

          {/* Import Options Section */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Import Options</h3>
            <div className="space-y-3">
              {/* Import Mode */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 focus:ring-blue-500"
                  />
                  <span className="text-zinc-300 text-sm">Replace all segments</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 focus:ring-blue-500"
                  />
                  <span className="text-zinc-300 text-sm">Append to existing segments</span>
                </label>
              </div>
              {importMode === 'replace' && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <span className="text-amber-400 text-xs">Warning: This will remove all existing segments</span>
                </div>
              )}

              {/* Additional Options */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                {groups.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importGroups}
                      onChange={(e) => setImportGroups(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-zinc-300 text-sm">
                      Import groups ({groups.length})
                    </span>
                  </label>
                )}
                {importMode === 'replace' && (data.rundown?.targetDuration || data.rundown?.approvalStatus) && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importSettings}
                      onChange={(e) => setImportSettings(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-zinc-300 text-sm">Import settings</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preserveIds}
                    onChange={(e) => setPreserveIds(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-zinc-300 text-sm">Preserve segment IDs</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(importMode, { importGroups, importSettings, preserveIds })}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Import {segments.length} Segments
          </button>
        </div>
      </div>
    </div>
  );
}
