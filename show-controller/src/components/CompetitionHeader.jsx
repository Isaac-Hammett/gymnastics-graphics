import { Link } from 'react-router-dom';
import { useCompetition } from '../context/CompetitionContext';
import { useShow } from '../context/ShowContext';

/**
 * CompetitionHeader displays the current competition info and connection status.
 * Shows event name, gender badge, venue, and a connection status indicator.
 */
export default function CompetitionHeader() {
  const { compId, competitionConfig, isLocalMode, vmAddress } = useCompetition();
  const { connected } = useShow();

  // Get display values
  const eventName = competitionConfig?.eventName || (isLocalMode ? 'Local Development' : 'Loading...');
  const gender = competitionConfig?.gender || 'womens';
  const venue = competitionConfig?.venue || null;
  const genderBadge = gender === 'mens' || gender === 'MAG' ? 'MAG' : 'WAG';
  const genderColor = gender === 'mens' || gender === 'MAG'
    ? 'bg-blue-600 text-blue-100'
    : 'bg-pink-600 text-pink-100';

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Left side: Event info */}
        <div className="flex items-center gap-3">
          {/* Gender badge */}
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${genderColor}`}>
            {genderBadge}
          </span>

          {/* Event name */}
          <h1 className="text-white font-semibold text-lg">
            {eventName}
          </h1>

          {/* Venue */}
          {venue && (
            <span className="text-gray-400 text-sm hidden sm:inline">
              @ {venue}
            </span>
          )}

          {/* Local mode indicator */}
          {isLocalMode && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
              LOCAL
            </span>
          )}
        </div>

        {/* Right side: Connection status and change link */}
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-sm ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            {vmAddress && !isLocalMode && (
              <span className="text-gray-500 text-xs hidden md:inline">
                ({vmAddress})
              </span>
            )}
          </div>

          {/* Change competition link */}
          <Link
            to="/"
            className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="hidden sm:inline">Change</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
