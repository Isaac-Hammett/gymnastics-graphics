import { useEffect } from 'react';
import { useShow } from '../context/ShowContext';
import CurrentSegment from '../components/CurrentSegment';
import NextSegment from '../components/NextSegment';
import RunOfShow from '../components/RunOfShow';
import QuickActions from '../components/QuickActions';
import ConnectionStatus from '../components/ConnectionStatus';
import { PlayIcon, LockClosedIcon } from '@heroicons/react/24/solid';

export default function TalentView() {
  const { state, advance, startShow, identify, error } = useShow();
  const { showConfig, isPlaying, talentLocked, showProgress } = state;

  useEffect(() => {
    identify('talent', 'Talent');
  }, [identify]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">
              {showConfig?.showName || 'Show Controller'}
            </h1>
            <div className="text-sm text-zinc-500">Talent View</div>
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

      {/* Talent Locked Warning */}
      {talentLocked && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-yellow-400 text-sm">
            <LockClosedIcon className="w-4 h-4" />
            Controls locked by producer
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 space-y-4">
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
            {/* Current Segment */}
            <CurrentSegment />

            {/* Next Segment Preview */}
            <NextSegment />

            {/* Big Next Button */}
            <button
              onClick={advance}
              disabled={talentLocked}
              className={`
                w-full py-6 rounded-xl text-xl font-bold transition-all
                ${talentLocked
                  ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-98'
                }
              `}
            >
              {talentLocked ? (
                <span className="flex items-center justify-center gap-2">
                  <LockClosedIcon className="w-6 h-6" />
                  Controls Locked
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <PlayIcon className="w-6 h-6" />
                  NEXT
                </span>
              )}
            </button>

            {/* Quick Actions */}
            <QuickActions />

            {/* Run of Show */}
            <RunOfShow />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-zinc-500">
          <span>Segment {showProgress.completed + 1} of {showProgress.total}</span>
          <span>Gymnastics Graphics Show Controller</span>
        </div>
      </footer>
    </div>
  );
}
