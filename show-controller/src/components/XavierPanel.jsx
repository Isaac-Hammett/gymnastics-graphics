import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useXavier from '../hooks/useXavier';

const MODES = [
  { id: 'off', label: 'Off', title: 'Xavier is off' },
  { id: 'suggest', label: 'Suggest', title: 'Suggestions only; you take them' },
  { id: 'auto', label: 'Auto', title: 'Xavier runs actions that clear the threshold; suggests the rest' },
  { id: 'full', label: 'Full', title: 'Xavier runs everything it recommends' }
];

const OUTCOME_TEXT = {
  auto: { text: 'Ran', cls: 'text-emerald-400' },
  refused: { text: 'Blocked by guardrail', cls: 'text-amber-400' },
  cancelled: { text: 'Cancelled', cls: 'text-zinc-400' },
  failed: { text: 'Failed', cls: 'text-red-400' }
};

const pctOf = (p) => `${Math.round((p || 0) * 100)}%`;

/** Seconds left until `until`, ticking once a second while it is in the future. */
function useSecondsLeft(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until || until <= Date.now()) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  return until && until > now ? Math.ceil((until - now) / 1000) : 0;
}

/** What Xavier did on its own (ISA2-277): pending action, cooldown, and recent executions. */
function AutoActivity({ control }) {
  const cooldownLeft = useSecondsLeft(control?.cooldownUntil);
  if (!control) return null;
  const { mode, thresholds = {}, pending, recent = [] } = control;
  const auto = mode === 'auto' || mode === 'full';
  const shown = recent.filter(r => r.outcome !== 'cancelled' || r.reason?.startsWith('producer')).slice(0, 5);
  if (!auto && shown.length === 0) return null;
  return (
    <div className="space-y-1.5" data-testid="xavier-auto-activity">
      {auto && (
        <div className="text-xs text-zinc-400" data-testid="xavier-mode-line">
          {mode === 'full'
            ? 'Full: Xavier runs every action it recommends.'
            : `Auto: runs graphics at ${pctOf(thresholds.graphic)}+ and scenes at ${pctOf(thresholds.scene)}+; suggests the rest.`}
        </div>
      )}
      {auto && cooldownLeft > 0 && (
        <div className="text-xs text-sky-400" data-testid="xavier-cooldown">
          You took over. Xavier waits {cooldownLeft}s before acting again.
        </div>
      )}
      {pending && (
        <div className="text-xs text-amber-300" data-testid="xavier-pending">
          About to run {pending.label} ({pctOf(pending.confidence)}). Any action of yours cancels it.
        </div>
      )}
      {shown.map(r => {
        const o = OUTCOME_TEXT[r.outcome] || OUTCOME_TEXT.failed;
        return (
          <div key={`${r.recommendationId}-${r.at}`} className="flex items-center justify-between gap-2 text-xs rounded bg-zinc-800/60 px-2 py-1" data-testid="xavier-auto-record">
            <span className="text-zinc-200 truncate">{r.label}</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-zinc-400 tabular-nums">{pctOf(r.confidence)}</span>
              <span className={o.cls} title={r.guardrail?.reason || r.reason || r.error || ''}>{o.text}</span>
              <span className="text-zinc-500 tabular-nums">{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_TEXT = {
  no_api_key: 'Jev key missing on the coordinator',
  unreachable: 'Jev is unreachable',
  bad_response: 'Jev sent an unusable reply'
};

function Card({ rec, result, ran, onTake, onDismiss }) {
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
      {ran ? (
        <div className="text-xs text-emerald-400" data-testid="xavier-ran">Ran</div>
      ) : (
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
      )}
    </div>
  );
}

/** Xavier recommendations, mode toggle, and auto activity for Producer View (ISA2-276, ISA2-277). */
export default function XavierPanel({ socket, compId }) {
  const { running, mode, control, status, recommendations, results, ranIds, setMode, take, dismiss } = useXavier(socket, compId);

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 space-y-3" data-testid="xavier-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400 uppercase tracking-wide">Xavier</span>
          <Link
            to={`/${compId}/xavier-log`}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline"
            title="View decision log and take rate"
          >
            Log
          </Link>
        </div>
        <div className="flex rounded overflow-hidden border border-zinc-700">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => m.id !== mode && setMode(m.id)}
              title={m.title}
              data-testid={`xavier-mode-${m.id}`}
              className={`px-2 py-1 text-xs ${m.id === mode ? (m.id === 'auto' || m.id === 'full' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white') : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {m.label}
              {m.id === mode && control?.ladderUnverified && (
                <span className="ml-1 text-[10px] uppercase" data-testid="xavier-toggle-ladder-unverified">ladder unverified</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {control?.ladderUnverified && (
        <div className="text-xs text-amber-400" data-testid="xavier-ladder-unverified" title="Shakespeare is running and its brief is not approved. Approve the brief to let Xavier act.">
          Ladder unverified: {mode === 'full' ? 'Full' : 'Auto'} is holding to suggestions until the Shakespeare brief is approved.
        </div>
      )}
      <AutoActivity control={control} />
      {running && !status.ok && (
        <div className="text-xs text-amber-400">{STATUS_TEXT[status.reason] || status.message || 'Xavier is unavailable'}</div>
      )}
      {running && status.ok && recommendations.length === 0 && (
        <div className="text-xs text-zinc-500">Watching the meet. No suggestions right now.</div>
      )}
      {running && recommendations.map(rec => (
        <Card key={rec.recommendationId} rec={rec} result={results[rec.recommendationId]} ran={!!ranIds[rec.recommendationId]} onTake={take} onDismiss={dismiss} />
      ))}
    </div>
  );
}
