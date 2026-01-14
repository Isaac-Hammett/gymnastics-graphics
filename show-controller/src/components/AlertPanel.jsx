import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  BellAlertIcon
} from '@heroicons/react/24/solid';
import { ALERT_LEVEL } from '../hooks/useAlerts';

// Get icon for alert level
function getAlertIcon(level) {
  switch (level) {
    case ALERT_LEVEL.CRITICAL:
      return <ExclamationCircleIcon className="w-5 h-5" />;
    case ALERT_LEVEL.WARNING:
      return <ExclamationTriangleIcon className="w-5 h-5" />;
    case ALERT_LEVEL.INFO:
    default:
      return <InformationCircleIcon className="w-5 h-5" />;
  }
}

// Get styles for alert level
function getAlertStyles(level, acknowledged) {
  const base = acknowledged ? 'opacity-60' : '';

  switch (level) {
    case ALERT_LEVEL.CRITICAL:
      return `${base} bg-red-500/10 border-red-500/30 text-red-400`;
    case ALERT_LEVEL.WARNING:
      return `${base} bg-yellow-500/10 border-yellow-500/30 text-yellow-400`;
    case ALERT_LEVEL.INFO:
    default:
      return `${base} bg-blue-500/10 border-blue-500/30 text-blue-400`;
  }
}

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

// Single alert item
function AlertItem({ alert, onAcknowledge }) {
  const styles = getAlertStyles(alert.level, alert.acknowledged);

  return (
    <div className={`p-3 rounded-lg border ${styles}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getAlertIcon(alert.level)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">{alert.title}</span>
            <span className="text-xs opacity-70 font-mono flex-shrink-0">
              {formatTimestamp(alert.createdAt)}
            </span>
          </div>
          <p className="text-sm opacity-80 mt-1">{alert.message}</p>
          {alert.metadata?.vmId && (
            <div className="text-xs opacity-60 mt-1">
              VM: {alert.metadata.vmId}
            </div>
          )}
        </div>
        {!alert.acknowledged && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="flex-shrink-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Acknowledge"
          >
            <CheckIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * AlertPanel - Collapsible panel showing alerts grouped by level
 *
 * @param {Array} alerts - Array of alert objects
 * @param {Function} onAcknowledge - Callback when alert is acknowledged
 * @param {Function} onAcknowledgeAll - Callback to acknowledge all alerts
 * @param {boolean} collapsed - Initial collapsed state
 */
export default function AlertPanel({
  alerts = [],
  onAcknowledge,
  onAcknowledgeAll,
  collapsed: initialCollapsed = true
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Group alerts by level
  const criticalAlerts = alerts.filter(a => a.level === ALERT_LEVEL.CRITICAL);
  const warningAlerts = alerts.filter(a => a.level === ALERT_LEVEL.WARNING);
  const infoAlerts = alerts.filter(a => a.level === ALERT_LEVEL.INFO);

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  // Empty state
  if (alerts.length === 0) {
    return (
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <BellAlertIcon className="w-5 h-5" />
          <span className="font-medium">Alerts</span>
        </div>
        <div className="text-center py-4 text-zinc-500 text-sm">
          No active alerts
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BellAlertIcon className="w-5 h-5 text-zinc-400" />
          <span className="font-medium text-white">Alerts</span>
          <div className="flex items-center gap-1">
            {criticalAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                {criticalAlerts.length}
              </span>
            )}
            {warningAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                {warningAlerts.length}
              </span>
            )}
            {infoAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                {infoAlerts.length}
              </span>
            )}
          </div>
        </div>
        {collapsed ? (
          <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {!collapsed && (
        <div className="p-4 pt-0 space-y-3">
          {/* Acknowledge all button */}
          {unacknowledgedCount > 0 && onAcknowledgeAll && (
            <div className="flex justify-end">
              <button
                onClick={onAcknowledgeAll}
                className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
              >
                <CheckIcon className="w-3 h-3" />
                Acknowledge All ({unacknowledgedCount})
              </button>
            </div>
          )}

          {/* Critical alerts */}
          {criticalAlerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-red-400 uppercase tracking-wide">
                Critical ({criticalAlerts.length})
              </div>
              {criticalAlerts.map(alert => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={onAcknowledge}
                />
              ))}
            </div>
          )}

          {/* Warning alerts */}
          {warningAlerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-yellow-400 uppercase tracking-wide">
                Warning ({warningAlerts.length})
              </div>
              {warningAlerts.map(alert => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={onAcknowledge}
                />
              ))}
            </div>
          )}

          {/* Info alerts */}
          {infoAlerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                Info ({infoAlerts.length})
              </div>
              {infoAlerts.map(alert => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={onAcknowledge}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
