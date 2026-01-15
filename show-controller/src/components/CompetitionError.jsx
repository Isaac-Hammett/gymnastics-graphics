import { Link } from 'react-router-dom';
import { CompetitionErrorType } from '../context/CompetitionContext';

/**
 * CompetitionError displays error states for competition loading failures.
 * Handles NOT_FOUND, NO_VM_ADDRESS, VM_UNREACHABLE, and generic errors.
 */
export default function CompetitionError({ error, errorType, compId, onRetry }) {
  // Error-specific content
  const getErrorContent = () => {
    switch (errorType) {
      case CompetitionErrorType.NOT_FOUND:
        return {
          title: 'Competition Not Found',
          message: `The competition "${compId}" could not be found.`,
          icon: (
            <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          actions: (
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Competition Selector
            </Link>
          )
        };

      case CompetitionErrorType.NO_VM_ADDRESS:
        return {
          title: 'Not Configured',
          message: 'This competition does not have a VM address configured. Please configure the production VM in the Hub.',
          icon: (
            <svg className="w-16 h-16 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          actions: (
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to={`/hub?edit=${compId}`}
                className="inline-flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configure VM
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Selector
              </Link>
            </div>
          )
        };

      case CompetitionErrorType.VM_UNREACHABLE:
        return {
          title: 'Cannot Connect',
          message: 'Unable to connect to the competition VM. The server may be offline or unreachable.',
          icon: (
            <svg className="w-16 h-16 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
          ),
          actions: (
            <div className="flex flex-col sm:flex-row gap-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry Connection
                </button>
              )}
              <Link
                to="/"
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Selector
              </Link>
            </div>
          )
        };

      case CompetitionErrorType.FIREBASE_ERROR:
      default:
        return {
          title: 'Error Loading Competition',
          message: error || 'An unexpected error occurred while loading the competition.',
          icon: (
            <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          actions: (
            <div className="flex flex-col sm:flex-row gap-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try Again
                </button>
              )}
              <Link
                to="/"
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Selector
              </Link>
            </div>
          )
        };
    }
  };

  const content = getErrorContent();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-xl p-8 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {content.icon}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-3">
          {content.title}
        </h1>

        {/* Message */}
        <p className="text-gray-400 mb-6">
          {content.message}
        </p>

        {/* Competition ID */}
        {compId && compId !== 'local' && (
          <p className="text-gray-500 text-sm mb-6">
            Competition ID: <code className="bg-gray-700 px-2 py-0.5 rounded">{compId}</code>
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-center">
          {content.actions}
        </div>
      </div>
    </div>
  );
}
