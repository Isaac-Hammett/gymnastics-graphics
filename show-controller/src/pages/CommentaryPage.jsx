import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompetition } from '../context/CompetitionContext';
import { useCommentaryStaff, getStaffStatusLabel, getStaffStatusColor, getRoleLabel, STAFF_STATUS } from '../hooks/useCommentaryStaff';
import { useTalentRoster, getStatusLabel, getStatusColor, wagMagLabel } from '../hooks/useTalentRoster';
import { useCompetitions } from '../hooks/useCompetitions';
import {
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  PlusIcon,
  UserGroupIcon,
  ChevronRightIcon,
  CheckIcon,
  LinkIcon,
  PaperAirplaneIcon,
  CalendarIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
  NoSymbolIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ViewColumnsIcon,
  ListBulletIcon,
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import KebabMenu from '../components/crm/KebabMenu';
import KanbanBoard from '../components/crm/KanbanBoard';

const STATUS_FLOW = [
  { status: STAFF_STATUS.ASSIGNED, label: 'Assigned', next: STAFF_STATUS.INVITED },
  { status: STAFF_STATUS.INVITED, label: 'Invited', next: STAFF_STATUS.CONFIRMED },
  { status: STAFF_STATUS.CONFIRMED, label: 'Confirmed', next: STAFF_STATUS.BRIEFED },
  { status: STAFF_STATUS.DECLINED, label: 'Declined', next: null },
  { status: STAFF_STATUS.BRIEFED, label: 'Briefed', next: null },
];

const SLOT_ROLES = [
  { role: 'pbp', label: 'Play by Play / Lead', color: 'border-blue-600' },
  { role: 'analyst', label: 'Color / Analyst', color: 'border-purple-600' },
  { role: 'producer', label: 'Producer', color: 'border-teal-600' },
];

/**
 * CommentaryPage - Per-competition commentary talent management.
 * URL: /:compId/commentary
 */
export default function CommentaryPage() {
  const { compId, competitionConfig } = useCompetition();
  const { staffList, loading: staffLoading, assignTalent, updateStatus, updateNotes, removeAssignment } = useCommentaryStaff(compId);
  const { talentList, loading: talentLoading } = useTalentRoster();
  const { competitions, loading: competitionsLoading } = useCompetitions();

  const gender = competitionConfig?.gender || 'womens';
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('crm-commentary-view') || 'list');
  const [search, setSearch] = useState('');
  const [activeRole, setActiveRole] = useState('pbp');
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [talentTab, setTalentTab] = useState('search'); // 'search' or 'available'

  // Outreach modals
  const [briefingModalOpen, setBriefingModalOpen] = useState(null); // talentId when open
  const [briefingForm, setBriefingForm] = useState({ virtiusUrl: '', discordInfo: '', preProdTime: '' });
  const [preProdModalOpen, setPreProdModalOpen] = useState(null); // talentId when open
  const [preProdTime, setPreProdTime] = useState('');
  const [iMessageConfirmOpen, setIMessageConfirmOpen] = useState(null); // { talentId, type, message } when open
  const [sendingOutreach, setSendingOutreach] = useState(false);

  // Filter talent list for the right panel — match gender and status
  const targetWagMag = gender === 'mens' ? 'MAG' : 'WAG';
  const assignedIds = new Set(staffList.map(s => s.talentId));

  // Get this competition's date for same-day conflict checking
  const currentMeetDate = competitionConfig?.meetDate;

  // Build a map of talent IDs to their same-day conflict details
  const sameDayConflictDetails = new Map();
  if (currentMeetDate && competitions) {
    Object.entries(competitions).forEach(([otherCompId, otherComp]) => {
      if (otherCompId === compId) return; // Skip current competition
      if (otherComp?.config?.meetDate !== currentMeetDate) return; // Different date

      // Check commentary assignments for this same-day competition
      const commentary = otherComp.commentary || {};
      Object.entries(commentary).forEach(([talentId, assignment]) => {
        // Include invited, confirmed, and briefed — active commitments
        // Skip 'assigned' (pre-outreach, speculative) and 'declined'
        if (assignment.status === STAFF_STATUS.INVITED ||
            assignment.status === STAFF_STATUS.CONFIRMED ||
            assignment.status === STAFF_STATUS.BRIEFED) {
          const existing = sameDayConflictDetails.get(talentId) || [];
          existing.push({
            compId: otherCompId,
            compName: otherComp?.config?.eventName || otherCompId,
            role: assignment.role,
            status: assignment.status,
          });
          sameDayConflictDetails.set(talentId, existing);
        }
      });
    });
  }
  // Keep a Set for backward-compatible filtering (available tab)
  const sameDayConflicts = new Set(sameDayConflictDetails.keys());

  // Filter logic for "Search" tab
  const searchTalent = talentList.filter(t => {
    // Already assigned to this competition
    if (assignedIds.has(t.id)) return false;
    // Must match gender or be "Both"
    if (t.wagMag && t.wagMag !== 'Both' && t.wagMag !== targetWagMag) return false;
    // Search
    if (search) {
      const q = search.toLowerCase();
      if (!t.name?.toLowerCase().includes(q) && !t.affiliation?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Filter logic for "Available" tab
  const availableFilteredTalent = talentList.filter(t => {
    // Already assigned to this competition
    if (assignedIds.has(t.id)) return false;
    // Must match gender or be "Both"
    if (t.wagMag && t.wagMag !== 'Both' && t.wagMag !== targetWagMag) return false;

    // Must be interested (via booking link "No" flow) OR survey availability
    const isInterested = t.interested?.[compId] === true;
    const inSurvey = t.surveyAvailability?.[compId] === true;
    if (!isInterested && !inSurvey) return false;

    // Must be ready or has-contact status
    if (t.status !== 'ready' && t.status !== 'has-contact') return false;

    // Must NOT have same-day conflict
    if (sameDayConflicts.has(t.id)) return false;

    return true;
  });

  // Use the appropriate list based on active tab
  const availableTalent = talentTab === 'available' ? availableFilteredTalent : searchTalent;

  // Sort: non-conflicted first, then by status (ready first, then has-contact, then others)
  const sortedAvailable = [...availableTalent].sort((a, b) => {
    const aConflict = sameDayConflictDetails.has(a.id) ? 1 : 0;
    const bConflict = sameDayConflictDetails.has(b.id) ? 1 : 0;
    if (aConflict !== bConflict) return aConflict - bConflict;
    const order = { ready: 0, 'has-contact': 1, 'did-2025': 2, 'need-info': 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  async function handleAssign(talent) {
    try {
      await assignTalent(talent.id, activeRole);
      toast.success(`${talent.name} added as ${getRoleLabel(activeRole)}`);
    } catch (e) {
      toast.error('Failed to assign talent');
    }
  }

  async function handleAdvanceStatus(talentId, currentStatus) {
    const flow = STATUS_FLOW.find(s => s.status === currentStatus);
    if (!flow?.next) return;
    try {
      await updateStatus(talentId, flow.next);
      toast.success(`Status updated to ${getStaffStatusLabel(flow.next)}`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  }

  async function handleDecline(talentId) {
    try {
      await updateStatus(talentId, STAFF_STATUS.DECLINED);
    } catch (e) {
      toast.error('Failed to update status');
    }
  }

  async function handleRemove(talentId, name) {
    try {
      await removeAssignment(talentId);
      toast.success(`${name} removed`);
    } catch (e) {
      toast.error('Failed to remove');
    }
  }

  async function handleSaveNotes(talentId) {
    await updateNotes(talentId, notesDraft);
    setEditingNotes(null);
    toast.success('Notes saved');
  }

  async function handleCopyBookingLink(talentId, role) {
    try {
      const response = await fetch(`https://api.commentarygraphic.com/api/book/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talentId, compId, role }),
      });

      if (!response.ok) throw new Error('Failed to generate booking link');

      const data = await response.json();
      await navigator.clipboard.writeText(data.url);
      toast.success('Booking link copied!', { duration: 2000 });
    } catch (e) {
      toast.error('Failed to generate link');
    }
  }

  // Outreach handlers
  async function handleSendInvite(talentId, role) {
    setSendingOutreach(true);
    try {
      const response = await fetch(`https://api.commentarygraphic.com/api/commentary/${compId}/${talentId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) throw new Error('Failed to send invite');

      toast.success('Invite sent ✓');
    } catch (e) {
      toast.error(e.message || 'Failed to send invite');
    } finally {
      setSendingOutreach(false);
    }
  }

  async function handleSendBriefing(talentId) {
    if (!briefingForm.virtiusUrl || !briefingForm.discordInfo || !briefingForm.preProdTime) {
      toast.error('All fields are required');
      return;
    }

    setSendingOutreach(true);
    try {
      const response = await fetch(`https://api.commentarygraphic.com/api/commentary/${compId}/${talentId}/briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(briefingForm),
      });

      if (!response.ok) throw new Error('Failed to send briefing');

      toast.success('Briefing sent ✓');
      setBriefingModalOpen(null);
      setBriefingForm({ virtiusUrl: '', discordInfo: '', preProdTime: '' });
    } catch (e) {
      toast.error(e.message || 'Failed to send briefing');
    } finally {
      setSendingOutreach(false);
    }
  }

  async function handleSendCalendarInvite(talentId) {
    setSendingOutreach(true);
    try {
      const response = await fetch(`https://api.commentarygraphic.com/api/commentary/${compId}/${talentId}/calendar-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to send calendar invite');

      toast.success('Calendar invite sent ✓');
    } catch (e) {
      toast.error(e.message || 'Failed to send calendar invite');
    } finally {
      setSendingOutreach(false);
    }
  }

  async function handleSchedulePreProd(talentId) {
    if (!preProdTime) {
      toast.error('Meeting time is required');
      return;
    }

    setSendingOutreach(true);
    try {
      const response = await fetch(`https://api.commentarygraphic.com/api/commentary/${compId}/${talentId}/schedule-preproduction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingTime: preProdTime }),
      });

      if (!response.ok) throw new Error('Failed to schedule meeting');

      toast.success('Pre-production meeting scheduled ✓');
      setPreProdModalOpen(null);
      setPreProdTime('');
    } catch (e) {
      toast.error(e.message || 'Failed to schedule meeting');
    } finally {
      setSendingOutreach(false);
    }
  }

  function generateInviteMessage(talent, role) {
    const eventName = competitionConfig?.eventName || 'the competition';
    const meetDate = competitionConfig?.meetDate || 'TBD';
    return `Hi ${talent?.name?.split(' ')[0] || 'there'}! Would you be available for ${eventName} on ${meetDate}? You'd be joining as ${getRoleLabel(role)}. Let me know!`;
  }

  function generateBriefingMessage(talent) {
    const eventName = competitionConfig?.eventName || 'the competition';
    return `Hi ${talent?.name?.split(' ')[0]}! Here's your briefing for ${eventName}:\n\nVirtius: ${briefingForm.virtiusUrl}\nDiscord: ${briefingForm.discordInfo}\nPre-production meeting: ${briefingForm.preProdTime}\n\nSee you soon!`;
  }

  async function handleCopyForIMessage(talentId, type, message) {
    await navigator.clipboard.writeText(message);
    setIMessageConfirmOpen({ talentId, type, message });
  }

  async function confirmIMessageSent(talentId, type) {
    try {
      const talent = talentList.find(t => t.id === talentId);
      const response = await fetch(`https://api.commentarygraphic.com/api/talent/${talentId}/communication-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'imessage',
          sentAt: new Date().toISOString(),
          note: `${type} sent via iMessage`,
        }),
      });

      if (!response.ok) throw new Error('Failed to log iMessage');

      toast.success('Logged as sent via iMessage ✓');
      setIMessageConfirmOpen(null);
    } catch (e) {
      toast.error('Failed to log message');
    }
  }

  async function handleCopyTalentList() {
    const lines = sortedAvailable
      .map(t => `${t.name}${t.phone ? ` — ${t.phone}` : ''}`)
      .join('\n');

    if (lines) {
      await navigator.clipboard.writeText(lines);
      toast.success(`Copied ${sortedAvailable.length} talent to clipboard`, { duration: 2000 });
    } else {
      toast.error('No available talent to copy');
    }
  }

  function handleSetViewMode(mode) {
    setViewMode(mode);
    localStorage.setItem('crm-commentary-view', mode);
  }

  // Build kebab menu sections for a given assignment (reused by list view and kanban)
  function kebabSectionsForAssignment(assignment, talent) {
    return [
      {
        label: 'Workflow',
        items: [
          {
            label: 'Mark Declined',
            icon: NoSymbolIcon,
            onClick: () => handleDecline(assignment.talentId),
            hidden: assignment.status !== STAFF_STATUS.INVITED,
          },
        ],
      },
      {
        label: 'Outreach',
        items: [
          {
            label: 'Send Invite',
            icon: PaperAirplaneIcon,
            onClick: () => handleSendInvite(assignment.talentId, assignment.role),
            disabled: sendingOutreach,
          },
          {
            label: 'Copy Invite for iMessage',
            icon: ClipboardDocumentIcon,
            onClick: () => handleCopyForIMessage(assignment.talentId, 'invite', generateInviteMessage(talent, assignment.role)),
          },
          {
            label: 'Send Briefing',
            icon: DocumentTextIcon,
            onClick: () => setBriefingModalOpen(assignment.talentId),
            disabled: sendingOutreach,
          },
          {
            label: 'Copy Briefing for iMessage',
            icon: ClipboardDocumentIcon,
            onClick: () => handleCopyForIMessage(assignment.talentId, 'briefing', generateBriefingMessage(talent)),
          },
          {
            label: 'Calendar Invite',
            icon: CalendarIcon,
            onClick: () => handleSendCalendarInvite(assignment.talentId),
            disabled: sendingOutreach,
          },
          {
            label: 'Schedule Pre-Prod',
            icon: CalendarIcon,
            onClick: () => setPreProdModalOpen(assignment.talentId),
            disabled: sendingOutreach,
          },
        ],
      },
      {
        label: 'Links',
        items: [
          {
            label: 'Copy Booking Link',
            icon: LinkIcon,
            onClick: () => handleCopyBookingLink(assignment.talentId, assignment.role),
          },
        ],
      },
      {
        label: 'Danger',
        items: [
          {
            label: 'Remove from Competition',
            icon: TrashIcon,
            onClick: () => handleRemove(assignment.talentId, talent?.name),
            danger: true,
          },
        ],
      },
    ];
  }

  // Group staff by role
  const byRole = SLOT_ROLES.reduce((acc, { role }) => {
    acc[role] = staffList.filter(s => s.role === role);
    return acc;
  }, {});

  const confirmedCount = staffList.filter(s => s.status === STAFF_STATUS.CONFIRMED || s.status === STAFF_STATUS.BRIEFED).length;
  const totalCount = staffList.length;

  return (
    <>
      {/* Briefing Modal */}
      {briefingModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Send Briefing</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Virtius Session URL</label>
                <input
                  type="text"
                  value={briefingForm.virtiusUrl}
                  onChange={(e) => setBriefingForm({ ...briefingForm, virtiusUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Discord Info</label>
                <input
                  type="text"
                  value={briefingForm.discordInfo}
                  onChange={(e) => setBriefingForm({ ...briefingForm, discordInfo: e.target.value })}
                  placeholder="Room name or link"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Pre-Production Meeting Time</label>
                <input
                  type="datetime-local"
                  value={briefingForm.preProdTime}
                  onChange={(e) => setBriefingForm({ ...briefingForm, preProdTime: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => handleSendBriefing(briefingModalOpen)}
                disabled={sendingOutreach}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium text-sm disabled:opacity-50"
              >
                {sendingOutreach ? 'Sending...' : 'Send Briefing'}
              </button>
              <button
                onClick={() => setBriefingModalOpen(null)}
                disabled={sendingOutreach}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Production Scheduling Modal */}
      {preProdModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Schedule Pre-Production Meeting</h3>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Meeting Time</label>
              <input
                type="datetime-local"
                value={preProdTime}
                onChange={(e) => setPreProdTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => handleSchedulePreProd(preProdModalOpen)}
                disabled={sendingOutreach}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium text-sm disabled:opacity-50"
              >
                {sendingOutreach ? 'Scheduling...' : 'Schedule Meeting'}
              </button>
              <button
                onClick={() => setPreProdModalOpen(null)}
                disabled={sendingOutreach}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iMessage Confirmation Modal */}
      {iMessageConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3">Message Copied!</h3>
            <p className="text-sm text-zinc-400 mb-4">
              The message has been copied to your clipboard. After you send it via iMessage, click "Yes" to log it in the system.
            </p>
            <div className="bg-zinc-800 p-3 rounded text-xs text-zinc-300 mb-4 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {iMessageConfirmOpen.message}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => confirmIMessageSent(iMessageConfirmOpen.talentId, iMessageConfirmOpen.type)}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded font-medium text-sm"
              >
                Yes, I sent it
              </button>
              <button
                onClick={() => setIMessageConfirmOpen(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-blue-400" />
                Commentary
              </h1>
              <p className="text-xs text-zinc-500">
                {competitionConfig?.eventName || compId} ·{' '}
                {totalCount === 0
                  ? 'No talent assigned'
                  : `${confirmedCount}/${totalCount} confirmed`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => handleSetViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ListBulletIcon className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => handleSetViewMode('kanban')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'kanban' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ViewColumnsIcon className="w-3.5 h-3.5" />
                Board
              </button>
            </div>
            <Link
              to="/talent"
              className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
            >
              Manage Roster
              <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left: Current assignments (list) or Kanban board */}
        <div className="flex-1 overflow-y-auto border-r border-zinc-800">
          {viewMode === 'kanban' ? (
            <KanbanBoard
              staffList={staffList}
              talentList={talentList}
              updateStatus={updateStatus}
              kebabSectionsForAssignment={kebabSectionsForAssignment}
              sameDayConflictDetails={sameDayConflictDetails}
            />
          ) : (
          <div className="space-y-6 p-5">
            {SLOT_ROLES.map(({ role, label, color }) => (
              <div key={role}>
                <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${color.replace('border', 'border-b')}`}>
                  <h2 className="text-sm font-semibold text-zinc-300">{label}</h2>
                  <span className="text-xs text-zinc-500">({byRole[role]?.length || 0})</span>
                </div>

                {byRole[role]?.length === 0 && (
                  <button
                    onClick={() => setActiveRole(role)}
                    className="w-full py-3 border border-dashed border-zinc-700 rounded-lg text-zinc-500 text-sm hover:border-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Assign {label}
                  </button>
                )}

                <div className="space-y-2">
                  {byRole[role]?.map((assignment) => {
                    const talent = talentList.find(t => t.id === assignment.talentId);
                    const flowEntry = STATUS_FLOW.find(s => s.status === assignment.status);
                    const isEditingNotes = editingNotes === assignment.talentId;

                    return (
                      <div key={assignment.talentId} className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                to={`/talent/${assignment.talentId}`}
                                className="font-semibold text-white hover:text-blue-300 transition-colors"
                              >
                                {talent?.name || assignment.talentId}
                              </Link>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStaffStatusColor(assignment.status)}`}>
                                {getStaffStatusLabel(assignment.status)}
                              </span>
                              {sameDayConflictDetails.has(assignment.talentId) && (
                                <span className="relative group">
                                  <span className="px-1.5 py-0.5 bg-orange-700 text-orange-100 text-xs rounded flex items-center gap-1 cursor-default">
                                    <ExclamationTriangleIcon className="w-3 h-3" /> Conflict
                                  </span>
                                  <div className="absolute left-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs z-50 w-64 hidden group-hover:block shadow-lg">
                                    <div className="font-semibold text-orange-300 mb-1">Same-day conflict</div>
                                    {sameDayConflictDetails.get(assignment.talentId).map(c => (
                                      <div key={c.compId} className="text-zinc-300">
                                        Also {getStaffStatusLabel(c.status).toLowerCase()} for {c.compName} as {getRoleLabel(c.role)}
                                      </div>
                                    ))}
                                  </div>
                                </span>
                              )}
                            </div>
                            {talent && (
                              <div className="flex items-center gap-3 text-xs text-zinc-400">
                                {talent.phone && (
                                  <a href={`tel:${talent.phone}`} className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                                    <PhoneIcon className="w-3 h-3" />
                                    {talent.phone}
                                  </a>
                                )}
                                {talent.email && (
                                  <a href={`mailto:${talent.email}`} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200">
                                    <EnvelopeIcon className="w-3 h-3" />
                                    {talent.email}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Primary action + kebab menu */}
                        <div className="flex items-center gap-2 mt-3">
                          {flowEntry?.next && (
                            <button
                              onClick={() => handleAdvanceStatus(assignment.talentId, assignment.status)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium transition-colors"
                            >
                              <CheckIcon className="w-3 h-3" />
                              Mark as {getStaffStatusLabel(flowEntry.next)}
                            </button>
                          )}
                          {assignment.status === STAFF_STATUS.CONFIRMED && (
                            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-500">
                              <span className={`w-2 h-2 rounded-full ${assignment.calendarInviteSent ? 'bg-green-500' : 'bg-zinc-600'}`} />
                              Calendar invite
                            </div>
                          )}
                          <KebabMenu sections={kebabSectionsForAssignment(assignment, talent)} />
                        </div>

                        {/* Notes */}
                        <div className="mt-2">
                          {isEditingNotes ? (
                            <div className="flex gap-2">
                              <input
                                autoFocus
                                value={notesDraft}
                                onChange={e => setNotesDraft(e.target.value)}
                                placeholder="Add a note for this competition..."
                                className="flex-1 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-xs text-white focus:outline-none"
                              />
                              <button onClick={() => handleSaveNotes(assignment.talentId)} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs">Save</button>
                              <button onClick={() => setEditingNotes(null)} className="px-2 py-1 text-zinc-400 hover:text-white text-xs">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingNotes(assignment.talentId); setNotesDraft(assignment.notes || ''); }}
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              {assignment.notes ? assignment.notes : '+ Add competition note'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Right: Talent search */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-zinc-300">Add to competition</h2>
            </div>
            {/* Role selector */}
            <div className="flex gap-1.5 mb-3">
              {SLOT_ROLES.map(({ role, label }) => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    activeRole === role
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {role === 'pbp' ? 'PBP' : role === 'analyst' ? 'Analyst' : 'Producer'}
                </button>
              ))}
            </div>
            {/* Tab selector: Search / Available */}
            <div className="flex gap-1.5 mb-3">
              <button
                onClick={() => setTalentTab('search')}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  talentTab === 'search'
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Search
              </button>
              <button
                onClick={() => setTalentTab('available')}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  talentTab === 'available'
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Available
              </button>
            </div>
            {talentTab === 'search' && (
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search ${targetWagMag} talent...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            {talentTab === 'available' && (
              <div>
                <button
                  onClick={handleCopyTalentList}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-teal-700 hover:bg-teal-600 rounded-lg text-xs font-medium text-white transition-colors"
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                  Copy talent list ({sortedAvailable.length})
                </button>
                <p className="text-xs text-zinc-500 mt-2">
                  Showing talent who flagged this competition and are ready/have contact, no same-day conflicts
                </p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {talentLoading ? (
              <div className="text-center py-8 text-zinc-500 text-sm">Loading...</div>
            ) : sortedAvailable.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">No talent found</div>
            ) : (
              sortedAvailable.map(talent => {
                const isInterested = talent.interested && talent.interested[compId] === true;
                return (
                  <div
                    key={talent.id}
                    className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 rounded-lg px-3 py-2.5 group"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm font-medium text-white truncate">{talent.name}</span>
                          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs ${getStatusColor(talent.status)}`}>
                            {getStatusLabel(talent.status)}
                          </span>
                          {isInterested && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs bg-green-900 text-green-200 flex items-center gap-1">
                              <CheckIcon className="w-2.5 h-2.5" />
                              Interested
                            </span>
                          )}
                          {sameDayConflictDetails.has(talent.id) && (
                            <span className="relative group flex-shrink-0">
                              <span className="px-1.5 py-0.5 bg-orange-700 text-orange-100 text-xs rounded flex items-center gap-1 cursor-default">
                                <ExclamationTriangleIcon className="w-2.5 h-2.5" /> Conflict
                              </span>
                              <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs z-50 w-56 hidden group-hover:block shadow-lg">
                                <div className="font-semibold text-orange-300 mb-1">Same-day conflict</div>
                                {sameDayConflictDetails.get(talent.id).map(c => (
                                  <div key={c.compId} className="text-zinc-300">
                                    {getStaffStatusLabel(c.status)} for {c.compName} as {getRoleLabel(c.role)}
                                  </div>
                                ))}
                              </div>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {talent.commentaryRole}{talent.affiliation ? ` · ${talent.affiliation}` : ''}
                        </div>
                        {talent.phone && (
                          <a href={`tel:${talent.phone}`} className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 mt-0.5">
                            <PhoneIcon className="w-2.5 h-2.5" />
                            {talent.phone}
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => handleAssign(talent)}
                        className="flex-shrink-0 p-1.5 bg-blue-600 hover:bg-blue-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title={`Add as ${getRoleLabel(activeRole)}`}
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-zinc-800">
            <Link
              to="/talent"
              className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <UserGroupIcon className="w-4 h-4" />
              View full roster
            </Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
