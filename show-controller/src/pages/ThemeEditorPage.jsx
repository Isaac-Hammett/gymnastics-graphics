import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { db, ref, onValue, set, get, remove } from '../lib/firebase';

/**
 * Theme Editor Page
 *
 * Create, edit, and manage meet themes for custom branded graphics.
 * Themes control the chrome colors (headers, borders, badges) while
 * preserving team colors in team-specific areas.
 */

// Preset theme templates (not stored in Firebase)
const PRESET_THEMES = {
  'pink-meet': {
    name: 'Pink Meet',
    description: 'Breast cancer awareness fundraiser',
    colors: {
      accentPrimary: '#E91E8C',
      accentSecondary: '#FFB6D9',
      headerBg: '#E91E8C',
      headerText: '#FFFFFF',
      footerBg: '#E91E8C',
      borderColor: '#E91E8C',
      badgeBg: '#E91E8C',
      badgeText: '#FFFFFF',
      overlayBg: '#1a0a12',
      overlayText: '#FFFFFF',
    },
  },
  'military-appreciation': {
    name: 'Military Appreciation',
    description: 'Military appreciation night',
    colors: {
      accentPrimary: '#4A5C3E',
      accentSecondary: '#C5A55A',
      headerBg: '#4A5C3E',
      headerText: '#FFFFFF',
      footerBg: '#4A5C3E',
      borderColor: '#C5A55A',
      badgeBg: '#C5A55A',
      badgeText: '#1a1a1a',
      overlayBg: '#1a1f17',
      overlayText: '#FFFFFF',
    },
  },
  'senior-night': {
    name: 'Senior Night',
    description: 'Senior recognition ceremony',
    colors: {
      accentPrimary: '#FFD700',
      accentSecondary: '#1a1a1a',
      headerBg: '#FFD700',
      headerText: '#1a1a1a',
      footerBg: '#1a1a1a',
      borderColor: '#FFD700',
      badgeBg: '#FFD700',
      badgeText: '#1a1a1a',
      overlayBg: '#1a1a1a',
      overlayText: '#FFD700',
    },
  },
  'blackout': {
    name: 'Blackout',
    description: 'Blackout theme events',
    colors: {
      accentPrimary: '#000000',
      accentSecondary: '#00FF88',
      headerBg: '#000000',
      headerText: '#00FF88',
      footerBg: '#000000',
      borderColor: '#00FF88',
      badgeBg: '#00FF88',
      badgeText: '#000000',
      overlayBg: '#000000',
      overlayText: '#00FF88',
    },
  },
};

// Default empty theme
const DEFAULT_THEME = {
  name: '',
  description: '',
  colors: {
    accentPrimary: '#E91E8C',
    accentSecondary: '#FFB6D9',
    headerBg: '#E91E8C',
    headerText: '#FFFFFF',
    footerBg: '#E91E8C',
    borderColor: '#E91E8C',
    badgeBg: '#E91E8C',
    badgeText: '#FFFFFF',
    overlayBg: '#1a0a12',
    overlayText: '#FFFFFF',
  },
  logos: {
    meetLogo: '',
    causeLogo: '',
  },
  branding: {
    meetTitle: '',
    subtitle: '',
  },
};

// Color property labels for display
const COLOR_LABELS = {
  accentPrimary: 'Primary Accent',
  accentSecondary: 'Secondary Accent',
  headerBg: 'Header Background',
  headerText: 'Header Text',
  footerBg: 'Footer Background',
  borderColor: 'Border Color',
  badgeBg: 'Badge Background',
  badgeText: 'Badge Text',
  overlayBg: 'Overlay Background',
  overlayText: 'Overlay Text',
};

export default function ThemeEditorPage() {
  // Theme list from Firebase
  const [themes, setThemes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Current editing state
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [editingTheme, setEditingTheme] = useState({ ...DEFAULT_THEME });
  const [isDirty, setIsDirty] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Subscribe to themes from Firebase
  useEffect(() => {
    const themesRef = ref(db, 'themes');

    const unsubscribe = onValue(themesRef, (snapshot) => {
      setThemes(snapshot.val() || {});
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Generate a theme ID from the name
  const generateThemeId = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Load a theme for editing
  const loadTheme = useCallback((themeId) => {
    if (themes[themeId]) {
      setSelectedThemeId(themeId);
      setEditingTheme({
        ...DEFAULT_THEME,
        ...themes[themeId],
        colors: { ...DEFAULT_THEME.colors, ...themes[themeId].colors },
        logos: { ...DEFAULT_THEME.logos, ...themes[themeId].logos },
        branding: { ...DEFAULT_THEME.branding, ...themes[themeId].branding },
      });
      setIsDirty(false);
    }
  }, [themes]);

  // Start a new theme
  const newTheme = () => {
    setSelectedThemeId(null);
    setEditingTheme({ ...DEFAULT_THEME });
    setIsDirty(false);
  };

  // Apply a preset template
  const applyPreset = (presetKey) => {
    const preset = PRESET_THEMES[presetKey];
    if (preset) {
      setEditingTheme({
        ...editingTheme,
        name: preset.name,
        description: preset.description,
        colors: { ...preset.colors },
      });
      setIsDirty(true);
    }
  };

  // Update a field in the editing theme
  const updateField = (path, value) => {
    setEditingTheme(prev => {
      const parts = path.split('.');
      const newTheme = { ...prev };
      let current = newTheme;

      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;
      return newTheme;
    });
    setIsDirty(true);
  };

  // Save theme to Firebase
  const saveTheme = async () => {
    if (!editingTheme.name) {
      setSaveMessage({ type: 'error', text: 'Theme name is required' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const themeId = selectedThemeId || generateThemeId(editingTheme.name);
      const themeData = {
        ...editingTheme,
        id: themeId,
        updatedAt: new Date().toISOString(),
        createdAt: selectedThemeId ? themes[selectedThemeId]?.createdAt : new Date().toISOString(),
      };

      await set(ref(db, `themes/${themeId}`), themeData);

      setSelectedThemeId(themeId);
      setIsDirty(false);
      setSaveMessage({ type: 'success', text: `Theme "${editingTheme.name}" saved!` });
    } catch (err) {
      setSaveMessage({ type: 'error', text: `Failed to save: ${err.message}` });
    }

    setSaving(false);
    setTimeout(() => setSaveMessage(null), 5000);
  };

  // Delete theme from Firebase
  const deleteTheme = async () => {
    if (!selectedThemeId) return;

    setSaving(true);
    try {
      await remove(ref(db, `themes/${selectedThemeId}`));
      setSelectedThemeId(null);
      setEditingTheme({ ...DEFAULT_THEME });
      setIsDirty(false);
      setSaveMessage({ type: 'success', text: 'Theme deleted' });
    } catch (err) {
      setSaveMessage({ type: 'error', text: `Failed to delete: ${err.message}` });
    }
    setSaving(false);
    setShowDeleteConfirm(false);
    setTimeout(() => setSaveMessage(null), 5000);
  };

  // Build preview URL with current theme colors
  const getPreviewUrl = () => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    params.set('graphic', 'event-summary');
    params.set('summaryMode', 'rotation');
    params.set('summaryRotation', '1');
    params.set('summaryNumTeams', '2');
    params.set('team1Name', 'Home Team');
    params.set('team2Name', 'Away Team');

    // For preview, we'll use a special preview mode that reads from inline params
    // since the theme may not be saved yet
    if (selectedThemeId) {
      params.set('meetTheme', selectedThemeId);
    }

    return `${baseUrl}/output.html?${params.toString()}`;
  };

  // Calculate contrast ratio for accessibility
  const getContrastRatio = (color1, color2) => {
    const getLuminance = (hex) => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) / 255;
      const g = ((rgb >> 8) & 0xff) / 255;
      const b = (rgb & 0xff) / 255;
      const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };

    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  // Check if contrast is sufficient (WCAG AA for large text is 3:1)
  const hasGoodContrast = (bg, text) => {
    try {
      return getContrastRatio(bg, text) >= 3;
    } catch {
      return true; // Assume good if we can't calculate
    }
  };

  const themeList = Object.keys(themes).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading themes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-zinc-400 hover:text-white transition-colors">
              &larr; Back
            </Link>
            <h1 className="text-xl font-bold">Theme Editor</h1>
          </div>

          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className={`text-sm ${saveMessage.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                {saveMessage.text}
              </span>
            )}
            <button
              onClick={saveTheme}
              disabled={saving || !editingTheme.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Theme List */}
          <div className="col-span-3 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Saved Themes</h2>
                <button
                  onClick={newTheme}
                  className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  + New
                </button>
              </div>

              {themeList.length === 0 ? (
                <p className="text-zinc-500 text-sm">No themes saved yet</p>
              ) : (
                <div className="space-y-2">
                  {themeList.map((themeId) => (
                    <button
                      key={themeId}
                      onClick={() => loadTheme(themeId)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedThemeId === themeId
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div className="font-medium truncate">{themes[themeId].name}</div>
                      <div className="text-xs opacity-70 truncate">{themes[themeId].description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preset Templates */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Preset Templates</h2>
              <div className="space-y-2">
                {Object.entries(PRESET_THEMES).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className="w-full text-left px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-3"
                  >
                    <div
                      className="w-6 h-6 rounded"
                      style={{ background: preset.colors.accentPrimary }}
                    />
                    <div>
                      <div className="font-medium text-zinc-300">{preset.name}</div>
                      <div className="text-xs text-zinc-500">{preset.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center Panel - Editor Form */}
          <div className="col-span-5 space-y-6">
            {/* Basic Info */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Theme Info</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Theme Name *</label>
                  <input
                    type="text"
                    value={editingTheme.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="e.g., Pink Meet 2026"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={editingTheme.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="e.g., Breast cancer awareness fundraiser"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Color Pickers */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Colors</h2>

              <div className="grid grid-cols-2 gap-4">
                {Object.entries(COLOR_LABELS).map(([key, label]) => {
                  const color = editingTheme.colors[key];
                  // Check contrast for text colors
                  const needsContrastCheck = key.endsWith('Text');
                  const bgKey = key.replace('Text', 'Bg');
                  const bgColor = editingTheme.colors[bgKey];
                  const contrastOk = !needsContrastCheck || !bgColor || hasGoodContrast(bgColor, color);

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => updateField(`colors.${key}`, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-white">{label}</div>
                        <div className="text-xs text-zinc-500 font-mono">{color}</div>
                        {!contrastOk && (
                          <div className="text-xs text-yellow-500">Low contrast</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logos */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Logos</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Meet Logo URL</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={editingTheme.logos?.meetLogo || ''}
                      onChange={(e) => updateField('logos.meetLogo', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    {editingTheme.logos?.meetLogo && (
                      <img
                        src={editingTheme.logos.meetLogo}
                        alt="Meet logo preview"
                        className="w-10 h-10 object-contain bg-zinc-800 rounded"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Cause Logo URL</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={editingTheme.logos?.causeLogo || ''}
                      onChange={(e) => updateField('logos.causeLogo', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    {editingTheme.logos?.causeLogo && (
                      <img
                        src={editingTheme.logos.causeLogo}
                        alt="Cause logo preview"
                        className="w-10 h-10 object-contain bg-zinc-800 rounded"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Branding */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Branding</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Meet Title</label>
                  <input
                    type="text"
                    value={editingTheme.branding?.meetTitle || ''}
                    onChange={(e) => updateField('branding.meetTitle', e.target.value)}
                    placeholder="e.g., PINK MEET 2026"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={editingTheme.branding?.subtitle || ''}
                    onChange={(e) => updateField('branding.subtitle', e.target.value)}
                    placeholder="e.g., Supporting Breast Cancer Research"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Delete Button */}
            {selectedThemeId && (
              <div className="flex justify-end">
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400">Delete this theme?</span>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteTheme}
                      disabled={saving}
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                    >
                      {saving ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete Theme
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="col-span-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sticky top-6">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Live Preview</h2>

              {/* Color Preview Swatches */}
              <div className="mb-4 p-4 rounded-lg" style={{ background: editingTheme.colors.overlayBg }}>
                <div
                  className="p-3 rounded mb-2"
                  style={{
                    background: editingTheme.colors.headerBg,
                    color: editingTheme.colors.headerText,
                  }}
                >
                  <div className="text-sm font-bold">Header Preview</div>
                </div>

                <div className="flex gap-2 mb-2">
                  <div
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{
                      background: editingTheme.colors.badgeBg,
                      color: editingTheme.colors.badgeText,
                    }}
                  >
                    Badge
                  </div>
                  <div
                    className="px-3 py-1 rounded text-sm"
                    style={{
                      background: editingTheme.colors.accentSecondary,
                      color: editingTheme.colors.headerText,
                    }}
                  >
                    Accent
                  </div>
                </div>

                <div
                  className="p-3 rounded border-t-4"
                  style={{
                    background: editingTheme.colors.footerBg,
                    borderColor: editingTheme.colors.borderColor,
                    color: editingTheme.colors.overlayText,
                  }}
                >
                  <div className="text-sm">Footer with border</div>
                </div>
              </div>

              {/* Note about live preview */}
              <p className="text-xs text-zinc-500 mb-4">
                Save the theme and add <code className="bg-zinc-800 px-1 rounded">?meetTheme={selectedThemeId || 'theme-id'}</code> to any graphic URL to preview.
              </p>

              {/* Open Preview Link */}
              {selectedThemeId && (
                <a
                  href={getPreviewUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
                >
                  Open Full Preview &rarr;
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-yellow-600 text-black rounded-lg text-sm font-medium shadow-lg">
          Unsaved changes
        </div>
      )}
    </div>
  );
}
