import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTalentRoster, getStatusLabel, getStatusColor, wagMagLabel } from '../hooks/useTalentRoster';
import {
  PhoneIcon,
  EnvelopeIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  TrophyIcon,
  ChatBubbleLeftRightIcon,
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

  const talent = talents[talentId];

  useEffect(() => {
    if (talent && !form) {
      setForm({ ...talent });
    }
  }, [talent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!talent) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Talent not found.</p>
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

  const wm = wagMagLabel(talent.wagMag);
  const history = talent.competitionHistory || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/talent" className="text-gray-400 hover:text-white text-sm transition-colors">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
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
        {/* Left: Profile fields */}
        <div className="col-span-2 space-y-5">

          {/* Contact info */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Contact</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" editing={editing} value={form?.name || ''} onChange={v => setForm(p => ({ ...p, name: v }))}>
                <a href={`tel:${talent.name}`} className="font-semibold text-white">{talent.name}</a>
              </Field>
              <Field label="Phone" editing={editing} value={form?.phone || ''} onChange={v => setForm(p => ({ ...p, phone: v }))}>
                {talent.phone ? (
                  <a href={`tel:${talent.phone}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                    <PhoneIcon className="w-4 h-4" />
                    {talent.phone}
                  </a>
                ) : <span className="text-gray-500 italic text-sm">Not provided</span>}
              </Field>
              <Field label="Email" editing={editing} value={form?.email || ''} onChange={v => setForm(p => ({ ...p, email: v }))}>
                {talent.email ? (
                  <a href={`mailto:${talent.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                    <EnvelopeIcon className="w-4 h-4" />
                    {talent.email}
                  </a>
                ) : <span className="text-gray-500 italic text-sm">Not provided</span>}
              </Field>
              <Field label="Discord" editing={editing} value={form?.discordHandle || ''} onChange={v => setForm(p => ({ ...p, discordHandle: v }))}>
                <span className="text-sm text-white">{talent.discordHandle || <span className="text-gray-500 italic">Not set</span>}</span>
              </Field>
            </div>
          </div>

          {/* Commentary details */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Commentary Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">WAG / MAG</label>
                {editing ? (
                  <select
                    value={form.wagMag || ''}
                    onChange={e => setForm(p => ({ ...p, wagMag: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
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
                <label className="block text-xs text-gray-500 mb-1">Commentary Role</label>
                {editing ? (
                  <select
                    value={form.commentaryRole || ''}
                    onChange={e => setForm(p => ({ ...p, commentaryRole: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
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
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                {editing ? (
                  <select
                    value={form.status || ''}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
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
                <label className="block text-xs text-gray-500 mb-1">Affiliation</label>
                {editing ? (
                  <input
                    value={form.affiliation || ''}
                    onChange={e => setForm(p => ({ ...p, affiliation: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Stanford Alumni"
                  />
                ) : <span className="text-sm text-white">{talent.affiliation || '—'}</span>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Conference</label>
                {editing ? (
                  <input
                    value={form.conference || ''}
                    onChange={e => setForm(p => ({ ...p, conference: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
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
                    <label htmlFor="editCanProduce" className="text-sm text-gray-300">Can produce</label>
                  </>
                ) : (
                  <span className="text-sm text-white">{talent.canProduce ? '✓ Can produce' : '—'}</span>
                )}
              </div>
            </div>

            {/* Other Interests */}
            <div className="mt-4">
              <label className="block text-xs text-gray-500 mb-2">Other Interests</label>
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
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {interest.split(' (')[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(talent.otherInterests || []).length === 0
                    ? <span className="text-sm text-gray-500 italic">None listed</span>
                    : (talent.otherInterests || []).map(i => (
                      <span key={i} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                        {i.split(' (')[0]}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Tech onboarding */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Tech & Onboarding</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">2026 Survey</label>
                {editing ? (
                  <input
                    type="checkbox"
                    checked={form.surveyCompleted || false}
                    onChange={e => setForm(p => ({ ...p, surveyCompleted: e.target.checked }))}
                  />
                ) : (
                  <span className={`text-sm font-medium ${talent.surveyCompleted ? 'text-green-400' : 'text-gray-500'}`}>
                    {talent.surveyCompleted ? '✓ Completed' : 'Not completed'}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Text Sent</label>
                {editing ? (
                  <input
                    type="checkbox"
                    checked={form.textSent || false}
                    onChange={e => setForm(p => ({ ...p, textSent: e.target.checked }))}
                  />
                ) : (
                  <span className={`text-sm font-medium ${talent.textSent ? 'text-green-400' : 'text-gray-500'}`}>
                    {talent.textSent ? '✓ Sent' : 'Not sent'}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discord Added</label>
                {editing ? (
                  <input
                    type="checkbox"
                    checked={form.discordAdded || false}
                    onChange={e => setForm(p => ({ ...p, discordAdded: e.target.checked }))}
                  />
                ) : (
                  <span className={`text-sm font-medium ${talent.discordAdded ? 'text-green-400' : 'text-gray-500'}`}>
                    {talent.discordAdded ? '✓ Added' : 'Not added'}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Headphones</label>
                <span className="text-sm text-white">{talent.hasHeadphones ? 'Yes' : '—'}</span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Upload / Download</label>
                <span className="text-sm text-white">
                  {talent.internetUploadMbps ? `${talent.internetUploadMbps} / ${talent.internetDownloadMbps || '?'} Mbps` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Social links */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Social / Discovery</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="LinkedIn" editing={editing} value={form?.linkedInUrl || ''} onChange={v => setForm(p => ({ ...p, linkedInUrl: v }))} inputType="url">
                {talent.linkedInUrl
                  ? <a href={talent.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">{talent.linkedInUrl}</a>
                  : <span className="text-gray-500 italic text-sm">Not found</span>}
              </Field>
              <Field label="Instagram" editing={editing} value={form?.instagramUrl || ''} onChange={v => setForm(p => ({ ...p, instagramUrl: v }))} inputType="url">
                {talent.instagramUrl
                  ? <a href={talent.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">{talent.instagramUrl}</a>
                  : <span className="text-gray-500 italic text-sm">Not found</span>}
              </Field>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Discovered From</label>
                <span className="text-sm text-gray-400">{talent.discoveredFrom || 'manual'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: History + Notes */}
        <div className="space-y-5">
          {/* Competition history */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrophyIcon className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                History
              </h2>
              <span className="ml-auto text-xs text-gray-500">{talent.totalCompetitions || history.length} events</span>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No competitions recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...history].reverse().map((h, i) => (
                  <div key={i} className="text-xs border-b border-gray-700 pb-2 last:border-0">
                    <div className="text-white font-medium">{h.eventName || h.compId}</div>
                    <div className="text-gray-400">{h.date} · {h.role}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Notes</h2>
            </div>
            {editing ? (
              <textarea
                value={form.notes || ''}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Notes about this person..."
              />
            ) : (
              <>
                {talent.notes ? (
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto mb-3">
                    {talent.notes}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-500 italic mb-3">No notes yet.</p>
                )}
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !noteText.trim()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </form>
                <p className="text-xs text-gray-600 mt-1.5">Notes are timestamped automatically.</p>

                {/* Parsed availability hints */}
                {(talent.parsedAvailability?.availablePeriods?.length > 0 || talent.parsedAvailability?.unavailableDates?.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-500 mb-2">Extracted availability:</p>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Remove {talent.name}?</h3>
            <p className="text-gray-400 text-sm mb-5">This will permanently delete their profile and all associated data.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
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
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {editing ? (
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
        />
      ) : (
        <div className="text-sm">{children}</div>
      )}
    </div>
  );
}
