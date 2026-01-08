import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompetitions } from '../hooks/useCompetitions';

export default function HubPage() {
  const { competitions, loading } = useCompetitions();
  const [selectedComp, setSelectedComp] = useState('');

  const competitionList = Object.keys(competitions);
  const selectedConfig = selectedComp ? competitions[selectedComp]?.config : null;

  const teams = selectedConfig
    ? [selectedConfig.team1Name, selectedConfig.team2Name, selectedConfig.team3Name, selectedConfig.team4Name, selectedConfig.team5Name, selectedConfig.team6Name].filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-zinc-950 p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-2">Gymnastics Graphics Hub</h1>
          <p className="text-zinc-500">Central hub for all graphics tools and components</p>
        </div>

        {/* Competition Selector */}
        <div className="bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 mb-8">
          <div className="text-sm font-semibold text-zinc-400 mb-3">Select a Competition</div>
          <select
            value={selectedComp}
            onChange={(e) => setSelectedComp(e.target.value)}
            className="w-full max-w-md px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Choose a competition...</option>
            {competitionList.map((compId) => (
              <option key={compId} value={compId}>
                {compId} - {competitions[compId]?.config?.eventName || 'Untitled'}
              </option>
            ))}
          </select>

          {selectedConfig && (
            <>
              <div className="mt-3 text-sm text-zinc-500">
                <span className="text-blue-500 font-semibold">{selectedConfig.eventName || 'Untitled'}</span>
                {' - '}{selectedConfig.meetDate || 'No date'}<br />
                {teams.join(' vs ')} at {selectedConfig.venue || 'TBD'}
              </div>

              <div className="flex gap-3 flex-wrap mt-4">
                <Link
                  to={`/controller?comp=${selectedComp}`}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
                >
                  Open Controller
                </Link>
                <a
                  href={`/output.html?comp=${selectedComp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Open Output
                </a>
                <Link
                  to="/producer"
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Show Controller
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Management Tools */}
        <Section title="Management Tools">
          <Card
            to="/dashboard"
            icon="📊"
            title="Dashboard"
            description="Create and manage competitions. Configure team names, logos, and meet details."
            badge="Start Here"
            badgeColor="primary"
          />
          <Card
            to="/url-generator"
            icon="🔗"
            title="URL Generator"
            description="Generate overlay URLs with custom parameters for OBS browser sources."
          />
        </Section>

        {/* Competition Tools */}
        {selectedComp && (
          <Section title={`Competition Tools - ${selectedComp}`}>
            <Card
              to={`/controller?comp=${selectedComp}`}
              icon="🎮"
              title="Graphics Controller"
              description="Trigger graphics live during the event. Configure team stats and trigger overlays."
              badge="Live Control"
              badgeColor="green"
            />
            <ExternalCard
              href={`/output.html?comp=${selectedComp}`}
              icon="📺"
              title="Graphics Output"
              description="The actual graphics display. Add this as a browser source in OBS."
              badge="1920x1080"
            />
            <Card
              to="/producer"
              icon="🎛️"
              title="Producer View"
              description="Control the show flow, trigger scenes, and manage graphics from one panel."
            />
            <Card
              to="/talent"
              icon="🎤"
              title="Talent View"
              description="Simplified view for on-air talent showing current segment and notes."
            />
          </Section>
        )}

        {/* Overlay Templates */}
        <Section title="Overlay Templates">
          <ExternalCard
            href="/overlays/logos.html"
            icon="🏆"
            title="Team Logos"
            description="Display team logos. Supports 2-6 teams with automatic layout adjustment."
          />
          <ExternalCard
            href="/overlays/team-stats.html"
            icon="📈"
            title="Team Stats"
            description="Show team statistics including average, high score, and consistency."
          />
          <ExternalCard
            href="/overlays/coaches.html"
            icon="👥"
            title="Coaches"
            description="Display coaching staff with team logo."
          />
          <ExternalCard
            href="/overlays/hosts.html"
            icon="🎙️"
            title="Hosts"
            description="Show broadcast hosts and commentators."
          />
          <ExternalCard
            href="/overlays/event-bar.html"
            icon="📍"
            title="Event Bar"
            description="Lower-third event info bar with venue and location."
          />
          <ExternalCard
            href="/overlays/event-frame.html"
            icon="🖼️"
            title="Event Frame"
            description="Full-screen event title frame for transitions."
          />
          <ExternalCard
            href="/overlays/stream.html"
            icon="📡"
            title="Stream Cards"
            description="Starting soon and thanks for watching screens."
          />
        </Section>

        {/* Show Controller App */}
        <Section title="Show Controller App">
          <Card
            to="/producer"
            icon="🎬"
            title="Producer View"
            description="Full control panel for managing live shows with scene control."
          />
          <Card
            to="/talent"
            icon="🎤"
            title="Talent View"
            description="Simplified view for on-air talent with segment info and notes."
          />
          <Card
            to="/import"
            icon="📥"
            title="Import Show Plan"
            description="Import show plans from CSV files."
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 pb-2 border-b border-zinc-800">
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {children}
      </div>
    </div>
  );
}

function Card({ to, icon, title, description, badge, badgeColor }) {
  return (
    <Link
      to={to}
      className="block bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 hover:border-blue-500 hover:-translate-y-0.5 transition-all"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-lg font-bold text-white mb-2">{title}</div>
      <div className="text-sm text-zinc-500 leading-relaxed">{description}</div>
      {badge && (
        <span className={`inline-block mt-3 px-3 py-1 rounded text-xs uppercase font-semibold ${
          badgeColor === 'primary' ? 'bg-blue-600 text-white' :
          badgeColor === 'green' ? 'bg-green-500 text-black' :
          'bg-zinc-800 text-zinc-400'
        }`}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function ExternalCard({ href, icon, title, description, badge }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 hover:border-blue-500 hover:-translate-y-0.5 transition-all"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-lg font-bold text-white mb-2">{title}</div>
      <div className="text-sm text-zinc-500 leading-relaxed">{description}</div>
      {badge && (
        <span className="inline-block mt-3 px-3 py-1 bg-zinc-800 text-zinc-400 rounded text-xs uppercase font-semibold">
          {badge}
        </span>
      )}
    </a>
  );
}
