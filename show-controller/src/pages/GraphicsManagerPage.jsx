import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllGraphics,
  getCategories,
  getGraphicById,
} from '../lib/graphicsRegistry';
import { generateGraphicURL } from '../lib/urlBuilder';

// Category display names
const CATEGORY_LABELS = {
  'pre-meet': 'Pre-Meet',
  'in-meet': 'In-Meet',
  'event-frames': 'Event Frames',
  'frame-overlays': 'Frame Overlays',
  'leaderboards': 'Leaderboards',
  'event-summary': 'Event Summary',
  'stream': 'Stream',
};

// Gender display
const GENDER_LABELS = {
  'mens': "Men's",
  'womens': "Women's",
  'both': 'Both',
};

export default function GraphicsManagerPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [rendererFilter, setRendererFilter] = useState('all');
  const [previewGraphic, setPreviewGraphic] = useState(null);

  // Get all graphics from registry
  const allGraphics = useMemo(() => getAllGraphics(), []);
  const categories = useMemo(() => getCategories(), []);

  // Filter graphics
  const filteredGraphics = useMemo(() => {
    return allGraphics.filter(g => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!g.id.toLowerCase().includes(search) &&
            !g.label.toLowerCase().includes(search) &&
            !(g.keywords || []).some(k => k.toLowerCase().includes(search))) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all' && g.category !== categoryFilter) {
        return false;
      }

      // Gender filter
      if (genderFilter !== 'all' && g.gender !== genderFilter) {
        return false;
      }

      // Renderer filter
      if (rendererFilter !== 'all' && g.renderer !== rendererFilter) {
        return false;
      }

      return true;
    });
  }, [allGraphics, searchTerm, categoryFilter, genderFilter, rendererFilter]);

  // Group by category
  const groupedGraphics = useMemo(() => {
    const groups = {};
    for (const graphic of filteredGraphics) {
      if (!groups[graphic.category]) {
        groups[graphic.category] = [];
      }
      groups[graphic.category].push(graphic);
    }
    return groups;
  }, [filteredGraphics]);

  // Generate preview URL
  const previewUrl = useMemo(() => {
    if (!previewGraphic) return null;

    // Generate a test URL with placeholder data
    const testFormData = {
      team1Logo: 'https://media.virti.us/upload/images/team/0hHqMIqYSBWHy_uvZ-HQs',
      team1Name: 'Michigan',
      team2Logo: 'https://media.virti.us/upload/images/team/6AzE3ajFMD2k62b6kNM0G',
      team2Name: 'Ohio State',
      eventName: 'Test Meet',
      venue: 'Test Arena',
      hosts: 'John Smith|Jane Doe',
    };

    return generateGraphicURL(previewGraphic.id, testFormData, 2, undefined, {
      compType: previewGraphic.gender === 'womens' ? 'womens-dual' : 'mens-dual',
    });
  }, [previewGraphic]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              &larr; Back
            </Link>
            <h1 className="text-xl font-bold">Graphics Manager</h1>
            <span className="text-sm text-zinc-500">
              {allGraphics.length} graphics defined
            </span>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 max-w-7xl mx-auto">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by id, label, or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
            ))}
          </select>

          {/* Gender filter */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Genders</option>
            <option value="mens">Men's Only</option>
            <option value="womens">Women's Only</option>
            <option value="both">Both</option>
          </select>

          {/* Renderer filter */}
          <select
            value={rendererFilter}
            onChange={(e) => setRendererFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Renderers</option>
            <option value="overlay">Overlay</option>
            <option value="output">Output</option>
          </select>

          <div className="text-sm text-zinc-500">
            {filteredGraphics.length} results
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex max-w-7xl mx-auto">
        {/* Graphics list */}
        <div className="flex-1 p-6 overflow-y-auto">
          {Object.entries(groupedGraphics)
            .sort(([a], [b]) => {
              const order = ['pre-meet', 'in-meet', 'event-frames', 'frame-overlays', 'leaderboards', 'event-summary', 'stream'];
              return order.indexOf(a) - order.indexOf(b);
            })
            .map(([category, graphics]) => (
            <div key={category} className="mb-8">
              <h2 className="text-lg font-semibold text-zinc-300 mb-3 uppercase tracking-wide">
                {CATEGORY_LABELS[category] || category}
                <span className="ml-2 text-sm text-zinc-500 font-normal normal-case">
                  ({graphics.length})
                </span>
              </h2>

              <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-800 text-zinc-400 text-left">
                      <th className="px-4 py-2 font-medium">ID</th>
                      <th className="px-4 py-2 font-medium">Label</th>
                      <th className="px-4 py-2 font-medium">Gender</th>
                      <th className="px-4 py-2 font-medium">Renderer</th>
                      <th className="px-4 py-2 font-medium">File</th>
                      <th className="px-4 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graphics.map(graphic => (
                      <tr
                        key={graphic.id}
                        className="border-t border-zinc-800 hover:bg-zinc-800/50"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-blue-400">
                          {graphic.id}
                        </td>
                        <td className="px-4 py-2 text-white">
                          {graphic.label}
                          {graphic.perTeam && (
                            <span className="ml-2 text-xs text-amber-500">(per-team)</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-zinc-400">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            graphic.gender === 'mens' ? 'bg-blue-900/50 text-blue-400' :
                            graphic.gender === 'womens' ? 'bg-pink-900/50 text-pink-400' :
                            'bg-zinc-700 text-zinc-300'
                          }`}>
                            {GENDER_LABELS[graphic.gender]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-zinc-400">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            graphic.renderer === 'overlay' ? 'bg-green-900/50 text-green-400' :
                            'bg-purple-900/50 text-purple-400'
                          }`}>
                            {graphic.renderer}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-zinc-500">
                          {graphic.file}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => setPreviewGraphic(graphic)}
                            className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs transition-colors"
                          >
                            Preview
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {filteredGraphics.length === 0 && (
            <div className="text-center text-zinc-500 py-12">
              No graphics match your filters
            </div>
          )}
        </div>

        {/* Preview panel */}
        {previewGraphic && (
          <div className="w-96 border-l border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">{previewGraphic.label}</h3>
              <button
                onClick={() => setPreviewGraphic(null)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Preview iframe */}
            {previewUrl && (
              <div className="mb-4">
                <div className="aspect-video bg-black rounded-lg overflow-hidden border border-zinc-700">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full"
                    style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
                  />
                </div>
              </div>
            )}

            {/* Details */}
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-zinc-500">ID</div>
                <div className="font-mono text-blue-400">{previewGraphic.id}</div>
              </div>
              <div>
                <div className="text-zinc-500">Category</div>
                <div className="text-white">{CATEGORY_LABELS[previewGraphic.category]}</div>
              </div>
              <div>
                <div className="text-zinc-500">Gender</div>
                <div className="text-white">{GENDER_LABELS[previewGraphic.gender]}</div>
              </div>
              <div>
                <div className="text-zinc-500">Renderer</div>
                <div className="text-white">{previewGraphic.renderer}</div>
              </div>
              <div>
                <div className="text-zinc-500">File</div>
                <div className="font-mono text-xs text-zinc-400">{previewGraphic.file}</div>
              </div>
              <div>
                <div className="text-zinc-500">Transparent</div>
                <div className="text-white">{previewGraphic.transparent ? 'Yes' : 'No'}</div>
              </div>
              {previewGraphic.keywords && previewGraphic.keywords.length > 0 && (
                <div>
                  <div className="text-zinc-500">Keywords</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {previewGraphic.keywords.map(kw => (
                      <span key={kw} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {previewGraphic.params && Object.keys(previewGraphic.params).length > 0 && (
                <div>
                  <div className="text-zinc-500">Parameters</div>
                  <div className="mt-1 space-y-1">
                    {Object.entries(previewGraphic.params).map(([key, schema]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="font-mono text-zinc-400">{key}</span>
                        <span className="text-zinc-500">{schema.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
              {previewUrl && (
                <button
                  onClick={() => window.open(previewUrl, '_blank')}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
                >
                  Open Full Size
                </button>
              )}
              <Link
                to={`/url-generator`}
                className="block w-full px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-center rounded-lg text-sm transition-colors"
              >
                Open in URL Generator
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
