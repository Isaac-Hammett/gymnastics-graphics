/**
 * ErrorBoundary - React error boundary for catching component errors
 *
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI.
 */

import { Component } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * Default fallback UI for error boundary
 */
function DefaultFallback({ error, resetError }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-zinc-800 rounded-lg p-6 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-zinc-400 mb-4">
          An error occurred while loading this page. Please try reloading.
        </p>
        {error?.message && (
          <p className="text-sm text-zinc-500 bg-zinc-700 rounded p-2 mb-4 font-mono">
            {error.message}
          </p>
        )}
        <button
          onClick={resetError}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Reload Page
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <DefaultFallback
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}
