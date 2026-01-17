import { Outlet, useParams, Navigate } from 'react-router-dom';
import { CompetitionProvider, useCompetition, CompetitionErrorType } from '../context/CompetitionContext';
import { ShowProvider } from '../context/ShowContext';
import { OBSProvider } from '../context/OBSContext';
import CompetitionError from './CompetitionError';
import CompetitionHeader from './CompetitionHeader';

// Reserved path prefixes that should NOT be treated as competition IDs
const RESERVED_PREFIXES = ['_admin', 'admin', 'api', '_'];

/**
 * Inner layout component that uses the competition context
 */
function CompetitionLayoutInner() {
  const { compId, isLoading, error, errorType, socketUrl, isLocalMode } = useCompetition();

  // Show loading spinner while fetching config
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading competition...</p>
          {compId && compId !== 'local' && (
            <p className="text-gray-500 text-sm mt-2">
              ID: <code className="bg-gray-800 px-2 py-0.5 rounded">{compId}</code>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show error states
  if (error || errorType) {
    return (
      <CompetitionError
        error={error}
        errorType={errorType}
        compId={compId}
        onRetry={errorType === CompetitionErrorType.VM_UNREACHABLE ? () => window.location.reload() : null}
      />
    );
  }

  // Check if vmAddress is required but missing (not for local mode)
  if (!isLocalMode && !socketUrl) {
    return (
      <CompetitionError
        error="No VM address configured for this competition"
        errorType={CompetitionErrorType.NO_VM_ADDRESS}
        compId={compId}
      />
    );
  }

  // Ready to render - wrap with ShowProvider and OBSProvider and render nested routes
  return (
    <ShowProvider>
      <OBSProvider>
        <div className="min-h-screen bg-gray-900 flex flex-col">
          <CompetitionHeader />
          <div className="flex-1">
            <Outlet />
          </div>
        </div>
      </OBSProvider>
    </ShowProvider>
  );
}

/**
 * CompetitionLayout wraps competition-specific routes.
 * It provides the CompetitionProvider context and handles loading/error states.
 *
 * Usage in App.jsx:
 * <Route path="/:compId" element={<CompetitionLayout />}>
 *   <Route path="producer" element={<ProducerView />} />
 *   <Route path="talent" element={<TalentView />} />
 *   ...
 * </Route>
 */
export default function CompetitionLayout() {
  const { compId } = useParams();

  // Check if this is a reserved path that shouldn't be treated as a competition
  // This handles cases where React Router incorrectly matches /:compId for admin routes
  if (compId && RESERVED_PREFIXES.some(prefix => compId.startsWith(prefix))) {
    // Return null to let the actual route handle it, or redirect to the correct path
    // Since we're here, it means the route wasn't matched properly - try a hard navigation
    window.location.href = `/${compId}${window.location.pathname.slice(compId.length + 1)}`;
    return null;
  }

  return (
    <CompetitionProvider>
      <CompetitionLayoutInner />
    </CompetitionProvider>
  );
}
