import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTalentRoster, getStatusLabel, getStatusColor, wagMagLabel } from '../hooks/useTalentRoster';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserGroupIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ready', label: 'Ready' },
  { value: 'has-contact', label: 'Has Contact' },
  { value: 'did-2025', label: 'Did 2025' },
  { value: 'need-info', label: 'Need Info' },
];

const WAG_MAG_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'WAG', label: 'WAG' },
  { value: 'MAG', label: 'MAG' },
  { value: 'Both', label: 'Both' },
];

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'Play by Play / Lead', label: 'Play by Play' },
  { value: 'Color / Analyst', label: 'Color / Analyst' },
  { value: 'Does not matter', label: 'Flexible' },
];

/**
 * TalentPage - Global talent roster management page.
 * URL: /talent
 */
export default function TalentPage() {
  const { talentList, loading, error, createTalent } = useTalentRoster();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [wagMagFilter, setWagMagFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newTalent, setNewTalent] = useState({
    name: '',
    phone: '',
    email: '',
    wagMag: 'Both',
    commentaryRole: 'Does not matter',
    canProduce: false,
    affiliation: '',
    conference: '',
    status: 'has-contact',
    notes: '',
    otherInterests: [],
  });

  const filtered = talentList.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.name?.toLowerCase().includes(q) &&
        !t.affiliation?.toLowerCase().includes(q) &&
        !t.conference?.toLowerCase().includes(q) &&
        !t.notes?.toLowerCase().includes(q)
      ) return false;
    }
    if (statusFilter && t.status !== statusFilter) return false;
    if (wagMagFilter && t.wagMag !== wagMagFilter) return false;
    if (roleFilter && t.commentaryRole !== roleFilter) return false;
    return true;
  });

  const counts = {
    ready: talentList.filter(t => t.status === 'ready').length,
    hasContact: talentList.filter(t => t.status === 'has-contact').length,
    didPrior: talentList.filter(t => t.status?.startsWith('did-')).length,
    needInfo: talentList.filter(t => t.status === 'need-info').length,
  };

  async function handleCreate(e) {
    e.preventDefault();
    if (!newTalent.name.trim()) return;
    setSaving(true);
    try {
      const id = await createTalent(newTalent);
      setShowAddModal(false);
      setNewTalent({
        name: '', phone: '', email: '', wagMag: 'Both',
        commentaryRole: 'Does not matter', canProduce: false,
        affiliation: '', conference: '', status: 'has-contact', notes: '', otherInterests: [],
      });
      navigate(`/talent/${id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-white text-sm transition-colors">
              ← Home
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <UserGroupIcon className="w-6 h-6 text-blue-400" />
                Talent Roster
              </h1>
              <p className="text-gray-400 text-sm">{talentList.length} total contacts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/talent/discover"
              className="flex items-center gap-2 px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg text-sm font-medium transition-colors"
            >
              <SparklesIcon className="w-4 h-4" />
              Discover Talent
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Talent
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Status summary strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Ready', count: counts.ready, color: 'border-green-600 bg-green-900/20', filter: 'ready' },
            { label: 'Has Contact', count: counts.hasContact, color: 'border-blue-600 bg-blue-900/20', filter: 'has-contact' },
            { label: 'Did Prior Season', count: counts.didPrior, color: 'border-amber-600 bg-amber-900/20', filter: 'did-2025' },
            { label: 'Need Info', count: counts.needInfo, color: 'border-gray-600 bg-gray-800/50', filter: 'need-info' },
          ].map(({ label, count, color, filter }) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(statusFilter === filter ? '' : filter)}
              className={`rounded-lg border p-3 text-left transition-colors ${color} ${statusFilter === filter ? 'ring-2 ring-white/20' : 'hover:bg-opacity-30'}`}
            >
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-xs text-gray-300 mt-0.5">{label}</div>
            </button>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, affiliation, conference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={wagMagFilter}
            onChange={(e) => setWagMagFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {WAG_MAG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {(search || statusFilter || wagMagFilter || roleFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setWagMagFilter(''); setRoleFilter(''); }}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
            >
              <XMarkIcon className="w-4 h-4" />
              Clear
            </button>
          )}
          <span className="text-gray-500 text-sm ml-auto">{filtered.length} shown</span>
        </div>

        {/* Talent list */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading roster...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            {talentList.length === 0 ? 'No talent in roster yet. Add someone to get started.' : 'No results match your filters.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((talent) => (
              <TalentCard key={talent.id} talent={talent} />
            ))}
          </div>
        )}
      </div>

      {/* Add Talent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Add Talent</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    required
                    value={newTalent.name}
                    onChange={e => setNewTalent(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Phone</label>
                  <input
                    value={newTalent.phone}
                    onChange={e => setNewTalent(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newTalent.email}
                    onChange={e => setNewTalent(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">WAG / MAG</label>
                  <select
                    value={newTalent.wagMag}
                    onChange={e => setNewTalent(p => ({ ...p, wagMag: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="WAG">WAG</option>
                    <option value="MAG">MAG</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Role</label>
                  <select
                    value={newTalent.commentaryRole}
                    onChange={e => setNewTalent(p => ({ ...p, commentaryRole: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Play by Play / Lead">Play by Play / Lead</option>
                    <option value="Color / Analyst">Color / Analyst</option>
                    <option value="Does not matter">Does not matter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select
                    value={newTalent.status}
                    onChange={e => setNewTalent(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="ready">Ready</option>
                    <option value="has-contact">Has Contact</option>
                    <option value="did-2025">Did 2025</option>
                    <option value="need-info">Need Info</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Affiliation</label>
                  <input
                    value={newTalent.affiliation}
                    onChange={e => setNewTalent(p => ({ ...p, affiliation: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Stanford Alumni"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Conference</label>
                  <input
                    value={newTalent.conference}
                    onChange={e => setNewTalent(p => ({ ...p, conference: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. ECAC, GEC, NCGA"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    id="canProduce"
                    type="checkbox"
                    checked={newTalent.canProduce}
                    onChange={e => setNewTalent(p => ({ ...p, canProduce: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="canProduce" className="text-sm text-gray-300">Can also produce</label>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={newTalent.notes}
                    onChange={e => setNewTalent(p => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Any notes about this person..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newTalent.name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Add & Open Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TalentCard({ talent }) {
  const statusBadge = getStatusColor(talent.status);
  const wm = wagMagLabel(talent.wagMag);

  return (
    <Link
      to={`/talent/${talent.id}`}
      className="block bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg px-4 py-3 transition-colors group"
    >
      <div className="flex items-center gap-3">
        {/* Status + WAG/MAG badges */}
        <div className="flex flex-col gap-1 w-24 flex-shrink-0">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge}`}>
            {getStatusLabel(talent.status)}
          </span>
          {talent.wagMag && (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${wm.color}`}>
              {wm.label}
            </span>
          )}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white group-hover:text-blue-300 transition-colors">
              {talent.name}
            </span>
            {talent.canProduce && (
              <span className="px-1.5 py-0.5 bg-teal-800 text-teal-200 text-xs rounded">Producer</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 truncate">
            {[talent.commentaryRole, talent.affiliation, talent.conference].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Contact info */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {talent.phone && (
            <a
              href={`tel:${talent.phone}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
              title={talent.phone}
            >
              <PhoneIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">{talent.phone}</span>
            </a>
          )}
          {talent.email && (
            <a
              href={`mailto:${talent.email}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-300 text-sm transition-colors"
              title={talent.email}
            >
              <EnvelopeIcon className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Competition count */}
        <div className="text-right flex-shrink-0 w-16">
          {(talent.totalCompetitions > 0 || talent.competitionHistory?.length > 0) && (
            <div className="text-sm font-semibold text-white">
              {talent.totalCompetitions || talent.competitionHistory?.length || 0}
            </div>
          )}
          <div className="text-xs text-gray-500">
            {(talent.totalCompetitions || talent.competitionHistory?.length || 0) === 1 ? 'event' : 'events'}
          </div>
        </div>
      </div>

      {/* Notes snippet */}
      {talent.notes && (
        <div className="mt-2 text-xs text-gray-500 truncate pl-27">
          {talent.notes}
        </div>
      )}
    </Link>
  );
}
