import { useState, useEffect } from 'react';
import { db, ref, set, onValue } from '../lib/firebase';
import { PhotoIcon, XMarkIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/solid';

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
];

const eventFrames = ['floor', 'pommel', 'rings', 'vault', 'pbars', 'hbar', 'allaround', 'final'];

const OUTPUT_BASE_URL = 'https://virtiusgraphicsenginev001.netlify.app/output.html';

const teamCounts = {
  'mens-dual': 2, 'womens-dual': 2,
  'mens-tri': 3, 'womens-tri': 3,
  'mens-quad': 4, 'womens-quad': 4,
  'mens-5': 5,
  'mens-6': 6
};

export default function GraphicsControl({ competitionId }) {
  const [currentGraphic, setCurrentGraphic] = useState(null);
  const [config, setConfig] = useState(null);
  const [compId, setCompId] = useState(competitionId || '');
  const [competitions, setCompetitions] = useState([]);
  const [copied, setCopied] = useState(false);

  // Load available competitions
  useEffect(() => {
    const compsRef = ref(db, 'competitions');
    const unsubscribe = onValue(compsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCompetitions(Object.keys(data));
        // Auto-select first competition if none selected
        if (!compId && Object.keys(data).length > 0) {
          setCompId(Object.keys(data)[0]);
        }
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
      setCurrentGraphic(data?.graphic === 'clear' ? null : data?.graphic);
    });

    return () => unsubscribe();
  }, [compId]);

  const sendGraphic = (graphicId, frameTitle = null) => {
    if (!compId || !config) return;

    const data = {
      eventName: config.eventName || '',
      meetDate: config.meetDate || '',
      venue: config.venue || '',
      location: config.location || '',
      hosts: config.hosts || '',
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

    const graphicType = eventFrames.includes(graphicId) ? 'event-frame' : graphicId;

    set(ref(db, `competitions/${compId}/currentGraphic`), {
      graphic: graphicType,
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

  const sections = ['Pre-Meet', 'Events', 'Stream'];

  const outputUrl = compId ? `${OUTPUT_BASE_URL}?comp=${compId}` : '';

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
          {competitions.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      {/* Copy Output URL */}
      {compId && (
        <div className="mb-4">
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
                      onClick={() => sendGraphic(btn.id, btn.title)}
                      className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                        currentGraphic === btn.id ||
                        (eventFrames.includes(btn.id) && currentGraphic === 'event-frame')
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
