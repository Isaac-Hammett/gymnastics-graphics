import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCoordinator } from '../hooks/useCoordinator';
import {
  SparklesIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  StarIcon as StarIconSolid,
} from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';

/**
 * TalentDiscoveryPage - AI-powered talent discovery from RTN alumni rosters.
 * URL: /talent/discover
 */
export default function TalentDiscoveryPage() {
  const { coordinatorUrl } = useCoordinator();

  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [addedCandidates, setAddedCandidates] = useState(new Set());

  async function handleDiscover(e) {
    e.preventDefault();
    if (!schoolName.trim()) return;

    setLoading(true);
    setError('');
    setCandidates([]);

    try {
      const response = await fetch(`${coordinatorUrl}/api/talent/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName: schoolName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setCandidates(data.candidates || []);

      if (!data.candidates || data.candidates.length === 0) {
        setError('No candidates found for this school. Try a different school name.');
      }
    } catch (err) {
      console.error('Discovery error:', err);
      setError(err.message || 'Failed to discover candidates. Check coordinator server status.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCandidate(candidate) {
    try {
      const response = await fetch(`${coordinatorUrl}/api/talent/discover/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add candidate');
      }

      const { talentId } = await response.json();
      console.log('Added candidate to roster:', talentId);

      // Mark this candidate as added
      setAddedCandidates(prev => new Set([...prev, candidate.name]));
    } catch (err) {
      console.error('Add candidate error:', err);
      alert(`Failed to add ${candidate.name}: ${err.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/talent" className="text-zinc-400 hover:text-white text-sm transition-colors">
              ← Back to Talent Roster
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-purple-400" />
                Discover Talent
              </h1>
              <p className="text-zinc-400 text-sm">Find potential commentators from RTN alumni rosters</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search form */}
        <form onSubmit={handleDiscover} className="mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              School Name
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="w-5 h-5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g., Stanford, Michigan, UCLA"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !schoolName.trim()}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <SparklesIcon className="w-5 h-5" />
                {loading ? 'Searching...' : 'Find Candidates'}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              This searches RTN alumni rosters and uses AI to score candidates based on their gymnastics experience.
            </p>
          </div>
        </form>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-20">
            <SparklesIcon className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-pulse" />
            <div className="text-zinc-300 font-medium">Discovering candidates...</div>
            <div className="text-zinc-500 text-sm mt-1">Fetching roster and scoring with AI</div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {/* Candidates grid */}
        {!loading && candidates.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Found {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
              </h2>
              <div className="text-sm text-zinc-400">
                Sorted by suitability score
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map((candidate, index) => (
                <CandidateCard
                  key={`${candidate.name}-${index}`}
                  candidate={candidate}
                  onAdd={() => handleAddCandidate(candidate)}
                  isAdded={addedCandidates.has(candidate.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && candidates.length === 0 && (
          <div className="text-center py-20 text-zinc-500">
            <SparklesIcon className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <div>Enter a school name above to discover potential talent.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateCard({ candidate, onAdd, isAdded }) {
  const { name, school, graduationYear, score, explanation, alreadyInRoster } = candidate;

  // Render star rating (1-5)
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      i <= score ? (
        <StarIconSolid key={i} className="w-4 h-4 text-yellow-400" />
      ) : (
        <StarIconOutline key={i} className="w-4 h-4 text-zinc-600" />
      )
    );
  }

  const showAdded = isAdded || alreadyInRoster;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-white text-lg">{name}</h3>
          <div className="text-xs text-zinc-400 mt-1">
            {school} {graduationYear && `• Class of ${graduationYear}`}
          </div>
        </div>
        <div className="flex items-center gap-0.5 ml-2">
          {stars}
        </div>
      </div>

      {/* Explanation */}
      <div className="flex-1 text-sm text-zinc-300 mb-4 leading-relaxed">
        {explanation}
      </div>

      {/* Social links (if any) */}
      {(candidate.linkedIn || candidate.instagram) && (
        <div className="flex gap-2 mb-3 text-xs">
          {candidate.linkedIn && (
            <a
              href={candidate.linkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
              onClick={(e) => e.stopPropagation()}
            >
              LinkedIn
            </a>
          )}
          {candidate.instagram && (
            <a
              href={candidate.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 hover:text-pink-300 underline"
              onClick={(e) => e.stopPropagation()}
            >
              Instagram
            </a>
          )}
        </div>
      )}

      {/* Action button */}
      <div className="pt-3 border-t border-zinc-800">
        {alreadyInRoster ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-zinc-400">
            <CheckIcon className="w-4 h-4" />
            Already in Roster
          </div>
        ) : isAdded ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-400">
            <CheckIcon className="w-4 h-4" />
            Added ✓
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            Add to Roster
          </button>
        )}
      </div>
    </div>
  );
}
