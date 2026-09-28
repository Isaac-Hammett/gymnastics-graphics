import useXavier from '../hooks/useXavier';

const MODES = [
  { id: 'off', label: 'Off' },
  { id: 'suggest', label: 'Suggest' },
  { id: 'auto', label: 'Auto', disabled: true },
  { id: 'full', label: 'Full', disabled: true }
];

const STATUS_TEXT = {
  no_api_key: 'Jev key missing on the coordinator',
  unreachable: 'Jev is unreachable',
  bad_response: 'Jev sent an unusable reply'
};

function Card({ rec, result, onTake, onDismiss }) {
  const pct = Math.round((rec.probability || 0) * 100);
  const warning = result?.guardrail || rec.guardrail;
  return (
    <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 space-y-2" data-testid="xavier-card">
      <div className="text-sm font-medium text-zinc-100">{rec.label}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded bg-zinc-700 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-zinc-400 tabular-nums w-9 text-right">{pct}%</span>
      </div>
      {rec.trigger && <div className="text-xs text-zinc-400">{rec.trigger}</div>}
      {warning && (
        <div className="text-xs text-amber-400" data-testid="xavier-guardrail">
          Guardrail: {warning.reason || warning.rule}
        </div>
      )}
      {result && !result.pending && (
        <div className={`text-xs ${result.ok ? 'text-emerald-400' : 'text-red-400'}`} data-testid="xavier-ack">
          {result.ok ? 'Done' : `Not run: ${result.guardrail ? 'blocked by guardrail' : (result.error || 'failed')}`}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onTake(rec)}
          disabled={result?.pending}
          className="flex-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
        >
          {result?.pending ? 'Taking...' : 'Take'}
        </button>
        <button
          onClick={() => onDismiss(rec)}
          className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/** Xavier recommendations and mode toggle for Producer View (ISA2-276). */
export default function XavierPanel({ socket, compId }) {
  const { running, status, recommendations, results, setMode, take, dismiss } = useXavier(socket, compId);
  const mode = running ? 'suggest' : 'off';

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 space-y-3" data-testid="xavier-panel">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-zinc-400 uppercase tracking-wide">Xavier</span>
        <div className="flex rounded overflow-hidden border border-zinc-700">
          {MODES.map(m => (
            <button
              key={m.id}
              disabled={m.disabled}
              onClick={() => !m.disabled && m.id !== mode && setMode(m.id)}
              title={m.disabled ? 'Not available yet' : undefined}
              className={`px-2 py-1 text-xs ${m.id === mode ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'} ${m.disabled ? 'opacity-40 cursor-not-allowed hover:bg-zinc-800' : ''}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {running && !status.ok && (
        <div className="text-xs text-amber-400">{STATUS_TEXT[status.reason] || status.message || 'Xavier is unavailable'}</div>
      )}
      {running && status.ok && recommendations.length === 0 && (
        <div className="text-xs text-zinc-500">Watching the meet. No suggestions right now.</div>
      )}
      {running && recommendations.map(rec => (
        <Card key={rec.recommendationId} rec={rec} result={results[rec.recommendationId]} onTake={take} onDismiss={dismiss} />
      ))}
    </div>
  );
}
