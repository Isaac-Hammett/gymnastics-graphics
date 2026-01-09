import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, ref, set, onValue } from '../lib/firebase';
import { PhotoIcon, XMarkIcon, ClipboardDocumentIcon, CheckIcon, Cog6ToothIcon } from '@heroicons/react/24/solid';

const graphicButtons = [
  { id: 'logos', label: 'Team Logos', section: 'Pre-Meet' },
  { id: 'event-bar', label: 'Event Info', section: 'Pre-Meet' },
  { id: 'hosts', label: 'Hosts', section: 'Pre-Meet' },
  { id: 'team1-stats', label: 'Team 1 Stats', section: 'Pre-Meet', team: 1 },
  { id: 'team1-coaches', label: 'Team 1 Coaches', section: 'Pre-Meet', team: 1 },
  { id: 'team2-stats', label: 'Team 2 Stats', section: 'Pre-Meet', team: 2 },
  { id: 'team2-coaches', label: 'Team 2 Coaches', section: 'Pre-Meet', team: 2 },
  { id: 'team3-stats', label: 'Team 3 Stats', section: 'Pre-Meet', team: 3 },
  { id: 'team3-coaches', label: 'Team 3 Coaches', section: 'Pre-Meet', team: 3 },
  { id: 'team4-stats', label: 'Team 4 Stats', section: 'Pre-Meet', team: 4 },
  { id: 'team4-coaches', label: 'Team 4 Coaches', section: 'Pre-Meet', team: 4 },
  { id: 'team5-stats', label: 'Team 5 Stats', section: 'Pre-Meet', team: 5 },
  { id: 'team5-coaches', label: 'Team 5 Coaches', section: 'Pre-Meet', team: 5 },
  { id: 'team6-stats', label: 'Team 6 Stats', section: 'Pre-Meet', team: 6 },
  { id: 'team6-coaches', label: 'Team 6 Coaches', section: 'Pre-Meet', team: 6 },
  { id: 'floor', label: 'Floor', title: 'FLOOR EXERCISE', section: 'Events' },
  { id: 'pommel', label: 'Pommel Horse', title: 'POMMEL HORSE', section: 'Events' },
  { id: 'rings', label: 'Still Rings', title: 'STILL RINGS', section: 'Events' },
  { id: 'vault', label: 'Vault', title: 'VAULT', section: 'Events' },
  { id: 'pbars', label: 'Parallel Bars', title: 'PARALLEL BARS', section: 'Events' },
  { id: 'hbar', label: 'High Bar', title: 'HORIZONTAL BAR', section: 'Events' },
  { id: 'allaround', label: 'All Around', title: 'ALL AROUND', section: 'Events' },
  { id: 'final', label: 'Final Scores', title: 'FINAL SCORES', section: 'Events' },
  { id: 'stream-starting', label: 'Starting Soon', section: 'Stream' },
  { id: 'stream-thanks', label: 'Thanks', section: 'Stream' },
  // Virtius Leaderboards
  { id: 'leaderboard-fx', label: 'FX Leaders', section: 'Leaderboards', leaderboardEvent: 'fx' },
  { id: 'leaderboard-ph', label: 'PH Leaders', section: 'Leaderboards', leaderboardEvent: 'ph' },
  { id: 'leaderboard-sr', label: 'SR Leaders', section: 'Leaderboards', leaderboardEvent: 'sr' },
  { id: 'leaderboard-vt', label: 'VT Leaders', section: 'Leaderboards', leaderboardEvent: 'vt' },
  { id: 'leaderboard-pb', label: 'PB Leaders', section: 'Leaderboards', leaderboardEvent: 'pb' },
  { id: 'leaderboard-hb', label: 'HB Leaders', section: 'Leaderboards', leaderboardEvent: 'hb' },
  { id: 'leaderboard-aa', label: 'AA Leaders', section: 'Leaderboards', leaderboardEvent: 'aa' },
];

const eventFrames = ['floor', 'pommel', 'rings', 'vault', 'pbars', 'hbar', 'allaround', 'final'];

const OUTPUT_BASE_URL = 'https://virtiusgraphicsenginev001.netlify.app/output.html';
const LOCAL_OUTPUT_URL = 'http://localhost:8080/output.html';

const teamCounts = {
  'mens-dual': 2, 'womens-dual': 2,
  'mens-tri': 3, 'womens-tri': 3,
  'mens-quad': 4, 'womens-quad': 4,
  'mens-5': 5,
  'mens-6': 6
};

// Available themes for Event Summary
const summaryThemes = [
  { id: 'default', label: 'Default' },
  { id: 'espn', label: 'ESPN' },
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

export default function GraphicsControl({ competitionId }) {
  const [currentGraphic, setCurrentGraphic] = useState(null);
  const [currentGraphicId, setCurrentGraphicId] = useState(null); // Track the specific button ID (e.g., 'floor', 'pommel')
  const [config, setConfig] = useState(null);
  const [compId, setCompId] = useState(competitionId || '');
  const [competitions, setCompetitions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [summaryTheme, setSummaryTheme] = useState('default');

  // Load available competitions with their names
  useEffect(() => {
    const compsRef = ref(db, 'competitions');
    const unsubscribe = onValue(compsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Store full competition data including config for names
        const compList = Object.entries(data).map(([id, comp]) => ({
          id,
          name: comp.config?.eventName || id
        }));
        setCompetitions(compList);
        // Auto-select first competition only on initial load (when competitionId prop wasn't provided)
        setCompId((current) => {
          if (!current && compList.length > 0) {
            return compList[0].id;
          }
          return current;
        });
      }
    });

    return () => unsubscribe();
  }, []);

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

  const sendGraphic = (graphicId, frameTitle = null, leaderboardEvent = null) => {
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
    };

    if (frameTitle) {
      data.frameTitle = frameTitle;
    }

    if (leaderboardEvent) {
      data.leaderboardEvent = leaderboardEvent;
    }

    // Determine graphic type
    let graphicType = graphicId;
    if (eventFrames.includes(graphicId)) {
      graphicType = 'event-frame';
    } else if (graphicId.startsWith('leaderboard-')) {
      graphicType = 'virtius-leaderboard';
    }

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: graphicType,
      graphicId: graphicId, // Store the specific button ID for highlighting
      data: data,
      timestamp: Date.now()
    });
  };

  // Send event summary graphic - can be rotation-based (R1-R6) or apparatus-based (FX, PH, etc.)
  const sendEventSummary = (mode, value) => {
    if (!compId || !config) return;

    const maxTeams = teamCounts[config.compType] || 2;

    // Dual meets use alternating format for rotation-based view
    // (home team on one event, away team on adjacent event, swapping each rotation)
    const isDual = config.compType?.includes('dual');

    let graphicId, data;

    if (mode === 'rotation') {
      // Rotation mode: for dual meets, use alternating format (teams on different events)
      // R1: Home=FX, Away=PH | R2: swap | R3: Home=SR, Away=VT | etc.
      graphicId = `summary-r${value}`;
      data = {
        virtiusSessionId: config.virtiusSessionId || '',
        summaryMode: 'rotation',
        summaryRotation: value,
        summaryNumTeams: maxTeams,
        summaryFormat: isDual ? 'alternating' : 'olympic',
        summaryTheme: summaryTheme,
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
        summaryApparatus: value, // e.g., 'fx', 'ph', 'sr', 'vt', 'pb', 'hb'
        summaryNumTeams: maxTeams,
        summaryFormat: 'head-to-head', // Always head-to-head for apparatus mode
        summaryTheme: summaryTheme,
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

  const sections = ['Pre-Meet', 'Events', 'Leaderboards', 'Stream'];

  const outputUrl = compId ? `${OUTPUT_BASE_URL}?comp=${compId}` : '';
  const localOutputUrl = compId ? `${LOCAL_OUTPUT_URL}?comp=${compId}` : '';

  const copyOutputUrl = () => {
    if (!outputUrl) return;
    navigator.clipboard.writeText(outputUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {/* Competition Selector */}
      <div className="mb-4">
        <select
          value={compId}
          onChange={(e) => setCompId(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm"
        >
          <option value="">Select competition...</option>
          {competitions.map((comp) => (
            <option key={comp.id} value={comp.id}>
              {comp.name} ({comp.id})
            </option>
          ))}
        </select>
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
            const sectionButtons = graphicButtons.filter((btn) => {
              if (btn.section !== section) return false;
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
              {/* Rotation buttons (R1-R6) - shows each team on their event for that rotation */}
              <div className="text-xs text-zinc-600 mb-1">By Rotation (Alternating)</div>
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {[1, 2, 3, 4, 5, 6].map((rotation) => {
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
              {/* Apparatus buttons (FX, PH, SR, VT, PB, HB) - shows both teams' scores for same event */}
              <div className="text-xs text-zinc-600 mb-1">By Apparatus</div>
              <div className="grid grid-cols-6 gap-1.5">
                {[
                  { id: 'fx', label: 'FX' },
                  { id: 'ph', label: 'PH' },
                  { id: 'sr', label: 'SR' },
                  { id: 'vt', label: 'VT' },
                  { id: 'pb', label: 'PB' },
                  { id: 'hb', label: 'HB' },
                ].map((apparatus) => {
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
