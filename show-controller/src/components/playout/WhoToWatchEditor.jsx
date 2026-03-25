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
  imageMode: 'headshot',
  titleCards: [],
};

// Determine the best image mode based on image source type
function getDefaultImageMode(imageType) {
  if (!imageType) return 'headshot';
  if (imageType === 'headshot') return 'headshot';
  if (imageType === 'portrait' || imageType === 'full-body') return 'portrait';
  if (imageType === 'action' || imageType === 'custom') return 'full';
  return 'portrait';
}

const MAX_TITLE_CARDS = 3;

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

// Live iframe preview for title cards — renders the real overlay HTML at 1920×1080 and scales it down
function TitleCardIframePreview({ card, athleteName, teamName, logoUrl, imageUrl, imageMode, meetTheme }) {
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
    if (meetTheme) params.set('meetTheme', meetTheme);
    return `/overlays/who-to-watch-title.html?${params.toString()}`;
  }, [card, athleteName, teamName, logoUrl, imageUrl, imageMode, meetTheme]);

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
            src={debouncedOverlayUrl}
            title="Title card preview"
            style={{ width: '1920px', height: '1080px', border: 'none' }}
            sandbox="allow-scripts"
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

  const [config, setConfig] = useState(() => ({
    ...DEFAULT_WHO_TO_WATCH,
    ...whoToWatch,
  }));

  // Sync internal state when prop changes
  useEffect(() => {
    setConfig({
      ...DEFAULT_WHO_TO_WATCH,
      ...whoToWatch,
    });
  }, [whoToWatch]);

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
                    {/* Text Controls */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Text</div>
                    {/* Headline font size */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Headline size</label>
                      <input type="range" min="16" max="40" value={card.headlineFontSize || 28} onChange={(e) => updateTitleCard(index, 'headlineFontSize', parseInt(e.target.value))} className="flex-1 h-2 accent-rose-500 rounded-full cursor-pointer" />
                      <span className="text-[10px] text-zinc-400 w-8 text-right">{card.headlineFontSize || 28}px</span>
                      <button type="button" onClick={() => updateTitleCard(index, 'headlineFontSize', 28)} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    {/* Name font size */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Name size</label>
                      <input type="range" min="40" max="100" value={card.nameFontSize || 64} onChange={(e) => updateTitleCard(index, 'nameFontSize', parseInt(e.target.value))} className="flex-1 h-2 accent-rose-500 rounded-full cursor-pointer" />
                      <span className="text-[10px] text-zinc-400 w-8 text-right">{card.nameFontSize || 64}px</span>
                      <button type="button" onClick={() => updateTitleCard(index, 'nameFontSize', 64)} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    {/* Body font size */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Body size</label>
                      <input type="range" min="18" max="44" value={card.bodyFontSize || 30} onChange={(e) => updateTitleCard(index, 'bodyFontSize', parseInt(e.target.value))} className="flex-1 h-2 accent-rose-500 rounded-full cursor-pointer" />
                      <span className="text-[10px] text-zinc-400 w-8 text-right">{card.bodyFontSize || 30}px</span>
                      <button type="button" onClick={() => updateTitleCard(index, 'bodyFontSize', 30)} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    {/* Text vertical offset */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Text offset Y</label>
                      <input type="range" min="-200" max="200" value={card.textOffsetY || 0} onChange={(e) => updateTitleCard(index, 'textOffsetY', parseInt(e.target.value))} className="flex-1 h-2 accent-rose-500 rounded-full cursor-pointer" />
                      <span className="text-[10px] text-zinc-400 w-8 text-right">{card.textOffsetY || 0}px</span>
                      <button type="button" onClick={() => updateTitleCard(index, 'textOffsetY', 0)} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    {/* Image Controls */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Image</div>
                    {/* Image scale */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Scale</label>
                      <input type="range" min="50" max="150" value={card.imageScale || 100} onChange={(e) => updateTitleCard(index, 'imageScale', parseInt(e.target.value))} className="flex-1 h-2 accent-rose-500 rounded-full cursor-pointer" />
                      <span className="text-[10px] text-zinc-400 w-8 text-right">{card.imageScale || 100}%</span>
                      <button type="button" onClick={() => updateTitleCard(index, 'imageScale', 100)} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    {/* Image horizontal offset */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Offset X</label>
                      <input type="range" min="-200" max="200" value={card.imageOffsetX || 0} onChange={(e) => updateTitleCard(index, 'imageOffsetX', parseInt(e.target.value))} className="flex-1 h-2 accent-rose-500 rounded-full cursor-pointer" />
                      <span className="text-[10px] text-zinc-400 w-8 text-right">{card.imageOffsetX || 0}px</span>
                      <button type="button" onClick={() => updateTitleCard(index, 'imageOffsetX', 0)} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
                    </div>
                    {/* Image vertical offset */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-zinc-500 w-20 shrink-0">Offset Y</label>
                      <input type="range" min="-200" max="200" value={card.imageOffsetY || 0} onChange={(e) => updateTitleCard(index, 'imageOffsetY', parseInt(e.target.value))} className="flex-1 h-2 accent-rose-500 rounded-full cursor-pointer" />
                      <span className="text-[10px] text-zinc-400 w-8 text-right">{card.imageOffsetY || 0}px</span>
                      <button type="button" onClick={() => updateTitleCard(index, 'imageOffsetY', 0)} className="text-[10px] text-zinc-600 hover:text-zinc-400">&times;</button>
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

        <div className="relative rounded-lg overflow-hidden border border-zinc-600 bg-zinc-900" style={{ aspectRatio: '16/9' }}>
          {videoThumbnail ? (
            <img src={videoThumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900" />
          )}

          <div className="absolute bottom-0 left-0 right-0" style={{ padding: '0 8%', paddingBottom: '8%' }}>
            <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--meet-header-bg, #BFBFBF)' }}>
              <span className="text-xs font-black uppercase tracking-tight" style={{ color: 'var(--meet-header-text, #000)' }}>
                Who to Watch
              </span>
              {config.logoUrl && (
                <img src={config.logoUrl} alt="" className="h-5 w-5 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
              )}
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-black">
              {config.headshot ? (
                <img
                  src={config.headshot}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border border-white/30 shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex'; }}
                />
              ) : null}
              {(!config.headshot || true) && (
                <div
                  className="w-8 h-8 rounded-full bg-zinc-700 border border-white/30 shrink-0 items-center justify-center text-xs font-bold text-zinc-400"
                  style={{ display: config.headshot ? 'none' : 'flex' }}
                >
                  {getInitials(config.athleteName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-white uppercase truncate">
                  {config.athleteName || 'Athlete Name'}
                </div>
                {(config.subtitle || config.teamName) && (
                  <div className="text-[10px] text-zinc-400 uppercase truncate">
                    {config.subtitle || config.teamName}
                  </div>
                )}
                {config.statLabel && config.statValue && (
                  <div className="text-[10px] font-semibold uppercase truncate" style={{ color: 'var(--meet-header-bg, #3b82f6)' }}>
                    {config.statLabel}: {config.statValue}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

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
