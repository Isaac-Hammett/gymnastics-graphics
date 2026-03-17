import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTalentRoster, getStatusLabel, getStatusColor, wagMagLabel } from '../hooks/useTalentRoster';
import { useTalentAssignments } from '../hooks/useTalentAssignments';
import {
  PhoneIcon,
  EnvelopeIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  TrophyIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleLeftIcon,
  ArrowUpTrayIcon,
  ChevronDownIcon,
  CalendarIcon,
  PaperAirplaneIcon,
  DocumentTextIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const OTHER_INTERESTS = [
  'Commentator',
  'Producer',
  'Meet Monitor',
  'Streaming / Production',
  'Social Media',
  'Creative (Broadcast Graphics, Web Design, Social Graphics, etc)',
];

// Timeline type configuration with icons and colors
const TIMELINE_TYPES = {
  imessage: { icon: ChatBubbleLeftIcon, color: 'text-blue-400', bgColor: 'bg-blue-900/30', borderColor: 'border-blue-700', label: 'iMessage' },
  invite: { icon: PaperAirplaneIcon, color: 'text-green-400', bgColor: 'bg-green-900/30', borderColor: 'border-green-700', label: 'Invite' },
  briefing: { icon: DocumentTextIcon, color: 'text-purple-400', bgColor: 'bg-purple-900/30', borderColor: 'border-purple-700', label: 'Briefing' },
  calendar: { icon: CalendarIcon, color: 'text-blue-400', bgColor: 'bg-blue-900/30', borderColor: 'border-blue-700', label: 'Calendar' },
  preproduction: { icon: VideoCameraIcon, color: 'text-amber-400', bgColor: 'bg-amber-900/30', borderColor: 'border-amber-700', label: 'Pre-Production' },
  note: { icon: PencilIcon, color: 'text-zinc-400', bgColor: 'bg-zinc-800', borderColor: 'border-zinc-700', label: 'Note' },
};

// Filter options for the timeline
const TIMELINE_FILTERS = ['all', 'imessage', 'invite', 'briefing', 'calendar', 'preproduction', 'note'];

/**
 * timeAgo - Converts a timestamp to a relative time string
 * Extends the pattern from ScoreBugPanel.jsx to include hours and days
 */
function timeAgo(timestamp) {
  if (!timestamp) return 'never';
  const now = Date.now();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Role label formatter
function getRoleLabel(role) {
  if (!role) return '—';
  if (role === 'pbp') return 'Play-by-Play';
  if (role === 'analyst') return 'Analyst';
  if (role === 'both') return 'Both';
  return role;
}

/**
 * CollapsibleSection - A collapsible container for profile sections
 */
function CollapsibleSection({ title, defaultOpen = true, children, icon: Icon }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-zinc-400" />}
          <span className="text-sm font-semibold text-zinc-300">{title}</span>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-zinc-500 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="p-4 bg-zinc-900/50">{children}</div>}
    </div>
  );
}

/**
 * TalentProfilePage - Full profile for a single talent person.
 * URL: /talent/:talentId
 */
export default function TalentProfilePage() {
  const { talentId } = useParams();
  const navigate = useNavigate();
  const { talents, loading, updateTalent, deleteTalent } = useTalentRoster();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'communications'
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('all');

  const talent = talents[talentId];

  // Create single-element array for useTalentAssignments
  const talentListForAssignments = useMemo(() => {
    if (!talent) return [];
    return [{ id: talentId, ...talent }];
  }, [talent, talentId]);

  // Get assignment data from cross-competition hook
  const { assignmentsByTalent, loading: assignmentsLoading } = useTalentAssignments(talentListForAssignments);
  const talentAssignmentData = assignmentsByTalent[talentId] || {
    assignments: [],
    lastOutreach: null,
    lastOutreachType: null,
    pendingCount: 0,
    confirmedCount: 0,
    availableFor: [],
    availabilityDot: 'gray',
  };

  useEffect(() => {
    if (talent && !form) {
      setForm({ ...talent });
    }
  }, [talent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!talent) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Talent not found.</p>
          <Link to="/talent" className="text-blue-400 hover:text-blue-300">← Back to roster</Link>
        </div>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateTalent(talentId, form);
      setEditing(false);
      toast.success('Profile saved');
    } catch (e) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm({ ...talent });
    setEditing(false);
  }

  async function handleDelete() {
    await deleteTalent(talentId);
    navigate('/talent');
    toast.success('Talent removed');
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    const existing = talent.notes || '';
    const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const updated = existing
      ? `${existing}\n\n[${timestamp}] ${noteText.trim()}`
      : `[${timestamp}] ${noteText.trim()}`;
    try {
      await updateTalent(talentId, { notes: updated });
      setNoteText('');
      toast.success('Note added');

      // Parse the note for availability hints
      try {
        const response = await fetch(`https://api.commentarygraphic.com/api/talent/${talentId}/notes/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteText: noteText.trim() })
        });
        if (response.ok) {
          const parsed = await response.json();
          if (parsed.availablePeriods?.length > 0 || parsed.unavailableDates?.length > 0) {
            toast.success('Availability hints extracted');
          }
        }
      } catch (parseError) {
        console.error('Note parsing failed:', parseError);
        // Don't show error to user - parsing is a bonus feature
      }
    } catch (e) {
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  }

  function toggleInterest(interest) {
    const current = form.otherInterests || [];
    const updated = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    setForm(p => ({ ...p, otherInterests: updated }));
  }

  async function handleScreenshotUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setUploadingScreenshot(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);

      await new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = reader.result;
            const [metadata, data] = base64.split(',');
            const mimeType = file.type;

            // Call screenshot parsing endpoint
            const response = await fetch(`https://api.commentarygraphic.com/api/talent/${talentId}/parse-screenshot`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: data, mimeType })
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to parse screenshot');
            }

            const result = await response.json();

            if (result.extractedText) {
              toast.success('Screenshot parsed successfully');
              // The note will appear automatically via the real-time listener
            } else {
              toast.error('No availability text found in screenshot');
            }

            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
      });
    } catch (error) {
      console.error('Screenshot upload failed:', error);
      toast.error(error.message || 'Failed to upload screenshot');
    } finally {
      setUploadingScreenshot(false);
      // Reset file input
      e.target.value = '';
    }
  }

  const wm = wagMagLabel(talent.wagMag);
  const history = talent.competitionHistory || [];
  const communications = talent.communicationLog
    ? Object.entries(talent.communicationLog).map(([key, value]) => ({ id: key, ...value })).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/talent" className="text-zinc-400 hover:text-white text-sm transition-colors">
              ← Talent Roster
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{talent.name}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(talent.status)}`}>
                {getStatusLabel(talent.status)}
              </span>
              {talent.wagMag && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${wm.color}`}>
                  {wm.label}
                </span>
              )}
              {talent.canProduce && (
                <span className="px-2 py-0.5 bg-teal-800 text-teal-200 text-xs rounded">Producer</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CheckIcon className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                >
                  <PencilIcon className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-3 gap-6">
        {/* Left: Profile fields organized in collapsible sections */}
        <div className="col-span-2 space-y-4">

          {/* Contact Info Section (always open) */}
          <CollapsibleSection title="Contact Info" defaultOpen={true} icon={PhoneIcon}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" editing={editing} value={form?.name || ''} onChange={v => setForm(p => ({ ...p, name: v }))}>
                <span className="font-semibold text-white">{talent.name}</span>
              </Field>
              <Field label="Phone" editing={editing} value={form?.phone || ''} onChange={v => setForm(p => ({ ...p, phone: v }))}>
                {talent.phone ? (
                  <a href={`tel:${talent.phone}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                    <PhoneIcon className="w-4 h-4" />
                    {talent.phone}
                  </a>
                ) : <span className="text-zinc-500 italic text-sm">Not provided</span>}
              </Field>
              <Field label="Email" editing={editing} value={form?.email || ''} onChange={v => setForm(p => ({ ...p, email: v }))}>
                {talent.email ? (
                  <a href={`mailto:${talent.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                    <EnvelopeIcon className="w-4 h-4" />
                    {talent.email}
                  </a>
                ) : <span className="text-zinc-500 italic text-sm">Not provided</span>}
              </Field>
              <Field label="Discord" editing={editing} value={form?.discordHandle || ''} onChange={v => setForm(p => ({ ...p, discordHandle: v }))}>
                <span className="text-sm text-white">{talent.discordHandle || <span className="text-zinc-500 italic">Not set</span>}</span>
              </Field>
            </div>
          </CollapsibleSection>

          {/* Role & Expertise Section */}
          <CollapsibleSection title="Role & Expertise" defaultOpen={true} icon={TrophyIcon}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">WAG / MAG</label>
                {editing ? (
                  <select
                    value={form.wagMag || ''}
                    onChange={e => setForm(p => ({ ...p, wagMag: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="WAG">WAG</option>
                    <option value="MAG">MAG</option>
                    <option value="Both">Both</option>
                  </select>
                ) : (
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${wm.color}`}>{wm.label}</span>
                )}
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Commentary Role</label>
                {editing ? (
                  <select
                    value={form.commentaryRole || ''}
                    onChange={e => setForm(p => ({ ...p, commentaryRole: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Play by Play / Lead">Play by Play / Lead</option>
                    <option value="Color / Analyst">Color / Analyst</option>
                    <option value="Does not matter">Does not matter</option>
                  </select>
                ) : (
                  <span className="text-sm text-white">{talent.commentaryRole || '—'}</span>
                )}
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Status</label>
                {editing ? (
                  <select
                    value={form.status || ''}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="ready">Ready</option>
                    <option value="has-contact">Has Contact</option>
                    <option value="did-2025">Did 2025</option>
                    <option value="need-info">Need Info</option>
                  </select>
                ) : (
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(talent.status)}`}>
                    {getStatusLabel(talent.status)}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Affiliation</label>
                {editing ? (
                  <input
                    value={form.affiliation || ''}
                    onChange={e => setForm(p => ({ ...p, affiliation: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Stanford Alumni"
                  />
                ) : <span className="text-sm text-white">{talent.affiliation || '—'}</span>}
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Conference</label>
                {editing ? (
                  <input
                    value={form.conference || ''}
                    onChange={e => setForm(p => ({ ...p, conference: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. ECAC, GEC"
                  />
                ) : <span className="text-sm text-white">{talent.conference || '—'}</span>}
              </div>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <input
                      id="editCanProduce"
                      type="checkbox"
                      checked={form.canProduce || false}
                      onChange={e => setForm(p => ({ ...p, canProduce: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="editCanProduce" className="text-sm text-zinc-300">Can produce</label>
                  </>
                ) : (
                  <span className="text-sm text-white">{talent.canProduce ? '✓ Can produce' : '—'}</span>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Availability & Assignments Section */}
          <CollapsibleSection title="Availability & Assignments" defaultOpen={true} icon={CalendarIcon}>
            {/* Current Assignments */}
            <div className="mb-4">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Current Assignments</h3>
              {assignmentsLoading ? (
                <div className="text-xs text-zinc-400 italic">Loading assignments...</div>
              ) : talentAssignmentData.assignments.length === 0 ? (
                <div className="text-xs text-zinc-500 italic">No current assignments</div>
              ) : (
                <div className="space-y-2">
                  {talentAssignmentData.assignments.map((a, i) => (
                    <Link
                      key={i}
                      to={`/${a.compId}/commentary`}
                      className="flex items-center justify-between p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white group-hover:text-blue-300 transition-colors">{a.compName}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          a.status === 'confirmed' ? 'bg-green-900/50 text-green-400' :
                          a.status === 'briefed' ? 'bg-purple-900/50 text-purple-400' :
                          a.status === 'invited' ? 'bg-blue-900/50 text-blue-400' :
                          a.status === 'declined' ? 'bg-red-900/50 text-red-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>
                          {a.status || 'assigned'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {getRoleLabel(a.role)} · {a.meetDate || 'TBD'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Interest Flags */}
            <div className="mb-4">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Available For (Interest Flags)</h3>
              {talentAssignmentData.availableFor.length === 0 ? (
                <div className="text-xs text-zinc-500 italic">No availability flagged</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {talentAssignmentData.availableFor.map((a, i) => (
                    <span key={i} className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded border border-green-800">
                      {a.compName} <span className="text-green-600">({a.source})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Parsed Availability Hints */}
            {(talent.parsedAvailability?.availablePeriods?.length > 0 || talent.parsedAvailability?.unavailableDates?.length > 0) && (
              <div>
                <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Extracted Availability</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(talent.parsedAvailability?.availablePeriods || []).map((period, i) => (
                    <span key={`avail-${i}`} className="px-2 py-0.5 bg-green-900/30 text-green-400 text-xs rounded border border-green-700">
                      Available: {period}
                    </span>
                  ))}
                  {(talent.parsedAvailability?.unavailableDates || []).map((date, i) => (
                    <span key={`busy-${i}`} className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded border border-red-700">
                      Busy: {date}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tech Setup Summary */}
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Tech Setup</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-xs text-zinc-500">Internet</span>
                  <div className="text-sm text-white">
                    {talent.internetUploadMbps ? `↑${talent.internetUploadMbps} ↓${talent.internetDownloadMbps || '?'} Mbps` : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">Headphones</span>
                  <div className="text-sm text-white">{talent.hasHeadphones ? 'Yes' : '—'}</div>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">Discord</span>
                  <div className={`text-sm ${talent.discordAdded ? 'text-green-400' : 'text-zinc-500'}`}>
                    {talent.discordAdded ? '✓ Added' : 'Not added'}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Notes & Interests Section */}
          <CollapsibleSection title="Notes & Interests" defaultOpen={true} icon={ChatBubbleLeftRightIcon}>
            {/* Notes */}
            <div className="mb-4">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Notes</h3>
              {editing ? (
                <textarea
                  value={form.notes || ''}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Notes about this person..."
                />
              ) : (
                <>
                  {talent.notes ? (
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto mb-3 bg-zinc-800/50 p-2 rounded">
                      {talent.notes}
                    </pre>
                  ) : (
                    <p className="text-xs text-zinc-500 italic mb-3">No notes yet.</p>
                  )}
                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={savingNote || !noteText.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50 transition-colors"
                    >
                      Add
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Other Interests */}
            <div className="mb-4">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Other Interests</h3>
              {editing ? (
                <div className="flex flex-wrap gap-2">
                  {OTHER_INTERESTS.map(interest => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        (form.otherInterests || []).includes(interest)
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {interest.split(' (')[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(talent.otherInterests || []).length === 0
                    ? <span className="text-sm text-zinc-500 italic">None listed</span>
                    : (talent.otherInterests || []).map(i => (
                      <span key={i} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs rounded">
                        {i.split(' (')[0]}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Social Links */}
            <div>
              <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Social Links</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="LinkedIn" editing={editing} value={form?.linkedInUrl || ''} onChange={v => setForm(p => ({ ...p, linkedInUrl: v }))} inputType="url">
                  {talent.linkedInUrl
                    ? <a href={talent.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">{talent.linkedInUrl}</a>
                    : <span className="text-zinc-500 italic text-sm">Not found</span>}
                </Field>
                <Field label="Instagram" editing={editing} value={form?.instagramUrl || ''} onChange={v => setForm(p => ({ ...p, instagramUrl: v }))} inputType="url">
                  {talent.instagramUrl
                    ? <a href={talent.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">{talent.instagramUrl}</a>
                    : <span className="text-zinc-500 italic text-sm">Not found</span>}
                </Field>
              </div>
            </div>
          </CollapsibleSection>

          {/* History Section (collapsed by default) */}
          <CollapsibleSection title="History" defaultOpen={false} icon={TrophyIcon}>
            {/* Competition History */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs text-zinc-500 uppercase tracking-wide">Competition History</h3>
                <span className="text-xs text-zinc-500">{talent.totalCompetitions || history.length} events</span>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No competitions recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {[...history].reverse().map((h, i) => (
                    <div key={i} className="text-xs border-b border-zinc-800 pb-2 last:border-0">
                      <div className="text-white font-medium">{h.eventName || h.compId}</div>
                      <div className="text-zinc-400">{h.date} · {h.role}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discovery & Timestamps */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-800">
              <div>
                <span className="text-xs text-zinc-500">Discovered From</span>
                <div className="text-sm text-zinc-400">{talent.discoveredFrom || 'manual'}</div>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Created</span>
                <div className="text-sm text-zinc-400">
                  {talent.createdAt ? new Date(talent.createdAt).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Right: Tabs + Content */}
        <div className="space-y-5">
          {/* Tab Switcher */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-1 flex gap-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('communications')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'communications'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Communications
              {communications.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {communications.length}
                </span>
              )}
            </button>
          </div>

          {/* Profile Tab — Onboarding checklist */}
          {activeTab === 'profile' && (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">Onboarding Checklist</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">2026 Survey</span>
                  {editing ? (
                    <input
                      type="checkbox"
                      checked={form.surveyCompleted || false}
                      onChange={e => setForm(p => ({ ...p, surveyCompleted: e.target.checked }))}
                      className="rounded"
                    />
                  ) : (
                    <span className={`text-sm font-medium ${talent.surveyCompleted ? 'text-green-400' : 'text-zinc-500'}`}>
                      {talent.surveyCompleted ? '✓' : '—'}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Text Sent</span>
                  {editing ? (
                    <input
                      type="checkbox"
                      checked={form.textSent || false}
                      onChange={e => setForm(p => ({ ...p, textSent: e.target.checked }))}
                      className="rounded"
                    />
                  ) : (
                    <span className={`text-sm font-medium ${talent.textSent ? 'text-green-400' : 'text-zinc-500'}`}>
                      {talent.textSent ? '✓' : '—'}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Discord Added</span>
                  {editing ? (
                    <input
                      type="checkbox"
                      checked={form.discordAdded || false}
                      onChange={e => setForm(p => ({ ...p, discordAdded: e.target.checked }))}
                      className="rounded"
                    />
                  ) : (
                    <span className={`text-sm font-medium ${talent.discordAdded ? 'text-green-400' : 'text-zinc-500'}`}>
                      {talent.discordAdded ? '✓' : '—'}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Quick Stats</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Assignments:</span>{' '}
                    <span className="text-white">{talentAssignmentData.assignments.length}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Confirmed:</span>{' '}
                    <span className="text-green-400">{talentAssignmentData.confirmedCount}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Pending:</span>{' '}
                    <span className="text-blue-400">{talentAssignmentData.pendingCount}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Available:</span>{' '}
                    <span className="text-green-400">{talentAssignmentData.availableFor.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Communications Tab */}
          {activeTab === 'communications' && (
            <>
              {/* Screenshot Upload */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpTrayIcon className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Upload Screenshot</h2>
                </div>
                <p className="text-xs text-zinc-400 mb-3">
                  Upload a screenshot of a text conversation to extract availability mentions automatically.
                </p>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    disabled={uploadingScreenshot}
                    className="hidden"
                  />
                  <span className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    uploadingScreenshot
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}>
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    {uploadingScreenshot ? 'Processing...' : 'Upload Screenshot'}
                  </span>
                </label>
              </div>

              {/* Activity Timeline */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
                    Activity Timeline
                  </h2>
                  <span className="ml-auto text-xs text-zinc-500">{communications.length} entries</span>
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {TIMELINE_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTimelineFilter(filter)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        timelineFilter === filter
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {filter === 'all' ? 'All' : TIMELINE_TYPES[filter]?.label || filter}
                    </button>
                  ))}
                </div>

                {communications.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No communications recorded yet.</p>
                ) : (
                  <div className="relative max-h-96 overflow-y-auto">
                    {/* Vertical timeline line */}
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-700" />

                    <div className="space-y-4">
                      {communications
                        .filter(comm => timelineFilter === 'all' || comm.type === timelineFilter)
                        .map((comm) => {
                          const typeConfig = TIMELINE_TYPES[comm.type] || TIMELINE_TYPES.note;
                          const IconComponent = typeConfig.icon;
                          const fullDate = new Date(comm.sentAt).toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          });

                          return (
                            <div key={comm.id} className="relative pl-8">
                              {/* Timeline dot with icon */}
                              <div className={`absolute left-0 top-0 w-6 h-6 rounded-full ${typeConfig.bgColor} border ${typeConfig.borderColor} flex items-center justify-center`}>
                                <IconComponent className={`w-3 h-3 ${typeConfig.color}`} />
                              </div>

                              {/* Content */}
                              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-800">
                                <div className="flex items-start justify-between mb-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color} border ${typeConfig.borderColor}`}>
                                    {typeConfig.label}
                                  </span>
                                  <span className="text-xs text-zinc-500" title={fullDate}>
                                    {timeAgo(comm.sentAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-300 mt-1">{comm.note}</p>
                                {comm.bookingUrl && (
                                  <a
                                    href={comm.bookingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                                  >
                                    View booking link →
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Empty state for filtered view */}
                    {timelineFilter !== 'all' && communications.filter(c => c.type === timelineFilter).length === 0 && (
                      <p className="text-xs text-zinc-500 italic pl-8">No {TIMELINE_TYPES[timelineFilter]?.label || timelineFilter} entries found.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Remove {talent.name}?</h3>
            <p className="text-zinc-400 text-sm mb-5">This will permanently delete their profile and all associated data.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-zinc-400 hover:text-white text-sm">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, editing, value, onChange, children, inputType = 'text' }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      {editing ? (
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
        />
      ) : (
        <div className="text-sm">{children}</div>
      )}
    </div>
  );
}
