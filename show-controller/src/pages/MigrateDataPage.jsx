import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeamsDatabase } from '../hooks/useTeamsDatabase';
import { teams, athleteHeadshots } from '../lib/teamsDatabase';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/solid';

// School aliases from teamsDatabase.js
const schoolAliases = {
  'california': 'cal',
  'uc berkeley': 'cal',
  'berkeley': 'cal',
  'golden bears': 'cal',
  'naval academy': 'navy',
  'us navy': 'navy',
  'usna': 'navy',
  'stanford university': 'stanford',
  'cardinal': 'stanford',
  'penn state': 'penn-state',
  'pennsylvania state': 'penn-state',
  'psu': 'penn-state',
  'nittany lions': 'penn-state',
  'william & mary': 'william-mary',
  'william and mary': 'william-mary',
  'w&m': 'william-mary',
  'george washington': 'george-washington',
  'gw': 'george-washington',
  'gwu': 'george-washington',
  'fisk university': 'fisk',
  'centenary college': 'centenary',
  'wilberforce university': 'wilberforce',
  'greenville university': 'greenville',
  'springfield college': 'springfield',
  'university of illinois': 'illinois',
  'fighting illini': 'illinois',
  'university of michigan': 'michigan',
  'wolverines': 'michigan',
  'west point': 'army',
  'us army': 'army',
  'black knights': 'army',
  'university of maryland': 'maryland',
  'terrapins': 'maryland',
  'simpson college': 'simpson',
};

export default function MigrateDataPage() {
  const { migrateFromStatic, teams: firebaseTeams } = useTeamsDatabase();
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toISOString() }]);
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setResult(null);
    setLogs([]);

    addLog('Starting migration from teamsDatabase.js to Firebase...', 'info');

    try {
      // Count items to migrate
      const teamCount = Object.keys(teams).length;
      const headshotCount = Object.keys(athleteHeadshots).length;
      const aliasCount = Object.keys(schoolAliases).length;

      addLog(`Found ${teamCount} teams to migrate`, 'info');
      addLog(`Found ${headshotCount} headshots to migrate`, 'info');
      addLog(`Found ${aliasCount} aliases to migrate`, 'info');

      // Run migration
      const migrationResult = await migrateFromStatic(teams, athleteHeadshots, schoolAliases);

      if (migrationResult.success) {
        addLog('Migration completed successfully!', 'success');
        setResult({ success: true, teamCount, headshotCount, aliasCount });
      } else {
        addLog(`Migration failed: ${migrationResult.error}`, 'error');
        setResult({ success: false, error: migrationResult.error });
      }
    } catch (err) {
      addLog(`Error during migration: ${err.message}`, 'error');
      setResult({ success: false, error: err.message });
    }

    setMigrating(false);
  };

  const firebaseTeamCount = Object.keys(firebaseTeams || {}).length;

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/media-manager"
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Media Manager
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Migrate Data to Firebase</h1>
            <p className="text-zinc-400 text-sm">One-time migration from static teamsDatabase.js</p>
          </div>
        </div>

        {/* Current State */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Static File (teamsDatabase.js)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Teams:</span>
                <span className="text-white font-medium">{Object.keys(teams).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Headshots:</span>
                <span className="text-white font-medium">{Object.keys(athleteHeadshots).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Aliases:</span>
                <span className="text-white font-medium">{Object.keys(schoolAliases).length}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Firebase Database</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Teams:</span>
                <span className="text-white font-medium">{firebaseTeamCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Status:</span>
                <span className={firebaseTeamCount > 0 ? 'text-green-400' : 'text-yellow-400'}>
                  {firebaseTeamCount > 0 ? 'Has Data' : 'Empty'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Migration Button */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Run Migration</h3>
          <p className="text-zinc-400 text-sm mb-4">
            This will copy all teams, rosters, and headshots from the static teamsDatabase.js file into Firebase.
            {firebaseTeamCount > 0 && (
              <span className="text-yellow-400 block mt-2">
                Warning: Firebase already has {firebaseTeamCount} teams. Running this migration will update existing data.
              </span>
            )}
          </p>

          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
          >
            <CloudArrowUpIcon className="w-5 h-5" />
            {migrating ? 'Migrating...' : 'Start Migration'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`mb-8 p-6 rounded-xl ${result.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
            <div className="flex items-center gap-3 mb-4">
              {result.success ? (
                <>
                  <CheckCircleIcon className="w-8 h-8 text-green-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-green-300">Migration Successful!</h3>
                    <p className="text-green-400 text-sm">
                      Migrated {result.teamCount} teams, {result.headshotCount} headshots, and {result.aliasCount} aliases.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ExclamationCircleIcon className="w-8 h-8 text-red-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-300">Migration Failed</h3>
                    <p className="text-red-400 text-sm">{result.error}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Migration Log</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-sm">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    'text-zinc-400'
                  }`}
                >
                  [{new Date(log.time).toLocaleTimeString()}] {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
