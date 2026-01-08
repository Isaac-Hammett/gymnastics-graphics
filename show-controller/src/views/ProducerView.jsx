import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShow } from '../context/ShowContext';
import CurrentSegment from '../components/CurrentSegment';
import NextSegment from '../components/NextSegment';
import RunOfShow from '../components/RunOfShow';
import ConnectionStatus from '../components/ConnectionStatus';
import GraphicsControl from '../components/GraphicsControl';
import {
  PlayIcon,
  BackwardIcon,
  ForwardIcon,
  PauseIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowPathIcon,
  StopIcon,
  UsersIcon
} from '@heroicons/react/24/solid';

export default function ProducerView() {
  const {
    state,
    advance,
    previous,
    jumpTo,
    overrideScene,
    lockTalent,
    togglePause,
    startShow,
    resetShow,
    identify,
    error
  } = useShow();

  const {
    showConfig,
    isPlaying,
    isPaused,
    talentLocked,
    obsConnected,
    obsCurrentScene,
    connectedClients,
    showProgress
  } = state;

  const [scenes, setScenes] = useState([]);

  useEffect(() => {
    identify('producer', 'Producer');

    // Fetch available scenes
    fetch('/api/scenes')
      .then(res => res.json())
      .then(setScenes)
      .catch(console.error);
  }, [identify]);

  // Common OBS scenes for quick access
  const sceneOverrides = [
    'Intro Video',
    'Talent Camera',
    'Competition Camera',
    'Scoreboard',
    'Interview',
    'Sponsor',
    'BRB',
    'End Card'
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Hub
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">
                {showConfig?.showName || 'Show Controller'}
              </h1>
              <div className="text-sm text-zinc-500">Producer View</div>
            </div>
          </div>
          <ConnectionStatus />
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Show State */}
          <div className="lg:col-span-2 space-y-4">
            {!isPlaying ? (
              /* Start Show */
              <div className="bg-zinc-800 rounded-xl p-8 text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Start</h2>
                <p className="text-zinc-400 mb-6">
                  {showConfig?.segments?.length || 0} segments loaded
                </p>
                <button
                  onClick={startShow}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-xl transition-colors"
                >
                  <PlayIcon className="w-6 h-6" />
                  Start Show
                </button>
              </div>
            ) : (
              <>
                {/* Current & Next Segment */}
                <CurrentSegment />
                <NextSegment />

                {/* Show Controls */}
                <div className="bg-zinc-800 rounded-xl p-4">
                  <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Show Control</div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={previous}
                      className="flex items-center gap-2 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                    >
                      <BackwardIcon className="w-5 h-5" />
                      Previous
                    </button>

                    <button
                      onClick={advance}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
                    >
                      <ForwardIcon className="w-5 h-5" />
                      NEXT
                    </button>

                    <button
                      onClick={togglePause}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                        isPaused
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                      }`}
                    >
                      {isPaused ? (
                        <>
                          <PlayIcon className="w-5 h-5" />
                          Resume
                        </>
                      ) : (
                        <>
                          <PauseIcon className="w-5 h-5" />
                          Pause
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => lockTalent(!talentLocked)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        talentLocked
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      {talentLocked ? (
                        <>
                          <LockClosedIcon className="w-4 h-4" />
                          Unlock Talent
                        </>
                      ) : (
                        <>
                          <LockOpenIcon className="w-4 h-4" />
                          Lock Talent
                        </>
                      )}
                    </button>

                    <button
                      onClick={resetShow}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                      Reset Show
                    </button>
                  </div>
                </div>

                {/* Scene Override */}
                <div className="bg-zinc-800 rounded-xl p-4">
                  <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Scene Override</div>

                  <div className="grid grid-cols-4 gap-2">
                    {sceneOverrides.map((scene) => (
                      <button
                        key={scene}
                        onClick={() => overrideScene(scene)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          obsCurrentScene === scene
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                        }`}
                      >
                        {scene}
                      </button>
                    ))}
                  </div>

                  {scenes.length > 0 && (
                    <div className="mt-3">
                      <select
                        value={obsCurrentScene || ''}
                        onChange={(e) => overrideScene(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm"
                      >
                        <option value="">Select scene...</option>
                        {scenes.map((scene) => (
                          <option key={scene} value={scene}>{scene}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Run of Show - Clickable for jump */}
            <RunOfShow clickable onSegmentClick={jumpTo} />
          </div>

          {/* Right Column - Status */}
          <div className="space-y-4">
            {/* Web Graphics Control */}
            <GraphicsControl />

            {/* OBS Status */}
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">OBS Status</div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Connection</span>
                  <span className={obsConnected ? 'text-green-400' : 'text-red-400'}>
                    {obsConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Current Scene</span>
                  <span className="text-white">{obsCurrentScene || '-'}</span>
                </div>
              </div>
            </div>

            {/* Connected Clients */}
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-wide mb-3">
                <UsersIcon className="w-4 h-4" />
                Connected Clients ({connectedClients.length})
              </div>

              <div className="space-y-2">
                {connectedClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-zinc-300">{client.name || 'Unknown'}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      client.role === 'producer'
                        ? 'bg-purple-500/20 text-purple-400'
                        : client.role === 'talent'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {client.role || 'unknown'}
                    </span>
                  </div>
                ))}

                {connectedClients.length === 0 && (
                  <div className="text-zinc-500 text-sm">No clients connected</div>
                )}
              </div>
            </div>

            {/* Show Stats */}
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Show Progress</div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-400">Segments</span>
                    <span className="text-white">
                      {showProgress.completed + 1} / {showProgress.total}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${showProgress.total > 0
                          ? ((showProgress.completed + 1) / showProgress.total) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Status</span>
                  <span className={
                    isPaused ? 'text-yellow-400' :
                    isPlaying ? 'text-green-400' :
                    'text-zinc-400'
                  }>
                    {isPaused ? 'Paused' : isPlaying ? 'Live' : 'Ready'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Talent Controls</span>
                  <span className={talentLocked ? 'text-red-400' : 'text-green-400'}>
                    {talentLocked ? 'Locked' : 'Unlocked'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
