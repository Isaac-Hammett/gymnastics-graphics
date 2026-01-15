import { Link } from 'react-router-dom';
import {
  BookOpenIcon,
  ServerIcon,
  CloudIcon,
  PlayIcon,
  StopIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { useCoordinator, COORDINATOR_STATUS } from '../hooks/useCoordinator';

/**
 * SetupGuidePage - Documentation page explaining the coordinator system
 *
 * Explains how the wake/sleep system works for cost optimization.
 */
export default function SetupGuidePage() {
  const { status, details } = useCoordinator();

  const statusColors = {
    [COORDINATOR_STATUS.ONLINE]: 'text-green-400',
    [COORDINATOR_STATUS.OFFLINE]: 'text-zinc-400',
    [COORDINATOR_STATUS.STARTING]: 'text-yellow-400',
    [COORDINATOR_STATUS.STOPPING]: 'text-orange-400',
    [COORDINATOR_STATUS.UNKNOWN]: 'text-zinc-500',
  };

  const statusLabels = {
    [COORDINATOR_STATUS.ONLINE]: 'Online',
    [COORDINATOR_STATUS.OFFLINE]: 'Sleeping',
    [COORDINATOR_STATUS.STARTING]: 'Starting',
    [COORDINATOR_STATUS.STOPPING]: 'Stopping',
    [COORDINATOR_STATUS.UNKNOWN]: 'Unknown',
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/select"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpenIcon className="w-5 h-5 text-blue-400" />
                System Setup Guide
              </h1>
              <div className="text-sm text-zinc-500">
                Understanding the coordinator wake/sleep system
              </div>
            </div>
          </div>

          {/* Current Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${status === COORDINATOR_STATUS.ONLINE ? 'bg-green-400' : status === COORDINATOR_STATUS.OFFLINE ? 'bg-zinc-500' : 'bg-yellow-400 animate-pulse'}`} />
            <span className={`text-sm ${statusColors[status]}`}>
              System: {statusLabels[status]}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        {/* Overview Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <div className="bg-zinc-800 rounded-xl p-6">
            <p className="text-zinc-300 leading-relaxed mb-4">
              The Gymnastics Graphics system uses an <strong className="text-white">EC2 coordinator server</strong> to manage
              live production VMs and coordinate graphics streaming. To minimize AWS costs, the coordinator
              automatically <strong className="text-white">sleeps after 2 hours of inactivity</strong> and can be
              woken up on-demand when needed.
            </p>
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <CloudIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-300">
                <strong>Cost Savings:</strong> When not in use, the coordinator is stopped, eliminating EC2 hourly charges.
                You only pay when actively using the system.
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
          <div className="grid gap-4">
            {/* Wake Up */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <PlayIcon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Waking Up the System</h3>
                  <p className="text-sm text-zinc-400">When you need to use production features</p>
                </div>
              </div>
              <ol className="space-y-3 text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">1</span>
                  <span>Navigate to a page that requires the coordinator (e.g., VM Pool, competition with VMs)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">2</span>
                  <span>If the system is sleeping, you'll see a <strong className="text-white">"Wake Up System"</strong> button</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">3</span>
                  <span>Click the button and wait <strong className="text-white">60-90 seconds</strong> for the system to start</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">4</span>
                  <span>You'll be automatically redirected when the system is ready</span>
                </li>
              </ol>
            </div>

            {/* Auto Sleep */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-zinc-600/20 flex items-center justify-center">
                  <ClockIcon className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Automatic Sleep</h3>
                  <p className="text-sm text-zinc-400">Cost optimization when idle</p>
                </div>
              </div>
              <p className="text-zinc-300 mb-4">
                The coordinator automatically stops after <strong className="text-white">2 hours of no activity</strong>.
                Activity includes:
              </p>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  API requests to the coordinator
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  WebSocket connections (real-time updates)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  Active streaming competitions
                </li>
              </ul>
              <div className="mt-4 flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-300">
                  <strong>Note:</strong> The system will NOT auto-sleep if there's an active streaming competition
                  (isStreaming = true). This prevents interruption during live broadcasts.
                </div>
              </div>
            </div>

            {/* Manual Stop */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <StopIcon className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Manual Stop</h3>
                  <p className="text-sm text-zinc-400">Stop immediately to save costs</p>
                </div>
              </div>
              <p className="text-zinc-300 mb-4">
                If you're done using the system and don't want to wait 2 hours for auto-sleep, you can
                manually stop the coordinator:
              </p>
              <ol className="space-y-3 text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">1</span>
                  <span>Go to <Link to="/_admin/vm-pool" className="text-purple-400 hover:text-purple-300 underline">VM Pool Management</Link></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">2</span>
                  <span>Click the <strong className="text-red-400">"Stop System"</strong> button in the header</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">3</span>
                  <span>The system will shut down in 30-60 seconds</span>
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* Status Indicators Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">Status Indicators</h2>
          <div className="bg-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-700/50">
                <tr>
                  <th className="text-left text-zinc-300 font-medium px-4 py-3">Status</th>
                  <th className="text-left text-zinc-300 font-medium px-4 py-3">Indicator</th>
                  <th className="text-left text-zinc-300 font-medium px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                <tr>
                  <td className="px-4 py-3 text-green-400 font-medium">Online</td>
                  <td className="px-4 py-3"><div className="w-3 h-3 rounded-full bg-green-400" /></td>
                  <td className="px-4 py-3 text-zinc-400">System is running and ready to use</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-zinc-400 font-medium">Sleeping</td>
                  <td className="px-4 py-3"><div className="w-3 h-3 rounded-full bg-zinc-500" /></td>
                  <td className="px-4 py-3 text-zinc-400">System is stopped to save costs</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-yellow-400 font-medium">Starting</td>
                  <td className="px-4 py-3"><div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" /></td>
                  <td className="px-4 py-3 text-zinc-400">System is booting up (60-90 seconds)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-orange-400 font-medium">Stopping</td>
                  <td className="px-4 py-3"><div className="w-3 h-3 rounded-full bg-orange-400 animate-pulse" /></td>
                  <td className="px-4 py-3 text-zinc-400">System is shutting down (30-60 seconds)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Current System Info */}
        {details && (
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">Current System Info</h2>
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Status</div>
                  <div className={`font-medium ${statusColors[status]}`}>{statusLabels[status]}</div>
                </div>
                {details.publicIp && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Public IP</div>
                    <div className="font-mono text-zinc-300">{details.publicIp}</div>
                  </div>
                )}
                {details.uptime && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Uptime</div>
                    <div className="text-zinc-300">{details.uptime}</div>
                  </div>
                )}
                {details.idleMinutes !== undefined && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Idle Time</div>
                    <div className="text-zinc-300">{details.idleMinutes} minutes</div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* FAQ Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">FAQ</h2>
          <div className="space-y-4">
            <div className="bg-zinc-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Why does first startup take longer?</h3>
              <p className="text-zinc-400">
                The first time the EC2 instance starts (or after being stopped for a long time), it may take
                5-8 minutes due to initial setup, cloud-init scripts, and cold boot processes. Subsequent
                wakes are much faster (60-90 seconds).
              </p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">What happens to my VMs when the coordinator sleeps?</h3>
              <p className="text-zinc-400">
                Production VMs (the ones that run OBS) are separate from the coordinator. They will continue
                running independently. However, you won't be able to manage them (start/stop/assign) until
                the coordinator is awake.
              </p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Can I use local development without the coordinator?</h3>
              <p className="text-zinc-400">
                Yes! Routes starting with <code className="bg-zinc-700 px-1.5 py-0.5 rounded text-sm">/local</code> work
                without the coordinator. The competition selector, dashboard, and other standalone pages also
                work independently.
              </p>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/_admin/vm-pool"
              className="bg-zinc-800 hover:bg-zinc-700 rounded-xl p-4 transition-colors group"
            >
              <ServerIcon className="w-8 h-8 text-purple-400 mb-2" />
              <h3 className="text-white font-semibold group-hover:text-purple-300">VM Pool Management</h3>
              <p className="text-sm text-zinc-400">Manage EC2 instances and stop the system</p>
            </Link>
            <Link
              to="/select"
              className="bg-zinc-800 hover:bg-zinc-700 rounded-xl p-4 transition-colors group"
            >
              <PlayIcon className="w-8 h-8 text-green-400 mb-2" />
              <h3 className="text-white font-semibold group-hover:text-green-300">Competition Selector</h3>
              <p className="text-sm text-zinc-400">Start or join a competition</p>
            </Link>
            <Link
              to="/_admin/system-offline"
              className="bg-zinc-800 hover:bg-zinc-700 rounded-xl p-4 transition-colors group"
            >
              <ArrowPathIcon className="w-8 h-8 text-yellow-400 mb-2" />
              <h3 className="text-white font-semibold group-hover:text-yellow-300">System Status</h3>
              <p className="text-sm text-zinc-400">Check status and wake up system</p>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
