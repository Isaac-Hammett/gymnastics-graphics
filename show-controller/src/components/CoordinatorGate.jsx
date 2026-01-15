import { useLocation } from 'react-router-dom';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import { useCoordinator, COORDINATOR_STATUS } from '../hooks/useCoordinator';
import SystemOfflinePage from '../pages/SystemOfflinePage';

/**
 * CoordinatorGate - Route guard component for coordinator-dependent pages
 *
 * Wraps routes that require the coordinator to be online. If the coordinator
 * is offline (sleeping), it shows the SystemOfflinePage with a wake button.
 *
 * Usage in App.jsx:
 * ```jsx
 * <Route path="/_admin/vm-pool" element={
 *   <CoordinatorGate>
 *     <VMPoolPage />
 *   </CoordinatorGate>
 * } />
 * ```
 */
export default function CoordinatorGate({ children, requireCoordinator = true }) {
  const location = useLocation();
  const {
    status,
    isWaking,
    isAvailable,
    error,
  } = useCoordinator();

  // useCoordinator already checks status on mount, no need to duplicate

  // If coordinator is not required, just render children
  if (!requireCoordinator) {
    return children;
  }

  // Check if current route requires coordinator
  const currentPath = location.pathname;

  // Routes that do NOT require coordinator (can load even when offline)
  // /select is handled outside CoordinatorGate, so don't include it here
  const coordinatorOptionalPaths = [
    '/hub',
    '/dashboard',
    '/controller',
    '/url-generator',
    '/media-manager',
    '/import',
  ];

  // Check if current path is optional (doesn't need coordinator)
  const isOptionalPath = coordinatorOptionalPaths.some(path =>
    currentPath === path || currentPath.startsWith(path + '/')
  );

  if (isOptionalPath) {
    return children;
  }

  // Admin routes always require coordinator
  const isAdminRoute = currentPath.startsWith('/_admin');

  // Competition routes (/:compId/*) need coordinator for VM operations
  // but the 'local' competition can work without coordinator
  const isLocalCompetition = currentPath.startsWith('/local');

  // For local development, don't require coordinator
  if (isLocalCompetition) {
    return children;
  }

  // If coordinator is available (online and app ready), render children
  if (isAvailable) {
    return children;
  }

  // If coordinator is offline, show SystemOfflinePage
  if (status === COORDINATOR_STATUS.OFFLINE && !isWaking) {
    return <SystemOfflinePage redirectTo={currentPath} />;
  }

  // If coordinator is starting up (or waking), show progress overlay
  if (status === COORDINATOR_STATUS.STARTING || isWaking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <ArrowPathIcon className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">System Starting Up...</h2>
          <p className="text-zinc-400 mb-4">
            The production system is starting. This usually takes 60-90 seconds.
          </p>
          <p className="text-sm text-zinc-500">
            You'll be redirected automatically when ready.
          </p>
        </div>
      </div>
    );
  }

  // Unknown state - show loading while checking
  if (status === COORDINATOR_STATUS.UNKNOWN) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Checking system status...</p>
        </div>
      </div>
    );
  }

  // Fallback - render children if none of the above conditions match
  // This handles edge cases where status might be in an unexpected state
  return children;
}
