import { useShow } from '../context/ShowContext';
import { useOBS } from '../context/OBSContext';

export default function ConnectionStatus() {
  const { connected, state } = useShow();
  const { obsState } = useOBS();
  // The action bus drives the VM's OBS through the connection manager, which OBSContext tracks;
  // ShowContext's legacy flag is overwritten by full stateUpdate payloads, so honor either.
  const obsConnected = !!(obsState?.connected || state.obsConnected);
  const obsCurrentScene = obsState?.currentScene || state.obsCurrentScene;
  const { obsIsStreaming, obsIsRecording } = state;

  return (
    <div className="flex items-center gap-4 text-sm">
      {/* Server Connection */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-zinc-400">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {/* OBS Connection */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">OBS:</span>
        {obsConnected ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-zinc-300">{obsCurrentScene || 'Ready'}</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-zinc-400">Not connected</span>
          </>
        )}
      </div>

      {/* Streaming/Recording Status */}
      {obsIsStreaming && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 rounded text-red-400">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          LIVE
        </div>
      )}

      {obsIsRecording && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded text-orange-400">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          REC
        </div>
      )}
    </div>
  );
}
