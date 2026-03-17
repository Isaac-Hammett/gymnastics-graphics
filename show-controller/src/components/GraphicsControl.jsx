import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db, ref, set, get, onValue, push, remove } from '../lib/firebase';
import { PhotoIcon, XMarkIcon, ClipboardDocumentIcon, CheckIcon, Cog6ToothIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/solid';
import useEventConfig from '../hooks/useEventConfig';
import useTeamsDatabase from '../hooks/useTeamsDatabase';
import { getGraphicsForCompetition, getGraphicsByCategory } from '../lib/graphicsRegistry';

// Category to section mapping for display
const CATEGORY_TO_SECTION = {
  'pre-meet': 'Pre-Meet',
  'in-meet': 'In-Meet',
  'frame-overlays': 'Frame Overlays',
  'stream': 'Stream',
  'sponsors': 'Sponsors',
};

// Event button mapping for different genders (uses eventConfig IDs)
// These map internal event IDs to display-friendly button configs
const eventButtonConfig = {
  floor: { id: 'floor', label: 'Floor', title: 'FLOOR EXERCISE' },
  pommel: { id: 'pommel', label: 'Pommel Horse', title: 'POMMEL HORSE' },
  rings: { id: 'rings', label: 'Still Rings', title: 'STILL RINGS' },
  vault: { id: 'vault', label: 'Vault', title: 'VAULT' },
  pBars: { id: 'pbars', label: 'Parallel Bars', title: 'PARALLEL BARS' },
  hBar: { id: 'hbar', label: 'High Bar', title: 'HORIZONTAL BAR' },
  bars: { id: 'ubars', label: 'Uneven Bars', title: 'UNEVEN BARS' },
  beam: { id: 'beam', label: 'Balance Beam', title: 'BALANCE BEAM' },
};

// Common event buttons that appear for all genders
const commonEventButtons = [
  { id: 'allaround', label: 'All-Around', title: 'ALL-AROUND' },
  { id: 'final', label: 'Final Scores', title: 'FINAL SCORES' },
];

// Leaderboard button mapping (uses short names for display)
const leaderboardButtonConfig = {
  floor: { id: 'leaderboard-fx', label: 'FX Leaders', leaderboardEvent: 'fx' },
  pommel: { id: 'leaderboard-ph', label: 'PH Leaders', leaderboardEvent: 'ph' },
  rings: { id: 'leaderboard-sr', label: 'SR Leaders', leaderboardEvent: 'sr' },
  vault: { id: 'leaderboard-vt', label: 'VT Leaders', leaderboardEvent: 'vt' },
  pBars: { id: 'leaderboard-pb', label: 'PB Leaders', leaderboardEvent: 'pb' },
  hBar: { id: 'leaderboard-hb', label: 'HB Leaders', leaderboardEvent: 'hb' },
  bars: { id: 'leaderboard-ub', label: 'UB Leaders', leaderboardEvent: 'ub' },
  beam: { id: 'leaderboard-bb', label: 'BB Leaders', leaderboardEvent: 'bb' },
};

// AA leaderboard is always available
const commonLeaderboardButtons = [
  { id: 'leaderboard-aa', label: 'AA Leaders', leaderboardEvent: 'aa' },
];

// All possible event frame IDs (for both genders)
const eventFrames = ['floor', 'pommel', 'rings', 'vault', 'pbars', 'hbar', 'ubars', 'beam', 'allaround', 'final'];

const OUTPUT_BASE_URL = 'https://commentarygraphic.com/output.html';
const LOCAL_OUTPUT_URL = 'http://localhost:3003/output.html';

const teamCounts = {
  'mens-dual': 2, 'womens-dual': 2,
  'mens-tri': 3, 'womens-tri': 3,
  'mens-quad': 4, 'womens-quad': 4,
  'mens-5': 5, 'womens-5': 5,
  'mens-6': 6, 'womens-6': 6,
  'womens-7': 7
};

// Available themes for Event Summary
// Layout themes (start with 'layout-') change the entire structure
// Color themes just change colors of the default layout
const summaryThemes = [
  // LAYOUTS - Different structural designs
  { id: 'layout-broadcast-table', label: '🎴 Hero Cards', isLayout: true },
  { id: 'layout-classic-broadcast', label: '📺 Classic Broadcast', isLayout: true },
  { id: 'layout-default-v2', label: '✨ Default V2', isLayout: true },
  { id: 'layout-default-v3', label: '📊 V3 Full Height', isLayout: true },
  { id: 'layout-default-v4', label: '🏆 V4 Rankings', isLayout: true },
  { id: 'layout-default-v5', label: '📦 V5 Compact', isLayout: true },
  { id: 'layout-default-v6', label: '🃏 V6 Cards', isLayout: true },
  { id: 'layout-default-v7', label: '📊 V7 Progress Bars', isLayout: true },
  { id: 'layout-default-v8', label: '⬜ V8 Light Minimal', isLayout: true },
  { id: 'layout-default-v9', label: '🔵 V9 Bold Blue', isLayout: true },
  { id: 'layout-default-v10', label: '🔢 V10 Score Focus', isLayout: true },
  { id: 'layout-default-v11', label: '📋 V11 Blue Accent', isLayout: true },
  { id: 'layout-default-v12', label: '🌈 V12 Gradient Rows', isLayout: true },
  { id: 'layout-default-v13', label: '🖼️ V13 Split Header', isLayout: true },
  { id: 'layout-default-v14', label: '⬇️ V14 Big Footer', isLayout: true },
  { id: 'layout-default-v15', label: '🔶 V15 Orange Badges', isLayout: true },
  { id: 'layout-default-v16', label: '🟣 V16 Purple Theme', isLayout: true },
  { id: 'layout-default-v17', label: '💚 V17 Green Scores', isLayout: true },
  { id: 'layout-default-v18', label: '🎨 V18 Team Colors', isLayout: true },
  { id: 'layout-default-v19', label: '📐 V19 Dense Compact', isLayout: true },
  { id: 'layout-default-v20', label: '⭐ V20 Combined Best', isLayout: true },
  { id: 'layout-default-v21', label: '📺 V21 Extra Large', isLayout: true },
  { id: 'layout-default-v22', label: '🏅 V22 Integrated Rank', isLayout: true },
  { id: 'layout-default-v23', label: '📋 V23 No Rankings', isLayout: true },
  { id: 'layout-default-v24', label: '🎨 V24 Meet Theme', isLayout: true },
  { id: 'layout-split-row', label: '📊 Split Row (5-team)', isLayout: true },
  { id: 'layout-dual-dynamic-v1', label: '📏 Dual Dynamic V1', isLayout: true },
  { id: 'layout-dual-dynamic-v2', label: '📏 Dual Dynamic V2', isLayout: true },
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

// Map Virtius event names to display names
const eventDisplayNames = {
  'FLOOR': 'Floor Exercise',
  'HORSE': 'Pommel Horse',
  'RINGS': 'Still Rings',
  'VAULT': 'Vault',
  'PBARS': 'Parallel Bars',
  'BAR': 'High Bar',
};

export default function GraphicsControl({ competitionId }) {
  const [currentGraphic, setCurrentGraphic] = useState(null);
  const [currentGraphicId, setCurrentGraphicId] = useState(null); // Track the specific button ID (e.g., 'floor', 'pommel')
  const [config, setConfig] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedTheme, setCopiedTheme] = useState(false);
  const [summaryTheme, setSummaryTheme] = useState('default');
  const [liveAthletes, setLiveAthletes] = useState([]); // Athletes currently competing - now read from Firebase
  const [scoreBugPolling, setScoreBugPolling] = useState(false); // Whether scoreBug overlay is polling
  const [customGraphics, setCustomGraphics] = useState({}); // Custom URL graphics for this competition
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [slateLayout, setSlateLayout] = useState('classic');

  // Use competitionId directly from props (no local state needed)
  const compId = competitionId || '';

  // Get gender-specific event configuration
  const { events, eventIds, rotationCount, gender } = useEventConfig(config?.compType);

  // Get teams database for sponsor data
  const { getTeamSponsors, resolveSchoolKey } = useTeamsDatabase();

  // Build dynamic graphic buttons based on competition gender and team names
  const graphicButtons = useMemo(() => {
    const maxTeams = teamCounts[config?.compType] || 2;

    // Build team names object from config
    const teamNames = {};
    for (let i = 1; i <= maxTeams; i++) {
      teamNames[i] = config?.[`team${i}Name`] || `Team ${i}`;
    }

    // Get graphics from registry with dynamic labels
    const registryGraphics = getGraphicsForCompetition(config?.compType, teamNames);

    // Build base graphic buttons from registry (pre-meet, in-meet, frame-overlays, stream, sponsors)
    const baseGraphicButtons = registryGraphics
      .filter(g => ['pre-meet', 'in-meet', 'frame-overlays', 'stream', 'sponsors'].includes(g.category))
      .map(g => ({
        id: g.id,
        label: g.label,
        section: CATEGORY_TO_SECTION[g.category] || g.category,
        team: g.team,
      }));

    // Build leaderboard buttons from gender-specific events
    const leaderboardButtons = eventIds
      .map(eventId => leaderboardButtonConfig[eventId])
      .filter(Boolean)
      .map(btn => ({ ...btn, section: 'Leaderboards' }));

    return [
      ...baseGraphicButtons,
      ...leaderboardButtons,
      ...commonLeaderboardButtons.map(btn => ({ ...btn, section: 'Leaderboards' })),
    ];
  }, [eventIds, config]);

  // Build apparatus buttons for Event Summary (gender-specific)
  const apparatusButtons = useMemo(() => {
    return events.map(event => ({
      id: event.shortName.toLowerCase(),
      label: event.shortName,
    }));
  }, [events]);

  // Load competition config
  useEffect(() => {
    if (!compId) return;

    const configRef = ref(db, `competitions/${compId}/config`);
    const unsubscribe = onValue(configRef, (snapshot) => {
      setConfig(snapshot.val());
    });

    return () => unsubscribe();
  }, [compId]);

  // Listen for current graphic state
  useEffect(() => {
    if (!compId) return;

    const graphicRef = ref(db, `competitions/${compId}/currentGraphic`);
    const unsubscribe = onValue(graphicRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.graphic === 'clear') {
        setCurrentGraphic(null);
        setCurrentGraphicId(null);
      } else {
        setCurrentGraphic(data?.graphic);
        // For event-frame, extract the specific event from graphicId or frameTitle
        setCurrentGraphicId(data?.graphicId || null);
      }
    });

    return () => unsubscribe();
  }, [compId]);

  // Listen to Firebase for now-competing athletes (written by team-bug.html overlay)
  useEffect(() => {
    if (!compId) {
      setLiveAthletes([]);
      setScoreBugPolling(false);
      return;
    }

    // Listen for detected now-competing athletes from scoreBug overlay
    const nowCompetingRef = ref(db, `competitions/${compId}/scoreBug/detected/nowCompeting`);
    const unsubscribeNowCompeting = onValue(nowCompetingRef, (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        // Transform to match existing liveAthletes format
        const athletes = data.map(entry => ({
          id: entry.athlete?.id,
          name: entry.athlete?.name,
          team: entry.teamName,
          teamTricode: entry.tricode,
          event: entry.eventName,
          eventDisplay: eventDisplayNames[entry.eventName] || entry.eventName,
          order: entry.athlete?.order,
        }));
        setLiveAthletes(athletes);
      } else {
        setLiveAthletes([]);
      }
    });

    // Listen for scoreBug polling state to show status indicator
    const pollingRef = ref(db, `competitions/${compId}/scoreBug/config/polling`);
    const unsubscribePolling = onValue(pollingRef, (snapshot) => {
      setScoreBugPolling(snapshot.val() === true);
    });

    return () => {
      unsubscribeNowCompeting();
      unsubscribePolling();
    };
  }, [compId]);

  // Listen for custom graphics
  useEffect(() => {
    if (!compId) {
      setCustomGraphics({});
      return;
    }

    const customRef = ref(db, `competitions/${compId}/customGraphics`);
    const unsubscribe = onValue(customRef, (snapshot) => {
      setCustomGraphics(snapshot.val() || {});
    });

    return () => unsubscribe();
  }, [compId]);

  // Add a custom graphic
  const addCustomGraphic = () => {
    if (!compId || !newCustomLabel.trim() || !newCustomUrl.trim()) return;

    const customRef = ref(db, `competitions/${compId}/customGraphics`);
    push(customRef, {
      label: newCustomLabel.trim(),
      url: newCustomUrl.trim(),
    });

    setNewCustomLabel('');
    setNewCustomUrl('');
    setShowAddCustom(false);
  };

  // Delete a custom graphic
  const deleteCustomGraphic = (customId) => {
    if (!compId) return;
    remove(ref(db, `competitions/${compId}/customGraphics/${customId}`));
  };

  // Send a custom graphic to the output
  const sendCustomGraphic = (customId, customGraphic) => {
    if (!compId) return;

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'custom',
      graphicId: `custom-${customId}`,
      data: {
        customUrl: customGraphic.url,
        customLabel: customGraphic.label,
      },
      timestamp: Date.now(),
    });
  };

  const sendGraphic = async (graphicId, frameTitle = null, leaderboardEvent = null) => {
    if (!compId || !config) return;

    const data = {
      eventName: config.eventName || '',
      meetDate: config.meetDate || '',
      venue: config.venue || '',
      location: config.location || '',
      hosts: config.hosts || '',
      virtiusSessionId: config.virtiusSessionId || '',
      // Team 1
      team1Name: config.team1Name || '',
      team1Logo: config.team1Logo || '',
      team1Ave: config.team1Ave || '',
      team1High: config.team1High || '',
      team1Con: config.team1Con || '',
      team1Coaches: config.team1Coaches || '',
      // Team 2
      team2Name: config.team2Name || '',
      team2Logo: config.team2Logo || '',
      team2Ave: config.team2Ave || '',
      team2High: config.team2High || '',
      team2Con: config.team2Con || '',
      team2Coaches: config.team2Coaches || '',
      // Team 3
      team3Name: config.team3Name || '',
      team3Logo: config.team3Logo || '',
      team3Ave: config.team3Ave || '',
      team3High: config.team3High || '',
      team3Con: config.team3Con || '',
      team3Coaches: config.team3Coaches || '',
      // Team 4
      team4Name: config.team4Name || '',
      team4Logo: config.team4Logo || '',
      team4Ave: config.team4Ave || '',
      team4High: config.team4High || '',
      team4Con: config.team4Con || '',
      team4Coaches: config.team4Coaches || '',
      // Team 5
      team5Name: config.team5Name || '',
      team5Logo: config.team5Logo || '',
      team5Ave: config.team5Ave || '',
      team5High: config.team5High || '',
      team5Con: config.team5Con || '',
      team5Coaches: config.team5Coaches || '',
      // Team 6
      team6Name: config.team6Name || '',
      team6Logo: config.team6Logo || '',
      team6Ave: config.team6Ave || '',
      team6High: config.team6High || '',
      team6Con: config.team6Con || '',
      team6Coaches: config.team6Coaches || '',
      // Team 7
      team7Name: config.team7Name || '',
      team7Logo: config.team7Logo || '',
      team7Ave: config.team7Ave || '',
      team7High: config.team7High || '',
      team7Con: config.team7Con || '',
      team7Coaches: config.team7Coaches || '',
    };

    if (frameTitle) {
      data.frameTitle = frameTitle;
    }

    if (leaderboardEvent) {
      data.leaderboardEvent = leaderboardEvent;
      data.leaderboardGender = gender; // Pass gender for column visibility (women don't have Exec/SB)
    }

    // Handle event calendar - load events from competition config
    if (graphicId === 'event-calendar') {
      data.calendarTitle = config.calendarTitle || 'Event Calendar';
      data.calendarEvents = config.calendarEvents || '[]';
      data.calendarColumns = config.calendarColumns || 'auto';
    }

    // Handle sponsor graphics - check for event sponsors from theme first, then fall back to team sponsors
    if (graphicId.startsWith('sponsors-')) {
      let sponsorsFound = false;

      // Check if competition has a theme with event sponsors
      if (config.meetTheme) {
        try {
          const themeRef = ref(db, `themes/${config.meetTheme}/sponsors`);
          const snapshot = await get(themeRef);
          const eventSponsors = snapshot.val();
          if (eventSponsors && Array.isArray(eventSponsors) && eventSponsors.length > 0) {
            // Use event sponsors from theme (include all adjustment fields)
            data.sponsors = JSON.stringify(eventSponsors.slice(0, 8).map(s => ({
              name: s.name || '',
              url: s.url || '',
              ...(s.scale != null && s.scale !== 100 ? { scale: s.scale } : {}),
              ...(s.offsetX ? { offsetX: s.offsetX } : {}),
              ...(s.offsetY ? { offsetY: s.offsetY } : {}),
              ...(s.cropX != null ? { cropX: s.cropX } : {}),
              ...(s.cropY != null ? { cropY: s.cropY } : {}),
              ...(s.cropW != null ? { cropW: s.cropW } : {}),
              ...(s.cropH != null ? { cropH: s.cropH } : {}),
            })));
            sponsorsFound = true;
          }
        } catch (err) {
          console.error('Error fetching theme sponsors:', err);
        }
      }

      // Fallback to team sponsors if no event sponsors
      if (!sponsorsFound) {
        // Resolve home team key from team name (includes gender suffix)
        const schoolKey = resolveSchoolKey(config.team1Name);
        // Add gender suffix to get full team key (e.g., "west-chester" -> "west-chester-womens")
        const homeTeamKey = schoolKey ? `${schoolKey}-${gender}` : null;
        if (homeTeamKey) {
          const teamSponsors = getTeamSponsors(homeTeamKey);
          // Convert to JSON for the overlay (include all adjustment fields)
          data.sponsors = JSON.stringify(teamSponsors.slice(0, 8).map(s => ({
            name: s.name,
            url: s.url,
            ...(s.scale != null && s.scale !== 100 ? { scale: s.scale } : {}),
            ...(s.offsetX ? { offsetX: s.offsetX } : {}),
            ...(s.offsetY ? { offsetY: s.offsetY } : {}),
            ...(s.cropX != null ? { cropX: s.cropX } : {}),
            ...(s.cropY != null ? { cropY: s.cropY } : {}),
            ...(s.cropW != null ? { cropW: s.cropW } : {}),
            ...(s.cropH != null ? { cropH: s.cropH } : {}),
          })));
        } else {
          data.sponsors = '[]';
        }
      }
    }

    // Determine graphic type
    let graphicType = graphicId;
    if (eventFrames.includes(graphicId)) {
      graphicType = 'event-frame';
    } else if (graphicId.startsWith('leaderboard-')) {
      graphicType = 'virtius-leaderboard';
    } else if (graphicId.match(/^team\d+-roster$/)) {
      graphicType = 'team-roster';
    }

    // Include graphicId in data for renderers that need it
    data.graphicId = graphicId;

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: graphicType,
      graphicId: graphicId, // Store the specific button ID for highlighting
      data: data,
      timestamp: Date.now()
    });
  };

  // Send rotation slate graphic with specific rotation number
  const sendRotationSlate = (rotation) => {
    if (!compId || !config) return;

    const data = {
      eventName: config.eventName || 'GYMNASTICS',
      team1Logo: config.team1Logo || '',
      rotation: String(rotation),
      meetTheme: config.meetTheme || '',
      layout: slateLayout || 'classic',
    };

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'rotation-slate',
      graphicId: `rotation-slate-r${rotation}`,
      data: data,
      timestamp: Date.now()
    });
  };

  // Send auto-updating rotation slate (polls Virtius API)
  const sendAutoSlate = () => {
    if (!compId || !config) return;

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'rotation-slate-auto',
      graphicId: 'rotation-slate-auto',
      data: {
        compId: compId,
        layout: slateLayout || 'classic',
        meetTheme: config.meetTheme || '',
      },
      timestamp: Date.now()
    });
  };

  // Send event summary graphic - can be rotation-based (R1-R4/R1-R6) or apparatus-based (gender-specific events)
  const sendEventSummary = (mode, value) => {
    if (!compId || !config) return;

    const maxTeams = teamCounts[config.compType] || 2;

    // Dual meets use alternating format for rotation-based view
    // (home team on one event, away team on adjacent event, swapping each rotation)
    const isDual = config.compType?.includes('dual');

    let graphicId, data;

    if (mode === 'rotation') {
      // Rotation mode: for dual meets, use alternating format (teams on different events)
      // Men's: R1: Home=FX, Away=PH | R2: swap | R3: Home=SR, Away=VT | etc.
      // Women's: R1: Home=VT, Away=UB | R2: swap | R3: Home=BB, Away=FX | R4: swap
      // For multi-team meets (tri, quad), each team is on a different event per rotation
      graphicId = `summary-r${value}`;
      data = {
        virtiusSessionId: config.virtiusSessionId || '',
        summaryMode: 'rotation',
        summaryRotation: value,
        summaryNumTeams: maxTeams,
        summaryFormat: isDual ? 'alternating' : 'rotation', // 'alternating' for dual, 'rotation' for multi-team
        summaryTheme: summaryTheme,
        summaryGender: gender, // Gender for determining correct events
        team1Logo: config.team1Logo || '',
        team1Name: config.team1Name || '',
        team2Name: config.team2Name || '',
      };
    } else {
      // Apparatus mode: show both teams' scores for the same event (head-to-head view)
      graphicId = `summary-${value}`;
      data = {
        virtiusSessionId: config.virtiusSessionId || '',
        summaryMode: 'apparatus',
        summaryApparatus: value, // e.g., 'fx', 'ph', 'sr', 'vt', 'pb', 'hb', 'ub', 'bb'
        summaryNumTeams: maxTeams,
        summaryFormat: 'head-to-head', // Always head-to-head for apparatus mode
        summaryTheme: summaryTheme,
        summaryGender: gender, // Gender for determining correct events
        team1Logo: config.team1Logo || '',
        team1Name: config.team1Name || '',
        team2Name: config.team2Name || '',
      };
    }

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'event-summary',
      graphicId: graphicId,
      data: data,
      timestamp: Date.now()
    });
  };

  const clearGraphic = () => {
    if (!compId) return;

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'clear',
      data: {},
      timestamp: Date.now()
    });
  };

  // Send "Now Competing" graphic for a specific athlete
  const sendNowCompeting = (athlete) => {
    if (!compId || !config) return;

    // Find the team logo based on the athlete's team
    const maxTeams = teamCounts[config.compType] || 2;
    let athleteLogo = config.team1Logo || '';
    for (let i = 1; i <= maxTeams; i++) {
      if (config[`team${i}Name`] === athlete.team ||
          config[`team${i}Tricode`]?.toUpperCase() === athlete.teamTricode?.toUpperCase()) {
        athleteLogo = config[`team${i}Logo`] || '';
        break;
      }
    }

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: 'now-competing',
      graphicId: `now-competing-${athlete.id}`,
      data: {
        athleteName: athlete.name,
        athleteTeam: athlete.team,
        athleteEvent: athlete.eventDisplay,
        athleteLogo: athleteLogo,
        team1Logo: config.team1Logo || '',
      },
      timestamp: Date.now()
    });
  };

  const sections = ['Pre-Meet', 'In-Meet', 'Frame Overlays', 'Leaderboards', 'Stream', 'Sponsors'];

  const outputUrl = compId ? `${OUTPUT_BASE_URL}?comp=${compId}` : '';
  const localOutputUrl = compId ? `${LOCAL_OUTPUT_URL}?comp=${compId}` : '';

  const copyOutputUrl = () => {
    if (!outputUrl) return;
    navigator.clipboard.writeText(outputUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const themeOutputUrl = compId && config?.meetTheme ? `${OUTPUT_BASE_URL}?comp=${compId}&meetTheme=${config.meetTheme}` : '';

  const copyThemeUrl = () => {
    if (!themeOutputUrl) return;
    navigator.clipboard.writeText(themeOutputUrl);
    setCopiedTheme(true);
    setTimeout(() => setCopiedTheme(false), 2000);
  };

  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-wide">
          <PhotoIcon className="w-4 h-4" />
          Web Graphics
        </div>
        {currentGraphic && (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
            {currentGraphic}
          </span>
        )}
      </div>

      {/* Copy Output URL & URL Generator */}
      {compId && (
        <div className="mb-4 space-y-2">
          <button
            onClick={copyOutputUrl}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
            }`}
          >
            {copied ? (
              <>
                <CheckIcon className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy Output URL
              </>
            )}
          </button>
          {config?.meetTheme && (
            <button
              onClick={copyThemeUrl}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                copiedTheme
                  ? 'bg-green-600 text-white'
                  : 'bg-purple-700 hover:bg-purple-600 text-zinc-100'
              }`}
            >
              {copiedTheme ? (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-4 h-4" />
                  Copy Theme URL
                </>
              )}
            </button>
          )}
          <a
            href={localOutputUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-700 hover:bg-amber-600 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
          >
            Local Output
          </a>
          <Link
            to={`/url-generator?comp=${compId}`}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            URL Generator
          </Link>
        </div>
      )}

      {compId && config ? (
        <>
          {/* Graphic Buttons by Section */}
          {sections.map((section) => {
            // Get max teams for this competition type
            const maxTeams = teamCounts[config.compType] || 2;

            // Filter buttons by section and team count
            // Exclude rotation-slate from regular buttons - it gets its own rotation selector
            const sectionButtons = graphicButtons.filter((btn) => {
              if (btn.section !== section) return false;
              if (btn.id === 'rotation-slate') return false; // Handle separately below
              // If button has a team number, only show if within max teams
              if (btn.team && btn.team > maxTeams) return false;
              return true;
            });

            return (
              <div key={section} className="mb-4">
                <div className="text-xs text-zinc-500 uppercase mb-2">{section}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {sectionButtons.map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => sendGraphic(btn.id, btn.title, btn.leaderboardEvent)}
                      className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                        currentGraphicId === btn.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                {/* Rotation Slate buttons - shown after In-Meet section */}
                {section === 'In-Meet' && (
                  <>
                    <div className="flex items-center justify-between mt-3 mb-1">
                      <div className="text-xs text-zinc-600">Rotation Slate</div>
                      <select
                        value={slateLayout}
                        onChange={(e) => setSlateLayout(e.target.value)}
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
                    <div className={`grid gap-1.5 ${rotationCount <= 4 ? 'grid-cols-4' : rotationCount <= 6 ? 'grid-cols-6' : 'grid-cols-7'}`}>
                      {Array.from({ length: rotationCount }, (_, i) => i + 1).map((rotation) => {
                        const graphicId = `rotation-slate-r${rotation}`;
                        return (
                          <button
                            key={rotation}
                            onClick={() => sendRotationSlate(rotation)}
                            className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                              currentGraphicId === graphicId
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                            }`}
                          >
                            R{rotation}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => sendAutoSlate()}
                      className={`mt-1.5 w-full px-2 py-2 rounded text-xs font-medium transition-colors ${
                        currentGraphicId === 'rotation-slate-auto'
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      Auto (Live)
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {/* Event Summary Section - Rotation and Apparatus buttons */}
          {config.virtiusSessionId && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-zinc-500 uppercase">Event Summary</div>
                <select
                  value={summaryTheme}
                  onChange={(e) => setSummaryTheme(e.target.value)}
                  className="text-xs bg-zinc-700 text-zinc-300 border border-zinc-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                  {summaryThemes.map((theme) => (
                    <option key={theme.id} value={theme.id}>{theme.label}</option>
                  ))}
                </select>
              </div>
              {/* Rotation buttons - dynamic based on gender (R1-R6 for mens, R1-R4 for womens) */}
              <div className="text-xs text-zinc-600 mb-1">By Rotation (Alternating)</div>
              <div className={`grid gap-1.5 mb-2 ${rotationCount <= 4 ? 'grid-cols-4' : rotationCount <= 6 ? 'grid-cols-6' : 'grid-cols-7'}`}>
                {Array.from({ length: rotationCount }, (_, i) => i + 1).map((rotation) => {
                  const graphicId = `summary-r${rotation}`;
                  return (
                    <button
                      key={rotation}
                      onClick={() => sendEventSummary('rotation', rotation)}
                      className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                        currentGraphicId === graphicId
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      R{rotation}
                    </button>
                  );
                })}
              </div>
              {/* Apparatus buttons - dynamic based on gender */}
              <div className="text-xs text-zinc-600 mb-1">By Apparatus</div>
              <div className={`grid gap-1.5 ${apparatusButtons.length === 4 ? 'grid-cols-4' : 'grid-cols-6'}`}>
                {apparatusButtons.map((apparatus) => {
                  const graphicId = `summary-${apparatus.id}`;
                  return (
                    <button
                      key={apparatus.id}
                      onClick={() => sendEventSummary('apparatus', apparatus.id)}
                      className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                        currentGraphicId === graphicId
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      {apparatus.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Now Competing Section - Live athletes from Firebase (via team-bug overlay) */}
          {config.virtiusSessionId && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-zinc-500 uppercase">Now Competing</div>
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    scoreBugPolling
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {scoreBugPolling ? 'Live' : 'Polling Off'}
                </span>
              </div>
              {scoreBugPolling ? (
                liveAthletes.length > 0 ? (
                  <div className="space-y-1.5">
                    {liveAthletes.map((athlete) => (
                      <button
                        key={athlete.id}
                        onClick={() => sendNowCompeting(athlete)}
                        className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                          currentGraphicId === `now-competing-${athlete.id}`
                            ? 'bg-green-600 text-white'
                            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold">{athlete.name}</span>
                            <span className="text-zinc-400 ml-2">({athlete.teamTricode || athlete.team})</span>
                          </div>
                          <span className="text-zinc-400">{athlete.eventDisplay}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 text-center py-3 bg-zinc-700/50 rounded">
                    No athletes currently competing
                  </div>
                )
              ) : (
                <div className="text-xs text-zinc-500 text-center py-3 bg-zinc-700/50 rounded">
                  Enable polling in Score Bug panel
                </div>
              )}
            </div>
          )}

          {/* Custom Graphics Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500 uppercase">Custom Graphics</div>
              <button
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="text-xs px-2 py-1 rounded font-medium bg-teal-700 hover:bg-teal-600 text-white transition-colors flex items-center gap-1"
              >
                <PlusIcon className="w-3 h-3" />
                Add
              </button>
            </div>

            {/* Add Custom Graphic Form */}
            {showAddCustom && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-2 space-y-2">
                <input
                  type="text"
                  placeholder="Label (e.g. Halftime Show)"
                  value={newCustomLabel}
                  onChange={(e) => setNewCustomLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500"
                />
                <input
                  type="text"
                  placeholder="URL (e.g. https://example.com/graphic.html)"
                  value={newCustomUrl}
                  onChange={(e) => setNewCustomUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addCustomGraphic}
                    disabled={!newCustomLabel.trim() || !newCustomUrl.trim()}
                    className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded text-sm font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowAddCustom(false); setNewCustomLabel(''); setNewCustomUrl(''); }}
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Custom Graphic Buttons */}
            {Object.keys(customGraphics).length > 0 ? (
              <div className="space-y-1.5">
                {Object.entries(customGraphics).map(([id, cg]) => (
                  <div key={id} className="flex items-center gap-1.5">
                    <button
                      onClick={() => sendCustomGraphic(id, cg)}
                      className={`flex-1 text-left px-3 py-2 rounded text-xs font-medium transition-colors truncate ${
                        currentGraphicId === `custom-${id}`
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                      title={cg.url}
                    >
                      {cg.label}
                    </button>
                    <button
                      onClick={() => deleteCustomGraphic(id)}
                      className="p-2 rounded bg-zinc-700 hover:bg-red-600 text-zinc-400 hover:text-white transition-colors shrink-0"
                      title="Delete custom graphic"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : !showAddCustom && (
              <div className="text-xs text-zinc-500 text-center py-3 bg-zinc-700/50 rounded">
                No custom graphics added
              </div>
            )}
          </div>

          {/* Clear Button */}
          <button
            onClick={clearGraphic}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
            Clear Graphic
          </button>
        </>
      ) : (
        <div className="text-zinc-500 text-sm text-center py-4">
          {compId ? 'Loading config...' : 'Select a competition to control graphics'}
        </div>
      )}
    </div>
  );
}
