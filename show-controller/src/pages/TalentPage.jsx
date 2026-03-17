import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTalentRoster, getStatusLabel, getStatusColor, wagMagLabel } from '../hooks/useTalentRoster';
import { useTalentAssignments } from '../hooks/useTalentAssignments';
import TalentTable from '../components/crm/TalentTable';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserGroupIcon,
  SparklesIcon,
  XMarkIcon,
  TableCellsIcon,
  Squares2X2Icon,
  BookmarkIcon,
  TrashIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
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

const SAVED_VIEWS_KEY = 'crm-saved-views';
const MAX_SAVED_VIEWS = 10;

/**
 * TalentPage - Global talent roster management page.
 * URL: /talent
 */
export default function TalentPage() {
  const { talentList, loading, error, createTalent, updateTalent } = useTalentRoster();
  const { assignmentsByTalent, loading: assignmentsLoading } = useTalentAssignments(talentList);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL params
  const urlSearch = searchParams.get('q') || '';
  const urlStatus = searchParams.get('status') || '';
  const urlWagMag = searchParams.get('wagMag') || '';
  const urlRole = searchParams.get('role') || '';

  // Local state for instant UI feedback (debounced sync to URL)
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [wagMagFilter, setWagMagFilter] = useState(urlWagMag);
  const [roleFilter, setRoleFilter] = useState(urlRole);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('crm-talent-view') || 'table');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Saved views state
  const [savedViews, setSavedViews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY)) || [];
    } catch { return []; }
  });
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [showViewsDropdown, setShowViewsDropdown] = useState(false);
  const viewsDropdownRef = useRef(null);

  // Debounce search input → URL sync (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      if (wagMagFilter) params.set('wagMag', wagMagFilter);
      if (roleFilter) params.set('role', roleFilter);
      setSearchParams(params, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, wagMagFilter, roleFilter, setSearchParams]);

  // Close views dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (viewsDropdownRef.current && !viewsDropdownRef.current.contains(e.target)) {
        setShowViewsDropdown(false);
      }
    }
    if (showViewsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showViewsDropdown]);

  // Persist saved views to localStorage
  useEffect(() => {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  function handleSaveView(e) {
    e.preventDefault();
    if (!newViewName.trim()) return;
    if (savedViews.length >= MAX_SAVED_VIEWS) {
      alert(`Maximum ${MAX_SAVED_VIEWS} saved views. Remove one first.`);
      return;
    }
    const newView = {
      id: Date.now(),
      name: newViewName.trim(),
      filters: { q: search, status: statusFilter, wagMag: wagMagFilter, role: roleFilter },
    };
    setSavedViews([...savedViews, newView]);
    setNewViewName('');
    setShowSaveViewModal(false);
  }

  function loadView(view) {
    setSearch(view.filters.q || '');
    setStatusFilter(view.filters.status || '');
    setWagMagFilter(view.filters.wagMag || '');
    setRoleFilter(view.filters.role || '');
    setShowViewsDropdown(false);
  }

  function deleteView(id) {
    setSavedViews(savedViews.filter(v => v.id !== id));
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setWagMagFilter('');
    setRoleFilter('');
  }

  const hasActiveFilters = search || statusFilter || wagMagFilter || roleFilter;

  // Clear selection when switching to card view
  const handleViewChange = useCallback((mode) => {
    setViewMode(mode);
    localStorage.setItem('crm-talent-view', mode);
    if (mode === 'cards') {
      setSelectedIds([]); // Clear selection when switching to cards
    }
  }, []);

  // Bulk CSV export
  const handleExportCSV = useCallback(() => {
    const selectedTalent = talentList.filter(t => selectedIds.includes(t.id));
    const rows = selectedTalent.map(t => {
      const aData = assignmentsByTalent[t.id] || {};
      const assignmentNames = (aData.assignments || []).map(a => a.compName).join(', ');
      const lastOutreachDate = aData.lastOutreach ? new Date(aData.lastOutreach).toLocaleDateString() : '';
      return [
        t.name || '',
        getStatusLabel(t.status),
        t.wagMag || '',
        t.commentaryRole || '',
        t.phone || '',
        t.email || '',
        assignmentNames,
        lastOutreachDate,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const headers = 'Name,Status,WAG/MAG,Role,Phone,Email,Assignments,Last Outreach';
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talent-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedIds, talentList, assignmentsByTalent]);

  // Bulk status update
  const handleBulkStatusUpdate = useCallback(async () => {
    if (!bulkStatus) return;
    setBulkUpdating(true);
    try {
      await Promise.all(selectedIds.map(id => updateTalent(id, { status: bulkStatus })));
      setSelectedIds([]);
      setShowBulkStatusModal(false);
      setBulkStatus('');
    } finally {
      setBulkUpdating(false);
    }
  }, [selectedIds, bulkStatus]);

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
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-zinc-400 hover:text-white text-sm transition-colors">
              ← Home
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <UserGroupIcon className="w-6 h-6 text-blue-400" />
                Talent Roster
              </h1>
              <p className="text-zinc-400 text-sm">{talentList.length} total contacts</p>
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
            { label: 'Need Info', count: counts.needInfo, color: 'border-zinc-700 bg-zinc-900/50', filter: 'need-info' },
          ].map(({ label, count, color, filter }) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(statusFilter === filter ? '' : filter)}
              className={`rounded-lg border p-3 text-left transition-colors ${color} ${statusFilter === filter ? 'ring-2 ring-white/20' : 'hover:bg-opacity-30'}`}
            >
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-xs text-zinc-300 mt-0.5">{label}</div>
            </button>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, affiliation, conference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={wagMagFilter}
            onChange={(e) => setWagMagFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {WAG_MAG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-zinc-400 hover:text-white text-sm flex items-center gap-1"
            >
              <XMarkIcon className="w-4 h-4" />
              Clear
            </button>
          )}
          {/* Saved Views */}
          <div className="relative" ref={viewsDropdownRef}>
            <button
              onClick={() => setShowViewsDropdown(!showViewsDropdown)}
              className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-white text-sm border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
            >
              <BookmarkIcon className="w-3.5 h-3.5" />
              Views
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${showViewsDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showViewsDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 min-w-48">
                {savedViews.length > 0 ? (
                  <div className="py-1">
                    {savedViews.map(view => (
                      <div key={view.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-zinc-700">
                        <button
                          onClick={() => loadView(view)}
                          className="flex-1 text-left text-sm text-zinc-200 hover:text-white"
                        >
                          {view.name}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete view"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-xs text-zinc-500">No saved views</div>
                )}
                <div className="border-t border-zinc-700">
                  <button
                    onClick={() => { setShowViewsDropdown(false); setShowSaveViewModal(true); }}
                    disabled={!hasActiveFilters}
                    className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed"
                  >
                    {hasActiveFilters ? 'Save current filters...' : 'Set filters to save'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-zinc-500 text-sm mr-2">{filtered.length} shown</span>
            <button
              onClick={() => handleViewChange('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Table view"
            >
              <TableCellsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewChange('cards')}
              className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Card view"
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Talent list */}
        {loading ? (
          <div className="text-center py-20 text-zinc-500">Loading roster...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            {talentList.length === 0 ? 'No talent in roster yet. Add someone to get started.' : 'No results match your filters.'}
          </div>
        ) : viewMode === 'table' ? (
          <TalentTable
            talents={filtered}
            assignmentsByTalent={assignmentsByTalent}
            loading={assignmentsLoading}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((talent) => (
              <TalentCard key={talent.id} talent={talent} assignmentData={assignmentsByTalent[talent.id]} />
            ))}
          </div>
        )}
      </div>

      {/* Add Talent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Add Talent</h2>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                  <input
                    required
                    value={newTalent.name}
                    onChange={e => setNewTalent(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Phone</label>
                  <input
                    value={newTalent.phone}
                    onChange={e => setNewTalent(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newTalent.email}
                    onChange={e => setNewTalent(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">WAG / MAG</label>
                  <select
                    value={newTalent.wagMag}
                    onChange={e => setNewTalent(p => ({ ...p, wagMag: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="WAG">WAG</option>
                    <option value="MAG">MAG</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Role</label>
                  <select
                    value={newTalent.commentaryRole}
                    onChange={e => setNewTalent(p => ({ ...p, commentaryRole: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Play by Play / Lead">Play by Play / Lead</option>
                    <option value="Color / Analyst">Color / Analyst</option>
                    <option value="Does not matter">Does not matter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Status</label>
                  <select
                    value={newTalent.status}
                    onChange={e => setNewTalent(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="ready">Ready</option>
                    <option value="has-contact">Has Contact</option>
                    <option value="did-2025">Did 2025</option>
                    <option value="need-info">Need Info</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Affiliation</label>
                  <input
                    value={newTalent.affiliation}
                    onChange={e => setNewTalent(p => ({ ...p, affiliation: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Stanford Alumni"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Conference</label>
                  <input
                    value={newTalent.conference}
                    onChange={e => setNewTalent(p => ({ ...p, conference: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
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
                  <label htmlFor="canProduce" className="text-sm text-zinc-300">Can also produce</label>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Notes</label>
                  <textarea
                    value={newTalent.notes}
                    onChange={e => setNewTalent(p => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Any notes about this person..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-zinc-400 hover:text-white text-sm">
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

      {/* Save View Modal */}
      {showSaveViewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Save Filter View</h2>
              <button onClick={() => setShowSaveViewModal(false)} className="text-zinc-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveView} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">View Name</label>
                <input
                  autoFocus
                  required
                  value={newViewName}
                  onChange={e => setNewViewName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Available WAG Analysts"
                />
              </div>
              <div className="text-xs text-zinc-500">
                <div className="font-medium mb-1">Current filters:</div>
                <ul className="space-y-0.5">
                  {search && <li>Search: "{search}"</li>}
                  {statusFilter && <li>Status: {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}</li>}
                  {wagMagFilter && <li>WAG/MAG: {wagMagFilter}</li>}
                  {roleFilter && <li>Role: {ROLE_OPTIONS.find(o => o.value === roleFilter)?.label}</li>}
                </ul>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowSaveViewModal(false)} className="px-4 py-2 text-zinc-400 hover:text-white text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newViewName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Save View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Status Confirmation Modal */}
      {showBulkStatusModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Confirm Status Change</h2>
              <button onClick={() => setShowBulkStatusModal(false)} className="text-zinc-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-zinc-300">
                Update status to <span className="font-semibold text-white">{STATUS_OPTIONS.find(o => o.value === bulkStatus)?.label}</span> for <span className="font-semibold text-white">{selectedIds.length}</span> {selectedIds.length === 1 ? 'person' : 'people'}?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkStatusModal(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
                  disabled={bulkUpdating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkStatusUpdate}
                  disabled={bulkUpdating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  {bulkUpdating ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar (when selection > 0) */}
      {selectedIds.length > 0 && viewMode === 'table' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4 z-40">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium text-white">{selectedIds.length} selected</span>
          </div>
          <div className="w-px h-6 bg-zinc-700" />
          <div className="flex items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setBulkStatus(e.target.value);
                  setShowBulkStatusModal(true);
                }
              }}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Set Status...</option>
              {STATUS_OPTIONS.filter(o => o.value).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-white transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return null;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ASSIGNMENT_STATUS_COLORS = {
  assigned: 'bg-zinc-700 text-zinc-200',
  invited: 'bg-blue-800 text-blue-200',
  confirmed: 'bg-green-800 text-green-200',
  briefed: 'bg-purple-800 text-purple-200',
  declined: 'bg-red-800 text-red-200',
};

const ROLE_ABBREV = {
  pbp: 'PBP',
  analyst: 'Analyst',
  'Play by Play / Lead': 'PBP',
  'Color / Analyst': 'Analyst',
};

function TalentCard({ talent, assignmentData }) {
  const statusBadge = getStatusColor(talent.status);
  const wm = wagMagLabel(talent.wagMag);
  const assignments = assignmentData?.assignments || [];
  const showAssignments = assignments.slice(0, 2);
  const moreCount = assignments.length - 2;

  return (
    <Link
      to={`/talent/${talent.id}`}
      className="block bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-3 transition-colors group"
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
            {assignmentData?.availabilityDot === 'green' && (
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Available for upcoming competitions" />
            )}
            <span className="font-semibold text-white group-hover:text-blue-300 transition-colors">
              {talent.name}
            </span>
            {talent.canProduce && (
              <span className="px-1.5 py-0.5 bg-teal-800 text-teal-200 text-xs rounded">Producer</span>
            )}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5 truncate">
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
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
              title={talent.email}
            >
              <EnvelopeIcon className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Assignments */}
        <div className="text-right flex-shrink-0 max-w-52">
          {assignments.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1">
              {showAssignments.map(a => (
                <span key={a.compId} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${ASSIGNMENT_STATUS_COLORS[a.status] || ASSIGNMENT_STATUS_COLORS.assigned}`}>
                  <span className="truncate max-w-24">{a.compName}</span>
                  <span className="opacity-70">{ROLE_ABBREV[a.role] || a.role}</span>
                </span>
              ))}
              {moreCount > 0 && (
                <span className="text-xs text-zinc-500">+{moreCount}</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">No assignments</div>
          )}
        </div>
      </div>

      {/* Last outreach + notes */}
      <div className="mt-2 flex items-center gap-4 pl-27">
        {assignmentData?.lastOutreach && (
          <span className="text-xs text-zinc-500" title={new Date(assignmentData.lastOutreach).toLocaleString()}>
            Last contacted: {formatTimeAgo(assignmentData.lastOutreach)} ({assignmentData.lastOutreachType})
          </span>
        )}
        {talent.notes && (
          <span className="text-xs text-zinc-500 truncate flex-1">
            {talent.notes}
          </span>
        )}
      </div>
    </Link>
  );
}
