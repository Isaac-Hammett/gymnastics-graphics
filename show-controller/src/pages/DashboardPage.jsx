import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompetitions } from '../hooks/useCompetitions';
import { competitionTypes, teamCounts, typeLabels } from '../lib/graphicButtons';

export default function DashboardPage() {
  const { competitions, loading, createCompetition, updateCompetition, deleteCompetition, duplicateCompetition } = useCompetitions();
  const [showModal, setShowModal] = useState(false);
  const [editingCompId, setEditingCompId] = useState(null);
  const [formData, setFormData] = useState(getDefaultFormData());

  const competitionList = Object.keys(competitions);

  function getDefaultFormData() {
    return {
      compId: '',
      compType: '',
      eventName: '',
      meetDate: '',
      venue: '',
      location: '',
      team1Name: '',
      team2Name: '',
      team3Name: '',
      team3Logo: '',
      team4Name: '',
      team4Logo: '',
      team5Name: '',
      team5Logo: '',
      team6Name: '',
      team6Logo: '',
    };
  }

  function openCreateModal() {
    setEditingCompId(null);
    setFormData(getDefaultFormData());
    setShowModal(true);
  }

  function openEditModal(compId) {
    const config = competitions[compId]?.config || {};
    setEditingCompId(compId);
    setFormData({
      compId,
      compType: config.compType || 'mens-dual',
      eventName: config.eventName || '',
      meetDate: config.meetDate || '',
      venue: config.venue || '',
      location: config.location || '',
      team1Name: config.team1Name || '',
      team2Name: config.team2Name || '',
      team3Name: config.team3Name || '',
      team3Logo: config.team3Logo || '',
      team4Name: config.team4Name || '',
      team4Logo: config.team4Logo || '',
      team5Name: config.team5Name || '',
      team5Logo: config.team5Logo || '',
      team6Name: config.team6Name || '',
      team6Logo: config.team6Logo || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const compId = formData.compId.toLowerCase().trim();

    const config = {
      compType: formData.compType,
      eventName: formData.eventName,
      meetDate: formData.meetDate,
      venue: formData.venue,
      location: formData.location,
      team1Name: formData.team1Name,
      team2Name: formData.team2Name,
      team3Name: formData.team3Name,
      team3Logo: formData.team3Logo || 'https://via.placeholder.com/200/006400/FFFFFF?text=T3',
      team4Name: formData.team4Name,
      team4Logo: formData.team4Logo || 'https://via.placeholder.com/200/800080/FFFFFF?text=T4',
      team5Name: formData.team5Name,
      team5Logo: formData.team5Logo || 'https://via.placeholder.com/200/FF6600/FFFFFF?text=T5',
      team6Name: formData.team6Name,
      team6Logo: formData.team6Logo || 'https://via.placeholder.com/200/000080/FFFFFF?text=T6',
      // Defaults
      hosts: 'Host Name',
      team1Logo: 'https://via.placeholder.com/200/00274C/FFCB05?text=T1',
      team1Ave: '0.000',
      team1High: '0.000',
      team1Con: '0%',
      team1Coaches: 'Coach Name',
      team2Logo: 'https://via.placeholder.com/200/BB0000/FFFFFF?text=T2',
      team2Ave: '0.000',
      team2High: '0.000',
      team2Con: '0%',
      team2Coaches: 'Coach Name',
      team3Ave: '0.000',
      team3High: '0.000',
      team3Con: '0%',
      team3Coaches: 'Coach Name',
      team4Ave: '0.000',
      team4High: '0.000',
      team4Con: '0%',
      team4Coaches: 'Coach Name',
      team5Ave: '0.000',
      team5High: '0.000',
      team5Con: '0%',
      team5Coaches: 'Coach Name',
      team6Ave: '0.000',
      team6High: '0.000',
      team6Con: '0%',
      team6Coaches: 'Coach Name',
    };

    if (editingCompId) {
      await updateCompetition(editingCompId, config);
    } else {
      await createCompetition(compId, config);
    }

    setShowModal(false);
  }

  async function handleDelete() {
    if (!editingCompId) return;
    if (window.confirm(`Are you sure you want to delete competition "${editingCompId}"? This cannot be undone.`)) {
      await deleteCompetition(editingCompId);
      setShowModal(false);
    }
  }

  async function handleDuplicate(compId) {
    const newCompId = window.prompt(`Duplicate "${compId}" as:\n\nEnter new competition ID (lowercase, no spaces):`, compId + '-copy');
    if (!newCompId) return;

    if (!/^[a-z0-9-]+$/.test(newCompId)) {
      alert('Competition ID can only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    if (competitions[newCompId]) {
      alert(`Competition "${newCompId}" already exists. Please choose a different ID.`);
      return;
    }

    await duplicateCompetition(compId, newCompId);
  }

  async function handleDeleteFromCard(compId) {
    if (window.confirm(`Are you sure you want to delete "${compId}"?\n\nThis will permanently delete:\n- All configuration\n- Current graphic state\n- All data for this competition\n\nThis cannot be undone.`)) {
      await deleteCompetition(compId);
    }
  }

  const teamCount = teamCounts[formData.compType] || 2;

  return (
    <div className="min-h-screen bg-zinc-950 p-10">
      <Link
        to="/"
        className="fixed top-5 left-5 flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm hover:bg-zinc-700 transition-colors z-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Hub
      </Link>

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-2">Gymnastics Graphics Dashboard</h1>
          <p className="text-zinc-500">Manage multiple competitions simultaneously</p>
        </div>

        <div className="flex justify-center mb-10">
          <button
            onClick={openCreateModal}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
          >
            + Create New Competition
          </button>
        </div>

        {competitionList.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-xl">
            <h2 className="text-xl font-semibold text-white mb-2">No Competitions Yet</h2>
            <p className="text-zinc-500 mb-6">Create your first competition to get started</p>
            <button
              onClick={openCreateModal}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
            >
              + Create Competition
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {competitionList.map((compId) => {
              const config = competitions[compId]?.config || {};
              const hasConfig = config.eventName && config.team1Name && config.team2Name;
              const teams = [config.team1Name, config.team2Name, config.team3Name, config.team4Name, config.team5Name, config.team6Name].filter(Boolean);

              return (
                <div
                  key={compId}
                  className="bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 hover:border-blue-500 transition-colors"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                        {compId} • {typeLabels[config.compType] || 'Type not set'}
                      </div>
                      <div className="text-xl font-bold text-white mb-1">
                        {config.eventName || 'Untitled Competition'}
                      </div>
                      <div className="text-sm text-zinc-400">
                        {config.meetDate || 'Date not set'}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-semibold ${
                      hasConfig ? 'bg-green-500 text-black' : 'bg-zinc-700 text-white'
                    }`}>
                      {hasConfig ? 'Configured' : 'Draft'}
                    </span>
                  </div>

                  <div className="mb-5 pb-5 border-b border-zinc-800">
                    <div className="text-sm text-white mb-1">{teams.join(' vs ') || 'Teams not set'}</div>
                    <div className="text-xs text-zinc-500">{config.venue || 'Venue not set'} • {config.location || 'Location not set'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/controller?comp=${compId}`}
                      className="px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium text-center rounded-lg transition-colors"
                    >
                      Open Controller
                    </Link>
                    <a
                      href={`/output.html?comp=${compId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm text-center rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      Open Output
                    </a>
                    <Link
                      to={`/url-generator?comp=${compId}`}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm text-center rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      URL Generator
                    </Link>
                    <button
                      onClick={() => openEditModal(compId)}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      Edit Config
                    </button>
                    <button
                      onClick={() => handleDuplicate(compId)}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDeleteFromCard(compId)}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-red-400 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-2">
              {editingCompId ? 'Edit Competition' : 'Create Competition'}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">Configure competition details</p>

            <form onSubmit={handleSubmit}>
              <FormGroup label="Competition ID (no spaces, lowercase)">
                <input
                  type="text"
                  value={formData.compId}
                  onChange={(e) => setFormData({ ...formData, compId: e.target.value })}
                  disabled={!!editingCompId}
                  placeholder="e.g., court1, meet-a, ncaa-finals"
                  pattern="[a-z0-9-]+"
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </FormGroup>

              <FormGroup label="Competition Type">
                <select
                  value={formData.compType}
                  onChange={(e) => setFormData({ ...formData, compType: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select type...</option>
                  {competitionTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </FormGroup>

              <FormGroup label="Event Name">
                <input
                  type="text"
                  value={formData.eventName}
                  onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                  placeholder="e.g., Big Ten Dual Meet"
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </FormGroup>

              <FormGroup label="Meet Date">
                <input
                  type="text"
                  value={formData.meetDate}
                  onChange={(e) => setFormData({ ...formData, meetDate: e.target.value })}
                  placeholder="e.g., January 15, 2025"
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </FormGroup>

              <div className="grid grid-cols-2 gap-3">
                <FormGroup label="Venue">
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="e.g., Crisler Center"
                    required
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </FormGroup>
                <FormGroup label="Location">
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Ann Arbor, MI"
                    required
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </FormGroup>
              </div>

              <FormGroup label="Team 1 Name">
                <input
                  type="text"
                  value={formData.team1Name}
                  onChange={(e) => setFormData({ ...formData, team1Name: e.target.value })}
                  placeholder="e.g., Michigan"
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </FormGroup>

              <FormGroup label="Team 2 Name">
                <input
                  type="text"
                  value={formData.team2Name}
                  onChange={(e) => setFormData({ ...formData, team2Name: e.target.value })}
                  placeholder="e.g., Ohio State"
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </FormGroup>

              {teamCount >= 3 && (
                <>
                  <FormGroup label="Team 3 Name">
                    <input
                      type="text"
                      value={formData.team3Name}
                      onChange={(e) => setFormData({ ...formData, team3Name: e.target.value })}
                      placeholder="e.g., Penn State"
                      required
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </FormGroup>
                  <FormGroup label="Team 3 Logo URL">
                    <input
                      type="text"
                      value={formData.team3Logo}
                      onChange={(e) => setFormData({ ...formData, team3Logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </FormGroup>
                </>
              )}

              {teamCount >= 4 && (
                <>
                  <FormGroup label="Team 4 Name">
                    <input
                      type="text"
                      value={formData.team4Name}
                      onChange={(e) => setFormData({ ...formData, team4Name: e.target.value })}
                      placeholder="e.g., Nebraska"
                      required
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </FormGroup>
                  <FormGroup label="Team 4 Logo URL">
                    <input
                      type="text"
                      value={formData.team4Logo}
                      onChange={(e) => setFormData({ ...formData, team4Logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </FormGroup>
                </>
              )}

              {teamCount >= 5 && (
                <>
                  <FormGroup label="Team 5 Name">
                    <input
                      type="text"
                      value={formData.team5Name}
                      onChange={(e) => setFormData({ ...formData, team5Name: e.target.value })}
                      placeholder="e.g., Stanford"
                      required
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </FormGroup>
                  <FormGroup label="Team 5 Logo URL">
                    <input
                      type="text"
                      value={formData.team5Logo}
                      onChange={(e) => setFormData({ ...formData, team5Logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </FormGroup>
                </>
              )}

              {teamCount >= 6 && (
                <>
                  <FormGroup label="Team 6 Name">
                    <input
                      type="text"
                      value={formData.team6Name}
                      onChange={(e) => setFormData({ ...formData, team6Name: e.target.value })}
                      placeholder="e.g., Oklahoma"
                      required
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </FormGroup>
                  <FormGroup label="Team 6 Logo URL">
                    <input
                      type="text"
                      value={formData.team6Logo}
                      onChange={(e) => setFormData({ ...formData, team6Logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </FormGroup>
                </>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                {editingCompId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors"
                >
                  Save Competition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
