import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ServerIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  ClipboardIcon,
  CheckIcon,
  LinkIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';

// VM Status constants matching server-side
export const VM_STATUS = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  IN_USE: 'in_use',
  STOPPED: 'stopped',
  STARTING: 'starting',
  STOPPING: 'stopping',
  ERROR: 'error',
};

// Status badge colors
export const STATUS_COLORS = {
  [VM_STATUS.AVAILABLE]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [VM_STATUS.ASSIGNED]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  [VM_STATUS.IN_USE]: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  [VM_STATUS.STOPPED]: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  [VM_STATUS.STARTING]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  [VM_STATUS.STOPPING]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  [VM_STATUS.ERROR]: 'bg-red-500/20 text-red-400 border-red-500/30',
};

/**
 * Service health indicator dot
 */
export function ServiceDot({ label, healthy }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className={`w-2 h-2 rounded-full ${
          healthy === true ? 'bg-green-400' :
          healthy === false ? 'bg-red-400' : 'bg-zinc-500'
        }`}
      />
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}

/**
 * VMCard - displays individual VM details and actions
 *
 * Props:
 * - vm: VM object with vmId, name, instanceId, status, publicIp, services, assignedTo, lastHealthCheck
 * - onStart: (vmId) => void - Start a stopped VM
 * - onStop: (vmId) => void - Stop a VM
 * - onAssign: () => void - Open assignment modal for this VM (optional)
 * - onRelease: (vmId) => void - Release VM from competition (optional)
 * - actionLoading: string | null - Current action loading state ('starting', 'stopping', 'assigning', 'releasing')
 * - showAssignControls: boolean - Whether to show assign/release buttons (default: true)
 * - hasAvailableCompetitions: boolean - Whether there are competitions available for assignment (default: true)
 */
export default function VMCard({
  vm,
  onStart,
  onStop,
  onAssign,
  onRelease,
  actionLoading,
  showAssignControls = true,
  hasAvailableCompetitions = true,
}) {
  const [copiedSSH, setCopiedSSH] = useState(false);

  const statusColor = STATUS_COLORS[vm.status] || STATUS_COLORS[VM_STATUS.ERROR];
  const canStart = vm.status === VM_STATUS.STOPPED;
  const canStop = [VM_STATUS.AVAILABLE, VM_STATUS.ASSIGNED, VM_STATUS.ERROR].includes(vm.status);
  const canAssign = vm.status === VM_STATUS.AVAILABLE && !vm.assignedTo;
  const canRelease = !!vm.assignedTo && [VM_STATUS.ASSIGNED, VM_STATUS.IN_USE].includes(vm.status);
  const hasPublicIP = !!vm.publicIp;

  // Service health indicators
  const services = vm.services || {};

  // Copy SSH command to clipboard
  const copySSHCommand = () => {
    const sshCommand = `ssh -i ~/.ssh/gymnastics-graphics-key-pair.pem ubuntu@${vm.publicIp}`;
    navigator.clipboard.writeText(sshCommand);
    setCopiedSSH(true);
    setTimeout(() => setCopiedSSH(false), 2000);
  };

  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <ServerIcon className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="text-white font-medium">{vm.name || vm.vmId}</div>
            <div className="text-xs text-zinc-500 font-mono">{vm.instanceId || vm.vmId}</div>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColor}`}>
          {vm.status}
        </span>
      </div>

      {/* Public IP */}
      {hasPublicIP && (
        <div className="mb-3 p-2 bg-zinc-700/30 rounded-lg">
          <div className="text-xs text-zinc-400 mb-1">Public IP</div>
          <div className="text-white font-mono text-sm">{vm.publicIp}</div>
        </div>
      )}

      {/* Assigned Competition */}
      {vm.assignedTo && (
        <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-blue-400 mb-1">Assigned To</div>
              <Link
                to={`/${vm.assignedTo}/producer`}
                className="text-white font-medium hover:text-blue-400 transition-colors"
              >
                {vm.assignedTo}
              </Link>
            </div>
            {showAssignControls && canRelease && (
              <button
                onClick={() => onRelease && onRelease(vm.vmId)}
                disabled={!!actionLoading}
                className="p-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded transition-colors"
                title="Release VM"
              >
                {actionLoading === 'releasing' ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <XMarkIcon className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Service Health Dots */}
      <div className="mb-3">
        <div className="text-xs text-zinc-400 mb-2">Services</div>
        <div className="flex items-center gap-3">
          <ServiceDot label="Node" healthy={services.node} />
          <ServiceDot label="OBS" healthy={services.obs} />
          <ServiceDot label="NoMachine" healthy={services.nomachine} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {canStart && (
          <button
            onClick={() => onStart && onStart(vm.vmId)}
            disabled={!!actionLoading}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {actionLoading === 'starting' ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            Start
          </button>
        )}

        {canStop && (
          <button
            onClick={() => onStop && onStop(vm.vmId)}
            disabled={!!actionLoading}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {actionLoading === 'stopping' ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <StopIcon className="w-4 h-4" />
            )}
            Stop
          </button>
        )}

        {/* Assign Button - opens modal in parent */}
        {showAssignControls && canAssign && (
          <button
            onClick={onAssign}
            disabled={!!actionLoading || !hasAvailableCompetitions}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
            title={!hasAvailableCompetitions ? 'All competitions already have a VM assigned' : 'Assign to a competition'}
          >
            {actionLoading === 'assigning' ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <LinkIcon className="w-4 h-4" />
            )}
            Assign
          </button>
        )}

        {/* SSH Copy Button */}
        {hasPublicIP && (
          <button
            onClick={copySSHCommand}
            className="p-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
            title="Copy SSH command"
          >
            {copiedSSH ? (
              <CheckIcon className="w-4 h-4 text-green-400" />
            ) : (
              <ClipboardIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Last Health Check */}
      {vm.lastHealthCheck && (
        <div className="mt-3 text-xs text-zinc-500 text-right">
          Last checked: {new Date(vm.lastHealthCheck).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
