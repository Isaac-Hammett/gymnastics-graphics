import { useShow } from '../context/ShowContext';

export default function ConnectionStatus() {
  const { connected, state } = useShow();
  const { obsConnected, obsCurrentScene, obsIsStreaming, obsIsRecording } = state;

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
