import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlayIcon, MoonIcon, ArrowPathIcon, ClockIcon } from '@heroicons/react/24/solid';
import { useCoordinator, COORDINATOR_STATUS } from '../hooks/useCoordinator';

/**
 * SystemOfflinePage - Full-page display when coordinator is offline
 *
 * Shows when the coordinator EC2 instance is stopped to save costs.
 * Provides a "Wake Up System" button and progress during startup.
 * Auto-redirects to original destination when ready.
 */
export default function SystemOfflinePage({ redirectTo }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    status,
    isWaking,
    error,
    details,
    wake,
    checkStatus,
    estimatedTimeRemaining,
    isAvailable,
  } = useCoordinator();

  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Get the target destination (from props, query param, or default)
  const getTargetDestination = () => {
    // Check props first
    if (redirectTo) return redirectTo;
    // Check query param
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (redirect) return redirect;
    // Default to competition selector
    return '/select';
  };

  const targetDestination = getTargetDestination();

  // Auto-redirect when coordinator becomes available
  useEffect(() => {
    if (isAvailable) {
      // Small delay for UX
      const timeout = setTimeout(() => {
        navigate(targetDestination, { replace: true });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isAvailable, navigate, targetDestination]);

  // Track elapsed time during startup
  useEffect(() => {
    if (isWaking && !startTime) {
      setStartTime(Date.now());
    }
    if (!isWaking) {
      setStartTime(null);
      setElapsedSeconds(0);
    }
  }, [isWaking, startTime]);

  // Update elapsed seconds during startup
  useEffect(() => {
    if (!isWaking || !startTime) return;

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isWaking, startTime]);

  // Handle wake button click
  const handleWake = async () => {
    await wake();
  };

  // Handle retry/refresh
  const handleRefresh = async () => {
    await checkStatus();
  };

  // Calculate progress percentage (estimated 60-90 seconds)
  const estimatedTotalSeconds = 75; // 60-90 average
  const progressPercent = isWaking
    ? Math.min(100, Math.round((elapsedSeconds / estimatedTotalSeconds) * 100))
    : 0;

  // Format last shutdown time if available
  const formatLastShutdown = () => {
    if (!details?.lastShutdownTime) return null;
    try {
      const date = new Date(details.lastShutdownTime);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      }
    } catch {
      return null;
    }
  };

  const lastShutdown = formatLastShutdown();

  // Show loading/ready state when coordinator is online
  if (status === COORDINATOR_STATUS.ONLINE && isAvailable) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <ArrowPathIcon className="w-8 h-8 text-green-400 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">System Ready</h2>
          <p className="text-zinc-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full">
        {/* Icon and Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            {isWaking ? (
              <ArrowPathIcon className="w-10 h-10 text-yellow-400 animate-spin" />
            ) : (
              <MoonIcon className="w-10 h-10 text-zinc-400" />
            )}
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            {isWaking ? 'System Starting Up...' : 'System is Sleeping'}
          </h1>

          <p className="text-zinc-400 text-base leading-relaxed">
            {isWaking
              ? 'The production system is starting. This usually takes 60-90 seconds.'
              : 'The production system is hibernating to save costs. Click below to wake it up.'}
          </p>
        </div>

        {/* Progress Section - shown when waking */}
        {isWaking && (
          <div className="mb-8">
            {/* Progress Bar */}
            <div className="bg-zinc-800 rounded-full h-3 overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-green-500 transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Progress Info */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <ClockIcon className="w-4 h-4" />
                <span>Elapsed: {elapsedSeconds}s</span>
              </div>
              {estimatedTimeRemaining !== null && (
                <span className="text-zinc-500">
                  ~{estimatedTimeRemaining}s remaining
                </span>
              )}
            </div>

            {/* Status text */}
            <div className="mt-4 text-center">
              {status === COORDINATOR_STATUS.STARTING && (
                <span className="text-yellow-400 text-sm">
                  {elapsedSeconds < 10
                    ? 'Starting EC2 instance...'
                    : elapsedSeconds < 30
                    ? 'Booting operating system...'
                    : elapsedSeconds < 50
                    ? 'Starting application services...'
                    : 'Almost ready...'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Wake Up Button - shown when offline */}
        {status === COORDINATOR_STATUS.OFFLINE && !isWaking && (
          <div className="space-y-4">
            <button
              onClick={handleWake}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-500 rounded-xl text-white text-lg font-semibold transition-colors shadow-lg shadow-green-600/20"
            >
              <PlayIcon className="w-6 h-6" />
              Wake Up System
            </button>

            {/* Estimated Time */}
            <div className="text-center text-sm text-zinc-500">
              Estimated startup time: 60-90 seconds
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="text-red-400 font-medium mb-1">Error</div>
            <div className="text-sm text-red-400/70">{error}</div>
            <button
              onClick={handleRefresh}
              className="mt-3 flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}

        {/* Last Shutdown Info */}
        {!isWaking && lastShutdown && (
          <div className="mt-8 text-center text-sm text-zinc-600">
            Last active: {lastShutdown}
          </div>
        )}

        {/* Redirect Info */}
        {targetDestination !== '/select' && (
          <div className="mt-6 text-center text-sm text-zinc-500">
            After startup, you'll be redirected to:
            <span className="block mt-1 font-mono text-zinc-400">{targetDestination}</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-zinc-600">
          The system automatically sleeps after 2 hours of inactivity to minimize AWS costs.
        </p>
      </div>
    </div>
  );
}
