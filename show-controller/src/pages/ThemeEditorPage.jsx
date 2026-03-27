import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db, ref, onValue } from '../lib/firebase';
import { SERVER_URL } from '../lib/serverUrl';
import SponsorAdjustControls from '../components/SponsorAdjustControls';
import { buildSponsorsCycleURL } from '../lib/urlBuilder';

// Override-able graphic IDs grouped by category (for per-graphic override panels)
const LOWER_THIRD_GRAPHICS = ['event-bar', 'warm-up', 'replay'];

// Full-screen graphics for rich control panels (Phase 7A.8)
const FULL_SCREEN_GRAPHICS = ['event-summary', 'virtuis-leaderboard', 'event-frame', 'sponsors-thanks', 'team-roster'];

const LOWER_THIRD_DEFAULTS = {
  'event-bar': {
    barBottom: 120, barLeft: 100, logoImgSize: 70, logoContainerWidth: 100,
    logoPadding: 15, logoRadius: 0, venueFontSize: 36, barMinWidth: 600,
    venuePaddingV: 10, venuePaddingH: 40, nameFontSize: 28, locationFontSize: 24,
    detailsPaddingV: 10, detailsPaddingH: 40, detailsLines: 2,
  },
  'warm-up': {
    barBottom: 120, barLeft: 100, logoImgSize: 70, logoContainerWidth: 100,
    logoPadding: 15, logoRadius: 0, venueFontSize: 30, barMinWidth: 450,
    venuePaddingV: 10, venuePaddingH: 40, nameFontSize: 28, locationFontSize: 0,
    detailsPaddingV: 10, detailsPaddingH: 40, detailsLines: 1,
  },
  'replay': {
    barBottom: 120, barLeft: 100, logoImgSize: 70, logoContainerWidth: 100,
    logoPadding: 15, logoRadius: 0, venueFontSize: 30, barMinWidth: 450,
    venuePaddingV: 10, venuePaddingH: 40, nameFontSize: 28, locationFontSize: 0,
    detailsPaddingV: 10, detailsPaddingH: 40, detailsLines: 1,
  },
};

// Default values for full-screen graphics (Phase 7A.8)
const FULL_SCREEN_DEFAULTS = {
  'event-summary': {
    titleFontSize: 36, titleFontFamily: 'Inter', titleFontWeight: '800', titleTextTransform: 'uppercase',
    scoreFontFamily: 'Roboto Mono', scoreFontSize: 28,
    headerPadding: 40, headerHeight: 80, headerLogoSize: 60,
    contentPadding: 30, footerHeight: 60, footerFontSize: 28,
    teamNameFontSize: 24, athleteNameFontSize: 18, rowHeight: 48, rowPadding: 12,
  },
  'virtuis-leaderboard': {
    tableFontSize: 18, tableHeaderPadding: 16, tableRowPadding: 12, rankColWidth: 60,
    medalSize: 24, teamLogoSize: 32,
    goldFrom: '#fbbf24', goldTo: '#f59e0b', silverFrom: '#9ca3af', silverTo: '#6b7280',
    bronzeFrom: '#d97706', bronzeTo: '#b45309', stickBonusBg: '#22c55e',
    containerTop: 60, containerLeft: 60, containerRight: 60, containerBottom: 60,
  },
  'event-frame': {
    frameBorderWidth: 4, frameBorderColor: '#ffffff', frameGap: 8,
    logoHeaderHeight: 80, frameLogoSize: 60, frameLogoMaxWidth: 200,
    watermarkFontSize: 14, watermarkFontWeight: '400', watermarkColor: '#ffffff', watermarkAccentColor: '#9ca3af',
    watermarkBottom: 20, watermarkRight: 20, showWatermark: true,
  },
  'sponsors-thanks': {
    containerMarginTop: 70, containerMarginSide: 70, containerMarginBottom: 70, containerBorderRadius: 16,
    headerPaddingV: 24, headerPaddingH: 40, headerTitleFontSize: 32, headerTitleFontWeight: '800', headerTitleFontFamily: 'Inter',
    headerLogoWidth: 80, headerLogoHeight: 80,
    gridGap: 24, gridPadding: 40, sponsorItemPadding: 16,
  },
  'team-roster': {
    containerMarginTop: 70, containerMarginSide: 70, containerMarginBottom: 70, containerBorderRadius: 16,
    headerPaddingV: 24, headerPaddingH: 40, headerTitleFontSize: 32, headerTitleFontWeight: '800', headerTitleFontFamily: 'Inter',
    headerLogoWidth: 80, headerLogoHeight: 80,
    rosterContainerPadding: 40, rosterGridGap: 16, rosterHeadshotSize: 100, rosterHeadshotRadius: '50%',
    rosterHeadshotBorder: 3, rosterHeadshotBorderColor: '#374151', rosterHeadshotBg: '#1f2937',
    rosterNameFontSize: 14, rosterNameFontWeight: '600', rosterNameFontFamily: 'Inter', rosterNameTextTransform: 'none',
    rosterInitialsFontSize: 36, rosterInitialsColor: '#6b7280', rosterInitialsBg: '#374151', rosterCardWidth: 120,
  },
};

// Compute the effective rendered height based on font sizes + padding
// Shows producers the real pixel value instead of "0 (auto)"
function getEffectiveVenueHeight(overrides, graphicId) {
  const defs = LOWER_THIRD_DEFAULTS[graphicId] || LOWER_THIRD_DEFAULTS['event-bar'];
  const fontSize = overrides?.venueFontSize ?? defs.venueFontSize;
  const padV = overrides?.venuePaddingV ?? defs.venuePaddingV;
  return Math.round(fontSize * 1.2 + padV * 2);
}

function getEffectiveDetailsHeight(overrides, graphicId) {
  const defs = LOWER_THIRD_DEFAULTS[graphicId] || LOWER_THIRD_DEFAULTS['event-bar'];
  const nameFontSize = overrides?.nameFontSize ?? defs.nameFontSize;
  const padV = overrides?.detailsPaddingV ?? defs.detailsPaddingV;
  const lines = defs.detailsLines || 1;
  if (lines === 2) {
    const locFontSize = overrides?.locationFontSize ?? defs.locationFontSize;
    return Math.round(nameFontSize * 1.2 + locFontSize * 1.2 + padV * 2);
  }
  return Math.round(nameFontSize * 1.2 + padV * 2);
}

function getEffectiveLogoHeight(overrides, graphicId) {
  return getEffectiveVenueHeight(overrides, graphicId) + getEffectiveDetailsHeight(overrides, graphicId);
}

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

// Font family options for Phase 7 typography controls
// tabular: true marks fonts that support tabular-nums for aligned score columns
const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter', tabular: false },
  { value: 'Inter Tight', label: 'Inter Tight', tabular: false },
  { value: 'Roboto Mono', label: 'Roboto Mono', tabular: true },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', tabular: true },
  { value: 'Poppins', label: 'Poppins', tabular: false },
];

// Font weight options for typography controls
const FONT_WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi-Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra-Bold' },
  { value: '900', label: 'Black' },
];

// Text transform options for typography controls
const TEXT_TRANSFORMS = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'capitalize', label: 'Capitalize' },
];

// Variant options for full-screen graphics in preview selector
// Event-summary layouts (simplified for Theme Editor — 6 main layouts)
const EVENT_SUMMARY_LAYOUTS = [
  { value: 'broadcast-table', label: 'Broadcast Table' },
  { value: 'classic-broadcast', label: 'Classic Broadcast' },
  { value: 'default-v2', label: 'Default v2' },
  { value: 'dual-dynamic-v1', label: 'Dual Dynamic v1' },
  { value: 'dual-dynamic-v2', label: 'Dual Dynamic v2' },
];

// Team count options for event-summary
const SUMMARY_TEAM_COUNTS = [
  { value: '2', label: '2 Teams (Dual)' },
  { value: '3', label: '3 Teams (Tri)' },
  { value: '4', label: '4 Teams (Quad)' },
  { value: '5', label: '5 Teams' },
  { value: '6', label: '6 Teams' },
  { value: '7', label: '7 Teams' },
];

// Summary modes
const SUMMARY_MODES = [
  { value: 'rotation', label: 'By Rotation' },
  { value: 'apparatus', label: 'By Apparatus' },
];

// Virtius leaderboard event options (men's)
const LEADERBOARD_EVENTS_MENS = [
  { value: 'FX', label: 'Floor Exercise' },
  { value: 'PH', label: 'Pommel Horse' },
  { value: 'SR', label: 'Still Rings' },
  { value: 'VT', label: 'Vault' },
  { value: 'PB', label: 'Parallel Bars' },
  { value: 'HB', label: 'High Bar' },
  { value: 'AA', label: 'All-Around' },
];

// Virtius leaderboard event options (women's)
const LEADERBOARD_EVENTS_WOMENS = [
  { value: 'VT', label: 'Vault' },
  { value: 'UB', label: 'Uneven Bars' },
  { value: 'BB', label: 'Balance Beam' },
  { value: 'FX', label: 'Floor Exercise' },
  { value: 'AA', label: 'All-Around' },
];

// Gender options for leaderboard
const LEADERBOARD_GENDERS = [
  { value: 'mens', label: "Men's" },
  { value: 'womens', label: "Women's" },
];

// Event-frame type options
const EVENT_FRAME_TYPES = [
  { value: 'frame-quad', label: 'Quad (4 feeds)' },
  { value: 'frame-tri-center', label: 'Tri Center' },
  { value: 'frame-tri-wide', label: 'Tri Wide' },
  { value: 'frame-tri-wide-top', label: 'Tri Wide Top' },
  { value: 'frame-dual', label: 'Dual (2 feeds)' },
  { value: 'frame-single', label: 'Single' },
  { value: 'frame-team-header', label: 'Team Header' },
];

/**
 * Editable number input with increment/decrement stepper buttons.
 * Simplified version for per-graphic override controls.
 */
function OverrideStepper({ label, value, onChange, min = 0, max = 9999, step = 1, suffix = '' }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const [localText, setLocalText] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync local text when value changes externally (not while typing)
  useEffect(() => {
    if (!isFocused) setLocalText(String(value));
  }, [value, isFocused]);

  const commitValue = (text) => {
    const parsed = Number(text);
    if (!isNaN(parsed) && text !== '') {
      onChange(clamp(parsed));
    } else {
      // Revert to current value if invalid
      setLocalText(String(value));
    }
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-zinc-500 w-16">{label}</span>
      <button
        onClick={() => { const v = clamp(value - step); onChange(v); setLocalText(String(v)); }}
        className="w-5 h-5 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded-l text-zinc-300 text-xs font-bold transition-colors select-none"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={isFocused ? localText : String(value)}
        onFocus={() => { setIsFocused(true); setLocalText(String(value)); }}
        onBlur={() => { setIsFocused(false); commitValue(localText); }}
        onChange={(e) => setLocalText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
        className="w-12 h-5 text-center text-[10px] font-mono bg-zinc-800 text-zinc-300 border-y border-zinc-600 focus:outline-none focus:border-purple-500"
      />
      <button
        onClick={() => { const v = clamp(value + step); onChange(v); setLocalText(String(v)); }}
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
      { id: 'clip-overlay', name: 'Clip Overlay' },
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

  // Variant selector state for full-screen graphics
  const [selectedVariants, setSelectedVariants] = useState({
    'event-summary': { layout: 'broadcast-table', numTeams: '2', mode: 'rotation' },
    'virtuis-leaderboard': { event: 'FX', gender: 'mens' },
    'event-frame': { type: 'frame-quad' },
  });

  // Per-graphic override state
  const [expandedOverrideGraphics, setExpandedOverrideGraphics] = useState({});
  const [showResetAllOverridesConfirm, setShowResetAllOverridesConfirm] = useState(false);
  const [showImportOverridesModal, setShowImportOverridesModal] = useState(false);
  const [importSourceThemeId, setImportSourceThemeId] = useState('');

  // Lower-Third Template state
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showApplyTemplateConfirm, setShowApplyTemplateConfirm] = useState(false);

  // Apply lower-third template values to all three lower-third graphics
  const applyLowerThirdTemplate = () => {
    const template = editingTheme.lowerThirdTemplate || {};
    const templateKeys = Object.keys(template).filter(k => template[k] !== undefined && template[k] !== null && template[k] !== '');
    if (templateKeys.length === 0) return;

    setEditingTheme(prev => {
      const newOverrides = { ...prev.overrides };
      for (const gId of LOWER_THIRD_GRAPHICS) {
        newOverrides[gId] = { ...(newOverrides[gId] || {}) };
        for (const key of templateKeys) {
          newOverrides[gId][key] = template[key];
        }
      }
      return { ...prev, overrides: newOverrides };
    });
    setShowApplyTemplateConfirm(false);
  };

  const updateTemplateField = (key, value) => {
    setEditingTheme(prev => ({
      ...prev,
      lowerThirdTemplate: { ...(prev.lowerThirdTemplate || {}), [key]: value },
    }));
  };

  const clearTemplateField = (key) => {
    setEditingTheme(prev => {
      const tmpl = { ...(prev.lowerThirdTemplate || {}) };
      delete tmpl[key];
      return { ...prev, lowerThirdTemplate: tmpl };
    });
  };

  // Preview reload state - increment to force iframe refresh after save
  const [previewVersion, setPreviewVersion] = useState(0);

  // Pixel-perfect height measurements from the preview iframe
  const previewIframeRef = useRef(null);
  const [measuredHeights, setMeasuredHeights] = useState({});

  // Selector mapping for each lower-third graphic
  const MEASUREMENT_SELECTORS = {
    'event-bar': { logo: '.event-bar-logo', venue: '.event-bar-venue', details: '.event-bar-details' },
    'warm-up': { logo: '.warm-up-logo-section', venue: '.warm-up-teams-row', details: '.warm-up-status-row' },
    'replay': { logo: '.replay-logo-section', venue: '.replay-title-row', details: '.replay-status-row' },
  };

  // Listen for measurement responses from the preview iframe
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'heightMeasurements') {
        setMeasuredHeights(prev => ({
          ...prev,
          [event.data.graphic]: event.data.measurements,
        }));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Request measurements from preview iframe after it loads
  const requestMeasurements = useCallback(() => {
    const iframe = previewIframeRef.current;
    if (!iframe?.contentWindow) return;
    const graphicType = selectedGraphicType;
    const selectors = MEASUREMENT_SELECTORS[graphicType];
    if (selectors) {
      // Small delay to ensure the graphic has rendered
      setTimeout(() => {
        iframe.contentWindow.postMessage({
          type: 'measureHeights',
          graphic: graphicType,
          selectors,
        }, '*');
      }, 1500);
    }
  }, [selectedGraphicType]);

  // Get the measured height for a graphic element, falling back to computed estimate
  const getMeasuredHeight = (graphicId, element) => {
    return measuredHeights[graphicId]?.[element] || null;
  };

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

  // Subscribe to all competitions from Firebase
  useEffect(() => {
    const competitionsRef = ref(db, 'competitions');

    const unsubscribe = onValue(competitionsRef, (snapshot) => {
      const allCompetitions = snapshot.val() || {};
      setCompetitions(allCompetitions);
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
        lowerThirdTemplate: themes[themeId].lowerThirdTemplate || {}, // Lower-third template
      });
      setIsDirty(false);
      setExpandedOverrideGraphics({}); // Collapse all override panels when loading new theme
    }
  }, [themes]);

  // Start a new theme
  const newTheme = () => {
    setSelectedThemeId(null);
    setEditingTheme({ ...DEFAULT_THEME, overrides: {}, lowerThirdTemplate: {} });
    setIsDirty(false);
    setExpandedOverrideGraphics({});
  };

  // Update a variant selection for full-screen graphic previews
  const updateVariant = (graphicId, key, value) => {
    setSelectedVariants(prev => ({
      ...prev,
      [graphicId]: { ...(prev[graphicId] || {}), [key]: value },
    }));
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

  // Reset ALL overrides (clears the entire overrides object)
  const resetAllOverrides = () => {
    setEditingTheme(prev => ({
      ...prev,
      overrides: {},
    }));
    setIsDirty(true);
    setShowResetAllOverridesConfirm(false);
  };

  // Count total overrides across all graphics
  const totalOverrideCount = useMemo(() => {
    const overrides = editingTheme.overrides || {};
    let count = 0;
    Object.keys(overrides).forEach(graphicId => {
      count += Object.keys(overrides[graphicId] || {}).length;
    });
    return count;
  }, [editingTheme.overrides]);

  // Count graphics with overrides
  const graphicsWithOverridesCount = useMemo(() => {
    return Object.keys(editingTheme.overrides || {}).filter(
      graphicId => Object.keys(editingTheme.overrides[graphicId] || {}).length > 0
    ).length;
  }, [editingTheme.overrides]);

  // Import overrides from another theme
  const importOverrides = () => {
    if (!importSourceThemeId || !themes[importSourceThemeId]) {
      return;
    }
    const sourceOverrides = themes[importSourceThemeId].overrides || {};
    setEditingTheme(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        ...sourceOverrides,
      },
    }));
    setIsDirty(true);
    setShowImportOverridesModal(false);
    setImportSourceThemeId('');
  };

  // Get list of other themes (for import dropdown) - exclude current theme
  const otherThemesForImport = useMemo(() => {
    return Object.entries(themes)
      .filter(([id]) => id !== selectedThemeId)
      .filter(([, theme]) => theme.overrides && Object.keys(theme.overrides).length > 0)
      .map(([id, theme]) => ({
        id,
        name: theme.name,
        overrideCount: Object.keys(theme.overrides).length,
      }));
  }, [themes, selectedThemeId]);

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

    if (selectedGraphicType === 'clip-overlay') {
      // Clip Overlay — use output.html with mode=clip-preview for sample clip overlay
      params.set('mode', 'clip-preview');
      if (selectedThemeId) {
        params.set('meetTheme', selectedThemeId);
      }
      // If competition selected, pull real team data for the overlay
      if (selectedCompetition) {
        const compData = competitions[selectedCompetition];
        if (compData?.teamData?.team1?.roster?.[0]) {
          const athlete = compData.teamData.team1.roster[0];
          params.set('athleteName', athlete.fullName || 'Sample Athlete');
        }
        if (compData?.config?.team1Name) {
          params.set('teamName', compData.config.team1Name);
        }
        if (compData?.teamData?.team1?.logo) {
          params.set('teamLogo', compData.teamData.team1.logo);
        }
      }
      return `${baseUrl}/output.html?${params.toString()}`;
    }

    if (selectedGraphicType === 'sponsors-thanks') {
      // Sponsors Thanks — use the overlay file directly with theme sponsors
      params.set('meetTheme', selectedThemeId || 'preview');
      // Get the meet logo from theme
      const logo = editingTheme?.logos?.primary || '';
      if (logo) {
        params.set('logo', logo);
      }
      // Pass sponsors from theme (if any)
      const sponsors = editingTheme?.sponsors || [];
      if (sponsors.length > 0) {
        // Only include name and url for each sponsor
        const sponsorData = sponsors.slice(0, 8).map(s => ({
          name: s.name || '',
          url: s.url || '',
          scale: s.scale,
          offsetX: s.offsetX,
          offsetY: s.offsetY,
        }));
        params.set('sponsors', JSON.stringify(sponsorData));
      }
      return `${baseUrl}/overlays/sponsors-thanks.html?${params.toString()}`;
    }

    // Standard graphics — use output.html
    params.set('graphic', selectedGraphicType);

    // Add placeholder data when no competition is selected so preview renders
    if (!selectedCompetition) {
      params.set('previewMode', 'placeholder');
      // Event bar
      if (selectedGraphicType === 'event-bar') {
        params.set('venue', 'Sample Arena');
        params.set('eventName', 'Home Team vs Away Team');
        params.set('location', 'City, State');
        params.set('team1Name', 'Home Team');
        params.set('team1Logo', 'https://media.virti.us/upload/images/team/CbWKimoC_0RpBy-M-lcSy');
      }
      // Event summary
      if (selectedGraphicType === 'event-summary') {
        params.set('summaryMode', 'rotation');
        params.set('summaryRotation', '1');
        params.set('summaryNumTeams', '2');
        params.set('team1Name', 'Home Team');
        params.set('team2Name', 'Away Team');
      }
      // Hosts / coaches
      if (selectedGraphicType === 'hosts') {
        params.set('venue', 'Sample Arena');
        params.set('eventName', 'Home Team vs Away Team');
        params.set('team1Name', 'Home Team');
      }
      // Warm-up / replay
      if (selectedGraphicType === 'warm-up' || selectedGraphicType === 'replay') {
        params.set('team1Name', 'Home Team');
        params.set('team2Name', 'Away Team');
        params.set('team1Logo', 'https://media.virti.us/upload/images/team/CbWKimoC_0RpBy-M-lcSy');
        params.set('team2Logo', 'https://media.virti.us/upload/images/team/CbWKimoC_0RpBy-M-lcSy');
      }
      // Stream graphics
      if (selectedGraphicType === 'stream-starting' || selectedGraphicType === 'stream-thanks') {
        params.set('venue', 'Sample Arena');
        params.set('eventName', 'Home Team vs Away Team');
        params.set('team1Name', 'Home Team');
        params.set('team1Logo', 'https://media.virti.us/upload/images/team/CbWKimoC_0RpBy-M-lcSy');
      }
      // Stats / coaches cards
      if (selectedGraphicType.match(/^team\d-stats$/) || selectedGraphicType.match(/^team\d-coaches$/)) {
        params.set('team1Name', 'Home Team');
        params.set('team2Name', 'Away Team');
        params.set('team1Logo', 'https://media.virti.us/upload/images/team/CbWKimoC_0RpBy-M-lcSy');
        params.set('team2Logo', 'https://media.virti.us/upload/images/team/CbWKimoC_0RpBy-M-lcSy');
      }
      // Event frame / leaderboard
      if (selectedGraphicType === 'event-frame' || selectedGraphicType === 'virtuis-leaderboard') {
        params.set('team1Name', 'Home Team');
        params.set('team2Name', 'Away Team');
      }
      // Live camera
      if (selectedGraphicType === 'live-camera') {
        params.set('cameraLabel', 'Camera 1');
      }
    }

    // Apply variant selections for full-screen graphics
    if (selectedGraphicType === 'event-summary') {
      const variants = selectedVariants['event-summary'] || {};
      params.set('summaryMode', variants.mode || 'rotation');
      params.set('summaryRotation', '1');
      params.set('summaryNumTeams', variants.numTeams || '2');
      if (variants.layout) {
        params.set('layout', variants.layout);
      }
    }

    if (selectedGraphicType === 'virtuis-leaderboard') {
      const variants = selectedVariants['virtuis-leaderboard'] || {};
      params.set('leaderboardEvent', variants.event || 'FX');
      params.set('leaderboardGender', variants.gender || 'mens');
    }

    if (selectedGraphicType === 'event-frame') {
      const variants = selectedVariants['event-frame'] || {};
      // Event-frame uses overlay files, so we route to the selected frame type
      const frameType = variants.type || 'frame-quad';
      params.set('meetTheme', selectedThemeId || 'preview');
      // Event-frame needs special handling — it's an overlay file, not output.html
      // Return early with overlay URL
      return `${baseUrl}/overlays/${frameType}.html?${params.toString()}`;
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
  }, [selectedThemeId, selectedGraphicType, selectedCompetition, competitions, editingTheme, selectedVariants]);

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

            {/* Background Images */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Background Images</h2>
              <p className="text-xs text-zinc-500 mb-4">
                Apply to all graphics. Per-graphic overrides (below) take precedence.
              </p>

              <div className="space-y-4">
                {/* Header Background Image */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Header Background Image</label>
                  <div className="flex gap-3 mb-2">
                    <input
                      type="text"
                      value={editingTheme.images?.headerBgImage || ''}
                      onChange={(e) => updateField('images.headerBgImage', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    {editingTheme.images?.headerBgImage && (
                      <img
                        src={editingTheme.images.headerBgImage}
                        alt="Header bg preview"
                        className="w-16 h-10 object-cover bg-zinc-800 rounded"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                  {editingTheme.images?.headerBgImage && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Fit</label>
                        <select
                          value={editingTheme.images?.headerBgImageFit || 'cover'}
                          onChange={(e) => updateField('images.headerBgImageFit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="cover">Cover</option>
                          <option value="contain">Contain</option>
                          <option value="auto">Auto</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Position</label>
                        <select
                          value={editingTheme.images?.headerBgImagePosition || 'center'}
                          onChange={(e) => updateField('images.headerBgImagePosition', e.target.value)}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="center">Center</option>
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Opacity</label>
                        <input
                          type="number"
                          value={Math.round((editingTheme.images?.headerBgImageOpacity ?? 1) * 100)}
                          onChange={(e) => updateField('images.headerBgImageOpacity', Number(e.target.value) / 100)}
                          min={0}
                          max={100}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Body Background Image */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Body Background Image</label>
                  <div className="flex gap-3 mb-2">
                    <input
                      type="text"
                      value={editingTheme.images?.bodyBgImage || ''}
                      onChange={(e) => updateField('images.bodyBgImage', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    {editingTheme.images?.bodyBgImage && (
                      <img
                        src={editingTheme.images.bodyBgImage}
                        alt="Body bg preview"
                        className="w-16 h-10 object-cover bg-zinc-800 rounded"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                  {editingTheme.images?.bodyBgImage && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Fit</label>
                        <select
                          value={editingTheme.images?.bodyBgImageFit || 'cover'}
                          onChange={(e) => updateField('images.bodyBgImageFit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="cover">Cover</option>
                          <option value="contain">Contain</option>
                          <option value="auto">Auto</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Position</label>
                        <select
                          value={editingTheme.images?.bodyBgImagePosition || 'center'}
                          onChange={(e) => updateField('images.bodyBgImagePosition', e.target.value)}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="center">Center</option>
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Opacity</label>
                        <input
                          type="number"
                          value={Math.round((editingTheme.images?.bodyBgImageOpacity ?? 1) * 100)}
                          onChange={(e) => updateField('images.bodyBgImageOpacity', Number(e.target.value) / 100)}
                          min={0}
                          max={100}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Texture Overlay */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Texture Overlay</label>
                  <div className="flex gap-3 mb-2">
                    <input
                      type="text"
                      value={editingTheme.textures?.overlay || ''}
                      onChange={(e) => updateField('textures.overlay', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    {editingTheme.textures?.overlay && (
                      <img
                        src={editingTheme.textures.overlay}
                        alt="Texture preview"
                        className="w-16 h-10 object-cover bg-zinc-800 rounded"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                  {editingTheme.textures?.overlay && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Opacity</label>
                        <input
                          type="number"
                          value={Math.round((editingTheme.textures?.opacity ?? 0.08) * 100)}
                          onChange={(e) => updateField('textures.opacity', Number(e.target.value) / 100)}
                          min={0}
                          max={100}
                          step={2}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Per-Graphic Overrides</h2>
                  {graphicsWithOverridesCount > 0 && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                      {totalOverrideCount} override{totalOverrideCount !== 1 ? 's' : ''} in {graphicsWithOverridesCount} graphic{graphicsWithOverridesCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Import from another theme */}
                  {otherThemesForImport.length > 0 && (
                    <button
                      onClick={() => setShowImportOverridesModal(true)}
                      className="px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                    >
                      Import...
                    </button>
                  )}
                  {/* Reset all overrides */}
                  {graphicsWithOverridesCount > 0 && !showResetAllOverridesConfirm && (
                    <button
                      onClick={() => setShowResetAllOverridesConfirm(true)}
                      className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                    >
                      Reset All
                    </button>
                  )}
                  {showResetAllOverridesConfirm && (
                    <div className="flex items-center gap-1.5 bg-red-900/20 rounded px-2 py-1">
                      <span className="text-[10px] text-red-400">Clear all {totalOverrideCount} overrides?</span>
                      <button
                        onClick={() => setShowResetAllOverridesConfirm(false)}
                        className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-300 bg-zinc-800 rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={resetAllOverrides}
                        className="px-1.5 py-0.5 text-[10px] text-white bg-red-600 hover:bg-red-500 rounded transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Override theme colors for specific graphics. Overrides take precedence over the theme defaults above.
              </p>

              {/* Import Overrides Modal */}
              {showImportOverridesModal && (
                <div className="mb-4 p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-300">Import overrides from another theme</span>
                    <button
                      onClick={() => {
                        setShowImportOverridesModal(false);
                        setImportSourceThemeId('');
                      }}
                      className="text-zinc-500 hover:text-zinc-300"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mb-2">
                    Select a theme to import its overrides. Imported overrides will merge with existing ones (matching graphic IDs will be replaced).
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={importSourceThemeId}
                      onChange={(e) => setImportSourceThemeId(e.target.value)}
                      className="flex-1 h-8 px-2 bg-zinc-700 border border-zinc-600 rounded text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select a theme...</option>
                      {otherThemesForImport.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name} ({theme.overrideCount} graphic{theme.overrideCount !== 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={importOverrides}
                      disabled={!importSourceThemeId}
                      className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded transition-colors"
                    >
                      Import
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {OVERRIDE_GRAPHIC_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                      {group.label}
                    </div>

                    {/* LOWER-THIRD TEMPLATE — only for Lower-Third Bars group */}
                    {group.label === 'Lower-Third Bars' && (
                      <div className="bg-zinc-800/80 rounded-lg overflow-hidden mb-2 border border-teal-500/30">
                        <button
                          onClick={() => setShowTemplatePanel(p => !p)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-700/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-teal-400 font-semibold">Template</span>
                            <span className="text-[10px] text-zinc-500">Set values for all lower-thirds at once</span>
                          </div>
                          <svg className={`w-4 h-4 text-teal-500 transition-transform ${showTemplatePanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showTemplatePanel && (() => {
                          const tmpl = editingTheme.lowerThirdTemplate || {};
                          return (
                            <div className="px-3 pb-3 border-t border-teal-500/20 space-y-4 pt-3">
                              {/* POSITION */}
                              <div>
                                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Position</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <OverrideStepper label="Bottom" value={tmpl.barBottom ?? 120} onChange={(v) => updateTemplateField('barBottom', v)} min={0} max={1080} step={10} suffix="px" />
                                  <OverrideStepper label="Left" value={tmpl.barLeft ?? 100} onChange={(v) => updateTemplateField('barLeft', v)} min={0} max={1920} step={10} suffix="px" />
                                </div>
                              </div>
                              {/* LOGO */}
                              <div className="pt-2 border-t border-zinc-700/30">
                                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Logo</div>
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <OverrideStepper label="Logo size" value={tmpl.logoImgSize ?? 70} onChange={(v) => updateTemplateField('logoImgSize', v)} min={16} max={200} step={1} suffix="px" />
                                    <OverrideStepper label="Box width" value={tmpl.logoContainerWidth ?? 100} onChange={(v) => updateTemplateField('logoContainerWidth', v)} min={40} max={300} step={1} suffix="px" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <OverrideStepper label="Box height" value={tmpl.logoContainerHeight ?? getEffectiveLogoHeight(tmpl, 'event-bar')} onChange={(v) => updateTemplateField('logoContainerHeight', v)} min={20} max={300} step={1} suffix="px" />
                                    <OverrideStepper label="Padding" value={tmpl.logoPadding ?? 15} onChange={(v) => updateTemplateField('logoPadding', v)} min={0} max={60} step={2} suffix="px" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <OverrideStepper label="Radius" value={tmpl.logoRadius ?? 0} onChange={(v) => updateTemplateField('logoRadius', v)} min={0} max={100} step={2} suffix="px" />
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <input type="color" value={tmpl.logoBg || '#ffffff'} onChange={(e) => updateTemplateField('logoBg', e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                      <span className="text-[10px] text-zinc-400">Box background</span>
                                    </div>
                                    {tmpl.logoBg && <button onClick={() => clearTemplateField('logoBg')} className="text-[10px] text-zinc-500 hover:text-zinc-300">reset</button>}
                                  </div>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={tmpl.showLogo !== false} onChange={(e) => updateTemplateField('showLogo', e.target.checked)} className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-0" />
                                    <span className="text-[11px] text-zinc-300">Show logo</span>
                                  </label>
                                </div>
                              </div>
                              {/* VENUE (Header Bar) */}
                              <div className="pt-2 border-t border-zinc-700/30">
                                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Venue (Header Bar)</div>
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <OverrideStepper label="Font size" value={tmpl.venueFontSize ?? 36} onChange={(v) => updateTemplateField('venueFontSize', v)} min={12} max={72} step={2} suffix="px" />
                                    <OverrideStepper label="Min width" value={tmpl.barMinWidth ?? 600} onChange={(v) => updateTemplateField('barMinWidth', v)} min={200} max={1600} step={20} suffix="px" />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <OverrideStepper label="Height" value={tmpl.venueHeight ?? getEffectiveVenueHeight(tmpl, 'event-bar')} onChange={(v) => updateTemplateField('venueHeight', v)} min={20} max={200} step={1} suffix="px" />
                                    <OverrideStepper label="Top/btm" value={tmpl.venuePaddingV ?? 10} onChange={(v) => updateTemplateField('venuePaddingV', v)} min={0} max={60} step={2} suffix="px" />
                                    <OverrideStepper label="Left/right" value={tmpl.venuePaddingH ?? 40} onChange={(v) => updateTemplateField('venuePaddingH', v)} min={0} max={100} step={1} suffix="px" />
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <input type="color" value={tmpl.headerBar || editingTheme.colors.headerBar || '#BFBFBF'} onChange={(e) => updateTemplateField('headerBar', e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                      <span className="text-[10px] text-zinc-400">Background</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <input type="color" value={tmpl.textOnHeader || editingTheme.colors.textOnHeader || '#000000'} onChange={(e) => updateTemplateField('textOnHeader', e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                      <span className="text-[10px] text-zinc-400">Text</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {/* TEXT (Details Section) */}
                              <div className="pt-2 border-t border-zinc-700/30">
                                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Text (Details Section)</div>
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <OverrideStepper label="Name size" value={tmpl.nameFontSize ?? 28} onChange={(v) => updateTemplateField('nameFontSize', v)} min={12} max={60} step={2} suffix="px" />
                                    <OverrideStepper label="Location" value={tmpl.locationFontSize ?? 24} onChange={(v) => updateTemplateField('locationFontSize', v)} min={12} max={48} step={2} suffix="px" />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <OverrideStepper label="Height" value={tmpl.detailsHeight ?? getEffectiveDetailsHeight(tmpl, 'event-bar')} onChange={(v) => updateTemplateField('detailsHeight', v)} min={20} max={200} step={1} suffix="px" />
                                    <OverrideStepper label="Top/btm" value={tmpl.detailsPaddingV ?? 10} onChange={(v) => updateTemplateField('detailsPaddingV', v)} min={0} max={60} step={2} suffix="px" />
                                    <OverrideStepper label="Left/right" value={tmpl.detailsPaddingH ?? 40} onChange={(v) => updateTemplateField('detailsPaddingH', v)} min={0} max={100} step={1} suffix="px" />
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <input type="color" value={tmpl.contentArea || editingTheme.colors.contentArea || '#000000'} onChange={(e) => updateTemplateField('contentArea', e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                      <span className="text-[10px] text-zinc-400">Background</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <input type="color" value={tmpl.textOnContent || editingTheme.colors.textOnContent || '#FFFFFF'} onChange={(e) => updateTemplateField('textOnContent', e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                      <span className="text-[10px] text-zinc-400">Text</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {/* Apply button */}
                              <div className="pt-2 border-t border-zinc-700/30">
                                {showApplyTemplateConfirm ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-zinc-400">Apply template values to all 3 lower-thirds?</span>
                                    <button onClick={applyLowerThirdTemplate} className="px-3 py-1 text-xs bg-teal-600 hover:bg-teal-500 rounded transition-colors">Apply</button>
                                    <button onClick={() => setShowApplyTemplateConfirm(false)} className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded transition-colors">Cancel</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowApplyTemplateConfirm(true)}
                                    className="w-full px-3 py-2 text-xs bg-teal-600/20 text-teal-400 hover:bg-teal-600/30 rounded-lg font-semibold transition-colors"
                                  >
                                    Apply to All Lower-Thirds
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

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
                                {LOWER_THIRD_GRAPHICS.includes(graphicId) ? (
                                  /* ========== RICH LOWER-THIRD CONTROLS ========== */
                                  <div className="pt-3 space-y-4">
                                    {/* POSITION */}
                                    <div>
                                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Position</div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <OverrideStepper
                                          label="Bottom"
                                          value={overrides.barBottom ?? (LOWER_THIRD_DEFAULTS[graphicId]?.barBottom ?? 120)}
                                          onChange={(v) => updateOverrideField(graphicId, 'barBottom', v)}
                                          min={0}
                                          max={1080}
                                          step={10}
                                          suffix="px"
                                        />
                                        <OverrideStepper
                                          label="Left"
                                          value={overrides.barLeft ?? (LOWER_THIRD_DEFAULTS[graphicId]?.barLeft ?? 100)}
                                          onChange={(v) => updateOverrideField(graphicId, 'barLeft', v)}
                                          min={0}
                                          max={1920}
                                          step={10}
                                          suffix="px"
                                        />
                                      </div>
                                    </div>

                                    {/* LOGO */}
                                    <div className="pt-2 border-t border-zinc-700/30">
                                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Logo</div>
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <OverrideStepper
                                            label="Logo size"
                                            value={overrides.logoImgSize ?? (LOWER_THIRD_DEFAULTS[graphicId]?.logoImgSize ?? 70)}
                                            onChange={(v) => updateOverrideField(graphicId, 'logoImgSize', v)}
                                            min={16}
                                            max={200}
                                            step={1}
                                            suffix="px"
                                          />
                                          <OverrideStepper
                                            label="Box width"
                                            value={overrides.logoContainerWidth ?? (LOWER_THIRD_DEFAULTS[graphicId]?.logoContainerWidth ?? 100)}
                                            onChange={(v) => updateOverrideField(graphicId, 'logoContainerWidth', v)}
                                            min={40}
                                            max={300}
                                            step={1}
                                            suffix="px"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <OverrideStepper
                                            label="Box height"
                                            value={overrides.logoContainerHeight ?? getMeasuredHeight(graphicId, 'logo') ?? getEffectiveLogoHeight(overrides, graphicId)}
                                            onChange={(v) => updateOverrideField(graphicId, 'logoContainerHeight', v)}
                                            min={20}
                                            max={300}
                                            step={1}
                                            suffix="px"
                                          />
                                          <OverrideStepper
                                            label="Padding"
                                            value={overrides.logoPadding ?? (LOWER_THIRD_DEFAULTS[graphicId]?.logoPadding ?? 15)}
                                            onChange={(v) => updateOverrideField(graphicId, 'logoPadding', v)}
                                            min={0}
                                            max={60}
                                            step={2}
                                            suffix="px"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <OverrideStepper
                                            label="Radius"
                                            value={overrides.logoRadius ?? (LOWER_THIRD_DEFAULTS[graphicId]?.logoRadius ?? 0)}
                                            onChange={(v) => updateOverrideField(graphicId, 'logoRadius', v)}
                                            min={0}
                                            max={100}
                                            step={2}
                                            suffix="px"
                                          />
                                        </div>
                                        {/* Logo box background color */}
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="color"
                                              value={overrides.logoBg || '#ffffff'}
                                              onChange={(e) => updateOverrideField(graphicId, 'logoBg', e.target.value)}
                                              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                                            />
                                            <span className="text-[10px] text-zinc-400">Box background</span>
                                          </div>
                                          {overrides.logoBg && (
                                            <button
                                              onClick={() => clearOverrideField(graphicId, 'logoBg')}
                                              className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                            >
                                              reset
                                            </button>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={overrides.showLogo !== false}
                                              onChange={(e) => updateOverrideField(graphicId, 'showLogo', e.target.checked)}
                                              className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                                            />
                                            <span className="text-[11px] text-zinc-300">Show logo</span>
                                          </label>
                                        </div>
                                        {/* Logo URL override */}
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={overrides.logo || ''}
                                            onChange={(e) => updateOverrideField(graphicId, 'logo', e.target.value)}
                                            placeholder="Logo URL override (https://...)"
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
                                      </div>
                                    </div>

                                    {/* VENUE (Header Bar) */}
                                    <div className="pt-2 border-t border-zinc-700/30">
                                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Venue (Header Bar)</div>
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <OverrideStepper
                                            label="Font size"
                                            value={overrides.venueFontSize ?? (LOWER_THIRD_DEFAULTS[graphicId]?.venueFontSize ?? 36)}
                                            onChange={(v) => updateOverrideField(graphicId, 'venueFontSize', v)}
                                            min={12}
                                            max={72}
                                            step={2}
                                            suffix="px"
                                          />
                                          <OverrideStepper
                                            label="Min width"
                                            value={overrides.barMinWidth ?? (LOWER_THIRD_DEFAULTS[graphicId]?.barMinWidth ?? 600)}
                                            onChange={(v) => updateOverrideField(graphicId, 'barMinWidth', v)}
                                            min={200}
                                            max={1600}
                                            step={20}
                                            suffix="px"
                                          />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                          <OverrideStepper
                                            label="Height"
                                            value={overrides.venueHeight ?? getMeasuredHeight(graphicId, 'venue') ?? getEffectiveVenueHeight(overrides, graphicId)}
                                            onChange={(v) => updateOverrideField(graphicId, 'venueHeight', v)}
                                            min={20}
                                            max={200}
                                            step={1}
                                            suffix="px"
                                          />
                                          <OverrideStepper
                                            label="Top/btm"
                                            value={overrides.venuePaddingV ?? 10}
                                            onChange={(v) => updateOverrideField(graphicId, 'venuePaddingV', v)}
                                            min={0}
                                            max={60}
                                            step={2}
                                            suffix="px"
                                          />
                                          <OverrideStepper
                                            label="Left/right"
                                            value={overrides.venuePaddingH ?? 40}
                                            onChange={(v) => updateOverrideField(graphicId, 'venuePaddingH', v)}
                                            min={0}
                                            max={100}
                                            step={1}
                                            suffix="px"
                                          />
                                        </div>
                                        {/* Venue colors */}
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="color"
                                              value={overrides.headerBar || editingTheme.colors.headerBar || '#BFBFBF'}
                                              onChange={(e) => updateOverrideField(graphicId, 'headerBar', e.target.value)}
                                              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                                            />
                                            <span className="text-[10px] text-zinc-400">Background</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="color"
                                              value={overrides.textOnHeader || editingTheme.colors.textOnHeader || '#000000'}
                                              onChange={(e) => updateOverrideField(graphicId, 'textOnHeader', e.target.value)}
                                              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                                            />
                                            <span className="text-[10px] text-zinc-400">Text</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* TEXT (Details Section) */}
                                    <div className="pt-2 border-t border-zinc-700/30">
                                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Text (Details Section)</div>
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <OverrideStepper
                                            label="Name size"
                                            value={overrides.nameFontSize ?? (LOWER_THIRD_DEFAULTS[graphicId]?.nameFontSize ?? 28)}
                                            onChange={(v) => updateOverrideField(graphicId, 'nameFontSize', v)}
                                            min={12}
                                            max={60}
                                            step={2}
                                            suffix="px"
                                          />
                                          <OverrideStepper
                                            label="Location"
                                            value={overrides.locationFontSize ?? (LOWER_THIRD_DEFAULTS[graphicId]?.locationFontSize ?? 24)}
                                            onChange={(v) => updateOverrideField(graphicId, 'locationFontSize', v)}
                                            min={12}
                                            max={48}
                                            step={2}
                                            suffix="px"
                                          />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                          <OverrideStepper
                                            label="Height"
                                            value={overrides.detailsHeight ?? getMeasuredHeight(graphicId, 'details') ?? getEffectiveDetailsHeight(overrides, graphicId)}
                                            onChange={(v) => updateOverrideField(graphicId, 'detailsHeight', v)}
                                            min={20}
                                            max={200}
                                            step={1}
                                            suffix="px"
                                          />
                                          <OverrideStepper
                                            label="Top/btm"
                                            value={overrides.detailsPaddingV ?? 10}
                                            onChange={(v) => updateOverrideField(graphicId, 'detailsPaddingV', v)}
                                            min={0}
                                            max={60}
                                            step={2}
                                            suffix="px"
                                          />
                                          <OverrideStepper
                                            label="Left/right"
                                            value={overrides.detailsPaddingH ?? 40}
                                            onChange={(v) => updateOverrideField(graphicId, 'detailsPaddingH', v)}
                                            min={0}
                                            max={100}
                                            step={1}
                                            suffix="px"
                                          />
                                        </div>
                                        {/* Details colors */}
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="color"
                                              value={overrides.contentArea || editingTheme.colors.contentArea || '#000000'}
                                              onChange={(e) => updateOverrideField(graphicId, 'contentArea', e.target.value)}
                                              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                                            />
                                            <span className="text-[10px] text-zinc-400">Background</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="color"
                                              value={overrides.textOnContent || editingTheme.colors.textOnContent || '#FFFFFF'}
                                              onChange={(e) => updateOverrideField(graphicId, 'textOnContent', e.target.value)}
                                              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                                            />
                                            <span className="text-[10px] text-zinc-400">Text</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* IMAGES / TEXTURES */}
                                    <div className="pt-2 border-t border-zinc-700/30">
                                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Images / Textures</div>
                                      <div className="space-y-2">
                                        {/* Header Background Image */}
                                        <div className="flex items-center gap-2 mb-1">
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
                                          <div className="space-y-2 ml-5">
                                            <input
                                              type="text"
                                              value={overrides.headerBgImage || ''}
                                              onChange={(e) => updateOverrideField(graphicId, 'headerBgImage', e.target.value)}
                                              placeholder="https://..."
                                              className="w-full px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                            />
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

                                        {/* Body Texture */}
                                        <div className="flex items-center gap-2 mb-1">
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
                                          <div className="space-y-2 ml-5">
                                            <input
                                              type="text"
                                              value={overrides.bodyTexture || ''}
                                              onChange={(e) => updateOverrideField(graphicId, 'bodyTexture', e.target.value)}
                                              placeholder="https://..."
                                              className="w-full px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                            />
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
                                ) : FULL_SCREEN_GRAPHICS.includes(graphicId) ? (
                                  /* ========== RICH FULL-SCREEN CONTROLS ========== */
                                  <div className="pt-3 space-y-4">
                                    {/* EVENT-SUMMARY specific controls */}
                                    {graphicId === 'event-summary' && (
                                      <>
                                        {/* HEADER */}
                                        <div>
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Header</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Title size"
                                                value={overrides.titleFontSize ?? FULL_SCREEN_DEFAULTS['event-summary'].titleFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'titleFontSize', v)}
                                                min={16} max={72} step={2} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Height"
                                                value={overrides.headerHeight ?? FULL_SCREEN_DEFAULTS['event-summary'].headerHeight}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerHeight', v)}
                                                min={40} max={200} step={4} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Padding"
                                                value={overrides.headerPadding ?? FULL_SCREEN_DEFAULTS['event-summary'].headerPadding}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerPadding', v)}
                                                min={0} max={100} step={4} suffix="px"
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Title font</span>
                                                <select
                                                  value={overrides.titleFontFamily ?? FULL_SCREEN_DEFAULTS['event-summary'].titleFontFamily}
                                                  onChange={(e) => updateOverrideField(graphicId, 'titleFontFamily', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                </select>
                                              </div>
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Weight</span>
                                                <select
                                                  value={overrides.titleFontWeight ?? FULL_SCREEN_DEFAULTS['event-summary'].titleFontWeight}
                                                  onChange={(e) => updateOverrideField(graphicId, 'titleFontWeight', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                                </select>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Transform</span>
                                                <select
                                                  value={overrides.titleTextTransform ?? FULL_SCREEN_DEFAULTS['event-summary'].titleTextTransform}
                                                  onChange={(e) => updateOverrideField(graphicId, 'titleTextTransform', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {TEXT_TRANSFORMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                </select>
                                              </div>
                                              <OverrideStepper
                                                label="Logo size"
                                                value={overrides.headerLogoSize ?? FULL_SCREEN_DEFAULTS['event-summary'].headerLogoSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerLogoSize', v)}
                                                min={24} max={120} step={4} suffix="px"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* CONTENT */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Content</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Row height"
                                                value={overrides.rowHeight ?? FULL_SCREEN_DEFAULTS['event-summary'].rowHeight}
                                                onChange={(v) => updateOverrideField(graphicId, 'rowHeight', v)}
                                                min={24} max={80} step={2} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Row pad"
                                                value={overrides.rowPadding ?? FULL_SCREEN_DEFAULTS['event-summary'].rowPadding}
                                                onChange={(v) => updateOverrideField(graphicId, 'rowPadding', v)}
                                                min={4} max={32} step={2} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Padding"
                                                value={overrides.contentPadding ?? FULL_SCREEN_DEFAULTS['event-summary'].contentPadding}
                                                onChange={(v) => updateOverrideField(graphicId, 'contentPadding', v)}
                                                min={0} max={80} step={4} suffix="px"
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <OverrideStepper
                                                label="Team name"
                                                value={overrides.teamNameFontSize ?? FULL_SCREEN_DEFAULTS['event-summary'].teamNameFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'teamNameFontSize', v)}
                                                min={12} max={48} step={2} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Athlete"
                                                value={overrides.athleteNameFontSize ?? FULL_SCREEN_DEFAULTS['event-summary'].athleteNameFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'athleteNameFontSize', v)}
                                                min={10} max={36} step={1} suffix="px"
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Score font</span>
                                                <select
                                                  value={overrides.scoreFontFamily ?? FULL_SCREEN_DEFAULTS['event-summary'].scoreFontFamily}
                                                  onChange={(e) => updateOverrideField(graphicId, 'scoreFontFamily', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_FAMILIES.filter(f => f.tabular).map(f => (
                                                    <option key={f.value} value={f.value}>{f.label} (tabular)</option>
                                                  ))}
                                                  {FONT_FAMILIES.filter(f => !f.tabular).map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <OverrideStepper
                                                label="Score size"
                                                value={overrides.scoreFontSize ?? FULL_SCREEN_DEFAULTS['event-summary'].scoreFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'scoreFontSize', v)}
                                                min={12} max={48} step={2} suffix="px"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* FOOTER */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Footer (Totals Row)</div>
                                          <div className="grid grid-cols-2 gap-2">
                                            <OverrideStepper
                                              label="Height"
                                              value={overrides.footerHeight ?? FULL_SCREEN_DEFAULTS['event-summary'].footerHeight}
                                              onChange={(v) => updateOverrideField(graphicId, 'footerHeight', v)}
                                              min={32} max={100} step={4} suffix="px"
                                            />
                                            <OverrideStepper
                                              label="Font size"
                                              value={overrides.footerFontSize ?? FULL_SCREEN_DEFAULTS['event-summary'].footerFontSize}
                                              onChange={(v) => updateOverrideField(graphicId, 'footerFontSize', v)}
                                              min={16} max={48} step={2} suffix="px"
                                            />
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {/* VIRTUIS-LEADERBOARD specific controls */}
                                    {graphicId === 'virtuis-leaderboard' && (
                                      <>
                                        {/* CONTAINER */}
                                        <div>
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Container Position</div>
                                          <div className="grid grid-cols-4 gap-2">
                                            <OverrideStepper
                                              label="Top"
                                              value={overrides.containerTop ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].containerTop}
                                              onChange={(v) => updateOverrideField(graphicId, 'containerTop', v)}
                                              min={0} max={400} step={10} suffix="px"
                                            />
                                            <OverrideStepper
                                              label="Left"
                                              value={overrides.containerLeft ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].containerLeft}
                                              onChange={(v) => updateOverrideField(graphicId, 'containerLeft', v)}
                                              min={0} max={400} step={10} suffix="px"
                                            />
                                            <OverrideStepper
                                              label="Right"
                                              value={overrides.containerRight ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].containerRight}
                                              onChange={(v) => updateOverrideField(graphicId, 'containerRight', v)}
                                              min={0} max={400} step={10} suffix="px"
                                            />
                                            <OverrideStepper
                                              label="Bottom"
                                              value={overrides.containerBottom ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].containerBottom}
                                              onChange={(v) => updateOverrideField(graphicId, 'containerBottom', v)}
                                              min={0} max={400} step={10} suffix="px"
                                            />
                                          </div>
                                        </div>

                                        {/* TABLE */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Table</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Font size"
                                                value={overrides.tableFontSize ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].tableFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'tableFontSize', v)}
                                                min={10} max={36} step={1} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Header pad"
                                                value={overrides.tableHeaderPadding ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].tableHeaderPadding}
                                                onChange={(v) => updateOverrideField(graphicId, 'tableHeaderPadding', v)}
                                                min={4} max={40} step={2} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Row pad"
                                                value={overrides.tableRowPadding ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].tableRowPadding}
                                                onChange={(v) => updateOverrideField(graphicId, 'tableRowPadding', v)}
                                                min={4} max={32} step={2} suffix="px"
                                              />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Rank col"
                                                value={overrides.rankColWidth ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].rankColWidth}
                                                onChange={(v) => updateOverrideField(graphicId, 'rankColWidth', v)}
                                                min={30} max={120} step={5} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Medal size"
                                                value={overrides.medalSize ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].medalSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'medalSize', v)}
                                                min={12} max={48} step={2} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Logo size"
                                                value={overrides.teamLogoSize ?? FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].teamLogoSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'teamLogoSize', v)}
                                                min={16} max={64} step={4} suffix="px"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* MEDALS */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Medal Colors</div>
                                          <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                              <span className="text-[10px] text-yellow-400">Gold</span>
                                              <div className="flex gap-1">
                                                <input type="color" value={overrides.goldFrom || FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].goldFrom}
                                                  onChange={(e) => updateOverrideField(graphicId, 'goldFrom', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" title="From" />
                                                <input type="color" value={overrides.goldTo || FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].goldTo}
                                                  onChange={(e) => updateOverrideField(graphicId, 'goldTo', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" title="To" />
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <span className="text-[10px] text-zinc-400">Silver</span>
                                              <div className="flex gap-1">
                                                <input type="color" value={overrides.silverFrom || FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].silverFrom}
                                                  onChange={(e) => updateOverrideField(graphicId, 'silverFrom', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" title="From" />
                                                <input type="color" value={overrides.silverTo || FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].silverTo}
                                                  onChange={(e) => updateOverrideField(graphicId, 'silverTo', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" title="To" />
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <span className="text-[10px] text-amber-600">Bronze</span>
                                              <div className="flex gap-1">
                                                <input type="color" value={overrides.bronzeFrom || FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].bronzeFrom}
                                                  onChange={(e) => updateOverrideField(graphicId, 'bronzeFrom', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" title="From" />
                                                <input type="color" value={overrides.bronzeTo || FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].bronzeTo}
                                                  onChange={(e) => updateOverrideField(graphicId, 'bronzeTo', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" title="To" />
                                              </div>
                                            </div>
                                          </div>
                                          <div className="mt-2 flex items-center gap-2">
                                            <input type="color" value={overrides.stickBonusBg || FULL_SCREEN_DEFAULTS['virtuis-leaderboard'].stickBonusBg}
                                              onChange={(e) => updateOverrideField(graphicId, 'stickBonusBg', e.target.value)}
                                              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                            <span className="text-[10px] text-zinc-400">Stick Bonus Badge</span>
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {/* EVENT-FRAME specific controls */}
                                    {graphicId === 'event-frame' && (
                                      <>
                                        {/* FRAME */}
                                        <div>
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Frame</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Border"
                                                value={overrides.frameBorderWidth ?? FULL_SCREEN_DEFAULTS['event-frame'].frameBorderWidth}
                                                onChange={(v) => updateOverrideField(graphicId, 'frameBorderWidth', v)}
                                                min={0} max={20} step={1} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Gap"
                                                value={overrides.frameGap ?? FULL_SCREEN_DEFAULTS['event-frame'].frameGap}
                                                onChange={(v) => updateOverrideField(graphicId, 'frameGap', v)}
                                                min={0} max={40} step={2} suffix="px"
                                              />
                                              <div className="flex items-center gap-1.5">
                                                <input type="color" value={overrides.frameBorderColor || FULL_SCREEN_DEFAULTS['event-frame'].frameBorderColor}
                                                  onChange={(e) => updateOverrideField(graphicId, 'frameBorderColor', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                                <span className="text-[10px] text-zinc-400">Color</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* HEADER/LOGO */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Header / Logo Row</div>
                                          <div className="grid grid-cols-3 gap-2">
                                            <OverrideStepper
                                              label="Height"
                                              value={overrides.logoHeaderHeight ?? FULL_SCREEN_DEFAULTS['event-frame'].logoHeaderHeight}
                                              onChange={(v) => updateOverrideField(graphicId, 'logoHeaderHeight', v)}
                                              min={40} max={160} step={4} suffix="px"
                                            />
                                            <OverrideStepper
                                              label="Logo size"
                                              value={overrides.frameLogoSize ?? FULL_SCREEN_DEFAULTS['event-frame'].frameLogoSize}
                                              onChange={(v) => updateOverrideField(graphicId, 'frameLogoSize', v)}
                                              min={24} max={120} step={4} suffix="px"
                                            />
                                            <OverrideStepper
                                              label="Max width"
                                              value={overrides.frameLogoMaxWidth ?? FULL_SCREEN_DEFAULTS['event-frame'].frameLogoMaxWidth}
                                              onChange={(v) => updateOverrideField(graphicId, 'frameLogoMaxWidth', v)}
                                              min={60} max={400} step={10} suffix="px"
                                            />
                                          </div>
                                        </div>

                                        {/* WATERMARK */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Watermark</div>
                                          <div className="space-y-2">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                              <input type="checkbox"
                                                checked={overrides.showWatermark !== false}
                                                onChange={(e) => updateOverrideField(graphicId, 'showWatermark', e.target.checked)}
                                                className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0" />
                                              <span className="text-[11px] text-zinc-300">Show Watermark</span>
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                              <OverrideStepper
                                                label="Font size"
                                                value={overrides.watermarkFontSize ?? FULL_SCREEN_DEFAULTS['event-frame'].watermarkFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'watermarkFontSize', v)}
                                                min={8} max={32} step={1} suffix="px"
                                              />
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Weight</span>
                                                <select
                                                  value={overrides.watermarkFontWeight ?? FULL_SCREEN_DEFAULTS['event-frame'].watermarkFontWeight}
                                                  onChange={(e) => updateOverrideField(graphicId, 'watermarkFontWeight', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                                </select>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <OverrideStepper
                                                label="Bottom"
                                                value={overrides.watermarkBottom ?? FULL_SCREEN_DEFAULTS['event-frame'].watermarkBottom}
                                                onChange={(v) => updateOverrideField(graphicId, 'watermarkBottom', v)}
                                                min={0} max={100} step={4} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Right"
                                                value={overrides.watermarkRight ?? FULL_SCREEN_DEFAULTS['event-frame'].watermarkRight}
                                                onChange={(v) => updateOverrideField(graphicId, 'watermarkRight', v)}
                                                min={0} max={100} step={4} suffix="px"
                                              />
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <div className="flex items-center gap-1.5">
                                                <input type="color" value={overrides.watermarkColor || FULL_SCREEN_DEFAULTS['event-frame'].watermarkColor}
                                                  onChange={(e) => updateOverrideField(graphicId, 'watermarkColor', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                                <span className="text-[10px] text-zinc-400">Text</span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <input type="color" value={overrides.watermarkAccentColor || FULL_SCREEN_DEFAULTS['event-frame'].watermarkAccentColor}
                                                  onChange={(e) => updateOverrideField(graphicId, 'watermarkAccentColor', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                                <span className="text-[10px] text-zinc-400">Accent</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {/* SPONSORS-THANKS specific controls */}
                                    {graphicId === 'sponsors-thanks' && (
                                      <>
                                        {/* CONTAINER */}
                                        <div>
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Container</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Top margin"
                                                value={overrides.containerMarginTop ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].containerMarginTop}
                                                onChange={(v) => updateOverrideField(graphicId, 'containerMarginTop', v)}
                                                min={0} max={200} step={10} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Side margin"
                                                value={overrides.containerMarginSide ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].containerMarginSide}
                                                onChange={(v) => updateOverrideField(graphicId, 'containerMarginSide', v)}
                                                min={0} max={200} step={10} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Bottom"
                                                value={overrides.containerMarginBottom ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].containerMarginBottom}
                                                onChange={(v) => updateOverrideField(graphicId, 'containerMarginBottom', v)}
                                                min={0} max={200} step={10} suffix="px"
                                              />
                                            </div>
                                            <OverrideStepper
                                              label="Border radius"
                                              value={overrides.containerBorderRadius ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].containerBorderRadius}
                                              onChange={(v) => updateOverrideField(graphicId, 'containerBorderRadius', v)}
                                              min={0} max={48} step={4} suffix="px"
                                            />
                                          </div>
                                        </div>

                                        {/* HEADER */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Header</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                              <OverrideStepper
                                                label="Pad V"
                                                value={overrides.headerPaddingV ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].headerPaddingV}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerPaddingV', v)}
                                                min={8} max={60} step={4} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Pad H"
                                                value={overrides.headerPaddingH ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].headerPaddingH}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerPaddingH', v)}
                                                min={8} max={100} step={4} suffix="px"
                                              />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Title size"
                                                value={overrides.headerTitleFontSize ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].headerTitleFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerTitleFontSize', v)}
                                                min={16} max={60} step={2} suffix="px"
                                              />
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Font</span>
                                                <select
                                                  value={overrides.headerTitleFontFamily ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].headerTitleFontFamily}
                                                  onChange={(e) => updateOverrideField(graphicId, 'headerTitleFontFamily', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                </select>
                                              </div>
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Weight</span>
                                                <select
                                                  value={overrides.headerTitleFontWeight ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].headerTitleFontWeight}
                                                  onChange={(e) => updateOverrideField(graphicId, 'headerTitleFontWeight', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                                </select>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <OverrideStepper
                                                label="Logo W"
                                                value={overrides.headerLogoWidth ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].headerLogoWidth}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerLogoWidth', v)}
                                                min={32} max={200} step={8} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Logo H"
                                                value={overrides.headerLogoHeight ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].headerLogoHeight}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerLogoHeight', v)}
                                                min={32} max={200} step={8} suffix="px"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* GRID */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sponsor Grid</div>
                                          <div className="grid grid-cols-3 gap-2">
                                            <OverrideStepper
                                              label="Gap"
                                              value={overrides.gridGap ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].gridGap}
                                              onChange={(v) => updateOverrideField(graphicId, 'gridGap', v)}
                                              min={8} max={60} step={4} suffix="px"
                                            />
                                            <OverrideStepper
                                              label="Padding"
                                              value={overrides.gridPadding ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].gridPadding}
                                              onChange={(v) => updateOverrideField(graphicId, 'gridPadding', v)}
                                              min={8} max={80} step={4} suffix="px"
                                            />
                                            <OverrideStepper
                                              label="Item pad"
                                              value={overrides.sponsorItemPadding ?? FULL_SCREEN_DEFAULTS['sponsors-thanks'].sponsorItemPadding}
                                              onChange={(v) => updateOverrideField(graphicId, 'sponsorItemPadding', v)}
                                              min={4} max={40} step={2} suffix="px"
                                            />
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {/* TEAM-ROSTER specific controls */}
                                    {graphicId === 'team-roster' && (
                                      <>
                                        {/* CONTAINER */}
                                        <div>
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Container</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Top margin"
                                                value={overrides.containerMarginTop ?? FULL_SCREEN_DEFAULTS['team-roster'].containerMarginTop}
                                                onChange={(v) => updateOverrideField(graphicId, 'containerMarginTop', v)}
                                                min={0} max={200} step={10} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Side margin"
                                                value={overrides.containerMarginSide ?? FULL_SCREEN_DEFAULTS['team-roster'].containerMarginSide}
                                                onChange={(v) => updateOverrideField(graphicId, 'containerMarginSide', v)}
                                                min={0} max={200} step={10} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Bottom"
                                                value={overrides.containerMarginBottom ?? FULL_SCREEN_DEFAULTS['team-roster'].containerMarginBottom}
                                                onChange={(v) => updateOverrideField(graphicId, 'containerMarginBottom', v)}
                                                min={0} max={200} step={10} suffix="px"
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <OverrideStepper
                                                label="Radius"
                                                value={overrides.containerBorderRadius ?? FULL_SCREEN_DEFAULTS['team-roster'].containerBorderRadius}
                                                onChange={(v) => updateOverrideField(graphicId, 'containerBorderRadius', v)}
                                                min={0} max={48} step={4} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Padding"
                                                value={overrides.rosterContainerPadding ?? FULL_SCREEN_DEFAULTS['team-roster'].rosterContainerPadding}
                                                onChange={(v) => updateOverrideField(graphicId, 'rosterContainerPadding', v)}
                                                min={16} max={100} step={8} suffix="px"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* HEADER */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Header</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                              <OverrideStepper
                                                label="Pad V"
                                                value={overrides.headerPaddingV ?? FULL_SCREEN_DEFAULTS['team-roster'].headerPaddingV}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerPaddingV', v)}
                                                min={8} max={60} step={4} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Pad H"
                                                value={overrides.headerPaddingH ?? FULL_SCREEN_DEFAULTS['team-roster'].headerPaddingH}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerPaddingH', v)}
                                                min={8} max={100} step={4} suffix="px"
                                              />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Title size"
                                                value={overrides.headerTitleFontSize ?? FULL_SCREEN_DEFAULTS['team-roster'].headerTitleFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'headerTitleFontSize', v)}
                                                min={16} max={60} step={2} suffix="px"
                                              />
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Font</span>
                                                <select
                                                  value={overrides.headerTitleFontFamily ?? FULL_SCREEN_DEFAULTS['team-roster'].headerTitleFontFamily}
                                                  onChange={(e) => updateOverrideField(graphicId, 'headerTitleFontFamily', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                </select>
                                              </div>
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Weight</span>
                                                <select
                                                  value={overrides.headerTitleFontWeight ?? FULL_SCREEN_DEFAULTS['team-roster'].headerTitleFontWeight}
                                                  onChange={(e) => updateOverrideField(graphicId, 'headerTitleFontWeight', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                                </select>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* HEADSHOT GRID */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Roster Grid</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Gap"
                                                value={overrides.rosterGridGap ?? FULL_SCREEN_DEFAULTS['team-roster'].rosterGridGap}
                                                onChange={(v) => updateOverrideField(graphicId, 'rosterGridGap', v)}
                                                min={4} max={40} step={2} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Card W"
                                                value={overrides.rosterCardWidth ?? FULL_SCREEN_DEFAULTS['team-roster'].rosterCardWidth}
                                                onChange={(v) => updateOverrideField(graphicId, 'rosterCardWidth', v)}
                                                min={60} max={200} step={10} suffix="px"
                                              />
                                              <OverrideStepper
                                                label="Headshot"
                                                value={overrides.rosterHeadshotSize ?? FULL_SCREEN_DEFAULTS['team-roster'].rosterHeadshotSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'rosterHeadshotSize', v)}
                                                min={40} max={200} step={10} suffix="px"
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <OverrideStepper
                                                label="Border"
                                                value={overrides.rosterHeadshotBorder ?? FULL_SCREEN_DEFAULTS['team-roster'].rosterHeadshotBorder}
                                                onChange={(v) => updateOverrideField(graphicId, 'rosterHeadshotBorder', v)}
                                                min={0} max={8} step={1} suffix="px"
                                              />
                                              <div className="flex items-center gap-1.5">
                                                <input type="color" value={overrides.rosterHeadshotBorderColor || FULL_SCREEN_DEFAULTS['team-roster'].rosterHeadshotBorderColor}
                                                  onChange={(e) => updateOverrideField(graphicId, 'rosterHeadshotBorderColor', e.target.value)}
                                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                                <span className="text-[10px] text-zinc-400">Border</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <input type="color" value={overrides.rosterHeadshotBg || FULL_SCREEN_DEFAULTS['team-roster'].rosterHeadshotBg}
                                                onChange={(e) => updateOverrideField(graphicId, 'rosterHeadshotBg', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                                              <span className="text-[10px] text-zinc-400">Headshot placeholder bg</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* NAME */}
                                        <div className="pt-2 border-t border-zinc-700/30">
                                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Athlete Name</div>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2">
                                              <OverrideStepper
                                                label="Size"
                                                value={overrides.rosterNameFontSize ?? FULL_SCREEN_DEFAULTS['team-roster'].rosterNameFontSize}
                                                onChange={(v) => updateOverrideField(graphicId, 'rosterNameFontSize', v)}
                                                min={8} max={24} step={1} suffix="px"
                                              />
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Font</span>
                                                <select
                                                  value={overrides.rosterNameFontFamily ?? FULL_SCREEN_DEFAULTS['team-roster'].rosterNameFontFamily}
                                                  onChange={(e) => updateOverrideField(graphicId, 'rosterNameFontFamily', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                </select>
                                              </div>
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Transform</span>
                                                <select
                                                  value={overrides.rosterNameTextTransform ?? FULL_SCREEN_DEFAULTS['team-roster'].rosterNameTextTransform}
                                                  onChange={(e) => updateOverrideField(graphicId, 'rosterNameTextTransform', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500"
                                                >
                                                  {TEXT_TRANSFORMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                </select>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {/* COLORS (shared across all full-screen graphics) */}
                                    <div className="pt-2 border-t border-zinc-700/30">
                                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Colors</div>
                                      <div className="grid grid-cols-2 gap-2">
                                        {OVERRIDE_COLOR_FIELDS.map(({ key, label }) => {
                                          const hasOverride = overrides[key] !== undefined;
                                          const overrideValue = overrides[key] || editingTheme.colors[key] || '#888888';
                                          return (
                                            <div key={key} className="flex items-center gap-2">
                                              <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" checked={hasOverride}
                                                  onChange={(e) => { e.target.checked ? updateOverrideField(graphicId, key, editingTheme.colors[key] || '#888888') : clearOverrideField(graphicId, key); }}
                                                  className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0" />
                                              </label>
                                              <input type="color" value={overrideValue} disabled={!hasOverride}
                                                onChange={(e) => updateOverrideField(graphicId, key, e.target.value)}
                                                className={`w-6 h-6 rounded cursor-pointer bg-transparent border-0 ${!hasOverride ? 'opacity-40 cursor-not-allowed' : ''}`} />
                                              <span className={`text-[11px] ${hasOverride ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* IMAGES / TEXTURES (shared across all full-screen graphics) */}
                                    <div className="pt-2 border-t border-zinc-700/30">
                                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Images / Textures</div>
                                      <div className="space-y-2">
                                        {/* Header Background Image */}
                                        <div className="flex items-center gap-2 mb-1">
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={overrides.headerBgImage !== undefined}
                                              onChange={(e) => {
                                                if (e.target.checked) { updateOverrideField(graphicId, 'headerBgImage', ''); }
                                                else { clearOverrideField(graphicId, 'headerBgImage'); clearOverrideField(graphicId, 'headerBgImageFit'); clearOverrideField(graphicId, 'headerBgImagePosition'); clearOverrideField(graphicId, 'headerBgImageOpacity'); }
                                              }}
                                              className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0" />
                                            <span className={`text-[11px] ${overrides.headerBgImage !== undefined ? 'text-zinc-300' : 'text-zinc-500'}`}>Header Background Image</span>
                                          </label>
                                        </div>
                                        {overrides.headerBgImage !== undefined && (
                                          <div className="space-y-2 ml-5">
                                            <input type="text" value={overrides.headerBgImage || ''} onChange={(e) => updateOverrideField(graphicId, 'headerBgImage', e.target.value)} placeholder="https://..."
                                              className="w-full px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500" />
                                            <div className="grid grid-cols-3 gap-2">
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Fit</span>
                                                <select value={overrides.headerBgImageFit || 'cover'} onChange={(e) => updateOverrideField(graphicId, 'headerBgImageFit', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500">
                                                  {IMAGE_FIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                              </div>
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Position</span>
                                                <select value={overrides.headerBgImagePosition || 'center'} onChange={(e) => updateOverrideField(graphicId, 'headerBgImagePosition', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500">
                                                  {IMAGE_POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                              </div>
                                              <OverrideStepper label="Opacity" value={Math.round((overrides.headerBgImageOpacity ?? 1) * 100)} onChange={(v) => updateOverrideField(graphicId, 'headerBgImageOpacity', v / 100)} min={0} max={100} step={5} suffix="%" />
                                            </div>
                                          </div>
                                        )}

                                        {/* Body Texture */}
                                        <div className="flex items-center gap-2 mb-1">
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={overrides.bodyTexture !== undefined}
                                              onChange={(e) => {
                                                if (e.target.checked) { updateOverrideField(graphicId, 'bodyTexture', ''); }
                                                else { clearOverrideField(graphicId, 'bodyTexture'); clearOverrideField(graphicId, 'bodyTextureOpacity'); clearOverrideField(graphicId, 'bodyTextureBlend'); }
                                              }}
                                              className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0" />
                                            <span className={`text-[11px] ${overrides.bodyTexture !== undefined ? 'text-zinc-300' : 'text-zinc-500'}`}>Body Texture Overlay</span>
                                          </label>
                                        </div>
                                        {overrides.bodyTexture !== undefined && (
                                          <div className="space-y-2 ml-5">
                                            <input type="text" value={overrides.bodyTexture || ''} onChange={(e) => updateOverrideField(graphicId, 'bodyTexture', e.target.value)} placeholder="https://..."
                                              className="w-full px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500" />
                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-zinc-500">Blend Mode</span>
                                                <select value={overrides.bodyTextureBlend || 'overlay'} onChange={(e) => updateOverrideField(graphicId, 'bodyTextureBlend', e.target.value)}
                                                  className="h-5 px-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-500">
                                                  {BLEND_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                              </div>
                                              <OverrideStepper label="Opacity" value={Math.round((overrides.bodyTextureOpacity ?? 0.08) * 100)} onChange={(v) => updateOverrideField(graphicId, 'bodyTextureOpacity', v / 100)} min={0} max={100} step={2} suffix="%" />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Reset button */}
                                    {overrideCount > 0 && (
                                      <div className="pt-2 flex justify-end">
                                        <button onClick={() => resetGraphicOverrides(graphicId)} className="text-[10px] text-zinc-400 hover:text-zinc-300 transition-colors">
                                          Reset to theme defaults
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* ========== GENERIC CONTROLS (all other graphics) ========== */
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
                                                  updateOverrideField(graphicId, key, editingTheme.colors[key] || '#888888');
                                                } else {
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
                                          step={1}
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
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Overrides Button — visible without scrolling to top */}
              {selectedThemeId && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={saveTheme}
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 rounded-lg font-semibold text-sm transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Overrides'}
                  </button>
                  {saveMessage && (
                    <span className={`text-xs ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {saveMessage.text}
                    </span>
                  )}
                </div>
              )}
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

                {/* Variant Selectors for Full-Screen Graphics */}
                {selectedGraphicType === 'event-summary' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-1">Layout</label>
                      <select
                        value={selectedVariants['event-summary']?.layout || 'broadcast-table'}
                        onChange={(e) => updateVariant('event-summary', 'layout', e.target.value)}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        {EVENT_SUMMARY_LAYOUTS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-1">Teams</label>
                      <select
                        value={selectedVariants['event-summary']?.numTeams || '2'}
                        onChange={(e) => updateVariant('event-summary', 'numTeams', e.target.value)}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        {SUMMARY_TEAM_COUNTS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-1">Mode</label>
                      <select
                        value={selectedVariants['event-summary']?.mode || 'rotation'}
                        onChange={(e) => updateVariant('event-summary', 'mode', e.target.value)}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        {SUMMARY_MODES.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {selectedGraphicType === 'virtuis-leaderboard' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-1">Event</label>
                      <select
                        value={selectedVariants['virtuis-leaderboard']?.event || 'FX'}
                        onChange={(e) => updateVariant('virtuis-leaderboard', 'event', e.target.value)}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        {(selectedVariants['virtuis-leaderboard']?.gender === 'womens'
                          ? LEADERBOARD_EVENTS_WOMENS
                          : LEADERBOARD_EVENTS_MENS
                        ).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-1">Gender</label>
                      <select
                        value={selectedVariants['virtuis-leaderboard']?.gender || 'mens'}
                        onChange={(e) => updateVariant('virtuis-leaderboard', 'gender', e.target.value)}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        {LEADERBOARD_GENDERS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {selectedGraphicType === 'event-frame' && (
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Frame Type</label>
                    <select
                      value={selectedVariants['event-frame']?.type || 'frame-quad'}
                      onChange={(e) => updateVariant('event-frame', 'type', e.target.value)}
                      className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                      {EVENT_FRAME_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
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
                      ref={previewIframeRef}
                      key={`${selectedThemeId}-${selectedGraphicType}-${selectedCompetition}-${previewVersion}`}
                      src={getPreviewUrl()}
                      className="w-[1920px] h-[1080px] origin-top-left"
                      style={{ border: 'none', transform: 'scale(0.22)' }}
                      title="Theme Preview"
                      onLoad={requestMeasurements}
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
