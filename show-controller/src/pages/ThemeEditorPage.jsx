import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db, ref, onValue } from '../lib/firebase';
import { SERVER_URL } from '../lib/serverUrl';
import SponsorAdjustControls from '../components/SponsorAdjustControls';
import { buildSponsorsCycleURL } from '../lib/urlBuilder';

// Override-able graphic IDs grouped by category (for per-graphic override panels)
const OVERRIDE_GRAPHIC_GROUPS = [
  {
    label: 'Lower-Third Bars',
    graphics: ['event-bar', 'warm-up', 'replay'],
  },
  {
    label: 'Full-Screen',
    graphics: ['event-summary', 'virtuis-leaderboard', 'event-frame'],
  },
  {
    label: 'Team Cards',
    graphics: ['team1-stats', 'team1-coaches', 'team2-stats', 'team2-coaches'],
  },
  {
    label: 'Sponsors',
    graphics: ['sponsors-thanks', 'sponsors-cycle', 'sponsors-bug'],
  },
  {
    label: 'Stream',
    graphics: ['stream-starting', 'stream-thanks'],
  },
  {
    label: 'Overlays',
    graphics: ['rotation-slate', 'team-roster', 'logos'],
  },
  {
    label: 'Playout / Who to Watch',
    graphics: ['who-to-watch-title', 'who-to-watch-lower-third', 'clip-overlay'],
  },
];

// Color override field keys and labels (same as COLOR_LABELS but for per-graphic overrides)
const OVERRIDE_COLOR_FIELDS = [
  { key: 'headerBar', label: 'Header Bar' },
  { key: 'contentArea', label: 'Content Area' },
  { key: 'bodyBackground', label: 'Body Background' },
  { key: 'borderDivider', label: 'Border / Divider' },
  { key: 'badge', label: 'Badge' },
  { key: 'badgeText', label: 'Badge Text' },
  { key: 'textOnHeader', label: 'Text on Header' },
  { key: 'textOnContent', label: 'Text on Content' },
];

// Image fit options for background images
const IMAGE_FIT_OPTIONS = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'repeat', label: 'Repeat' },
];

// Image position options
const IMAGE_POSITION_OPTIONS = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

// Texture blend mode options
const BLEND_MODE_OPTIONS = [
  { value: 'overlay', label: 'Overlay' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'normal', label: 'Normal' },
];

/**
 * Editable number input with increment/decrement stepper buttons.
 * Simplified version for per-graphic override controls.
 */
function OverrideStepper({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '' }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-zinc-500 w-16">{label}</span>
      <button
        onClick={() => onChange(clamp(value - step))}
        className="w-5 h-5 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded-l text-zinc-300 text-xs font-bold transition-colors select-none"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!isNaN(parsed)) onChange(clamp(parsed));
        }}
        className="w-12 h-5 text-center text-[10px] font-mono bg-zinc-800 text-zinc-300 border-y border-zinc-600 focus:outline-none focus:border-purple-500"
      />
      <button
        onClick={() => onChange(clamp(value + step))}
        className="w-5 h-5 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded-r text-zinc-300 text-xs font-bold transition-colors select-none"
      >
        +
      </button>
      {suffix && <span className="text-[10px] text-zinc-500">{suffix}</span>}
    </div>
  );
}

// Graphic types for preview selector, grouped by category
const GRAPHIC_GROUPS = [
  {
    label: 'Lower-Third Bars',
    graphics: [
      { id: 'event-bar', name: 'Event Bar' },
      { id: 'warm-up', name: 'Warm-up' },
      { id: 'replay', name: 'Replay' },
    ],
  },
  {
    label: 'Full-Screen',
    graphics: [
      { id: 'event-summary', name: 'Event Summary' },
      { id: 'virtuis-leaderboard', name: 'Leaderboard' },
      { id: 'event-frame', name: 'Event Frame' },
    ],
  },
  {
    label: 'Team Cards',
    graphics: [
      { id: 'team1-stats', name: 'Team 1 Stats' },
      { id: 'team1-coaches', name: 'Team 1 Coaches' },
      { id: 'team2-stats', name: 'Team 2 Stats' },
      { id: 'team2-coaches', name: 'Team 2 Coaches' },
    ],
  },
  {
    label: 'Sponsors',
    graphics: [
      { id: 'sponsors-thanks', name: 'Sponsors Thanks' },
      { id: 'sponsors-cycle', name: 'Sponsors Cycle' },
      { id: 'sponsors-bug', name: 'Sponsors Bug' },
    ],
  },
  {
    label: 'Stream',
    graphics: [
      { id: 'stream-starting', name: 'Stream Starting' },
      { id: 'stream-thanks', name: 'Stream Thanks' },
    ],
  },
  {
    label: 'Overlays',
    graphics: [
      { id: 'rotation-slate', name: 'Rotation Slate' },
      { id: 'team-roster', name: 'Team Roster' },
      { id: 'logos', name: 'Logos' },
    ],
  },
  {
    label: 'Playout / Who to Watch',
    graphics: [
      { id: 'who-to-watch-title', name: 'Who to Watch — Title Card' },
      { id: 'who-to-watch-lower-third', name: 'Who to Watch — Lower Third' },
    ],
  },
];

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
      headerBar: '#E91E8C',
      contentArea: '#000000',
      bodyBackground: '#1a0a12',
      borderDivider: '#E91E8C',
      badge: '#E91E8C',
      badgeText: '#FFFFFF',
      textOnHeader: '#FFFFFF',
      textOnContent: '#FFFFFF',
    },
  },
  'military-appreciation': {
    name: 'Military Appreciation',
    description: 'Military appreciation night',
    colors: {
      headerBar: '#4A5C3E',
      contentArea: '#000000',
      bodyBackground: '#1a1f17',
      borderDivider: '#C5A55A',
      badge: '#C5A55A',
      badgeText: '#1a1a1a',
      textOnHeader: '#FFFFFF',
      textOnContent: '#FFFFFF',
    },
  },
  'senior-night': {
    name: 'Senior Night',
    description: 'Senior recognition ceremony',
    colors: {
      headerBar: '#FFD700',
      contentArea: '#1a1a1a',
      bodyBackground: '#1a1a1a',
      borderDivider: '#FFD700',
      badge: '#FFD700',
      badgeText: '#1a1a1a',
      textOnHeader: '#1a1a1a',
      textOnContent: '#FFD700',
    },
  },
  'blackout': {
    name: 'Blackout',
    description: 'Blackout theme events',
    colors: {
      headerBar: '#000000',
      contentArea: '#000000',
      bodyBackground: '#000000',
      borderDivider: '#00FF88',
      badge: '#00FF88',
      badgeText: '#000000',
      textOnHeader: '#00FF88',
      textOnContent: '#00FF88',
    },
  },
};

// Default empty theme
const DEFAULT_THEME = {
  name: '',
  description: '',
  colors: {
    headerBar: '#E91E8C',
    contentArea: '#000000',
    bodyBackground: '#1a0a12',
    borderDivider: '#E91E8C',
    badge: '#E91E8C',
    badgeText: '#FFFFFF',
    textOnHeader: '#FFFFFF',
    textOnContent: '#FFFFFF',
  },
  logos: {
    meetLogo: '',
    causeLogo: '',
  },
  branding: {
    meetTitle: '',
    subtitle: '',
  },
  sponsors: [], // Array of { name: string, url: string } - event-level sponsors
};

// Extract dominant colors from an image URL using canvas pixel sampling
function extractColorsFromImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Collect non-white, non-black, non-transparent pixels
        const pixels = [];
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          if (a < 128) continue; // skip transparent
          const brightness = (r + g + b) / 3;
          if (brightness > 240 || brightness < 15) continue; // skip near-white/black
          pixels.push([r, g, b]);
        }

        if (pixels.length === 0) {
          resolve([]);
          return;
        }

        // Simple color clustering: group pixels within distance threshold
        const clusters = [];
        const threshold = 45;
        for (const px of pixels) {
          let found = false;
          for (const c of clusters) {
            const dist = Math.sqrt(
              (px[0] - c.avg[0]) ** 2 + (px[1] - c.avg[1]) ** 2 + (px[2] - c.avg[2]) ** 2
            );
            if (dist < threshold) {
              c.count++;
              c.sum[0] += px[0]; c.sum[1] += px[1]; c.sum[2] += px[2];
              c.avg = [c.sum[0] / c.count, c.sum[1] / c.count, c.sum[2] / c.count];
              found = true;
              break;
            }
          }
          if (!found) {
            clusters.push({ avg: [...px], sum: [...px], count: 1 });
          }
        }

        // Sort by frequency, return top colors as hex
        clusters.sort((a, b) => b.count - a.count);
        const colors = clusters.slice(0, 5).map(c => {
          const [r, g, b] = c.avg.map(v => Math.round(v));
          return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        });
        resolve(colors);
      } catch (err) {
        reject(new Error('Could not read image pixels. Cross-origin restrictions may be blocking access.'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image. Check the URL.'));
    img.src = url;
  });
}

// Pick white or black text based on background luminance
function autoTextColor(bgHex) {
  const rgb = parseInt(bgHex.slice(1), 16);
  const r = (rgb >> 16) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;
  const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.35 ? '#1a1a1a' : '#FFFFFF';
}

// Darken a hex color for overlay backgrounds
function darkenColor(hex, factor = 0.2) {
  const rgb = parseInt(hex.slice(1), 16);
  const r = Math.round(((rgb >> 16) & 0xff) * factor);
  const g = Math.round(((rgb >> 8) & 0xff) * factor);
  const b = Math.round((rgb & 0xff) * factor);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Color property labels for display
const COLOR_LABELS = {
  headerBar: 'Header Bar',
  contentArea: 'Content Area',
  bodyBackground: 'Body Background',
  borderDivider: 'Border / Divider',
  badge: 'Badge',
  badgeText: 'Badge Text',
  textOnHeader: 'Text on Header',
  textOnContent: 'Text on Content',
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
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);

  // Sponsor adjustment state
  const [selectedSponsorIndex, setSelectedSponsorIndex] = useState(-1);
  const [showSponsorBounds, setShowSponsorBounds] = useState(false);
  const [showSponsorCropControls, setShowSponsorCropControls] = useState(false);
  const [showSponsorGuides, setShowSponsorGuides] = useState(false);
  const [sponsorPreviewExpanded, setSponsorPreviewExpanded] = useState(false);

  // Competition preview state
  const [competitions, setCompetitions] = useState({});
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [selectedGraphicType, setSelectedGraphicType] = useState('event-summary');

  // Per-graphic override state
  const [expandedOverrideGraphics, setExpandedOverrideGraphics] = useState({});

  // Preview reload state - increment to force iframe refresh after save
  const [previewVersion, setPreviewVersion] = useState(0);

  // Preview URL for sponsor cycle when adjusting sponsors
  const sponsorPreviewUrl = useMemo(() => {
    const sponsors = editingTheme.sponsors || [];
    if (sponsors.length === 0) return null;
    const sponsorsJson = JSON.stringify(sponsors.slice(0, 8).map(s => ({
      name: s.name, url: s.url,
      ...(s.scale && s.scale !== 100 ? { scale: s.scale } : {}),
      ...(s.offsetX ? { offsetX: s.offsetX } : {}),
      ...(s.offsetY ? { offsetY: s.offsetY } : {}),
      ...(s.cropX != null ? { cropX: s.cropX } : {}),
      ...(s.cropY != null ? { cropY: s.cropY } : {}),
      ...(s.cropW != null ? { cropW: s.cropW } : {}),
      ...(s.cropH != null ? { cropH: s.cropH } : {}),
    })));
    return buildSponsorsCycleURL({
      sponsorsJson,
      lockedIndex: selectedSponsorIndex >= 0 ? selectedSponsorIndex : undefined,
      showBounds: showSponsorBounds || undefined,
      showGuides: showSponsorGuides || undefined,
    });
  }, [editingTheme.sponsors, selectedSponsorIndex, showSponsorBounds, showSponsorGuides]);

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

  // Subscribe to competitions from Firebase (filter to recent/active)
  useEffect(() => {
    const competitionsRef = ref(db, 'competitions');

    const unsubscribe = onValue(competitionsRef, (snapshot) => {
      const allCompetitions = snapshot.val() || {};
      // Filter to recent competitions (last 60 days) or active ones
      const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
      const filtered = {};
      for (const [id, comp] of Object.entries(allCompetitions)) {
        const config = comp.config || {};
        const createdAt = config.createdAt ? new Date(config.createdAt).getTime() : 0;
        const isActive = config.status === 'active';
        if (isActive || createdAt > cutoff) {
          filtered[id] = comp;
        }
      }
      setCompetitions(filtered);
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
        sponsors: themes[themeId].sponsors || [], // Ensure sponsors array exists
        overrides: themes[themeId].overrides || {}, // Per-graphic overrides
      });
      setIsDirty(false);
      setExpandedOverrideGraphics({}); // Collapse all override panels when loading new theme
    }
  }, [themes]);

  // Start a new theme
  const newTheme = () => {
    setSelectedThemeId(null);
    setEditingTheme({ ...DEFAULT_THEME, overrides: {} });
    setIsDirty(false);
    setExpandedOverrideGraphics({});
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

  // Update a per-graphic override field
  const updateOverrideField = (graphicId, fieldKey, value) => {
    setEditingTheme(prev => {
      const newOverrides = { ...(prev.overrides || {}) };
      if (!newOverrides[graphicId]) {
        newOverrides[graphicId] = {};
      }
      newOverrides[graphicId] = { ...newOverrides[graphicId], [fieldKey]: value };
      return { ...prev, overrides: newOverrides };
    });
    setIsDirty(true);
  };

  // Clear a per-graphic override field (remove the key entirely)
  const clearOverrideField = (graphicId, fieldKey) => {
    setEditingTheme(prev => {
      const newOverrides = { ...(prev.overrides || {}) };
      if (newOverrides[graphicId]) {
        const graphicOverrides = { ...newOverrides[graphicId] };
        delete graphicOverrides[fieldKey];
        // If no overrides left for this graphic, remove the graphic entry
        if (Object.keys(graphicOverrides).length === 0) {
          delete newOverrides[graphicId];
        } else {
          newOverrides[graphicId] = graphicOverrides;
        }
      }
      return { ...prev, overrides: newOverrides };
    });
    setIsDirty(true);
  };

  // Reset all overrides for a specific graphic
  const resetGraphicOverrides = (graphicId) => {
    setEditingTheme(prev => {
      const newOverrides = { ...(prev.overrides || {}) };
      delete newOverrides[graphicId];
      return { ...prev, overrides: newOverrides };
    });
    setIsDirty(true);
  };

  // Count overrides for a graphic (for badge display)
  const countGraphicOverrides = (graphicId) => {
    const overrides = editingTheme.overrides?.[graphicId];
    if (!overrides) return 0;
    return Object.keys(overrides).length;
  };

  // Toggle expanded state for a graphic's override panel
  const toggleOverridePanel = (graphicId) => {
    setExpandedOverrideGraphics(prev => ({
      ...prev,
      [graphicId]: !prev[graphicId],
    }));
    // When expanding a panel, auto-switch preview to this graphic
    if (!expandedOverrideGraphics[graphicId]) {
      setSelectedGraphicType(graphicId);
    }
  };

  // Extract colors from the meet logo and populate color fields
  const extractColors = async () => {
    const logoUrl = editingTheme.logos?.meetLogo;
    if (!logoUrl) return;

    setExtracting(true);
    setExtractError(null);
    try {
      const colors = await extractColorsFromImage(logoUrl);
      if (colors.length === 0) {
        setExtractError('No distinct colors found in the image.');
        setExtracting(false);
        return;
      }

      const primary = colors[0];
      const secondary = colors[1] || colors[0];
      const primaryText = autoTextColor(primary);
      const secondaryText = autoTextColor(secondary);

      setEditingTheme(prev => ({
        ...prev,
        colors: {
          headerBar: primary,
          contentArea: '#000000',
          bodyBackground: darkenColor(primary),
          borderDivider: primary,
          badge: primary,
          badgeText: primaryText,
          textOnHeader: primaryText,
          textOnContent: '#FFFFFF',
        },
      }));
      setIsDirty(true);
    } catch (err) {
      setExtractError(err.message);
    }
    setExtracting(false);
  };

  // Save theme via server API (uses Admin SDK to bypass Firebase rules)
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

      const res = await fetch(`${SERVER_URL}/api/admin/themes/${themeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(themeData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save theme');
      }

      setSelectedThemeId(themeId);
      setIsDirty(false);
      setSaveMessage({ type: 'success', text: `Theme "${editingTheme.name}" saved!` });

      // Reload preview iframe after 500ms to allow Firebase to propagate
      setTimeout(() => {
        setPreviewVersion(v => v + 1);
      }, 500);
    } catch (err) {
      setSaveMessage({ type: 'error', text: `Failed to save: ${err.message}` });
    }

    setSaving(false);
    setTimeout(() => setSaveMessage(null), 5000);
  };

  // Delete theme via server API
  const deleteTheme = async () => {
    if (!selectedThemeId) return;

    setSaving(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/themes/${selectedThemeId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete theme');
      }

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
  const getPreviewUrl = useCallback(() => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();

    // Handle special graphic types that need different URLs
    if (selectedGraphicType === 'who-to-watch-title') {
      // WTW Title Card — use the overlay file directly with sample data
      params.set('meetTheme', selectedThemeId || 'preview');
      params.set('athleteName', 'Sample Athlete');
      params.set('teamName', 'Sample Team');
      params.set('headline', '2x All-American');
      params.set('body', 'Record holder on floor exercise');
      params.set('badgeText', 'WHO TO WATCH');
      // If competition selected, we could pull real athlete data here
      if (selectedCompetition && competitions[selectedCompetition]?.teamData?.team1?.roster?.[0]) {
        const athlete = competitions[selectedCompetition].teamData.team1.roster[0];
        params.set('athleteName', athlete.fullName || 'Sample Athlete');
        params.set('teamName', competitions[selectedCompetition].config?.team1Name || 'Sample Team');
      }
      return `${baseUrl}/overlays/who-to-watch-title.html?${params.toString()}`;
    }

    if (selectedGraphicType === 'who-to-watch-lower-third') {
      // WTW Lower Third — use the overlay file directly with sample data
      params.set('meetTheme', selectedThemeId || 'preview');
      params.set('athleteName', 'Sample Athlete');
      params.set('subtitle', 'Floor Exercise');
      params.set('statLabel', 'Season High');
      params.set('statValue', '9.950');
      // If competition selected, pull real athlete data
      if (selectedCompetition && competitions[selectedCompetition]?.teamData?.team1?.roster?.[0]) {
        const athlete = competitions[selectedCompetition].teamData.team1.roster[0];
        params.set('athleteName', athlete.fullName || 'Sample Athlete');
      }
      return `${baseUrl}/overlays/who-to-watch.html?${params.toString()}`;
    }

    // Standard graphics — use output.html
    params.set('graphic', selectedGraphicType);

    // Add graphic-specific params for preview
    if (selectedGraphicType === 'event-summary') {
      params.set('summaryMode', 'rotation');
      params.set('summaryRotation', '1');
      params.set('summaryNumTeams', '2');
      if (!selectedCompetition) {
        params.set('team1Name', 'Home Team');
        params.set('team2Name', 'Away Team');
      }
    }

    // Add theme param — meetTheme takes precedence over comp's theme
    if (selectedThemeId) {
      params.set('meetTheme', selectedThemeId);
    }

    // Add competition param to load real data
    if (selectedCompetition) {
      params.set('comp', selectedCompetition);
    }

    return `${baseUrl}/output.html?${params.toString()}`;
  }, [selectedThemeId, selectedGraphicType, selectedCompetition, competitions]);

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
                      style={{ background: preset.colors.headerBar }}
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
                  {editingTheme.logos?.meetLogo && (
                    <div className="mt-2">
                      <button
                        onClick={extractColors}
                        disabled={extracting}
                        className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        {extracting ? 'Extracting...' : 'Extract Colors from Logo'}
                      </button>
                      {extractError && (
                        <p className="text-xs text-red-400 mt-1">{extractError}</p>
                      )}
                    </div>
                  )}
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

            {/* Event Sponsors */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Event Sponsors</h2>
                <span className="text-xs text-zinc-500">{(editingTheme.sponsors || []).length}/8</span>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Event sponsors appear in sponsor graphics when this theme is active. Falls back to team sponsors if none are defined.
              </p>

              {/* Sponsor name/URL entry list */}
              <div className="space-y-2 mb-3">
                {(editingTheme.sponsors || []).map((sponsor, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg">
                    <span className="text-xs text-zinc-500 font-mono w-5 text-center flex-shrink-0">{index + 1}</span>
                    <input
                      type="text"
                      value={sponsor.name || ''}
                      onChange={(e) => {
                        const newSponsors = [...(editingTheme.sponsors || [])];
                        newSponsors[index] = { ...newSponsors[index], name: e.target.value };
                        setEditingTheme({ ...editingTheme, sponsors: newSponsors });
                        setIsDirty(true);
                      }}
                      placeholder="Name"
                      className="w-28 px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={sponsor.url || ''}
                      onChange={(e) => {
                        const newSponsors = [...(editingTheme.sponsors || [])];
                        newSponsors[index] = { ...newSponsors[index], url: e.target.value };
                        setEditingTheme({ ...editingTheme, sponsors: newSponsors });
                        setIsDirty(true);
                      }}
                      placeholder="Logo URL (https://...)"
                      className="flex-1 px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    {sponsor.url && (
                      <img
                        src={sponsor.url}
                        alt={sponsor.name || 'Sponsor'}
                        className="w-8 h-8 object-contain bg-white rounded flex-shrink-0"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <button
                      onClick={() => {
                        const newSponsors = (editingTheme.sponsors || []).filter((_, i) => i !== index);
                        setEditingTheme({ ...editingTheme, sponsors: newSponsors });
                        setIsDirty(true);
                        if (selectedSponsorIndex === index) setSelectedSponsorIndex(-1);
                        else if (selectedSponsorIndex > index) setSelectedSponsorIndex(prev => prev - 1);
                      }}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-zinc-700 rounded transition-colors flex-shrink-0"
                      title="Remove sponsor"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {(editingTheme.sponsors || []).length < 8 && (
                  <button
                    onClick={() => {
                      const newSponsors = [...(editingTheme.sponsors || []), { name: '', url: '' }];
                      setEditingTheme({ ...editingTheme, sponsors: newSponsors });
                      setIsDirty(true);
                    }}
                    className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-dashed border-zinc-600 rounded-lg text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                  >
                    + Add Sponsor
                  </button>
                )}
              </div>

              {/* Sponsor adjustment controls (scale, offset, crop, bounds) */}
              {(editingTheme.sponsors || []).length > 0 && (
                <>
                  <SponsorAdjustControls
                    sponsors={editingTheme.sponsors || []}
                    getOverride={(index) => {
                      const s = (editingTheme.sponsors || [])[index] || {};
                      return {
                        scale: s.scale ?? 100,
                        offsetX: s.offsetX ?? 0,
                        offsetY: s.offsetY ?? 0,
                        cropX: s.cropX ?? null,
                        cropY: s.cropY ?? null,
                        cropW: s.cropW ?? null,
                        cropH: s.cropH ?? null,
                      };
                    }}
                    onUpdate={(index, field, value) => {
                      const newSponsors = [...(editingTheme.sponsors || [])];
                      newSponsors[index] = { ...newSponsors[index], [field]: value };
                      setEditingTheme({ ...editingTheme, sponsors: newSponsors });
                      setIsDirty(true);
                    }}
                    selectedIndex={selectedSponsorIndex}
                    onSelectIndex={setSelectedSponsorIndex}
                    showBounds={showSponsorBounds}
                    onToggleBounds={() => setShowSponsorBounds(prev => !prev)}
                    showGuides={showSponsorGuides}
                    onToggleGuides={() => setShowSponsorGuides(prev => !prev)}
                  />

                  {/* Live sponsor preview - expandable */}
                  {sponsorPreviewUrl && !sponsorPreviewExpanded && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Sponsor Preview</h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSponsorPreviewExpanded(true)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Expand
                          </button>
                          <button
                            onClick={() => window.open(sponsorPreviewUrl, '_blank')}
                            className="text-[10px] text-zinc-400 hover:text-zinc-300 transition-colors"
                          >
                            Open Full Size
                          </button>
                        </div>
                      </div>
                      <div className="relative bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700" style={{ height: Math.round(1080 * 0.3) + 'px' }}>
                        <iframe
                          src={sponsorPreviewUrl}
                          className="w-[1920px] h-[1080px] origin-top-left"
                          style={{ border: 'none', transform: 'scale(0.3)' }}
                          title="Sponsor Preview"
                        />
                      </div>
                    </div>
                  )}

                  {/* Expanded sponsor preview - fullscreen overlay */}
                  {sponsorPreviewUrl && sponsorPreviewExpanded && (
                    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
                      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700">
                        <h3 className="text-sm font-semibold text-zinc-300">Sponsor Preview</h3>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => window.open(sponsorPreviewUrl, '_blank')}
                            className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                          >
                            Open Full Size
                          </button>
                          <button
                            onClick={() => setSponsorPreviewExpanded(false)}
                            className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
                        <div className="relative" style={{ width: '100%', maxWidth: '1440px', aspectRatio: '16/9' }}>
                          <iframe
                            src={sponsorPreviewUrl}
                            className="w-[1920px] h-[1080px] origin-top-left absolute top-0 left-0"
                            style={{ border: 'none', transform: 'scale(var(--preview-scale))', '--preview-scale': 'calc(min(100cqw / 1920, 100cqh / 1080))' }}
                            title="Sponsor Preview"
                            ref={(el) => {
                              if (el) {
                                const resize = () => {
                                  const parent = el.parentElement;
                                  if (!parent) return;
                                  const scaleX = parent.clientWidth / 1920;
                                  const scaleY = parent.clientHeight / 1080;
                                  const s = Math.min(scaleX, scaleY);
                                  el.style.transform = `scale(${s})`;
                                  el.style.width = '1920px';
                                  el.style.height = '1080px';
                                };
                                resize();
                                window.addEventListener('resize', resize);
                                el._cleanup = () => window.removeEventListener('resize', resize);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Per-Graphic Overrides */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Per-Graphic Overrides</h2>
                {Object.keys(editingTheme.overrides || {}).length > 0 && (
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                    {Object.keys(editingTheme.overrides || {}).length} graphic(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Override theme colors for specific graphics. Overrides take precedence over the theme defaults above.
              </p>

              <div className="space-y-3">
                {OVERRIDE_GRAPHIC_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.graphics.map((graphicId) => {
                        const overrideCount = countGraphicOverrides(graphicId);
                        const isExpanded = expandedOverrideGraphics[graphicId];
                        const overrides = editingTheme.overrides?.[graphicId] || {};

                        return (
                          <div key={graphicId} className="bg-zinc-800 rounded-lg overflow-hidden">
                            {/* Collapsible header */}
                            <button
                              onClick={() => toggleOverridePanel(graphicId)}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-700/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-300 font-mono">{graphicId}</span>
                                {overrideCount > 0 && (
                                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded-full">
                                    {overrideCount} override{overrideCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <svg
                                className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Expanded panel */}
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-zinc-700/50">
                                <div className="pt-3 space-y-3">
                                  {/* Color override fields */}
                                  <div className="grid grid-cols-2 gap-2">
                                    {OVERRIDE_COLOR_FIELDS.map(({ key, label }) => {
                                      const hasOverride = overrides[key] !== undefined;
                                      const overrideValue = overrides[key] || editingTheme.colors[key] || '#888888';

                                      return (
                                        <div key={key} className="flex items-center gap-2">
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={hasOverride}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  // Enable override with current theme color as starting value
                                                  updateOverrideField(graphicId, key, editingTheme.colors[key] || '#888888');
                                                } else {
                                                  // Disable override
                                                  clearOverrideField(graphicId, key);
                                                }
                                              }}
                                              className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                                            />
                                          </label>
                                          <input
                                            type="color"
                                            value={overrideValue}
                                            disabled={!hasOverride}
                                            onChange={(e) => updateOverrideField(graphicId, key, e.target.value)}
                                            className={`w-6 h-6 rounded cursor-pointer bg-transparent border-0 ${!hasOverride ? 'opacity-40 cursor-not-allowed' : ''}`}
                                          />
                                          <span className={`text-[11px] ${hasOverride ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                            {label}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Logo override */}
                                  <div className="pt-2 border-t border-zinc-700/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={overrides.logo !== undefined}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              updateOverrideField(graphicId, 'logo', '');
                                            } else {
                                              clearOverrideField(graphicId, 'logo');
                                              clearOverrideField(graphicId, 'logoSize');
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                                        />
                                        <span className={`text-[11px] ${overrides.logo !== undefined ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                          Logo Override
                                        </span>
                                      </label>
                                    </div>
                                    {overrides.logo !== undefined && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={overrides.logo || ''}
                                            onChange={(e) => updateOverrideField(graphicId, 'logo', e.target.value)}
                                            placeholder="https://..."
                                            className="flex-1 px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                          />
                                          {overrides.logo && (
                                            <img
                                              src={overrides.logo}
                                              alt="Logo preview"
                                              className="w-8 h-8 object-contain bg-white rounded flex-shrink-0"
                                              onError={(e) => e.target.style.display = 'none'}
                                            />
                                          )}
                                        </div>
                                        <OverrideStepper
                                          label="Logo Size"
                                          value={overrides.logoSize || 48}
                                          onChange={(v) => updateOverrideField(graphicId, 'logoSize', v)}
                                          min={16}
                                          max={200}
                                          step={4}
                                          suffix="px"
                                        />
                                      </div>
                                    )}
                                  </div>

                                  {/* Header Background Image */}
                                  <div className="pt-2 border-t border-zinc-700/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={overrides.headerBgImage !== undefined}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              updateOverrideField(graphicId, 'headerBgImage', '');
                                            } else {
                                              clearOverrideField(graphicId, 'headerBgImage');
                                              clearOverrideField(graphicId, 'headerBgImageFit');
                                              clearOverrideField(graphicId, 'headerBgImagePosition');
                                              clearOverrideField(graphicId, 'headerBgImageOpacity');
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                                        />
                                        <span className={`text-[11px] ${overrides.headerBgImage !== undefined ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                          Header Background Image
                                        </span>
                                      </label>
                                    </div>
                                    {overrides.headerBgImage !== undefined && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={overrides.headerBgImage || ''}
                                            onChange={(e) => updateOverrideField(graphicId, 'headerBgImage', e.target.value)}
                                            placeholder="https://..."
                                            className="flex-1 px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                          />
                                          {overrides.headerBgImage && (
                                            <img
                                              src={overrides.headerBgImage}
                                              alt="Header bg preview"
                                              className="w-12 h-8 object-cover bg-zinc-600 rounded flex-shrink-0"
                                              onError={(e) => e.target.style.display = 'none'}
                                            />
                                          )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-zinc-500">Fit</span>
                                            <select
                                              value={overrides.headerBgImageFit || 'cover'}
                                              onChange={(e) => updateOverrideField(graphicId, 'headerBgImageFit', e.target.value)}
                                              className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                            >
                                              {IMAGE_FIT_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-zinc-500">Position</span>
                                            <select
                                              value={overrides.headerBgImagePosition || 'center'}
                                              onChange={(e) => updateOverrideField(graphicId, 'headerBgImagePosition', e.target.value)}
                                              className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                            >
                                              {IMAGE_POSITION_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <OverrideStepper
                                            label="Opacity"
                                            value={Math.round((overrides.headerBgImageOpacity ?? 1) * 100)}
                                            onChange={(v) => updateOverrideField(graphicId, 'headerBgImageOpacity', v / 100)}
                                            min={0}
                                            max={100}
                                            step={5}
                                            suffix="%"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Body Background Image */}
                                  <div className="pt-2 border-t border-zinc-700/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={overrides.bodyBgImage !== undefined}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              updateOverrideField(graphicId, 'bodyBgImage', '');
                                            } else {
                                              clearOverrideField(graphicId, 'bodyBgImage');
                                              clearOverrideField(graphicId, 'bodyBgImageFit');
                                              clearOverrideField(graphicId, 'bodyBgImagePosition');
                                              clearOverrideField(graphicId, 'bodyBgImageOpacity');
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                                        />
                                        <span className={`text-[11px] ${overrides.bodyBgImage !== undefined ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                          Body Background Image
                                        </span>
                                      </label>
                                    </div>
                                    {overrides.bodyBgImage !== undefined && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={overrides.bodyBgImage || ''}
                                            onChange={(e) => updateOverrideField(graphicId, 'bodyBgImage', e.target.value)}
                                            placeholder="https://..."
                                            className="flex-1 px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                          />
                                          {overrides.bodyBgImage && (
                                            <img
                                              src={overrides.bodyBgImage}
                                              alt="Body bg preview"
                                              className="w-12 h-8 object-cover bg-zinc-600 rounded flex-shrink-0"
                                              onError={(e) => e.target.style.display = 'none'}
                                            />
                                          )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-zinc-500">Fit</span>
                                            <select
                                              value={overrides.bodyBgImageFit || 'cover'}
                                              onChange={(e) => updateOverrideField(graphicId, 'bodyBgImageFit', e.target.value)}
                                              className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                            >
                                              {IMAGE_FIT_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-zinc-500">Position</span>
                                            <select
                                              value={overrides.bodyBgImagePosition || 'center'}
                                              onChange={(e) => updateOverrideField(graphicId, 'bodyBgImagePosition', e.target.value)}
                                              className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                            >
                                              {IMAGE_POSITION_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <OverrideStepper
                                            label="Opacity"
                                            value={Math.round((overrides.bodyBgImageOpacity ?? 1) * 100)}
                                            onChange={(v) => updateOverrideField(graphicId, 'bodyBgImageOpacity', v / 100)}
                                            min={0}
                                            max={100}
                                            step={5}
                                            suffix="%"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Body Texture */}
                                  <div className="pt-2 border-t border-zinc-700/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={overrides.bodyTexture !== undefined}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              updateOverrideField(graphicId, 'bodyTexture', '');
                                            } else {
                                              clearOverrideField(graphicId, 'bodyTexture');
                                              clearOverrideField(graphicId, 'bodyTextureOpacity');
                                              clearOverrideField(graphicId, 'bodyTextureBlend');
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                                        />
                                        <span className={`text-[11px] ${overrides.bodyTexture !== undefined ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                          Body Texture Overlay
                                        </span>
                                      </label>
                                    </div>
                                    {overrides.bodyTexture !== undefined && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={overrides.bodyTexture || ''}
                                            onChange={(e) => updateOverrideField(graphicId, 'bodyTexture', e.target.value)}
                                            placeholder="https://..."
                                            className="flex-1 px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                          />
                                          {overrides.bodyTexture && (
                                            <img
                                              src={overrides.bodyTexture}
                                              alt="Texture preview"
                                              className="w-12 h-8 object-cover bg-zinc-600 rounded flex-shrink-0"
                                              onError={(e) => e.target.style.display = 'none'}
                                            />
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-zinc-500">Blend Mode</span>
                                            <select
                                              value={overrides.bodyTextureBlend || 'overlay'}
                                              onChange={(e) => updateOverrideField(graphicId, 'bodyTextureBlend', e.target.value)}
                                              className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                            >
                                              {BLEND_MODE_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <OverrideStepper
                                            label="Opacity"
                                            value={Math.round((overrides.bodyTextureOpacity ?? 0.08) * 100)}
                                            onChange={(v) => updateOverrideField(graphicId, 'bodyTextureOpacity', v / 100)}
                                            min={0}
                                            max={100}
                                            step={2}
                                            suffix="%"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Reset button */}
                                  {overrideCount > 0 && (
                                    <div className="pt-2 flex justify-end">
                                      <button
                                        onClick={() => resetGraphicOverrides(graphicId)}
                                        className="text-[10px] text-zinc-400 hover:text-zinc-300 transition-colors"
                                      >
                                        Reset to theme defaults
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
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

              {/* Preview Controls */}
              <div className="space-y-3 mb-4">
                {/* Graphic Type Selector */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Graphic Type</label>
                  <select
                    value={selectedGraphicType}
                    onChange={(e) => setSelectedGraphicType(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {GRAPHIC_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.graphics.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Competition Selector */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">
                    Competition (optional)
                    <span className="ml-1 text-zinc-600">— loads real data</span>
                  </label>
                  <select
                    value={selectedCompetition}
                    onChange={(e) => setSelectedCompetition(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Use placeholder data</option>
                    {Object.entries(competitions)
                      .sort(([, a], [, b]) => {
                        // Sort by event date descending, then by name
                        const dateA = a.config?.eventDate || '';
                        const dateB = b.config?.eventDate || '';
                        if (dateB !== dateA) return dateB.localeCompare(dateA);
                        return (a.config?.eventName || '').localeCompare(b.config?.eventName || '');
                      })
                      .map(([id, comp]) => (
                        <option key={id} value={id}>
                          {comp.config?.eventName || id}
                          {comp.config?.eventDate ? ` (${comp.config.eventDate})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Color Preview Swatches */}
              <div className="mb-4 p-4 rounded-lg" style={{ background: editingTheme.colors.bodyBackground }}>
                <div
                  className="p-3 rounded mb-2"
                  style={{
                    background: editingTheme.colors.headerBar,
                    color: editingTheme.colors.textOnHeader,
                  }}
                >
                  <div className="text-sm font-bold">Header Preview</div>
                </div>

                <div className="flex gap-2 mb-2">
                  <div
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{
                      background: editingTheme.colors.badge,
                      color: editingTheme.colors.badgeText,
                    }}
                  >
                    Badge
                  </div>
                  <div
                    className="px-3 py-1 rounded text-sm"
                    style={{
                      background: editingTheme.colors.contentArea,
                      color: editingTheme.colors.textOnContent,
                    }}
                  >
                    Content
                  </div>
                </div>

                <div
                  className="p-3 rounded border-t-4"
                  style={{
                    background: editingTheme.colors.bodyBackground,
                    borderColor: editingTheme.colors.borderDivider,
                    color: editingTheme.colors.textOnContent,
                  }}
                >
                  <div className="text-sm">Body with border</div>
                </div>
              </div>

              {/* Live Iframe Preview */}
              {selectedThemeId && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Graphic Preview</h3>
                    <a
                      href={getPreviewUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-zinc-400 hover:text-zinc-300 transition-colors"
                    >
                      Open Full Size ↗
                    </a>
                  </div>
                  <div
                    className="relative bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700"
                    style={{ height: Math.round(1080 * 0.22) + 'px' }}
                  >
                    <iframe
                      key={`${selectedThemeId}-${selectedGraphicType}-${selectedCompetition}-${previewVersion}`}
                      src={getPreviewUrl()}
                      className="w-[1920px] h-[1080px] origin-top-left"
                      style={{ border: 'none', transform: 'scale(0.22)' }}
                      title="Theme Preview"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Preview reloads automatically after saving.
                  </p>
                </div>
              )}

              {/* Note about preview when no theme saved */}
              {!selectedThemeId && (
                <p className="text-xs text-zinc-500 mb-4">
                  Save the theme to see a live preview.
                </p>
              )}

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
