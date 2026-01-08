import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCompetition } from '../hooks/useCompetitions';
import { graphicButtons, getApparatusButtons, transparentGraphics } from '../lib/graphicButtons';

const graphicTitles = {
  logos: 'Team Logos',
  'event-bar': 'Event Info Bar',
  hosts: 'Hosts',
  'team1-stats': 'Team 1 Stats',
  'team1-coaches': 'Team 1 Coaches',
  'team2-stats': 'Team 2 Stats',
  'team2-coaches': 'Team 2 Coaches',
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
};

const eventTitles = {
  floor: 'FLOOR EXERCISE',
  pommel: 'POMMEL HORSE',
  rings: 'STILL RINGS',
  vault: 'VAULT',
  pbars: 'PARALLEL BARS',
  hbar: 'HORIZONTAL BAR',
  ubars: 'UNEVEN BARS',
  beam: 'BALANCE BEAM',
  allaround: 'ALL AROUND',
  final: 'FINAL SCORES',
  order: 'COMPETITION ORDER',
  lineups: 'NEXT EVENT LINEUPS',
  summary: 'EVENT SUMMARY',
};

export default function UrlGeneratorPage() {
  const [searchParams] = useSearchParams();
  const compId = searchParams.get('comp');

  const { config } = useCompetition(compId);

  const [currentGraphic, setCurrentGraphic] = useState('logos');
  const [activeTab, setActiveTab] = useState('meet');
  const [toast, setToast] = useState('');
  const [formData, setFormData] = useState({
    eventName: 'Big Ten Dual Meet',
    meetDate: 'January 15, 2025',
    venue: 'Crisler Center',
    location: 'Ann Arbor, MI',
    hosts: 'John Smith\nSarah Johnson',
    team1Name: 'Michigan',
    team1Logo: '',
    team1Ave: '406.850',
    team1High: '409.200',
    team1Con: '94.2%',
    team1Coaches: 'Kurt Golder\nBrian Coddington\nTyler Balthazor',
    team2Name: 'Ohio State',
    team2Logo: '',
    team2Ave: '403.450',
    team2High: '406.100',
    team2Con: '92.8%',
    team2Coaches: 'Rustam Sharipov\nSergio Santana\nJames Moore',
  });

  // Load config from Firebase if competition is selected
  useEffect(() => {
    if (config) {
      setFormData({
        eventName: config.eventName || '',
        meetDate: config.meetDate || '',
        venue: config.venue || '',
        location: config.location || '',
        hosts: config.hosts || '',
        team1Name: config.team1Name || '',
        team1Logo: config.team1Logo || '',
        team1Ave: config.team1Ave || '',
        team1High: config.team1High || '',
        team1Con: config.team1Con || '',
        team1Coaches: config.team1Coaches || '',
        team2Name: config.team2Name || '',
        team2Logo: config.team2Logo || '',
        team2Ave: config.team2Ave || '',
        team2High: config.team2High || '',
        team2Con: config.team2Con || '',
        team2Coaches: config.team2Coaches || '',
      });
    }
  }, [config]);

  const baseUrl = window.location.origin + '/';

  const generateURL = (graphic) => {
    const team1Logo = formData.team1Logo || 'https://via.placeholder.com/200/00274C/FFCB05?text=T1';
    const team2Logo = formData.team2Logo || 'https://via.placeholder.com/200/BB0000/FFFFFF?text=T2';
    const encode = encodeURIComponent;

    switch (graphic) {
      case 'logos':
        return `${baseUrl}overlays/logos.html?team1Logo=${encode(team1Logo)}&team2Logo=${encode(team2Logo)}`;
      case 'event-bar':
        return `${baseUrl}overlays/event-bar.html?team1Logo=${encode(team1Logo)}&venue=${encode(formData.venue)}&eventName=${encode(formData.eventName)}&location=${encode(formData.location)}`;
      case 'hosts':
        return `${baseUrl}overlays/hosts.html?hosts=${encode(formData.hosts.split('\n').join('|'))}`;
      case 'team1-stats':
        return `${baseUrl}overlays/team-stats.html?teamName=${encode(formData.team1Name)}&logo=${encode(team1Logo)}&ave=${encode(formData.team1Ave)}&high=${encode(formData.team1High)}&con=${encode(formData.team1Con)}`;
      case 'team1-coaches':
        return `${baseUrl}overlays/coaches.html?logo=${encode(team1Logo)}&coaches=${encode(formData.team1Coaches.split('\n').join('|'))}`;
      case 'team2-stats':
        return `${baseUrl}overlays/team-stats.html?teamName=${encode(formData.team2Name)}&logo=${encode(team2Logo)}&ave=${encode(formData.team2Ave)}&high=${encode(formData.team2High)}&con=${encode(formData.team2Con)}`;
      case 'team2-coaches':
        return `${baseUrl}overlays/coaches.html?logo=${encode(team2Logo)}&coaches=${encode(formData.team2Coaches.split('\n').join('|'))}`;
      case 'floor':
      case 'pommel':
      case 'rings':
      case 'vault':
      case 'pbars':
      case 'hbar':
      case 'ubars':
      case 'beam':
      case 'allaround':
      case 'final':
      case 'order':
      case 'lineups':
      case 'summary':
        return `${baseUrl}overlays/event-frame.html?title=${encode(eventTitles[graphic])}&logo=${encode(team1Logo)}`;
      case 'starting':
        return `${baseUrl}overlays/stream.html?title=STREAM%20STARTING%20SOON&logo=${encode(team1Logo)}&eventName=${encode(formData.eventName)}&meetDate=${encode(formData.meetDate)}`;
      case 'thanks':
        return `${baseUrl}overlays/stream.html?title=THANKS%20FOR%20WATCHING&logo=${encode(team1Logo)}&eventName=${encode(formData.eventName)}&meetDate=${encode(formData.meetDate)}`;
      default:
        return '';
    }
  };

  const currentUrl = useMemo(() => generateURL(currentGraphic), [currentGraphic, formData]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2000);
  };

  const copyUrl = (graphic) => {
    navigator.clipboard.writeText(generateURL(graphic));
    showToast(`Copied: ${graphicTitles[graphic]}`);
  };

  const copyAllUrls = () => {
    const allUrls = Object.keys(graphicTitles)
      .map((g) => `${graphicTitles[g]}:\n${generateURL(g)}`)
      .join('\n\n');
    navigator.clipboard.writeText(allUrls);
    showToast('All URLs copied!');
  };

  const isTransparent = transparentGraphics.includes(currentGraphic);

  const apparatusButtons = getApparatusButtons(config?.compType || 'mens-dual');

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
          {graphicButtons.preMeet.map((btn) => (
            <GraphicSidebarButton
              key={btn.id}
              {...btn}
              active={currentGraphic === btn.id}
              onClick={() => setCurrentGraphic(btn.id)}
            />
          ))}
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
        <div className="flex gap-1 mb-4">
          {['meet', 'team1', 'team2', 'urls'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {tab === 'meet' ? 'Meet Info' : tab === 'team1' ? 'Team 1' : tab === 'team2' ? 'Team 2' : 'All URLs'}
            </button>
          ))}
        </div>

        {activeTab === 'meet' && (
          <div>
            <ConfigInput label="Event Name" value={formData.eventName} onChange={(v) => setFormData({ ...formData, eventName: v })} />
            <ConfigInput label="Meet Date" value={formData.meetDate} onChange={(v) => setFormData({ ...formData, meetDate: v })} />
            <ConfigInput label="Venue" value={formData.venue} onChange={(v) => setFormData({ ...formData, venue: v })} />
            <ConfigInput label="Location" value={formData.location} onChange={(v) => setFormData({ ...formData, location: v })} />
            <ConfigTextarea label="Hosts (one per line)" value={formData.hosts} onChange={(v) => setFormData({ ...formData, hosts: v })} />
          </div>
        )}

        {activeTab === 'team1' && (
          <div>
            <ConfigInput label="Team Name" value={formData.team1Name} onChange={(v) => setFormData({ ...formData, team1Name: v })} />
            <ConfigInput label="Logo URL" value={formData.team1Logo} onChange={(v) => setFormData({ ...formData, team1Logo: v })} placeholder="https://..." />
            <div className="grid grid-cols-3 gap-2">
              <ConfigInput label="AVE" value={formData.team1Ave} onChange={(v) => setFormData({ ...formData, team1Ave: v })} />
              <ConfigInput label="HIGH" value={formData.team1High} onChange={(v) => setFormData({ ...formData, team1High: v })} />
              <ConfigInput label="CON" value={formData.team1Con} onChange={(v) => setFormData({ ...formData, team1Con: v })} />
            </div>
            <ConfigTextarea label="Coaches (one per line)" value={formData.team1Coaches} onChange={(v) => setFormData({ ...formData, team1Coaches: v })} rows={4} />
          </div>
        )}

        {activeTab === 'team2' && (
          <div>
            <ConfigInput label="Team Name" value={formData.team2Name} onChange={(v) => setFormData({ ...formData, team2Name: v })} />
            <ConfigInput label="Logo URL" value={formData.team2Logo} onChange={(v) => setFormData({ ...formData, team2Logo: v })} placeholder="https://..." />
            <div className="grid grid-cols-3 gap-2">
              <ConfigInput label="AVE" value={formData.team2Ave} onChange={(v) => setFormData({ ...formData, team2Ave: v })} />
              <ConfigInput label="HIGH" value={formData.team2High} onChange={(v) => setFormData({ ...formData, team2High: v })} />
              <ConfigInput label="CON" value={formData.team2Con} onChange={(v) => setFormData({ ...formData, team2Con: v })} />
            </div>
            <ConfigTextarea label="Coaches (one per line)" value={formData.team2Coaches} onChange={(v) => setFormData({ ...formData, team2Coaches: v })} rows={4} />
          </div>
        )}

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
