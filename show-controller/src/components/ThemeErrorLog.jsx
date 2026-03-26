import { useState, useCallback } from 'react';
import {
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  PaintBrushIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

// Format timestamp for display
function formatTimestamp(timestamp) {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Format error for copy-paste (structured format per fouc-prevention.md spec)
function formatErrorForCopy(error) {
  return `Theme Error
Type: ${error.type || 'unknown'}
Theme ID: ${error.themeId || 'none'}
Source: ${error.source || 'unknown'}
Message: ${error.message || 'No message'}
URL: ${error.url || 'N/A'}
Timestamp: ${error.timestamp || 'unknown'}
Competition: ${error.compId || 'unknown'}`;
}

// Single error item
function ErrorItem({ error, onClear }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formatErrorForCopy(error));
    toast.success('Copied to clipboard');
  }, [error]);

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm text-red-300">
              {error.type === 'timeout' && 'Theme Timeout'}
              {error.type === 'not_found' && 'Theme Not Found'}
              {error.type === 'fetch_error' && 'Theme Fetch Failed'}
              {!['timeout', 'not_found', 'fetch_error'].includes(error.type) && (error.type || 'Theme Error')}
            </span>
            <span className="text-xs text-red-400/70 font-mono flex-shrink-0">
              {formatTimestamp(error.timestamp)}
            </span>
          </div>
          <p className="text-sm text-red-200/80 mt-1">{error.message || 'No details available'}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-red-400/60">
            {error.themeId && <span>Theme: {error.themeId}</span>}
            {error.source && <span>Source: {error.source}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-red-400 transition-colors"
            title="Copy error details"
          >
            <ClipboardDocumentIcon className="w-3.5 h-3.5" />
          </button>
          {onClear && (
            <button
              onClick={() => onClear(error.id)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-red-400 transition-colors"
              title="Dismiss error"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ThemeErrorLog - Collapsible panel showing theme loading errors
 *
 * @param {Array} errors - Array of error objects from useThemeErrors
 * @param {Function} onClear - Callback to clear a single error
 * @param {Function} onClearAll - Callback to clear all errors
 * @param {boolean} collapsed - Initial collapsed state
 */
export default function ThemeErrorLog({
  errors = [],
  onClear,
  onClearAll,
  collapsed: initialCollapsed = true
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const handleCopyAll = useCallback(() => {
    const allErrors = errors.map(formatErrorForCopy).join('\n\n---\n\n');
    navigator.clipboard.writeText(allErrors);
    toast.success('Copied all errors to clipboard');
  }, [errors]);

  // Empty state - don't render anything
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden border border-red-500/30">
      {/* Header - always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-red-500/10 hover:bg-red-500/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <PaintBrushIcon className="w-4 h-4 text-red-400" />
          <span className="font-medium text-red-400 text-sm">Theme Errors</span>
          <span className="px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded-full">
            {errors.length}
          </span>
        </div>
        {collapsed ? (
          <ChevronDownIcon className="w-4 h-4 text-red-400" />
        ) : (
          <ChevronUpIcon className="w-4 h-4 text-red-400" />
        )}
      </button>

      {!collapsed && (
        <div className="p-4 pt-0 space-y-3">
          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
            >
              <ClipboardDocumentIcon className="w-3 h-3" />
              Copy All
            </button>
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
              >
                <TrashIcon className="w-3 h-3" />
                Dismiss All
              </button>
            )}
          </div>

          {/* Error list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {errors.map(error => (
              <ErrorItem
                key={error.id}
                error={error}
                onClear={onClear}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ThemeErrorBadge - Compact inline badge for header display
 * Shows count and is clickable to expand the full panel
 */
export function ThemeErrorBadge({ errorCount, onClick }) {
  if (!errorCount || errorCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-colors"
      title={`${errorCount} theme error${errorCount !== 1 ? 's' : ''}`}
    >
      <PaintBrushIcon className="w-3.5 h-3.5" />
      <span>{errorCount}</span>
    </button>
  );
}
