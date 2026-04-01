import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCompetition, useCompetitions } from '../hooks/useCompetitions';
import { useTeamsDatabase } from '../hooks/useTeamsDatabase';
import { isTransparentGraphic } from '../lib/graphicButtons';
import { GRAPHICS, CATEGORIES } from '../lib/graphicsRegistry';
import { getTeamCount } from '../lib/competitionUtils';
import { generateGraphicURL, copyToClipboard } from '../lib/urlBuilder';
import { db, ref, get, update } from '../lib/firebase';
import SponsorAdjustControls from '../components/SponsorAdjustControls';

// Available themes for Event Summary (same as GraphicsControl.jsx)
const summaryThemes = [
  // LAYOUTS - Different structural designs
  { id: 'layout-broadcast-table', label: 'Hero Cards' },
  { id: 'layout-classic-broadcast', label: 'Classic Broadcast' },
  { id: 'layout-default-v2', label: 'Default V2' },
  { id: 'layout-default-v3', label: 'V3 Full Height' },
  { id: 'layout-default-v4', label: 'V4 Rankings' },
  { id: 'layout-default-v5', label: 'V5 Compact' },
  { id: 'layout-default-v6', label: 'V6 Cards' },
  { id: 'layout-default-v7', label: 'V7 Progress Bars' },
  { id: 'layout-default-v8', label: 'V8 Light Minimal' },
  { id: 'layout-default-v9', label: 'V9 Bold Blue' },
  { id: 'layout-default-v10', label: 'V10 Score Focus' },
  { id: 'layout-default-v11', label: 'V11 Blue Accent' },
  { id: 'layout-default-v12', label: 'V12 Gradient Rows' },
  { id: 'layout-default-v13', label: 'V13 Split Header' },
  { id: 'layout-default-v14', label: 'V14 Big Footer' },
  { id: 'layout-default-v15', label: 'V15 Orange Badges' },
  { id: 'layout-default-v16', label: 'V16 Purple Theme' },
  { id: 'layout-default-v17', label: 'V17 Green Scores' },
  { id: 'layout-default-v18', label: 'V18 Team Colors' },
  { id: 'layout-default-v19', label: 'V19 Dense Compact' },
  { id: 'layout-default-v20', label: 'V20 Combined Best' },
  { id: 'layout-default-v21', label: 'V21 Extra Large' },
  { id: 'layout-default-v22', label: 'V22 Integrated Rank' },
  { id: 'layout-default-v23', label: 'V23 No Rankings' },
  { id: 'layout-split-row', label: 'Split Row (5-team 3+2)' },
  // COLOR THEMES - Same structure, different colors
  { id: 'default', label: 'Default (Original)' },
  { id: 'espn', label: 'ESPN Colors' },
  { id: 'nbc', label: 'NBC Olympics' },
  { id: 'btn', label: 'Big Ten' },
  { id: 'pac12', label: 'Pac-12' },
  { id: 'virtius', label: 'Virtius' },
  { id: 'neon', label: 'Neon' },
  { id: 'classic', label: 'Classic' },
  { id: 'light', label: 'Light' },
  { id: 'home', label: 'Team Colors' },
  { id: 'gradient', label: 'Gradient' },
];

/**
 * Generate graphic titles dynamically from registry
 * Includes both static registry labels and expanded per-team graphics
 */
function getGraphicTitles(teamCount, teamNames = {}) {
  const titles = { clear: 'None' };

  // Add all graphics from registry
  Object.values(GRAPHICS).forEach(g => {
    titles[g.id] = g.label;
  });

  // Expand perTeam graphics with team-specific names
  Object.values(GRAPHICS)
    .filter(g => g.perTeam)
    .forEach(g => {
      for (let i = 1; i <= teamCount; i++) {
        const teamName = teamNames[i] || `Team ${i}`;
        const baseId = g.id.replace('team-', '');
        const expandedId = `team${i}-${baseId}`;
        const label = g.labelTemplate
          ? g.labelTemplate.replace('{teamName}', teamName)
          : `${teamName} ${g.label.replace('Team ', '')}`;
        titles[expandedId] = label;
      }
    });

  return titles;
}

/**
 * Get graphics grouped by category and subcategory for sidebar rendering
 * Returns categories in sidebar order with their graphics
 */
function getGroupedGraphics(compType, teamCount, teamNames = {}) {
  const isMens = compType?.startsWith('mens');

  // Sort categories by order
  const sortedCategories = Object.entries(CATEGORIES)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([id, cat]) => ({ id, ...cat }));

  const grouped = {};

  for (const category of sortedCategories) {
    grouped[category.id] = {
      label: category.label,
      order: category.order,
      subcategories: {},
      graphics: [], // Graphics without subcategory
    };

    // Initialize subcategories
    for (const [subId, subLabel] of Object.entries(category.subcategories || {})) {
      grouped[category.id].subcategories[subId] = {
        label: subLabel,
        graphics: [],
      };
    }
  }

  // Add graphics to their categories
  for (const graphic of Object.values(GRAPHICS)) {
    // Filter by gender
    if (graphic.gender === 'mens' && !isMens) continue;
    if (graphic.gender === 'womens' && isMens) continue;

    // Filter by team count
    if (graphic.minTeams && teamCount < graphic.minTeams) continue;
    if (graphic.maxTeams && teamCount > graphic.maxTeams) continue;

    const cat = grouped[graphic.category];
    if (!cat) continue;

    // Handle perTeam expansion
    if (graphic.perTeam) {
      for (let i = 1; i <= teamCount; i++) {
        const teamName = teamNames[i] || `Team ${i}`;
        const baseId = graphic.id.replace('team-', '');
        const expandedId = `team${i}-${baseId}`;
        const label = graphic.labelTemplate
          ? graphic.labelTemplate.replace('{teamName}', teamName)
          : `${teamName} ${graphic.label.replace('Team ', '')}`;

        const expandedGraphic = {
          ...graphic,
          id: expandedId,
          label,
          team: i,
        };

        if (graphic.subcategory && cat.subcategories[graphic.subcategory]) {
          cat.subcategories[graphic.subcategory].graphics.push(expandedGraphic);
        } else {
          cat.graphics.push(expandedGraphic);
        }
      }
    } else {
      if (graphic.subcategory && cat.subcategories[graphic.subcategory]) {
        cat.subcategories[graphic.subcategory].graphics.push(graphic);
      } else {
        cat.graphics.push(graphic);
      }
    }
  }

  return grouped;
}

export default function UrlGeneratorPage() {
  const [searchParams] = useSearchParams();
  const compId = searchParams.get('comp');

  const { config } = useCompetition(compId);
  const { updateCompetition, refreshTeamData } = useCompetitions();
  const { teams: allTeams, getTeamSponsors, resolveSchoolKey, saveSponsor } = useTeamsDatabase();
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarJsonMode, setCalendarJsonMode] = useState(false);

  const [currentGraphic, setCurrentGraphic] = useState('logos');
  const [activeTab, setActiveTab] = useState('meet');
  const [toast, setToast] = useState('');
  const [summaryTheme, setSummaryTheme] = useState('layout-default-v4');
  const [rotationSlateNum, setRotationSlateNum] = useState('1');
  const [slateLayout, setSlateLayout] = useState('classic');
  const [meetThemeLogo, setMeetThemeLogo] = useState('');
  const [meetThemeSponsors, setMeetThemeSponsors] = useState([]);
  // Stat type selector per team: 'avg' (default), 'nqs', 'high'
  const [teamStatTypes, setTeamStatTypes] = useState({});
  const [sponsorOverrides, setSponsorOverrides] = useState({}); // { index: { scale, offsetX, offsetY, cropX, cropY, cropW, cropH } }
  const [sponsorSource, setSponsorSource] = useState(null); // 'theme' | 'team' | null - tracks where sponsors came from for persistence
  const [selectedSponsorIndex, setSelectedSponsorIndex] = useState(-1);
  const [showSponsorBounds, setShowSponsorBounds] = useState(false);
  const [showSponsorCropControls, setShowSponsorCropControls] = useState(false);
  const [showSponsorGuides, setShowSponsorGuides] = useState(false);
  const [cycleDuration, setCycleDuration] = useState(3); // seconds between sponsor switches
  const [excludedSponsors, setExcludedSponsors] = useState([]); // array of excluded indices
  const [combinedSessionId1, setCombinedSessionId1] = useState('');
  const [combinedSessionId2, setCombinedSessionId2] = useState('');

  // Interview Card state
  const [icCoachName, setIcCoachName] = useState('');
  const [icTitle, setIcTitle] = useState('HEAD COACH');
  const [icTeamKey, setIcTeamKey] = useState('');
  const [icSeries, setIcSeries] = useState('Behind the Chalk');
  const [icBgImage, setIcBgImage] = useState('https://image2url.com/r2/default/images/1774545468853-d0a3d266-7ef9-4066-bff0-1cb82174171e.blob');
  const [icEventLogo, setIcEventLogo] = useState('https://media.virti.us/upload/images/team/6HQvIZnZtygrv44TPNwxg');

  // Responsive preview scaling — dynamically fit 1920×1080 iframe into available space
  const previewContainerRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(null);
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setPreviewScale(Math.min(width / 1920, height / 1080));
      }
    };
    update(); // measure immediately
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch meet theme logo and sponsors when theme is set
  useEffect(() => {
    if (!config?.meetTheme) { setMeetThemeLogo(''); setMeetThemeSponsors([]); setSponsorOverrides({}); setSponsorSource(null); return; }
    get(ref(db, `themes/${config.meetTheme}`)).then(snap => {
      const theme = snap.val() || {};
      setMeetThemeLogo(theme.logos?.meetLogo || '');
      const sponsors = Array.isArray(theme.sponsors) ? theme.sponsors : [];
      setMeetThemeSponsors(sponsors);
      setSponsorSource(sponsors.length > 0 ? 'theme' : null);
      // Initialize overrides from theme data (including crop fields)
      const overrides = {};
      sponsors.forEach((s, i) => {
        if (s.scale || s.offsetX || s.offsetY || s.cropX != null || s.cropY != null || s.cropW != null || s.cropH != null) {
          overrides[i] = {
            scale: s.scale || 100, offsetX: s.offsetX || 0, offsetY: s.offsetY || 0,
            cropX: s.cropX ?? null, cropY: s.cropY ?? null, cropW: s.cropW ?? null, cropH: s.cropH ?? null,
          };
        }
      });
      setSponsorOverrides(overrides);
      setSelectedSponsorIndex(-1);
    });
  }, [config?.meetTheme]);

  // Get team count from competition type (supports 2-7 teams)
  const teamCount = useMemo(() => getTeamCount(config?.compType), [config?.compType]);

  // Rotation count: max of event count and team count (5+ teams have byes)
  const rotationCount = useMemo(() => {
    const eventCount = config?.compType?.startsWith('womens') ? 4 : 6;
    return Math.max(eventCount, teamCount);
  }, [config?.compType, teamCount]);

  // Initialize form data with support for up to 7 teams
  const [formData, setFormData] = useState({
    eventName: 'Big Ten Dual Meet',
    meetDate: 'January 15, 2025',
    venue: 'Crisler Center',
    location: 'Ann Arbor, MI',
    hosts: 'John Smith\nSarah Johnson',
    // Event Calendar
    calendarTitle: 'Event Calendar',
    calendarEvents: '[{"date":"March 15","name":"vs UCLA","location":"Los Angeles, CA"},{"date":"March 22","name":"at Oregon","location":"Eugene, OR"}]',
    calendarColumns: 'auto',
    // Team 1
    team1Name: 'Michigan',
    team1Logo: '',
    team1Ave: '406.850',
    team1High: '409.200',
    team1Nqs: '',
    team1Coaches: 'Kurt Golder\nBrian Coddington\nTyler Balthazor',
    // Team 2
    team2Name: 'Ohio State',
    team2Logo: '',
    team2Ave: '403.450',
    team2High: '406.100',
    team2Nqs: '',
    team2Coaches: 'Rustam Sharipov\nSergio Santana\nJames Moore',
    // Team 3 (for tri/quad meets)
    team3Name: '',
    team3Logo: '',
    team3Ave: '',
    team3High: '',
    team3Nqs: '',
    team3Coaches: '',
    // Team 4 (for quad meets)
    team4Name: '',
    team4Logo: '',
    team4Ave: '',
    team4High: '',
    team4Nqs: '',
    team4Coaches: '',
    // Team 5
    team5Name: '',
    team5Logo: '',
    team5Ave: '',
    team5High: '',
    team5Nqs: '',
    team5Coaches: '',
    // Team 6
    team6Name: '',
    team6Logo: '',
    team6Ave: '',
    team6High: '',
    team6Nqs: '',
    team6Coaches: '',
    // Team 7
    team7Name: '',
    team7Logo: '',
    team7Ave: '',
    team7High: '',
    team7Nqs: '',
    team7Coaches: '',
    // Team 8
    team8Name: '',
    team8Logo: '',
    team8Ave: '',
    team8High: '',
    team8Nqs: '',
    team8Coaches: '',
    // Team 9
    team9Name: '',
    team9Logo: '',
    team9Ave: '',
    team9High: '',
    team9Nqs: '',
    team9Coaches: '',
    // Team 10
    team10Name: '',
    team10Logo: '',
    team10Ave: '',
    team10High: '',
    team10Nqs: '',
    team10Coaches: '',
  });

  // Load config from Firebase if competition is selected
  // Coaches are now auto-synced to config when RTN data is fetched
  useEffect(() => {
    if (config) {
      // Build form data dynamically for all teams (up to 6)
      const newFormData = {
        eventName: config.eventName || '',
        meetDate: config.meetDate || '',
        venue: config.venue || '',
        location: config.location || '',
        hosts: config.hosts || '',
        // Event Calendar
        calendarTitle: config.calendarTitle || 'Event Calendar',
        calendarEvents: config.calendarEvents || '[]',
        calendarColumns: config.calendarColumns || 'auto',
      };

      // Load all team data (1-10)
      for (let i = 1; i <= 10; i++) {
        newFormData[`team${i}Name`] = config[`team${i}Name`] || '';
        newFormData[`team${i}Logo`] = config[`team${i}Logo`] || '';
        newFormData[`team${i}Ave`] = config[`team${i}Ave`] || '';
        newFormData[`team${i}High`] = config[`team${i}High`] || '';
        newFormData[`team${i}Nqs`] = config[`team${i}Nqs`] || '';
        newFormData[`team${i}Coaches`] = config[`team${i}Coaches`] || '';
      }

      setFormData(newFormData);
      setHasChanges(false);
    }
  }, [config]);

  // Update form data and track changes
  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  // Save changes to Firebase
  const saveToFirebase = async () => {
    if (!compId) {
      showToast('No competition selected!');
      return;
    }
    setSaving(true);
    try {
      await updateCompetition(compId, formData);
      setHasChanges(false);
      showToast('Saved to competition!');
    } catch (error) {
      console.error('Error saving:', error);
      showToast('Error saving changes');
    }
    setSaving(false);
  };

  // Fetch fresh team data from RTN
  const handleRefreshTeamData = async () => {
    if (!compId) {
      showToast('No competition selected!');
      return;
    }
    setRefreshing(true);
    try {
      const result = await refreshTeamData(compId);
      if (result.success) {
        showToast(`Refreshed ${result.teamsEnriched} team(s) from RTN!`);
      } else {
        showToast('Error: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error refreshing team data:', error);
      showToast('Error refreshing team data');
    }
    setRefreshing(false);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2000);
  };

  const copyUrl = async (graphic) => {
    const success = await copyToClipboard(generateURL(graphic));
    showToast(success ? `Copied: ${graphicTitles[graphic]}` : 'Failed to copy');
  };

  const copyAllUrls = async () => {
    const allUrls = Object.keys(graphicTitles)
      .map((g) => `${graphicTitles[g]}:\n${generateURL(g)}`)
      .join('\n\n');
    const success = await copyToClipboard(allUrls);
    showToast(success ? 'All URLs copied!' : 'Failed to copy');
  };

  const isTransparent = isTransparentGraphic(currentGraphic);

  // Generate dynamic team names from form data
  const teamNames = useMemo(() => {
    const names = {};
    for (let i = 1; i <= teamCount; i++) {
      if (formData[`team${i}Name`]) {
        names[i] = formData[`team${i}Name`];
      }
    }
    return names;
  }, [formData, teamCount]);

  // Get dynamic graphic titles based on team count
  const graphicTitles = useMemo(() => getGraphicTitles(teamCount, teamNames), [teamCount, teamNames]);

  // Get graphics grouped by category for sidebar
  const groupedGraphics = useMemo(
    () => getGroupedGraphics(config?.compType, teamCount, teamNames),
    [config?.compType, teamCount, teamNames]
  );

  // Resolve home team key for sponsor lookups
  const resolveHomeTeamKey = (formData, config) => {
    if (!formData.team1Name) return null;
    const gender = config?.compType?.startsWith('mens') ? 'mens' : 'womens';
    const schoolKey = resolveSchoolKey(formData.team1Name);
    if (!schoolKey) return null;
    return `${schoolKey}-${gender}`;
  };

  // Fall back to per-team sponsors when no theme sponsors exist
  const teamHomeKey = useMemo(() => resolveHomeTeamKey(formData, config), [formData.team1Name, config?.compType, resolveSchoolKey]);
  const teamSponsorsRaw = useMemo(() => {
    if (meetThemeSponsors.length > 0) return []; // theme sponsors take priority
    if (!teamHomeKey) return [];
    return getTeamSponsors(teamHomeKey);
  }, [meetThemeSponsors.length, teamHomeKey, getTeamSponsors]);

  // Combined sponsors list: theme sponsors first, then team sponsors as fallback
  const activeSponsorList = meetThemeSponsors.length > 0 ? meetThemeSponsors : teamSponsorsRaw;
  const activeSponsorSource = meetThemeSponsors.length > 0 ? 'theme' : (teamSponsorsRaw.length > 0 ? 'team' : null);

  // Generate URL with options for new graphic types
  const generateURLWithOptions = (graphic) => {
    let sponsorsJson = null;
    if (graphic.startsWith('sponsors-')) {
      // Prefer theme-level sponsors over team-level sponsors
      if (meetThemeSponsors.length > 0) {
        const capped = meetThemeSponsors.slice(0, 8).map((s, i) => {
          const ov = sponsorOverrides[i] || {};
          const scale = ov.scale || s.scale || 100;
          const offsetX = ov.offsetX ?? s.offsetX ?? 0;
          const offsetY = ov.offsetY ?? s.offsetY ?? 0;
          const cropX = ov.cropX ?? s.cropX ?? null;
          const cropY = ov.cropY ?? s.cropY ?? null;
          const cropW = ov.cropW ?? s.cropW ?? null;
          const cropH = ov.cropH ?? s.cropH ?? null;
          return {
            name: s.name, url: s.url,
            ...(scale !== 100 ? { scale } : {}),
            ...(offsetX ? { offsetX } : {}),
            ...(offsetY ? { offsetY } : {}),
            ...(cropX != null ? { cropX } : {}),
            ...(cropY != null ? { cropY } : {}),
            ...(cropW != null ? { cropW } : {}),
            ...(cropH != null ? { cropH } : {}),
          };
        });
        sponsorsJson = JSON.stringify(capped);
      } else if (teamSponsorsRaw.length > 0) {
        const capped = teamSponsorsRaw.slice(0, 8).map((s, i) => {
          const ov = sponsorOverrides[i] || {};
          const scale = ov.scale || s.scale || 100;
          const offsetX = ov.offsetX ?? s.offsetX ?? 0;
          const offsetY = ov.offsetY ?? s.offsetY ?? 0;
          const cropX = ov.cropX ?? s.cropX ?? null;
          const cropY = ov.cropY ?? s.cropY ?? null;
          const cropW = ov.cropW ?? s.cropW ?? null;
          const cropH = ov.cropH ?? s.cropH ?? null;
          return {
            name: s.name, url: s.url,
            ...(scale !== 100 ? { scale } : {}),
            ...(offsetX ? { offsetX } : {}),
            ...(offsetY ? { offsetY } : {}),
            ...(cropX != null ? { cropX } : {}),
            ...(cropY != null ? { cropY } : {}),
            ...(cropW != null ? { cropW } : {}),
            ...(cropH != null ? { cropH } : {}),
          };
        });
        sponsorsJson = JSON.stringify(capped);
      }
    }
    // Determine stat type for team-stats graphics
    let statLabel = undefined;
    let statValue = undefined;
    const teamStatsMatch = graphic.match(/^team(\d+)-stats$/);
    if (teamStatsMatch) {
      const teamNum = parseInt(teamStatsMatch[1]);
      const statType = teamStatTypes[teamNum] || 'avg';
      if (statType === 'nqs') {
        statLabel = 'NQS';
        statValue = formData[`team${teamNum}Nqs`];
      } else if (statType === 'high') {
        statLabel = 'HIGH';
        statValue = formData[`team${teamNum}High`];
      } else {
        statLabel = 'AVG';
        statValue = formData[`team${teamNum}Ave`];
      }
    }

    return generateGraphicURL(graphic, formData, teamCount, undefined, {
      compType: config?.compType,
      virtiusSessionId: graphic === 'combined-aa-leaderboard' ? combinedSessionId1 : config?.virtiusSessionId,
      virtiusSessionId2: combinedSessionId2,
      compId: compId,
      summaryTheme: summaryTheme,
      sponsors: sponsorsJson,
      rotation: rotationSlateNum,
      layout: slateLayout,
      meetTheme: config?.meetTheme,
      meetThemeLogo,
      // Stat type for team-stats graphics
      statLabel,
      statValue,
      // Sponsor editing aids (only for preview, not for production URLs)
      ...(graphic.startsWith('sponsors-') && selectedSponsorIndex >= 0 ? { lockedIndex: selectedSponsorIndex } : {}),
      ...(graphic.startsWith('sponsors-') && showSponsorBounds ? { showBounds: true } : {}),
      ...(graphic.startsWith('sponsors-') && showSponsorGuides ? { showGuides: true } : {}),
      // Sponsor cycle controls
      ...(graphic === 'sponsors-cycle' && cycleDuration !== 3 ? { cycleDuration } : {}),
      ...(graphic === 'sponsors-cycle' && excludedSponsors.length > 0 ? { excluded: excludedSponsors } : {}),
    });
  };

  // Override generateURL to use options
  const generateURL = (graphic) => {
    return generateURLWithOptions(graphic);
  };

  const currentUrl = useMemo(() => generateURL(currentGraphic), [currentGraphic, formData, teamCount, config?.compType, config?.virtiusSessionId, config?.meetTheme, summaryTheme, rotationSlateNum, slateLayout, meetThemeLogo, meetThemeSponsors, teamSponsorsRaw, sponsorOverrides, selectedSponsorIndex, showSponsorBounds, showSponsorGuides, teamStatTypes, combinedSessionId1, combinedSessionId2, cycleDuration, excludedSponsors]);

  return (
    <div className="h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <div className="w-72 bg-zinc-900 border-r border-zinc-800 p-5 overflow-y-auto flex-shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-xs hover:bg-zinc-700 transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Hub
        </Link>

        <h1 className="text-xl font-bold text-white mb-1">Graphics Generator</h1>
        <p className="text-xs text-zinc-500 mb-6">
          {compId ? (
            <span className="text-blue-500 font-semibold">Competition: {compId.toUpperCase()}</span>
          ) : (
            'OBS Overlay System'
          )}
        </p>

        {/* Dynamic sidebar sections from registry CATEGORIES */}
        {Object.entries(groupedGraphics)
          .sort((a, b) => a[1].order - b[1].order)
          .map(([categoryId, category]) => {
            // Special handling for event-summary category (theme dropdown + subcategory grids)
            if (categoryId === 'event-summary') {
              return (
                <GraphicSection key={categoryId} title={category.label}>
                  <div className="mb-3">
                    <select
                      value={summaryTheme}
                      onChange={(e) => setSummaryTheme(e.target.value)}
                      className="w-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    >
                      {summaryThemes.map((theme) => (
                        <option key={theme.id} value={theme.id}>{theme.label}</option>
                      ))}
                    </select>
                  </div>
                  {/* Rotations subcategory */}
                  {category.subcategories.rotations && category.subcategories.rotations.graphics.length > 0 && (
                    <>
                      <div className="text-xs text-zinc-600 mb-1">{category.subcategories.rotations.label}</div>
                      <div className="grid grid-cols-4 gap-1 mb-2">
                        {category.subcategories.rotations.graphics.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setCurrentGraphic(g.id)}
                            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                              currentGraphic === g.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {/* Apparatus subcategory */}
                  {category.subcategories.apparatus && category.subcategories.apparatus.graphics.length > 0 && (
                    <>
                      <div className="text-xs text-zinc-600 mb-1">{category.subcategories.apparatus.label}</div>
                      <div className="grid grid-cols-4 gap-1">
                        {category.subcategories.apparatus.graphics.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setCurrentGraphic(g.id)}
                            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                              currentGraphic === g.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </GraphicSection>
              );
            }

            // Special handling for full-bleed category (rotation slate has custom picker)
            if (categoryId === 'full-bleed') {
              const slatesSubcat = category.subcategories.slates;
              const streamSubcat = category.subcategories.stream;
              const sponsorsSubcat = category.subcategories.sponsors;

              // Filter out rotation-slate and rotation-slate-auto from slates (handled specially)
              const otherSlates = slatesSubcat?.graphics.filter(g =>
                g.id !== 'rotation-slate' && g.id !== 'rotation-slate-auto'
              ) || [];

              return (
                <GraphicSection key={categoryId} title={category.label}>
                  {/* Slates subcategory */}
                  {slatesSubcat && (
                    <>
                      <div className="text-xs text-zinc-500 mb-1">{slatesSubcat.label}</div>
                      {/* Regular slates */}
                      {otherSlates.map((g) => (
                        <GraphicSidebarButton
                          key={g.id}
                          id={g.id}
                          label={g.label}
                          renderer={g.renderer}
                          active={currentGraphic === g.id}
                          onClick={() => setCurrentGraphic(g.id)}
                        />
                      ))}
                      {/* Rotation Slate with layout picker */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-zinc-500">Rotation Slate</div>
                          <select
                            value={slateLayout}
                            onChange={(e) => {
                              setSlateLayout(e.target.value);
                              setCurrentGraphic('rotation-slate');
                            }}
                            className="text-xs bg-zinc-700 text-zinc-300 border border-zinc-600 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="classic">Classic</option>
                            <option value="centered">Centered</option>
                            <option value="minimal">Minimal</option>
                            <option value="banner">Banner</option>
                            <option value="jumbo">Jumbo</option>
                            <option value="hero">Hero</option>
                            <option value="split">Split</option>
                            <option value="bold">Bold</option>
                            <option value="watermark">Watermark</option>
                            <option value="frame">Frame</option>
                            <option value="stacked">Stacked</option>
                            <option value="cinema">Cinema</option>
                            <option value="corner">Corner</option>
                            <option value="wide">Wide</option>
                            <option value="side">Side</option>
                            <option value="stripe">Stripe</option>
                            <option value="overlap">Overlap</option>
                          </select>
                        </div>
                        <div className={`grid gap-1 ${rotationCount <= 4 ? 'grid-cols-4' : rotationCount <= 6 ? 'grid-cols-6' : 'grid-cols-7'}`}>
                          {Array.from({ length: rotationCount }, (_, i) => String(i + 1)).map((num) => (
                            <button
                              key={`rotation-slate-${num}`}
                              onClick={() => {
                                setRotationSlateNum(num);
                                setCurrentGraphic('rotation-slate');
                              }}
                              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                                currentGraphic === 'rotation-slate' && rotationSlateNum === num
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                              }`}
                            >
                              R{num}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setCurrentGraphic('rotation-slate-auto')}
                          className={`mt-1 w-full px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                            currentGraphic === 'rotation-slate-auto'
                              ? 'bg-green-600 text-white'
                              : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          Auto (Live)
                        </button>
                      </div>
                    </>
                  )}
                  {/* Stream subcategory */}
                  {streamSubcat && streamSubcat.graphics.length > 0 && (
                    <>
                      <div className="text-xs text-zinc-500 mt-3 mb-1">{streamSubcat.label}</div>
                      {streamSubcat.graphics.map((g) => (
                        <GraphicSidebarButton
                          key={g.id}
                          id={g.id}
                          label={g.label}
                          renderer={g.renderer}
                          active={currentGraphic === g.id}
                          onClick={() => setCurrentGraphic(g.id)}
                        />
                      ))}
                    </>
                  )}
                  {/* Sponsors subcategory */}
                  {sponsorsSubcat && sponsorsSubcat.graphics.length > 0 && (
                    <>
                      <div className="text-xs text-zinc-500 mt-3 mb-1">{sponsorsSubcat.label}</div>
                      {sponsorsSubcat.graphics.map((g) => (
                        <GraphicSidebarButton
                          key={g.id}
                          id={g.id}
                          label={g.label}
                          renderer={g.renderer}
                          active={currentGraphic === g.id}
                          onClick={() => setCurrentGraphic(g.id)}
                        />
                      ))}
                    </>
                  )}
                  {/* Ungrouped graphics */}
                  {category.graphics.length > 0 && (
                    category.graphics.map((g) => (
                      <GraphicSidebarButton
                        key={g.id}
                        id={g.id}
                        label={g.label}
                        renderer={g.renderer}
                        active={currentGraphic === g.id}
                        onClick={() => setCurrentGraphic(g.id)}
                      />
                    ))
                  )}
                </GraphicSection>
              );
            }

            // Special handling for full-screen-cards (leaderboards have combined-aa with session inputs)
            if (categoryId === 'full-screen-cards') {
              const leaderboardsSubcat = category.subcategories.leaderboards;
              const teamInfoSubcat = category.subcategories['team-info'];
              const sponsorsSubcat = category.subcategories.sponsors;

              return (
                <GraphicSection key={categoryId} title={category.label}>
                  {/* Leaderboards subcategory with special combined-aa handling */}
                  {leaderboardsSubcat && leaderboardsSubcat.graphics.length > 0 && (
                    <>
                      <div className="text-xs text-zinc-500 mb-1">{leaderboardsSubcat.label}</div>
                      {leaderboardsSubcat.graphics.filter(g => g.id !== 'combined-aa-leaderboard').map((g) => (
                        <GraphicSidebarButton
                          key={g.id}
                          id={g.id}
                          label={g.label}
                          renderer={g.renderer}
                          active={currentGraphic === g.id}
                          onClick={() => setCurrentGraphic(g.id)}
                        />
                      ))}
                      {/* Combined AA Leaderboard with session ID inputs */}
                      {leaderboardsSubcat.graphics.find(g => g.id === 'combined-aa-leaderboard') && (
                        <div className="mt-2 pt-2 border-t border-zinc-800">
                          <GraphicSidebarButton
                            id="combined-aa-leaderboard"
                            label="Combined AA"
                            renderer="stage"
                            active={currentGraphic === 'combined-aa-leaderboard'}
                            onClick={() => setCurrentGraphic('combined-aa-leaderboard')}
                          />
                          {currentGraphic === 'combined-aa-leaderboard' && (
                            <div className="mt-2 space-y-2 px-1">
                              <div>
                                <label className="text-xs text-zinc-500 block mb-1">Session ID 1</label>
                                <input
                                  type="text"
                                  value={combinedSessionId1}
                                  onChange={(e) => setCombinedSessionId1(e.target.value.trim())}
                                  placeholder="e.g., EeUcxrjyBD"
                                  className="w-full text-xs bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-zinc-500 block mb-1">Session ID 2</label>
                                <input
                                  type="text"
                                  value={combinedSessionId2}
                                  onChange={(e) => setCombinedSessionId2(e.target.value.trim())}
                                  placeholder="e.g., XyZ123abCD"
                                  className="w-full text-xs bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {/* Team Info subcategory */}
                  {teamInfoSubcat && teamInfoSubcat.graphics.length > 0 && (
                    <>
                      <div className="text-xs text-zinc-500 mt-3 mb-1">{teamInfoSubcat.label}</div>
                      {teamInfoSubcat.graphics.map((g) => (
                        <GraphicSidebarButton
                          key={g.id}
                          id={g.id}
                          label={g.label}
                          renderer={g.renderer}
                          active={currentGraphic === g.id}
                          onClick={() => setCurrentGraphic(g.id)}
                        />
                      ))}
                    </>
                  )}
                  {/* Sponsors subcategory */}
                  {sponsorsSubcat && sponsorsSubcat.graphics.length > 0 && (
                    <>
                      <div className="text-xs text-zinc-500 mt-3 mb-1">{sponsorsSubcat.label}</div>
                      {sponsorsSubcat.graphics.map((g) => (
                        <GraphicSidebarButton
                          key={g.id}
                          id={g.id}
                          label={g.label}
                          renderer={g.renderer}
                          active={currentGraphic === g.id}
                          onClick={() => setCurrentGraphic(g.id)}
                        />
                      ))}
                    </>
                  )}
                  {/* Ungrouped graphics */}
                  {category.graphics.length > 0 && (
                    category.graphics.map((g) => (
                      <GraphicSidebarButton
                        key={g.id}
                        id={g.id}
                        label={g.label}
                        renderer={g.renderer}
                        active={currentGraphic === g.id}
                        onClick={() => setCurrentGraphic(g.id)}
                      />
                    ))
                  )}
                </GraphicSection>
              );
            }

            // Default rendering for other categories (lower-thirds, video-frames, standalone)
            const hasSubcategories = Object.keys(category.subcategories).length > 0;
            const hasGraphicsInSubcategories = hasSubcategories &&
              Object.values(category.subcategories).some(sub => sub.graphics.length > 0);

            // Skip empty categories
            if (!hasGraphicsInSubcategories && category.graphics.length === 0) {
              return null;
            }

            return (
              <GraphicSection key={categoryId} title={category.label}>
                {/* Render subcategories */}
                {hasSubcategories && Object.entries(category.subcategories).map(([subId, sub]) => {
                  if (sub.graphics.length === 0) return null;
                  return (
                    <div key={subId}>
                      <div className="text-xs text-zinc-500 mb-1 first:mt-0 mt-3">{sub.label}</div>
                      {sub.graphics.map((g) => (
                        <GraphicSidebarButton
                          key={g.id}
                          id={g.id}
                          label={g.label}
                          renderer={g.renderer}
                          active={currentGraphic === g.id}
                          onClick={() => setCurrentGraphic(g.id)}
                        />
                      ))}
                    </div>
                  );
                })}
                {/* Render ungrouped graphics */}
                {category.graphics.length > 0 && (
                  <>
                    {hasGraphicsInSubcategories && <div className="text-xs text-zinc-500 mt-3 mb-1">Other</div>}
                    {category.graphics.map((g) => (
                      <GraphicSidebarButton
                        key={g.id}
                        id={g.id}
                        label={g.label}
                        renderer={g.renderer}
                        active={currentGraphic === g.id}
                        onClick={() => setCurrentGraphic(g.id)}
                      />
                    ))}
                  </>
                )}
              </GraphicSection>
            );
          })}
      </div>

      {/* Main Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white flex-1">{graphicTitles[currentGraphic]}</h2>
          <button
            onClick={() => window.open(currentUrl, '_blank')}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Open Full Size
          </button>
          <button
            onClick={() => copyUrl(currentGraphic)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
          >
            Copy URL
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center bg-zinc-950 p-4 min-w-0 min-h-0">
          <div
            ref={previewContainerRef}
            className={`relative w-full h-full max-w-[960px] max-h-[540px] rounded-lg overflow-hidden shadow-2xl ${
              isTransparent ? 'bg-checkered' : 'bg-black'
            }`}
            style={{
              aspectRatio: '16 / 9',
              ...(isTransparent ? {
                background: 'repeating-conic-gradient(#222 0% 25%, #1a1a1a 0% 50%) 50% / 20px 20px'
              } : {})
            }}
          >
            {previewScale != null && (
              <iframe
                src={currentUrl}
                className="w-[1920px] h-[1080px] origin-top-left absolute top-0 left-0"
                style={{ transform: `scale(${previewScale})` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Config Panel */}
      <div className="w-80 bg-zinc-900 border-l border-zinc-800 p-5 overflow-y-auto flex-shrink-0">
        {/* Dynamic tabs based on team count */}
        <div className="flex flex-wrap gap-1 mb-4">
          <button
            onClick={() => setActiveTab('meet')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'meet'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Meet
          </button>
          {/* Generate team tabs dynamically based on teamCount */}
          {Array.from({ length: teamCount }, (_, i) => i + 1).map((num) => (
            <button
              key={`team${num}`}
              onClick={() => setActiveTab(`team${num}`)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === `team${num}`
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              T{num}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('urls')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'urls'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            URLs
          </button>
          <button
            onClick={() => setActiveTab('interview')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'interview'
                ? 'bg-amber-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Interview
          </button>
        </div>

        {/* Competition type indicator */}
        {config?.compType && (
          <div className="mb-4 px-2 py-1.5 bg-zinc-800 rounded text-xs text-zinc-400">
            {config.compType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} ({teamCount} teams)
          </div>
        )}

        {activeTab === 'meet' && (
          <div>
            <ConfigInput label="Event Name" value={formData.eventName} onChange={(v) => updateFormData({ eventName: v })} />
            <ConfigInput label="Meet Date" value={formData.meetDate} onChange={(v) => updateFormData({ meetDate: v })} />
            <ConfigInput label="Venue" value={formData.venue} onChange={(v) => updateFormData({ venue: v })} />
            <ConfigInput label="Location" value={formData.location} onChange={(v) => updateFormData({ location: v })} />
            <ConfigTextarea label="Hosts (one per line)" value={formData.hosts} onChange={(v) => updateFormData({ hosts: v })} />
          </div>
        )}

        {/* Event Calendar config - shown when event-calendar graphic is selected */}
        {currentGraphic === 'event-calendar' && (() => {
          let calendarEventsList = [];
          try { calendarEventsList = JSON.parse(formData.calendarEvents || '[]'); } catch { calendarEventsList = []; }
          if (!Array.isArray(calendarEventsList)) calendarEventsList = [];

          const updateCalendarEvents = (newList) => {
            updateFormData({ calendarEvents: JSON.stringify(newList) });
          };
          const updateEvent = (index, field, value) => {
            const updated = [...calendarEventsList];
            updated[index] = { ...updated[index], [field]: value };
            updateCalendarEvents(updated);
          };
          const addEvent = () => {
            updateCalendarEvents([...calendarEventsList, { date: '', name: '', location: '' }]);
          };
          const removeEvent = (index) => {
            updateCalendarEvents(calendarEventsList.filter((_, i) => i !== index));
          };
          const moveEvent = (index, dir) => {
            const updated = [...calendarEventsList];
            const swapIdx = index + dir;
            if (swapIdx < 0 || swapIdx >= updated.length) return;
            [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
            updateCalendarEvents(updated);
          };

          return (
            <div className="mb-4 p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Event Calendar Settings</h3>
              <ConfigInput
                label="Header Title"
                value={formData.calendarTitle}
                onChange={(v) => updateFormData({ calendarTitle: v })}
                placeholder="Event Calendar"
              />

              <label className="block text-xs text-zinc-400 mb-1.5">Events ({calendarEventsList.length})</label>
              {!calendarJsonMode && <div className="space-y-2 mb-2">
                {calendarEventsList.map((evt, i) => (
                  <div key={i} className="p-2 bg-zinc-900 rounded border border-zinc-700">
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-[10px] text-zinc-500 font-mono w-4">{i + 1}</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => moveEvent(i, -1)}
                        disabled={i === 0}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-30 px-1"
                        title="Move up"
                      >&#9650;</button>
                      <button
                        onClick={() => moveEvent(i, 1)}
                        disabled={i === calendarEventsList.length - 1}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-30 px-1"
                        title="Move down"
                      >&#9660;</button>
                      <button
                        onClick={() => removeEvent(i)}
                        className="text-[10px] text-red-400 hover:text-red-300 px-1"
                        title="Remove event"
                      >&times;</button>
                    </div>
                    <input
                      type="text"
                      value={evt.date || ''}
                      onChange={(e) => updateEvent(i, 'date', e.target.value)}
                      placeholder="Date (e.g. March 15)"
                      className="w-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded px-2 py-1 mb-1 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={evt.name || ''}
                      onChange={(e) => updateEvent(i, 'name', e.target.value)}
                      placeholder="Event name (e.g. vs UCLA)"
                      className="w-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded px-2 py-1 mb-1 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={evt.location || ''}
                      onChange={(e) => updateEvent(i, 'location', e.target.value)}
                      placeholder="Location (optional)"
                      className="w-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>}
              {!calendarJsonMode && (
                <button
                  onClick={addEvent}
                  className="w-full text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded px-2 py-1.5 mb-2 transition-colors"
                >+ Add Event</button>
              )}

              <button
                onClick={() => setCalendarJsonMode(!calendarJsonMode)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 mb-2 transition-colors"
              >{calendarJsonMode ? 'Switch to visual editor' : 'Edit as JSON'}</button>

              {calendarJsonMode && (
                <div className="mb-2">
                  <ConfigTextarea
                    label="Events (JSON array)"
                    value={formData.calendarEvents}
                    onChange={(v) => updateFormData({ calendarEvents: v })}
                    rows={6}
                  />
                  <p className="text-[10px] text-zinc-500 -mt-2 mb-2">
                    Format: [&#123;"date":"Mar 15","name":"vs UCLA","location":"LA, CA"&#125;, ...]
                  </p>
                </div>
              )}

              <div className="mb-2">
                <label className="block text-xs text-zinc-400 mb-1.5">Layout</label>
                <select
                  value={formData.calendarColumns}
                  onChange={(e) => updateFormData({ calendarColumns: e.target.value })}
                  className="w-full text-xs bg-zinc-900 text-zinc-300 border border-zinc-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="auto">Auto (2 cols at 7+)</option>
                  <option value="1">Single Column</option>
                  <option value="2">Two Columns</option>
                </select>
              </div>
            </div>
          );
        })()}

        {/* Cycle settings - shown only for sponsors-cycle */}
        {currentGraphic === 'sponsors-cycle' && activeSponsorList.length > 0 && (
          <div className="mb-4 p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Cycle Settings</h3>

            {/* Switching speed */}
            <div className="mb-3">
              <label className="text-[10px] text-zinc-500 block mb-1">Switch Speed</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCycleDuration(d => Math.max(1, d - 1))}
                  className="w-6 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded-l text-zinc-300 text-xs font-bold transition-colors"
                >−</button>
                <span className="w-12 text-center text-sm font-mono text-zinc-300">{cycleDuration}s</span>
                <button
                  onClick={() => setCycleDuration(d => Math.min(30, d + 1))}
                  className="w-6 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded-r text-zinc-300 text-xs font-bold transition-colors"
                >+</button>
                {cycleDuration !== 3 && (
                  <button
                    onClick={() => setCycleDuration(3)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 ml-1"
                  >Reset</button>
                )}
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={cycleDuration}
                onChange={(e) => setCycleDuration(Number(e.target.value))}
                className="w-full h-1 accent-blue-500 mt-1"
              />
            </div>

            {/* Sponsor enable/disable toggles */}
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Include in Cycle</label>
              <div className="space-y-1">
                {activeSponsorList.slice(0, 8).map((sponsor, index) => {
                  const isExcluded = excludedSponsors.includes(index);
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setExcludedSponsors(prev =>
                          prev.includes(index)
                            ? prev.filter(i => i !== index)
                            : [...prev, index]
                        );
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left ${
                        isExcluded
                          ? 'bg-zinc-900/50 opacity-40'
                          : 'bg-zinc-900 hover:bg-zinc-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isExcluded
                          ? 'border-zinc-600 bg-zinc-800'
                          : 'border-blue-500 bg-blue-600'
                      }`}>
                        {!isExcluded && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      {sponsor.url && (
                        <img
                          src={sponsor.url}
                          alt=""
                          className="w-6 h-6 object-contain bg-white rounded flex-shrink-0"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      )}
                      <span className={`text-xs truncate ${isExcluded ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
                        {sponsor.name || `Sponsor ${index + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {excludedSponsors.length > 0 && (
                <button
                  onClick={() => setExcludedSponsors([])}
                  className="mt-2 text-[10px] text-blue-400 hover:text-blue-300"
                >Include All</button>
              )}
            </div>
          </div>
        )}

        {/* Sponsor logo adjustments - shown when a sponsor graphic is selected */}
        {currentGraphic.startsWith('sponsors-') && activeSponsorList.length > 0 && (
          <SponsorAdjustControls
            sponsors={activeSponsorList}
            getOverride={(index) => {
              const ov = sponsorOverrides[index] || {};
              const s = activeSponsorList[index] || {};
              return {
                scale: ov.scale ?? s.scale ?? 100,
                offsetX: ov.offsetX ?? s.offsetX ?? 0,
                offsetY: ov.offsetY ?? s.offsetY ?? 0,
                cropX: ov.cropX ?? s.cropX ?? null,
                cropY: ov.cropY ?? s.cropY ?? null,
                cropW: ov.cropW ?? s.cropW ?? null,
                cropH: ov.cropH ?? s.cropH ?? null,
              };
            }}
            onUpdate={(index, fieldOrBatch, value) => {
              // Support both single field updates and batch: onUpdate(i, 'field', val) or onUpdate(i, { field: val, ... })
              const updates = typeof fieldOrBatch === 'object' ? fieldOrBatch : { [fieldOrBatch]: value };

              // Update local state immediately for responsive UI
              setSponsorOverrides(prev => {
                const existing = prev[index] || {};
                const s = activeSponsorList[index] || {};
                return {
                  ...prev,
                  [index]: {
                    scale: existing.scale ?? s.scale ?? 100,
                    offsetX: existing.offsetX ?? s.offsetX ?? 0,
                    offsetY: existing.offsetY ?? s.offsetY ?? 0,
                    cropX: existing.cropX ?? s.cropX ?? null,
                    cropY: existing.cropY ?? s.cropY ?? null,
                    cropW: existing.cropW ?? s.cropW ?? null,
                    cropH: existing.cropH ?? s.cropH ?? null,
                    ...updates,
                  },
                };
              });

              // Normalize default values to null for clean Firebase storage
              const persistData = { ...updates };
              for (const [k, v] of Object.entries(persistData)) {
                if (k === 'scale' && v === 100) persistData[k] = null;
                if ((k === 'offsetX' || k === 'offsetY') && v === 0) persistData[k] = null;
              }

              // Persist to Firebase based on sponsor source
              if (activeSponsorSource === 'theme' && config?.meetTheme) {
                update(ref(db, `themes/${config.meetTheme}/sponsors/${index}`), persistData).catch(err => {
                  console.error('Failed to persist sponsor adjustment:', err);
                });
              } else if (activeSponsorSource === 'team' && teamSponsorsRaw[index]) {
                const sponsor = teamSponsorsRaw[index];
                saveSponsor(teamHomeKey, sponsor.key, {
                  name: sponsor.name, url: sponsor.url, tier: sponsor.tier, order: sponsor.order,
                  scale: sponsor.scale, offsetX: sponsor.offsetX, offsetY: sponsor.offsetY,
                  cropX: sponsor.cropX, cropY: sponsor.cropY, cropW: sponsor.cropW, cropH: sponsor.cropH,
                  ...persistData,
                }).catch(err => {
                  console.error('Failed to persist team sponsor adjustment:', err);
                });
              }
            }}
            selectedIndex={selectedSponsorIndex}
            onSelectIndex={setSelectedSponsorIndex}
            showBounds={showSponsorBounds}
            onToggleBounds={() => setShowSponsorBounds(prev => !prev)}
            showGuides={showSponsorGuides}
            onToggleGuides={() => setShowSponsorGuides(prev => !prev)}
          />
        )}

        {/* Dynamic team tabs - render for each team in the competition */}
        {Array.from({ length: teamCount }, (_, i) => i + 1).map((num) => (
          activeTab === `team${num}` && (
            <div key={`team${num}-content`}>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Team {num}</h3>
              <ConfigInput
                label="Team Name"
                value={formData[`team${num}Name`]}
                onChange={(v) => updateFormData({ [`team${num}Name`]: v })}
              />
              <ConfigInput
                label="Logo URL"
                value={formData[`team${num}Logo`]}
                onChange={(v) => updateFormData({ [`team${num}Logo`]: v })}
                placeholder="https://..."
              />
              <div className="grid grid-cols-3 gap-2">
                <ConfigInput
                  label="AVG"
                  value={formData[`team${num}Ave`]}
                  onChange={(v) => updateFormData({ [`team${num}Ave`]: v })}
                />
                <ConfigInput
                  label="HIGH"
                  value={formData[`team${num}High`]}
                  onChange={(v) => updateFormData({ [`team${num}High`]: v })}
                />
                <ConfigInput
                  label="NQS"
                  value={formData[`team${num}Nqs`]}
                  onChange={(v) => updateFormData({ [`team${num}Nqs`]: v })}
                />
              </div>
              {/* Stat Type Selector for team-stats graphic */}
              {currentGraphic === `team${num}-stats` && (
                <div className="mb-4 p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                  <label className="block text-xs text-zinc-400 mb-1.5">Display Stat Type</label>
                  <select
                    value={teamStatTypes[num] || 'avg'}
                    onChange={(e) => setTeamStatTypes(prev => ({ ...prev, [num]: e.target.value }))}
                    className="w-full text-xs bg-zinc-900 text-zinc-300 border border-zinc-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                  >
                    <option value="avg">Season Average (AVG)</option>
                    <option value="nqs">NQS</option>
                    <option value="high">Season High (HIGH)</option>
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Selected: {teamStatTypes[num] === 'nqs' ? 'NQS' : teamStatTypes[num] === 'high' ? 'HIGH' : 'AVG'} = {
                      teamStatTypes[num] === 'nqs' ? (formData[`team${num}Nqs`] || '—') :
                      teamStatTypes[num] === 'high' ? (formData[`team${num}High`] || '—') :
                      (formData[`team${num}Ave`] || '—')
                    }
                  </p>
                </div>
              )}
              <ConfigTextarea
                label="Coaches (one per line)"
                value={formData[`team${num}Coaches`]}
                onChange={(v) => updateFormData({ [`team${num}Coaches`]: v })}
                rows={3}
              />
              {compId && num <= 2 && (
                <button
                  onClick={handleRefreshTeamData}
                  disabled={refreshing}
                  className="w-full px-3 py-2 text-xs bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors disabled:opacity-50"
                >
                  {refreshing ? 'Fetching...' : 'Fetch Team Data from RTN'}
                </button>
              )}
            </div>
          )
        ))}

        {activeTab === 'urls' && (
          <div>
            <p className="text-xs text-zinc-500 mb-4">Copy these URLs into OBS as Browser Sources (1920x1080)</p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {Object.keys(graphicTitles).map((g) => (
                <div key={g} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-zinc-300">{graphicTitles[g]}</span>
                    <button
                      onClick={() => copyUrl(g)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-600 break-all">{generateURL(g)}</div>
                </div>
              ))}
            </div>
            <button
              onClick={copyAllUrls}
              className="w-full mt-4 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors"
            >
              Copy All URLs
            </button>
          </div>
        )}

        {activeTab === 'interview' && (() => {
          const selectedTeam = icTeamKey ? allTeams[icTeamKey] : null;
          const teamLogo = selectedTeam?.logo || '';
          const baseUrl = window.location.origin;
          const icParams = new URLSearchParams();
          if (icCoachName) icParams.set('name', icCoachName);
          if (icTitle) icParams.set('title', icTitle);
          if (teamLogo) icParams.set('logo', teamLogo);
          if (config?.meetTheme) icParams.set('meetTheme', config.meetTheme);
          if (icSeries) icParams.set('series', icSeries);
          if (icBgImage) icParams.set('bgImage', icBgImage);
          if (icEventLogo) icParams.set('eventLogo', icEventLogo);
          const icUrl = `${baseUrl}/overlays/interview-card.html?${icParams.toString()}`;
          const sortedTeams = Object.entries(allTeams)
            .sort(([,a], [,b]) => (a.displayName || '').localeCompare(b.displayName || ''));

          return (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Interview Card</h3>

              <div className="mb-4">
                <label className="block text-xs text-zinc-400 mb-1.5">Team</label>
                <select
                  value={icTeamKey}
                  onChange={(e) => setIcTeamKey(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select team...</option>
                  {sortedTeams.map(([key, team]) => (
                    <option key={key} value={key}>{team.displayName || key}</option>
                  ))}
                </select>
              </div>

              {selectedTeam && selectedTeam.logo && (
                <div className="mb-4 flex justify-center">
                  <img src={selectedTeam.logo} alt="" className="h-16 w-16 object-contain" />
                </div>
              )}

              <ConfigInput label="Coach Name" value={icCoachName} onChange={setIcCoachName} placeholder="e.g. Barb Cordova" />
              <ConfigInput label="Title" value={icTitle} onChange={setIcTitle} placeholder="HEAD COACH" />
              <ConfigInput label="Series Label" value={icSeries} onChange={setIcSeries} placeholder="Behind the Chalk" />
              <ConfigInput label="Background Image URL" value={icBgImage} onChange={setIcBgImage} placeholder="https://..." />
              <ConfigInput label="Event Logo URL" value={icEventLogo} onChange={setIcEventLogo} placeholder="https://..." />

              {/* Generated URL */}
              <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="text-xs text-zinc-400 mb-2">Interview Card URL</div>
                <div className="text-[10px] text-zinc-500 break-all mb-3 max-h-20 overflow-y-auto">{icUrl}</div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(icUrl);
                    setToast('Interview card URL copied!');
                    setTimeout(() => setToast(''), 2000);
                  }}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-500 transition-colors"
                >
                  Copy URL
                </button>
              </div>
            </div>
          );
        })()}

        {/* Save to Competition Button */}
        {compId && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <button
              onClick={saveToFirebase}
              disabled={saving || !hasChanges}
              className={`w-full px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
                hasChanges
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Saving...' : hasChanges ? 'Save to Competition' : 'No Changes'}
            </button>
            {hasChanges && (
              <p className="text-xs text-yellow-500 mt-2 text-center">Unsaved changes</p>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-400 mb-2">Current Graphic URL</div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[10px] text-zinc-500 break-all max-h-24 overflow-y-auto">
            {currentUrl}
          </div>
          <button
            onClick={() => copyUrl(currentGraphic)}
            className="w-full mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
          >
            Copy URL for OBS
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 px-5 py-3 bg-green-500 text-white rounded-lg font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function GraphicSection({ title, children }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function GraphicSidebarButton({ id, label, number, renderer, active, onClick }) {
  // Badge color: teal for stage (new), gray for overlay/output (legacy)
  const badgeClasses = renderer === 'stage'
    ? 'bg-teal-500/20 text-teal-400'
    : 'bg-zinc-700 text-zinc-400';

  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors flex items-center gap-2 ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-transparent border border-zinc-800 text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {number && <span className={`text-xs w-5 ${active ? 'text-blue-200' : 'text-zinc-500'}`}>{number}</span>}
      <span className="flex-1 truncate">{label}</span>
      {renderer && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${badgeClasses} ${active ? 'opacity-80' : ''}`}>
          {renderer}
        </span>
      )}
    </button>
  );
}

function ConfigInput({ label, value, onChange, placeholder }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function ConfigTextarea({ label, value, onChange, rows = 2 }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
      />
    </div>
  );
}
