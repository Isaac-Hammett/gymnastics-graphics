import { useState, useEffect, useMemo, useRef } from 'react';
import {
  StarIcon,
  LinkIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { db, ref, onValue } from '../../lib/firebase';

/**
 * WhoToWatchEditor — Configuration panel for who-to-watch type segments
 *
 * Features:
 * - Searchable team dropdown (populated from competition teams)
 * - Searchable athlete dropdown (populated from selected team's roster)
 * - Auto-fills headshot and logo URLs from teams database
 * - Image picker: choose headshot, gallery images, or paste custom URL
 * - Up to 3 full-screen title cards before the video clip
 * - Broadcast-style mini previews for each title card
 * - Live graphic preview
 *
 * Data shape:
 * {
 *   teamSlot: number,           // Which competition team (1-7)
 *   athleteName: string,
 *   teamName: string,
 *   logoUrl: string,
 *   subtitle: string,
 *   statLabel: string,
 *   statValue: string,
 *   clipUrl: string,
 *   headshot: string,
 *   imageUrl: string,           // Selected image for title cards (portrait/action/etc)
 *   imageMode: string,          // 'headshot' | 'portrait' | 'full'
 *   titleCards: [               // Up to 3 full-screen cards
 *     {
 *       headline: string,
 *       body: string,
 *       headlineFontSize: number,  // 16–40, default 28
 *       nameFontSize: number,      // 40–100, default 64
 *       bodyFontSize: number,      // 18–44, default 30
 *       textOffsetY: number,       // -200 to +200, default 0
 *       imageScale: number,        // 50–150, default 100
 *       imageOffsetX: number,      // -200 to +200, default 0
 *       imageOffsetY: number,      // -200 to +200, default 0
 *       badgeText: string,         // Badge text, default "WHO TO WATCH", empty hides
 *       badgeFontSize: number,     // 8–20, default 13
 *       teamNameFontSize: number,  // 12–36, default 20
 *       showTeamRow: boolean,      // default true
 *       watermarkOpacity: number,  // 0–20, default 8
 *       watermarkScale: number,    // 50–150, default 100
 *       showWatermark: boolean,    // default true
 *       bgColor: string,           // hex color override for background
 *       accentColor: string,       // hex color override for accent
 *     }
 *   ],
 * }
 */

const DEFAULT_WHO_TO_WATCH = {
  teamSlot: null,
  athleteName: '',
  teamName: '',
  logoUrl: '',
  subtitle: '',
  statLabel: 'Season High',
  statValue: '',
  clipUrl: '',
  headshot: '',
  imageUrl: '',
  imageMode: 'portrait',
  titleCards: [],
};

// Determine the best image mode based on image source type
function getDefaultImageMode(imageType) {
  if (!imageType) return 'portrait';
  if (imageType === 'headshot') return 'headshot';
  if (imageType === 'portrait' || imageType === 'full-body') return 'portrait';
  if (imageType === 'action' || imageType === 'custom') return 'full';
  return 'portrait';
}

const MAX_TITLE_CARDS = 3;

// Stepper input with +/- buttons, no upper limit, supports backspace/typing freely
function ValueStepper({ label, value, defaultValue, min, step = 1, unit = 'px', onChange, onReset }) {
  const display = value !== undefined && value !== null ? value : defaultValue;
  const [localText, setLocalText] = useState(null); // null = use prop value
  const shown = localText !== null ? localText : String(display);
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-zinc-500 w-20 shrink-0">{label}</label>
      <button type="button" onClick={() => onChange(min !== undefined ? Math.max(min, (display) - step) : (display) - step)} className="w-5 h-5 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 text-xs font-bold">-</button>
      <input
        type="text"
        inputMode="numeric"
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          setLocalText(raw);
          const v = parseInt(raw);
          if (!isNaN(v)) onChange(min !== undefined ? Math.max(min, v) : v);
        }}
        onBlur={() => { setLocalText(null); if (shown === '' || isNaN(parseInt(shown))) onChange(defaultValue); }}
        className="w-12 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 text-center focus:outline-none focus:border-rose-500"
      />
      <button type="button" onClick={() => onChange((display) + step)} className="w-5 h-5 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 text-xs font-bold">+</button>
      <span className="text-[10px] text-zinc-400 w-6">{unit}</span>
      <button type="button" onClick={() => { setLocalText(null); onReset(); }} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
    </div>
  );
}

// Validate: at minimum need athlete name
export function isWhoToWatchValid(whoToWatch) {
  return !!(whoToWatch && whoToWatch.athleteName && whoToWatch.athleteName.trim());
}

// Searchable dropdown component
function SearchableSelect({ options, value, onChange, placeholder, disabled, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-sm text-left focus:outline-none focus:border-rose-500 disabled:opacity-50 flex items-center justify-between"
      >
        <span className={selectedOption ? 'text-white' : 'text-zinc-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-500" />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl max-h-60 overflow-hidden">
          <div className="p-2 border-b border-zinc-700">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-rose-500"
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">No matches</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 flex items-center gap-2 ${
                    option.value === value ? 'bg-rose-500/20 text-rose-300' : 'text-zinc-300'
                  }`}
                >
                  {option.icon && (
                    <img src={option.icon} alt="" className="w-5 h-5 object-contain rounded-full shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                  )}
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Image picker — shows headshot + gallery images + custom URL option
function AthleteImagePicker({ headshot, galleryImages, selectedUrl, imageMode, onSelect, onAddImage, disabled }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customType, setCustomType] = useState('portrait');

  // Build list of available images
  const allImages = useMemo(() => {
    const images = [];
    if (headshot) {
      images.push({ url: headshot, type: 'headshot', label: 'Headshot' });
    }
    if (galleryImages && galleryImages.length > 0) {
      galleryImages.forEach(img => {
        images.push({ url: img.url, type: img.type || 'portrait', label: img.label || img.type || 'Photo' });
      });
    }
    return images;
  }, [headshot, galleryImages]);

  const handleAddCustom = () => {
    if (!customUrl.trim()) return;
    if (onAddImage) {
      onAddImage(customUrl.trim(), customType);
    }
    onSelect(customUrl.trim(), getDefaultImageMode(customType));
    setCustomUrl('');
    setShowCustom(false);
  };

  if (allImages.length === 0 && !showCustom) {
    return (
      <div className="space-y-2">
        <label className="block text-xs text-zinc-500 mb-1">Title Card Image</label>
        <p className="text-[10px] text-zinc-600 mb-2">No images found for this athlete. Add one below.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={selectedUrl || ''}
            onChange={(e) => onSelect(e.target.value, 'portrait')}
            placeholder="Paste image URL (portrait/action shot)..."
            disabled={disabled}
            className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:border-rose-500 disabled:opacity-50"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={imageMode || 'portrait'}
            onChange={(e) => onSelect(selectedUrl, e.target.value)}
            disabled={disabled}
            className="px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:border-rose-500 disabled:opacity-50"
          >
            <option value="portrait">Portrait (cutout)</option>
            <option value="headshot">Headshot (circle)</option>
            <option value="full">Full (rectangular)</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs text-zinc-500 mb-1">Title Card Image</label>

      {/* Thumbnail grid of available images */}
      <div className="flex flex-wrap gap-2">
        {/* No image option */}
        <button
          type="button"
          onClick={() => onSelect('', 'portrait')}
          disabled={disabled}
          className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-[9px] text-zinc-500 font-medium transition-colors ${
            !selectedUrl ? 'border-rose-500 bg-rose-500/10' : 'border-zinc-600 bg-zinc-900 hover:border-zinc-500'
          }`}
        >
          None
        </button>

        {allImages.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(img.url, getDefaultImageMode(img.type))}
            disabled={disabled}
            className={`w-16 h-16 rounded-lg border-2 overflow-hidden relative group transition-colors ${
              selectedUrl === img.url ? 'border-rose-500' : 'border-zinc-600 hover:border-zinc-500'
            }`}
          >
            <img src={img.url} alt={img.label} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            <div className="absolute inset-x-0 bottom-0 bg-black/70 text-[8px] text-zinc-300 px-1 py-0.5 truncate">
              {img.label}
            </div>
          </button>
        ))}

        {/* Add custom image button */}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          disabled={disabled}
          className="w-16 h-16 rounded-lg border-2 border-dashed border-zinc-600 flex items-center justify-center text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Custom URL entry */}
      {showCustom && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-[10px] text-zinc-600 mb-0.5">Image URL</label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="Paste image URL..."
              className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:border-rose-500"
            />
          </div>
          <select
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            className="px-2 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-white text-xs"
          >
            <option value="portrait">Portrait</option>
            <option value="action">Action</option>
            <option value="full-body">Full Body</option>
          </select>
          <button
            type="button"
            onClick={handleAddCustom}
            className="px-3 py-1.5 bg-rose-500/20 text-rose-300 rounded text-xs font-medium hover:bg-rose-500/30 transition-colors"
          >
            Add & Use
          </button>
        </div>
      )}

      {/* Image mode selector (when an image is selected) */}
      {selectedUrl && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-zinc-600">Display as:</label>
          <select
            value={imageMode || 'portrait'}
            onChange={(e) => onSelect(selectedUrl, e.target.value)}
            disabled={disabled}
            className="px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:border-rose-500"
          >
            <option value="portrait">Portrait (cutout)</option>
            <option value="headshot">Headshot (circle)</option>
            <option value="full">Full (rectangular)</option>
          </select>
        </div>
      )}
    </div>
  );
}

// Live iframe preview for lower-third — renders the real who-to-watch.html overlay at 1920×1080 and scales it down
function LowerThirdIframePreview({ athleteName, logoUrl, subtitle, teamName, statLabel, statValue, headshot, meetTheme, themeOverride, adjustments = {} }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.25);
  const [debouncedOverlayUrl, setDebouncedOverlayUrl] = useState('');

  // Build the overlay URL with query params
  const overlayUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (athleteName) params.set('athleteName', athleteName);
    if (logoUrl) params.set('logo', logoUrl);
    if (subtitle) params.set('subtitle', subtitle);
    else if (teamName) params.set('subtitle', teamName);
    if (statLabel) params.set('statLabel', statLabel);
    if (statValue) params.set('statValue', statValue);
    if (headshot) params.set('headshot', headshot);
    // Theme
    const effectiveTheme = themeOverride || meetTheme;
    if (effectiveTheme) params.set('meetTheme', effectiveTheme);
    // Adjustment params (for future Task 7)
    if (adjustments.badgeText !== undefined) params.set('badgeText', adjustments.badgeText);
    if (adjustments.badgeFontSize) params.set('badgeFontSize', adjustments.badgeFontSize);
    if (adjustments.nameFontSize) params.set('nameFontSize', adjustments.nameFontSize);
    if (adjustments.subtitleFontSize) params.set('subtitleFontSize', adjustments.subtitleFontSize);
    if (adjustments.statFontSize) params.set('statFontSize', adjustments.statFontSize);
    if (adjustments.headshotSize) params.set('headshotSize', adjustments.headshotSize);
    if (adjustments.showHeadshot === false) params.set('showHeadshot', 'false');
    if (adjustments.logoSize) params.set('logoSize', adjustments.logoSize);
    if (adjustments.cardBottom) params.set('cardBottom', adjustments.cardBottom);
    if (adjustments.cardLeft) params.set('cardLeft', adjustments.cardLeft);
    if (adjustments.cardMinWidth) params.set('cardMinWidth', adjustments.cardMinWidth);
    if (adjustments.cardMaxWidth) params.set('cardMaxWidth', adjustments.cardMaxWidth);
    if (adjustments.bgColor) params.set('bgColor', adjustments.bgColor);
    if (adjustments.accentColor) params.set('accentColor', adjustments.accentColor);
    return `/overlays/who-to-watch.html?${params.toString()}`;
  }, [athleteName, logoUrl, subtitle, teamName, statLabel, statValue, headshot, meetTheme, themeOverride, adjustments]);

  // Debounce the overlay URL to avoid reloading the iframe on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOverlayUrl(overlayUrl);
    }, 300);
    return () => clearTimeout(timer);
  }, [overlayUrl]);

  // Measure container width and compute scale
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / 1920);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div>
      <div ref={containerRef} className="relative rounded overflow-hidden border border-zinc-600" style={{ aspectRatio: '16/9' }}>
        {/* Dark background to simulate video behind the transparent overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900" />
        <div style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          position: 'relative',
        }}>
          <iframe
            key={debouncedOverlayUrl}
            src={debouncedOverlayUrl}
            title="Lower-third preview"
            style={{ width: '1920px', height: '1080px', border: 'none' }}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
      <a href={debouncedOverlayUrl} target="_blank" rel="noopener noreferrer"
         className="block text-center text-[10px] text-zinc-500 hover:text-rose-400 mt-1">
        Open full-size preview ↗
      </a>
    </div>
  );
}

// Live iframe preview for title cards — renders the real overlay HTML at 1920×1080 and scales it down
function TitleCardIframePreview({ card, athleteName, teamName, logoUrl, imageUrl, imageMode, meetTheme, themeOverride }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.25);
  const [debouncedOverlayUrl, setDebouncedOverlayUrl] = useState('');

  // Build the overlay URL with query params
  const overlayUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (athleteName) params.set('athleteName', athleteName);
    if (teamName) params.set('teamName', teamName);
    if (logoUrl) params.set('logo', logoUrl);
    if (card.headline) params.set('headline', card.headline);
    if (card.body) params.set('body', card.body);
    if (imageUrl) {
      params.set('imageUrl', imageUrl);
      if (imageMode) params.set('imageMode', imageMode);
    }
    // Card adjustment params
    if (card.nameFontSize) params.set('nameFontSize', card.nameFontSize);
    if (card.bodyFontSize) params.set('bodyFontSize', card.bodyFontSize);
    if (card.headlineFontSize) params.set('headlineFontSize', card.headlineFontSize);
    if (card.textOffsetY) params.set('textOffsetY', card.textOffsetY);
    if (card.imageScale && card.imageScale !== 100) params.set('imageScale', card.imageScale);
    if (card.imageOffsetX) params.set('imageOffsetX', card.imageOffsetX);
    if (card.imageOffsetY) params.set('imageOffsetY', card.imageOffsetY);
    // Badge controls
    if (card.badgeText !== undefined) params.set('badge', card.badgeText);
    if (card.badgeFontSize) params.set('badgeFontSize', card.badgeFontSize);
    // Team name row controls
    if (card.teamNameFontSize) params.set('teamNameFontSize', card.teamNameFontSize);
    if (card.logoSize && card.logoSize !== 48) params.set('logoSize', card.logoSize);
    if (card.showTeamRow === false) params.set('showTeamRow', 'false');
    // Watermark controls
    if (card.watermarkOpacity !== undefined && card.watermarkOpacity !== 8) params.set('watermarkOpacity', card.watermarkOpacity);
    if (card.watermarkScale && card.watermarkScale !== 100) params.set('watermarkScale', card.watermarkScale);
    if (card.watermarkOffsetX) params.set('watermarkOffsetX', card.watermarkOffsetX);
    if (card.watermarkOffsetY) params.set('watermarkOffsetY', card.watermarkOffsetY);
    if (card.showWatermark === false) params.set('showWatermark', 'false');
    // Theme controls
    const effectiveTheme = themeOverride || meetTheme;
    if (effectiveTheme) params.set('meetTheme', effectiveTheme);
    if (card.bgColor) params.set('bgColor', card.bgColor);
    if (card.accentColor) params.set('accentColor', card.accentColor);
    return `/overlays/who-to-watch-title.html?${params.toString()}`;
  }, [card, athleteName, teamName, logoUrl, imageUrl, imageMode, meetTheme, themeOverride]);

  // Debounce the overlay URL to avoid reloading the iframe on every slider tick
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOverlayUrl(overlayUrl);
    }, 300);
    return () => clearTimeout(timer);
  }, [overlayUrl]);

  // Measure container width and compute scale
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / 1920);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div>
      <div ref={containerRef} className="relative rounded overflow-hidden border border-zinc-700" style={{ aspectRatio: '16/9' }}>
        <div style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}>
          <iframe
            key={debouncedOverlayUrl}
            src={debouncedOverlayUrl}
            title="Title card preview"
            style={{ width: '1920px', height: '1080px', border: 'none' }}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
      <a href={debouncedOverlayUrl} target="_blank" rel="noopener noreferrer"
         className="block text-center text-[10px] text-zinc-500 hover:text-rose-400 mt-1">
        Open full-size preview ↗
      </a>
    </div>
  );
}

export default function WhoToWatchEditor({
  whoToWatch,
  onChange,
  disabled = false,
  competitionTeams = {},
  competitionGender = 'womens',
  teamsDbFunctions = {},
  meetTheme = '',
}) {
  const { getTeamRosterWithHeadshots, getHeadshot, resolveSchoolKey, getAthleteMedia, saveAthleteMedia } = teamsDbFunctions;

  // Fetch available themes for the theme picker (Issue 29)
  const [availableThemes, setAvailableThemes] = useState({});
  const [themeOverride, setThemeOverride] = useState('');
  useEffect(() => {
    const themesRef = ref(db, 'themes');
    const unsubscribe = onValue(themesRef, (snapshot) => {
      setAvailableThemes(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  const [config, setConfig] = useState(() => ({
    ...DEFAULT_WHO_TO_WATCH,
    ...whoToWatch,
  }));

  // Sync internal state when prop changes (e.g., switching segments)
  // Guard with JSON comparison to avoid double-render when same values come back
  useEffect(() => {
    const merged = { ...DEFAULT_WHO_TO_WATCH, ...whoToWatch };
    // Only update if the prop values actually differ from current config
    if (JSON.stringify(merged) !== JSON.stringify(config)) {
      setConfig(merged);
    }
  }, [whoToWatch]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: config intentionally omitted from deps — we only want to sync when the parent
  // provides genuinely new data (e.g., selecting a different segment), not on every
  // internal update cycle

  // Notify parent of changes
  const updateField = (field, value) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onChange?.(newConfig);
  };

  const updateConfig = (updates) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange?.(newConfig);
  };

  // Build team options from competition teams
  const teamOptions = useMemo(() => {
    return Object.entries(competitionTeams).map(([slot, team]) => ({
      value: parseInt(slot),
      label: team.name,
      icon: team.logo || null,
    }));
  }, [competitionTeams]);

  // Build athlete options from selected team's roster
  const athleteOptions = useMemo(() => {
    if (!config.teamSlot || !competitionTeams[config.teamSlot]) return [];
    const team = competitionTeams[config.teamSlot];
    const teamName = team.name;

    // Try to get roster from teamsDatabase
    if (resolveSchoolKey && getTeamRosterWithHeadshots) {
      const schoolKey = resolveSchoolKey(teamName);
      if (schoolKey) {
        const teamKey = `${schoolKey}-${competitionGender}`;
        const roster = getTeamRosterWithHeadshots(teamKey);
        if (roster && roster.length > 0) {
          return roster.map(a => ({
            value: a.name,
            label: a.name,
            icon: a.headshotUrl || null,
          }));
        }
      }
    }
    return [];
  }, [config.teamSlot, competitionTeams, competitionGender, resolveSchoolKey, getTeamRosterWithHeadshots]);

  // Get gallery images for selected athlete
  const galleryImages = useMemo(() => {
    if (!config.athleteName || !getAthleteMedia) return [];
    return getAthleteMedia(config.athleteName);
  }, [config.athleteName, getAthleteMedia]);

  // Handle team selection — auto-fill logo
  const handleTeamSelect = (teamSlot) => {
    const team = competitionTeams[teamSlot];
    if (!team) return;
    updateConfig({
      teamSlot,
      teamName: team.name,
      logoUrl: team.logo || '',
      // Clear athlete when team changes
      athleteName: '',
      headshot: '',
      imageUrl: '',
      imageMode: 'headshot',
    });
  };

  // Handle athlete selection — auto-fill headshot
  const handleAthleteSelect = (athleteName) => {
    let headshotUrl = '';
    if (getHeadshot) {
      headshotUrl = getHeadshot(athleteName) || '';
    }
    updateConfig({
      athleteName,
      headshot: headshotUrl,
      imageUrl: '',
      imageMode: 'headshot',
    });
  };

  // Handle image selection from picker
  const handleImageSelect = (url, mode) => {
    updateConfig({ imageUrl: url, imageMode: mode || 'portrait' });
  };

  // Handle adding a new image to the athlete's gallery
  const handleAddImage = (url, type) => {
    if (saveAthleteMedia && config.athleteName) {
      saveAthleteMedia(config.athleteName, url, type);
    }
  };

  // Title card handlers
  const addTitleCard = () => {
    const cards = config.titleCards || [];
    if (cards.length >= MAX_TITLE_CARDS) return;
    updateField('titleCards', [...cards, { headline: '', body: '' }]);
  };

  const removeTitleCard = (index) => {
    const cards = [...(config.titleCards || [])];
    cards.splice(index, 1);
    updateField('titleCards', cards);
  };

  const updateTitleCard = (index, field, value) => {
    const cards = [...(config.titleCards || [])];
    cards[index] = { ...cards[index], [field]: value };
    updateField('titleCards', cards);
  };

  const moveTitleCard = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= (config.titleCards || []).length) return;
    const cards = [...(config.titleCards || [])];
    const [item] = cards.splice(fromIndex, 1);
    cards.splice(toIndex, 0, item);
    updateField('titleCards', cards);
  };

  // Extract video thumbnail from common URL patterns
  const getVideoThumbnail = (url) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    return null;
  };

  const videoThumbnail = getVideoThumbnail(config.clipUrl);
  const isValid = isWhoToWatchValid(config);

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  };

  const titleCards = config.titleCards || [];

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-zinc-700">
      <div className="flex items-center gap-2 mb-2">
        <StarIcon className="w-4 h-4 text-rose-400" />
        <span className="text-sm font-medium text-rose-400 uppercase tracking-wide">
          Who to Watch
        </span>
      </div>

      {/* Team & Athlete Selection */}
      <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50 space-y-3">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide">
          Team & Athlete
        </label>

        {/* Team dropdown first */}
        <SearchableSelect
          label="Team / School *"
          options={teamOptions}
          value={config.teamSlot}
          onChange={handleTeamSelect}
          placeholder="Select a team..."
          disabled={disabled}
        />

        {/* Athlete dropdown — enabled after team is selected */}
        {config.teamSlot && athleteOptions.length > 0 ? (
          <SearchableSelect
            label="Athlete *"
            options={athleteOptions}
            value={config.athleteName}
            onChange={handleAthleteSelect}
            placeholder="Search athlete..."
            disabled={disabled}
          />
        ) : config.teamSlot ? (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Athlete Name *</label>
            <input
              type="text"
              value={config.athleteName}
              onChange={(e) => updateField('athleteName', e.target.value)}
              placeholder="Type athlete name..."
              disabled={disabled}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500 disabled:opacity-50"
            />
            <p className="text-[10px] text-zinc-600 mt-1">No roster found — type name manually</p>
          </div>
        ) : null}

        {/* Subtitle & Stats */}
        {config.athleteName && (
          <>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Subtitle</label>
              <input
                type="text"
                value={config.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="e.g., Sr • Denver, CO • Floor / Beam"
                disabled={disabled}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500 disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Stat Label</label>
                <input
                  type="text"
                  value={config.statLabel}
                  onChange={(e) => updateField('statLabel', e.target.value)}
                  placeholder="e.g., Season High"
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Stat Value</label>
                <input
                  type="text"
                  value={config.statValue}
                  onChange={(e) => updateField('statValue', e.target.value)}
                  placeholder="e.g., 9.925"
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Override URLs (collapsed by default) */}
            <details className="text-xs">
              <summary className="text-zinc-600 cursor-pointer hover:text-zinc-400">Override headshot / logo URLs</summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Headshot URL</label>
                  <input
                    type="text"
                    value={config.headshot}
                    onChange={(e) => updateField('headshot', e.target.value)}
                    placeholder="Auto-filled from database"
                    disabled={disabled}
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:border-rose-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Team Logo URL</label>
                  <input
                    type="text"
                    value={config.logoUrl}
                    onChange={(e) => updateField('logoUrl', e.target.value)}
                    placeholder="Auto-filled from competition"
                    disabled={disabled}
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:border-rose-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </details>
          </>
        )}
      </div>

      {/* Athlete Image Picker — for title cards */}
      {config.athleteName && (
        <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50 space-y-3">
          <div className="flex items-center gap-2">
            <PhotoIcon className="w-3.5 h-3.5 text-zinc-400" />
            <label className="block text-xs text-zinc-400 uppercase tracking-wide">
              Athlete Image
            </label>
            <span className="text-[10px] text-zinc-600">(for title cards)</span>
          </div>
          <AthleteImagePicker
            headshot={config.headshot}
            galleryImages={galleryImages}
            selectedUrl={config.imageUrl}
            imageMode={config.imageMode}
            onSelect={handleImageSelect}
            onAddImage={handleAddImage}
            disabled={disabled}
          />
        </div>
      )}

      {/* Title Cards Section — up to 3 full-screen cards before the video */}
      <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhotoIcon className="w-3.5 h-3.5 text-zinc-400" />
            <label className="block text-xs text-zinc-400 uppercase tracking-wide">
              Title Cards
            </label>
            <span className="text-[10px] text-zinc-600">({titleCards.length}/{MAX_TITLE_CARDS})</span>
          </div>
          {titleCards.length < MAX_TITLE_CARDS && (
            <button
              type="button"
              onClick={addTitleCard}
              disabled={disabled}
              className="flex items-center gap-1 px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-50"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Add Card
            </button>
          )}
        </div>

        {titleCards.length === 0 ? (
          <p className="text-xs text-zinc-600">No title cards — video will play immediately. Add up to {MAX_TITLE_CARDS} full-screen cards to show before the highlight clip.</p>
        ) : (
          <div className="space-y-2">
            {titleCards.map((card, index) => (
              <div key={index} className="border border-zinc-600 rounded-lg p-2.5 bg-zinc-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-medium uppercase">Card {index + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveTitleCard(index, index - 1)} disabled={disabled || index === 0} className="p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30">
                      <ChevronUpIcon className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => moveTitleCard(index, index + 1)} disabled={disabled || index === titleCards.length - 1} className="p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30">
                      <ChevronDownIcon className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => removeTitleCard(index)} disabled={disabled} className="p-0.5 text-zinc-500 hover:text-red-400 disabled:opacity-30">
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={card.headline}
                  onChange={(e) => updateTitleCard(index, 'headline', e.target.value)}
                  placeholder="Headline (e.g., SENIOR)"
                  disabled={disabled}
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-white text-sm font-bold focus:outline-none focus:border-rose-500 disabled:opacity-50"
                />
                <textarea
                  value={card.body}
                  onChange={(e) => updateTitleCard(index, 'body', e.target.value)}
                  placeholder="Body text (e.g., 17 Career 10.000s&#10;Vault - 1 | Bars - 6 | Beam - 0 | Floor - 10)"
                  disabled={disabled}
                  rows={3}
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:border-rose-500 disabled:opacity-50 resize-none"
                />
                {/* Card Adjustments — fine-tuning controls */}
                <details className="text-xs">
                  <summary className="text-zinc-600 cursor-pointer hover:text-zinc-400">Card Adjustments</summary>
                  <div className="mt-2 space-y-2 bg-zinc-800/50 rounded p-2">
                    {/* Theme Controls (Issue 29) */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Theme</div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Theme</label>
                      <select
                        value={themeOverride || meetTheme || ''}
                        onChange={(e) => setThemeOverride(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 focus:outline-none focus:border-rose-500"
                      >
                        <option value="">None (default)</option>
                        {Object.entries(availableThemes).map(([id, theme]) => (
                          <option key={id} value={id}>{theme.name || id}</option>
                        ))}
                      </select>
                      {(themeOverride || meetTheme) && (
                        <button type="button" onClick={() => setThemeOverride('')} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Background</label>
                      <input type="color" value={card.bgColor || '#1a2332'} onChange={(e) => updateTitleCard(index, 'bgColor', e.target.value)} className="w-6 h-5 bg-transparent border-0 cursor-pointer" />
                      <input type="text" value={card.bgColor || ''} onChange={(e) => updateTitleCard(index, 'bgColor', e.target.value)} placeholder="#hex" className="flex-1 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 focus:outline-none focus:border-rose-500" />
                      <button type="button" onClick={() => updateTitleCard(index, 'bgColor', '')} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Accent</label>
                      <input type="color" value={card.accentColor || '#3b82f6'} onChange={(e) => updateTitleCard(index, 'accentColor', e.target.value)} className="w-6 h-5 bg-transparent border-0 cursor-pointer" />
                      <input type="text" value={card.accentColor || ''} onChange={(e) => updateTitleCard(index, 'accentColor', e.target.value)} placeholder="#hex" className="flex-1 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 focus:outline-none focus:border-rose-500" />
                      <button type="button" onClick={() => updateTitleCard(index, 'accentColor', '')} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    {/* Badge Controls (Issue 26) */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Badge</div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Badge text</label>
                      <input type="text" value={card.badgeText !== undefined ? card.badgeText : 'WHO TO WATCH'} onChange={(e) => updateTitleCard(index, 'badgeText', e.target.value)} placeholder="WHO TO WATCH" className="flex-1 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 focus:outline-none focus:border-rose-500 uppercase" />
                      <button type="button" onClick={() => updateTitleCard(index, 'badgeText', undefined)} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    {card.badgeText === '' && (
                      <p className="text-[10px] text-zinc-500 italic">Badge hidden (empty text)</p>
                    )}
                    <ValueStepper label="Badge size" value={card.badgeFontSize} defaultValue={13} min={4} onChange={(v) => updateTitleCard(index, 'badgeFontSize', v)} onReset={() => updateTitleCard(index, 'badgeFontSize', 13)} />
                    {/* Team Controls (Issue 27) */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Team</div>
                    <ValueStepper label="Name size" value={card.teamNameFontSize} defaultValue={20} min={8} onChange={(v) => updateTitleCard(index, 'teamNameFontSize', v)} onReset={() => updateTitleCard(index, 'teamNameFontSize', 20)} />
                    <ValueStepper label="Logo size" value={card.logoSize} defaultValue={48} min={8} step={4} onChange={(v) => updateTitleCard(index, 'logoSize', v)} onReset={() => updateTitleCard(index, 'logoSize', 48)} />
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Show team</label>
                      <input type="checkbox" checked={card.showTeamRow !== false} onChange={(e) => updateTitleCard(index, 'showTeamRow', e.target.checked)} className="accent-rose-500 cursor-pointer" />
                      <span className="text-[10px] text-zinc-400">{card.showTeamRow !== false ? 'Visible' : 'Hidden'}</span>
                    </div>
                    {/* Text Controls */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Text</div>
                    {/* Headline font size */}
                    <ValueStepper label="Headline size" value={card.headlineFontSize} defaultValue={28} min={8} onChange={(v) => updateTitleCard(index, 'headlineFontSize', v)} onReset={() => updateTitleCard(index, 'headlineFontSize', 28)} />
                    {/* Name font size */}
                    <ValueStepper label="Name size" value={card.nameFontSize} defaultValue={64} min={16} onChange={(v) => updateTitleCard(index, 'nameFontSize', v)} onReset={() => updateTitleCard(index, 'nameFontSize', 64)} />
                    {/* Body font size */}
                    <ValueStepper label="Body size" value={card.bodyFontSize} defaultValue={30} min={8} onChange={(v) => updateTitleCard(index, 'bodyFontSize', v)} onReset={() => updateTitleCard(index, 'bodyFontSize', 30)} />
                    {/* Text vertical offset */}
                    <ValueStepper label="Text offset Y" value={card.textOffsetY} defaultValue={0} step={5} onChange={(v) => updateTitleCard(index, 'textOffsetY', v)} onReset={() => updateTitleCard(index, 'textOffsetY', 0)} />
                    {/* Hint when text content is empty */}
                    {!card.headline && !card.body && (
                      <p className="text-[10px] text-zinc-500 italic mt-1">Add headline or body text to see font size adjustments</p>
                    )}
                    {/* Image Controls */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Image</div>
                    {/* Image scale */}
                    <ValueStepper label="Scale" value={card.imageScale} defaultValue={100} min={1} step={5} unit="%" onChange={(v) => updateTitleCard(index, 'imageScale', v)} onReset={() => updateTitleCard(index, 'imageScale', 100)} />
                    {/* Image horizontal offset */}
                    <ValueStepper label="Offset X" value={card.imageOffsetX} defaultValue={0} step={5} onChange={(v) => updateTitleCard(index, 'imageOffsetX', v)} onReset={() => updateTitleCard(index, 'imageOffsetX', 0)} />
                    {/* Image vertical offset */}
                    <ValueStepper label="Offset Y" value={card.imageOffsetY} defaultValue={0} step={5} onChange={(v) => updateTitleCard(index, 'imageOffsetY', v)} onReset={() => updateTitleCard(index, 'imageOffsetY', 0)} />
                    {/* Watermark Controls (Issue 28) */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Watermark</div>
                    <ValueStepper label="Opacity" value={card.watermarkOpacity} defaultValue={8} min={0} unit="%" onChange={(v) => updateTitleCard(index, 'watermarkOpacity', v)} onReset={() => updateTitleCard(index, 'watermarkOpacity', 8)} />
                    <ValueStepper label="Scale" value={card.watermarkScale} defaultValue={100} min={1} step={5} unit="%" onChange={(v) => updateTitleCard(index, 'watermarkScale', v)} onReset={() => updateTitleCard(index, 'watermarkScale', 100)} />
                    <ValueStepper label="Offset X" value={card.watermarkOffsetX} defaultValue={0} step={10} onChange={(v) => updateTitleCard(index, 'watermarkOffsetX', v)} onReset={() => updateTitleCard(index, 'watermarkOffsetX', 0)} />
                    <ValueStepper label="Offset Y" value={card.watermarkOffsetY} defaultValue={0} step={10} onChange={(v) => updateTitleCard(index, 'watermarkOffsetY', v)} onReset={() => updateTitleCard(index, 'watermarkOffsetY', 0)} />
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Show</label>
                      <input type="checkbox" checked={card.showWatermark !== false} onChange={(e) => updateTitleCard(index, 'showWatermark', e.target.checked)} className="accent-rose-500 cursor-pointer" />
                      <span className="text-[10px] text-zinc-400">{card.showWatermark !== false ? 'Visible' : 'Hidden'}</span>
                    </div>
                  </div>
                </details>
                {/* Validation hints */}
                {!card.headline && !card.body && (
                  <p className="text-[10px] text-amber-400/80">Card is empty — add a headline or body text</p>
                )}
                {config.imageMode !== 'headshot' && config.imageUrl && config.imageUrl === config.headshot && galleryImages.length === 0 && (
                  <p className="text-[10px] text-amber-400/80">Headshot images look best in circle mode — switch "Display as" to Headshot, or add a full-body/cutout image via the + button</p>
                )}
                {/* Live overlay preview */}
                <TitleCardIframePreview
                  card={card}
                  athleteName={config.athleteName}
                  teamName={config.teamName}
                  logoUrl={config.logoUrl}
                  imageUrl={config.imageUrl}
                  imageMode={config.imageMode}
                  meetTheme={meetTheme}
                  themeOverride={themeOverride}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Clip Section */}
      <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50 space-y-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
          <label className="block text-xs text-zinc-400 uppercase tracking-wide">
            Highlight Clip
          </label>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">Video URL</label>
          <input
            type="text"
            value={config.clipUrl}
            onChange={(e) => updateField('clipUrl', e.target.value)}
            placeholder="Paste video URL here..."
            disabled={disabled}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500 disabled:opacity-50"
          />
        </div>

        {config.clipUrl && (
          <div className="mt-2">
            {videoThumbnail ? (
              <div className="relative rounded-lg overflow-hidden border border-zinc-600">
                <img src={videoThumbnail} alt="Video thumbnail" className="w-full h-auto" onError={(e) => { e.target.style.display = 'none'; }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <LinkIcon className="w-3.5 h-3.5" />
                <span className="truncate">{config.clipUrl}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lower-Third Graphic Preview */}
      <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50 space-y-2">
        <div className="flex items-center gap-2">
          <PhotoIcon className="w-3.5 h-3.5 text-zinc-400" />
          <label className="block text-xs text-zinc-400 uppercase tracking-wide">
            Lower-Third Preview
          </label>
        </div>

        <LowerThirdIframePreview
          athleteName={config.athleteName}
          logoUrl={config.logoUrl}
          subtitle={config.subtitle}
          teamName={config.teamName}
          statLabel={config.statLabel}
          statValue={config.statValue}
          headshot={config.headshot}
          meetTheme={meetTheme}
          themeOverride={themeOverride}
          adjustments={config.lowerThirdAdjustments || {}}
        />

        {/* Lower-Third Adjustments — fine-tuning controls */}
        <details className="text-xs">
          <summary className="text-zinc-600 cursor-pointer hover:text-zinc-400">Lower-Third Adjustments</summary>
          <div className="mt-2 space-y-2 bg-zinc-800/50 rounded p-2">
            {/* Theme Controls */}
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Theme</div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 w-20 shrink-0">Theme</label>
              <select
                value={themeOverride || meetTheme || ''}
                onChange={(e) => setThemeOverride(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 focus:outline-none focus:border-rose-500"
              >
                <option value="">None (default)</option>
                {Object.entries(availableThemes).map(([id, theme]) => (
                  <option key={id} value={id}>{theme.name || id}</option>
                ))}
              </select>
              {(themeOverride || meetTheme) && (
                <button type="button" onClick={() => setThemeOverride('')} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 w-20 shrink-0">Background</label>
              <input type="color" value={(config.lowerThirdAdjustments || {}).bgColor || '#1a2332'} onChange={(e) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), bgColor: e.target.value })} className="w-6 h-5 bg-transparent border-0 cursor-pointer" />
              <input type="text" value={(config.lowerThirdAdjustments || {}).bgColor || ''} onChange={(e) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), bgColor: e.target.value })} placeholder="#hex" className="flex-1 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 focus:outline-none focus:border-rose-500" />
              <button type="button" onClick={() => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), bgColor: '' })} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 w-20 shrink-0">Accent</label>
              <input type="color" value={(config.lowerThirdAdjustments || {}).accentColor || '#3b82f6'} onChange={(e) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), accentColor: e.target.value })} className="w-6 h-5 bg-transparent border-0 cursor-pointer" />
              <input type="text" value={(config.lowerThirdAdjustments || {}).accentColor || ''} onChange={(e) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), accentColor: e.target.value })} placeholder="#hex" className="flex-1 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 focus:outline-none focus:border-rose-500" />
              <button type="button" onClick={() => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), accentColor: '' })} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
            </div>

            {/* Badge Controls */}
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Badge</div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 w-20 shrink-0">Badge text</label>
              <input type="text" value={(config.lowerThirdAdjustments || {}).badgeText !== undefined ? (config.lowerThirdAdjustments || {}).badgeText : 'Who to Watch'} onChange={(e) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), badgeText: e.target.value })} placeholder="Who to Watch" className="flex-1 bg-zinc-900 border border-zinc-600 rounded text-white text-[10px] px-1 py-0.5 focus:outline-none focus:border-rose-500" />
              <button type="button" onClick={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.badgeText; updateField('lowerThirdAdjustments', adj); }} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
            </div>
            {(config.lowerThirdAdjustments || {}).badgeText === '' && (
              <p className="text-[10px] text-zinc-500 italic">Badge hidden (empty text)</p>
            )}
            <ValueStepper label="Badge size" value={(config.lowerThirdAdjustments || {}).badgeFontSize} defaultValue={36} min={8} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), badgeFontSize: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.badgeFontSize; updateField('lowerThirdAdjustments', adj); }} />

            {/* Text Controls */}
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Text</div>
            <ValueStepper label="Name size" value={(config.lowerThirdAdjustments || {}).nameFontSize} defaultValue={32} min={8} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), nameFontSize: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.nameFontSize; updateField('lowerThirdAdjustments', adj); }} />
            <ValueStepper label="Subtitle size" value={(config.lowerThirdAdjustments || {}).subtitleFontSize} defaultValue={18} min={8} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), subtitleFontSize: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.subtitleFontSize; updateField('lowerThirdAdjustments', adj); }} />
            <ValueStepper label="Stat size" value={(config.lowerThirdAdjustments || {}).statFontSize} defaultValue={18} min={8} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), statFontSize: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.statFontSize; updateField('lowerThirdAdjustments', adj); }} />

            {/* Headshot Controls */}
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Headshot</div>
            <ValueStepper label="Size" value={(config.lowerThirdAdjustments || {}).headshotSize} defaultValue={110} min={20} step={5} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), headshotSize: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.headshotSize; updateField('lowerThirdAdjustments', adj); }} />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 w-20 shrink-0">Show</label>
              <input type="checkbox" checked={(config.lowerThirdAdjustments || {}).showHeadshot !== false} onChange={(e) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), showHeadshot: e.target.checked })} className="accent-rose-500 cursor-pointer" />
              <span className="text-[10px] text-zinc-400">{(config.lowerThirdAdjustments || {}).showHeadshot !== false ? 'Visible' : 'Hidden'}</span>
            </div>

            {/* Logo Controls */}
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Logo</div>
            <ValueStepper label="Size" value={(config.lowerThirdAdjustments || {}).logoSize} defaultValue={50} min={10} step={5} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), logoSize: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.logoSize; updateField('lowerThirdAdjustments', adj); }} />

            {/* Position Controls */}
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Position</div>
            <ValueStepper label="Bottom" value={(config.lowerThirdAdjustments || {}).cardBottom} defaultValue={120} min={0} step={10} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), cardBottom: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.cardBottom; updateField('lowerThirdAdjustments', adj); }} />
            <ValueStepper label="Left" value={(config.lowerThirdAdjustments || {}).cardLeft} defaultValue={100} min={0} step={10} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), cardLeft: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.cardLeft; updateField('lowerThirdAdjustments', adj); }} />
            <ValueStepper label="Min width" value={(config.lowerThirdAdjustments || {}).cardMinWidth} defaultValue={600} min={200} step={50} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), cardMinWidth: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.cardMinWidth; updateField('lowerThirdAdjustments', adj); }} />
            <ValueStepper label="Max width" value={(config.lowerThirdAdjustments || {}).cardMaxWidth} defaultValue={900} min={300} step={50} onChange={(v) => updateField('lowerThirdAdjustments', { ...(config.lowerThirdAdjustments || {}), cardMaxWidth: v })} onReset={() => { const adj = { ...(config.lowerThirdAdjustments || {}) }; delete adj.cardMaxWidth; updateField('lowerThirdAdjustments', adj); }} />
          </div>
        </details>

        {!isValid && (
          <p className="text-xs text-rose-400 mt-1">Select a team and athlete to continue</p>
        )}
      </div>

      {/* Segment flow summary */}
      {isValid && (
        <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
          <label className="block text-xs text-zinc-400 uppercase tracking-wide mb-2">Playback Order</label>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 flex-wrap">
            {titleCards.map((card, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded font-medium">
                  Card {i + 1}{card.headline ? `: ${card.headline}` : ''}
                </span>
                <span className="text-zinc-600">&rarr;</span>
              </span>
            ))}
            <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-medium">
              {config.clipUrl ? 'Video Clip' : 'No clip set'}
            </span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="px-1.5 py-0.5 bg-zinc-600/30 text-zinc-400 rounded font-medium">
              Lower Third
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
