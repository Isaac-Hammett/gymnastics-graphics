import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCompetition, useCompetitions } from '../hooks/useCompetitions';
import { useTeamsDatabase } from '../hooks/useTeamsDatabase';
import { graphicButtons, getApparatusButtons, getPreMeetButtons, getLeaderboardButtons, getEventSummaryRotationButtons, getEventSummaryApparatusButtons, transparentGraphics, isTransparentGraphic } from '../lib/graphicButtons';
import { getTeamCount, getGenderFromCompType } from '../lib/competitionUtils';
import { generateGraphicURL, copyToClipboard } from '../lib/urlBuilder';
import { db, ref, get } from '../lib/firebase';
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

// Base graphic titles (team-specific ones are generated dynamically)
const baseGraphicTitles = {
  logos: 'Team Logos',
  'event-bar': 'Event Info Bar',
  'warm-up': 'Warm Up',
  hosts: 'Hosts',
  floor: 'Floor Exercise',
  pommel: 'Pommel Horse',
  rings: 'Still Rings',
  vault: 'Vault',
  pbars: 'Parallel Bars',
  hbar: 'Horizontal Bar',
  ubars: 'Uneven Bars',
  beam: 'Balance Beam',
  allaround: 'All Around',
  final: 'Final Scores',
  order: 'Competition Order',
  lineups: 'Next Event Lineups',
  summary: 'Event Summary',
  starting: 'Stream Starting Soon',
  thanks: 'Thanks for Watching',
  // In-Meet
  replay: 'Instant Replay',
  'rotation-slate': 'Rotation Slate',
  'rotation-slate-auto': 'Rotation Slate (Auto)',
  // Frame Overlays
  'frame-quad': 'Quad View',
  'frame-tri-center': 'Tri Center',
  'frame-tri-wide': 'Tri Wide',
  'frame-tri-wide-top': 'Tri Wide Top',
  'frame-team-header': 'Team Header',
  'frame-single': 'Single',
  // Leaderboards
  'leaderboard-fx': 'Floor Leaderboard',
  'leaderboard-ph': 'Pommel Horse Leaderboard',
  'leaderboard-sr': 'Still Rings Leaderboard',
  'leaderboard-vt': 'Vault Leaderboard',
  'leaderboard-pb': 'Parallel Bars Leaderboard',
  'leaderboard-hb': 'High Bar Leaderboard',
  'leaderboard-ub': 'Uneven Bars Leaderboard',
  'leaderboard-bb': 'Balance Beam Leaderboard',
  'leaderboard-aa': 'All-Around Leaderboard',
  // Event Summary Rotations
  'summary-r1': 'Event Summary - Rotation 1',
  'summary-r2': 'Event Summary - Rotation 2',
  'summary-r3': 'Event Summary - Rotation 3',
  'summary-r4': 'Event Summary - Rotation 4',
  'summary-r5': 'Event Summary - Rotation 5',
  'summary-r6': 'Event Summary - Rotation 6',
  // Event Summary Apparatus
  'summary-fx': 'Event Summary - Floor',
  'summary-ph': 'Event Summary - Pommel Horse',
  'summary-sr': 'Event Summary - Still Rings',
  'summary-vt': 'Event Summary - Vault',
  'summary-pb': 'Event Summary - Parallel Bars',
  'summary-hb': 'Event Summary - High Bar',
  'summary-ub': 'Event Summary - Uneven Bars',
  'summary-bb': 'Event Summary - Balance Beam',
  // Sponsors
  'sponsors-thanks': 'Thank You Sponsors',
  'sponsors-cycle': 'Cycling Sponsors',
  'sponsors-bug': 'Sponsor Bug',
  // Event Calendar
  'event-calendar': 'Event Calendar',
};

// Generate team-specific graphic titles dynamically
function getGraphicTitles(teamCount) {
  const titles = { ...baseGraphicTitles };
  for (let i = 1; i <= teamCount; i++) {
    titles[`team${i}-stats`] = `Team ${i} Stats`;
    titles[`team${i}-coaches`] = `Team ${i} Coaches`;
  }
  return titles;
}

export default function UrlGeneratorPage() {
  const [searchParams] = useSearchParams();
  const compId = searchParams.get('comp');

  const { config } = useCompetition(compId);
  const { updateCompetition, refreshTeamData } = useCompetitions();
  const { getTeamSponsors, resolveSchoolKey } = useTeamsDatabase();
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
  const [sponsorOverrides, setSponsorOverrides] = useState({}); // { index: { scale, offsetX, offsetY, cropX, cropY, cropW, cropH } }
  const [selectedSponsorIndex, setSelectedSponsorIndex] = useState(-1);
  const [showSponsorBounds, setShowSponsorBounds] = useState(false);
  const [showSponsorCropControls, setShowSponsorCropControls] = useState(false);
  const [showSponsorGuides, setShowSponsorGuides] = useState(false);

  // Fetch meet theme logo and sponsors when theme is set
  useEffect(() => {
    if (!config?.meetTheme) { setMeetThemeLogo(''); setMeetThemeSponsors([]); setSponsorOverrides({}); return; }
    get(ref(db, `themes/${config.meetTheme}`)).then(snap => {
      const theme = snap.val() || {};
      setMeetThemeLogo(theme.logos?.meetLogo || '');
      const sponsors = Array.isArray(theme.sponsors) ? theme.sponsors : [];
      setMeetThemeSponsors(sponsors);
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
    team1Coaches: 'Kurt Golder\nBrian Coddington\nTyler Balthazor',
    // Team 2
    team2Name: 'Ohio State',
    team2Logo: '',
    team2Ave: '403.450',
    team2High: '406.100',
    team2Coaches: 'Rustam Sharipov\nSergio Santana\nJames Moore',
    // Team 3 (for tri/quad meets)
    team3Name: '',
    team3Logo: '',
    team3Ave: '',
    team3High: '',
    team3Coaches: '',
    // Team 4 (for quad meets)
    team4Name: '',
    team4Logo: '',
    team4Ave: '',
    team4High: '',
    team4Coaches: '',
    // Team 5
    team5Name: '',
    team5Logo: '',
    team5Ave: '',
    team5High: '',
    team5Coaches: '',
    // Team 6
    team6Name: '',
    team6Logo: '',
    team6Ave: '',
    team6High: '',
    team6Coaches: '',
    // Team 7
    team7Name: '',
    team7Logo: '',
    team7Ave: '',
    team7High: '',
    team7Coaches: '',
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

      // Load all team data (1-7)
      for (let i = 1; i <= 7; i++) {
        newFormData[`team${i}Name`] = config[`team${i}Name`] || '';
        newFormData[`team${i}Logo`] = config[`team${i}Logo`] || '';
        newFormData[`team${i}Ave`] = config[`team${i}Ave`] || '';
        newFormData[`team${i}High`] = config[`team${i}High`] || '';
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

  // Get dynamic graphic titles based on team count
  const graphicTitles = useMemo(() => getGraphicTitles(teamCount), [teamCount]);

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

  const apparatusButtons = getApparatusButtons(config?.compType || 'mens-dual');

  // Generate dynamic pre-meet buttons based on team count and names
  const teamNames = useMemo(() => {
    const names = {};
    for (let i = 1; i <= teamCount; i++) {
      if (formData[`team${i}Name`]) {
        names[i] = formData[`team${i}Name`];
      }
    }
    return names;
  }, [formData, teamCount]);

  const preMeetButtons = useMemo(() => getPreMeetButtons(teamCount, teamNames), [teamCount, teamNames]);

  // Generate frame overlay buttons
  const frameOverlayButtons = graphicButtons.frameOverlays;

  // Generate leaderboard buttons (gender-aware)
  const leaderboardButtons = useMemo(() => getLeaderboardButtons(config?.compType), [config?.compType]);

  // Generate event summary buttons (gender-aware)
  const summaryRotationButtons = useMemo(() => getEventSummaryRotationButtons(config?.compType), [config?.compType]);
  const summaryApparatusButtons = useMemo(() => getEventSummaryApparatusButtons(config?.compType), [config?.compType]);

  // Resolve home team key for sponsor lookups
  const resolveHomeTeamKey = (formData, config) => {
    if (!formData.team1Name) return null;
    const gender = config?.compType?.startsWith('mens') ? 'mens' : 'womens';
    const schoolKey = resolveSchoolKey(formData.team1Name);
    if (!schoolKey) return null;
    return `${schoolKey}-${gender}`;
  };

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
      } else {
        const homeTeamKey = resolveHomeTeamKey(formData, config);
        if (homeTeamKey) {
          const teamSponsors = getTeamSponsors(homeTeamKey);
          const capped = teamSponsors.slice(0, 8).map(s => ({ name: s.name, url: s.url }));
          sponsorsJson = JSON.stringify(capped);
        }
      }
    }
    return generateGraphicURL(graphic, formData, teamCount, undefined, {
      compType: config?.compType,
      virtiusSessionId: config?.virtiusSessionId,
      compId: compId,
      summaryTheme: summaryTheme,
      sponsors: sponsorsJson,
      rotation: rotationSlateNum,
      layout: slateLayout,
      meetTheme: config?.meetTheme,
      meetThemeLogo,
      // Sponsor editing aids (only for preview, not for production URLs)
      ...(graphic.startsWith('sponsors-') && selectedSponsorIndex >= 0 ? { lockedIndex: selectedSponsorIndex } : {}),
      ...(graphic.startsWith('sponsors-') && showSponsorBounds ? { showBounds: true } : {}),
      ...(graphic.startsWith('sponsors-') && showSponsorGuides ? { showGuides: true } : {}),
    });
  };

  // Override generateURL to use options
  const generateURL = (graphic) => {
    return generateURLWithOptions(graphic);
  };

  const currentUrl = useMemo(() => generateURL(currentGraphic), [currentGraphic, formData, teamCount, config?.compType, config?.virtiusSessionId, config?.meetTheme, summaryTheme, rotationSlateNum, slateLayout, meetThemeLogo, meetThemeSponsors, sponsorOverrides, selectedSponsorIndex, showSponsorBounds, showSponsorGuides]);

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

        <GraphicSection title="Pre-Meet">
          {preMeetButtons.map((btn) => (
            <GraphicSidebarButton
              key={btn.id}
              {...btn}
              active={currentGraphic === btn.id}
              onClick={() => setCurrentGraphic(btn.id)}
            />
          ))}
        </GraphicSection>

        <GraphicSection title="In-Meet">
          {graphicButtons.inMeet.filter(btn => btn.id !== 'rotation-slate' && btn.id !== 'rotation-slate-auto').map((btn) => (
            <GraphicSidebarButton
              key={btn.id}
              id={btn.id}
              label={btn.label}
              number={btn.number}
              active={currentGraphic === btn.id}
              onClick={() => setCurrentGraphic(btn.id)}
            />
          ))}
          {/* Rotation Slate with rotation picker */}
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
            <div className="grid grid-cols-6 gap-1">
              {['1', '2', '3', '4', '5', '6'].map((num) => (
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
            {/* Auto-updating rotation slate */}
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
        </GraphicSection>

        <GraphicSection title="Event Frames">
          {apparatusButtons.map((btn) => (
            <GraphicSidebarButton
              key={btn.id}
              id={btn.id}
              label={btn.label}
              number={btn.number}
              active={currentGraphic === btn.id}
              onClick={() => setCurrentGraphic(btn.id)}
            />
          ))}
        </GraphicSection>

        <GraphicSection title="Frame Overlays">
          {frameOverlayButtons.map((btn) => (
            <GraphicSidebarButton
              key={btn.id}
              id={btn.id}
              label={btn.label}
              number={btn.number}
              active={currentGraphic === btn.id}
              onClick={() => setCurrentGraphic(btn.id)}
            />
          ))}
        </GraphicSection>

        <GraphicSection title="Leaderboards">
          {leaderboardButtons.map((btn) => (
            <GraphicSidebarButton
              key={btn.id}
              id={btn.id}
              label={btn.label}
              active={currentGraphic === btn.id}
              onClick={() => setCurrentGraphic(btn.id)}
            />
          ))}
        </GraphicSection>

        <GraphicSection title="Event Summary">
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
          <div className="text-xs text-zinc-600 mb-1">By Rotation (Alternating)</div>
          <div className="grid grid-cols-4 gap-1 mb-2">
            {summaryRotationButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setCurrentGraphic(btn.id)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  currentGraphic === btn.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-zinc-600 mb-1">By Apparatus</div>
          <div className="grid grid-cols-4 gap-1">
            {summaryApparatusButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setCurrentGraphic(btn.id)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  currentGraphic === btn.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </GraphicSection>

        <GraphicSection title="Stream">
          <GraphicSidebarButton
            id="starting"
            label="Stream Starting"
            number={19}
            active={currentGraphic === 'starting'}
            onClick={() => setCurrentGraphic('starting')}
          />
          <GraphicSidebarButton
            id="thanks"
            label="Thanks for Watching"
            number={20}
            active={currentGraphic === 'thanks'}
            onClick={() => setCurrentGraphic('thanks')}
          />
        </GraphicSection>

        <GraphicSection title="Sponsors">
          {graphicButtons.sponsors.map((btn) => (
            <GraphicSidebarButton
              key={btn.id}
              id={btn.id}
              label={btn.label}
              number={btn.number}
              active={currentGraphic === btn.id}
              onClick={() => setCurrentGraphic(btn.id)}
            />
          ))}
        </GraphicSection>
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

        <div className="flex-1 flex items-center justify-center bg-zinc-950 p-6">
          <div
            className={`relative w-[960px] h-[540px] rounded-lg overflow-hidden shadow-2xl ${
              isTransparent ? 'bg-checkered' : 'bg-black'
            }`}
            style={isTransparent ? {
              background: 'repeating-conic-gradient(#222 0% 25%, #1a1a1a 0% 50%) 50% / 20px 20px'
            } : {}}
          >
            <iframe
              src={currentUrl}
              className="w-[1920px] h-[1080px] origin-top-left"
              style={{ transform: 'scale(0.5)' }}
            />
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

        {/* Sponsor logo adjustments - shown when a sponsor graphic is selected */}
        {currentGraphic.startsWith('sponsors-') && meetThemeSponsors.length > 0 && (
          <SponsorAdjustControls
            sponsors={meetThemeSponsors}
            getOverride={(index) => {
              const ov = sponsorOverrides[index] || {};
              const s = meetThemeSponsors[index] || {};
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
            onUpdate={(index, field, value) => {
              setSponsorOverrides(prev => {
                const existing = prev[index] || {};
                const s = meetThemeSponsors[index] || {};
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
                    [field]: value,
                  },
                };
              });
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
              <div className="grid grid-cols-2 gap-2">
                <ConfigInput
                  label="AVE"
                  value={formData[`team${num}Ave`]}
                  onChange={(v) => updateFormData({ [`team${num}Ave`]: v })}
                />
                <ConfigInput
                  label="HIGH"
                  value={formData[`team${num}High`]}
                  onChange={(v) => updateFormData({ [`team${num}High`]: v })}
                />
              </div>
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

function GraphicSidebarButton({ id, label, number, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors flex items-center gap-2 ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-transparent border border-zinc-800 text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      <span className={`text-xs w-5 ${active ? 'text-blue-200' : 'text-zinc-500'}`}>{number}</span>
      {label}
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
