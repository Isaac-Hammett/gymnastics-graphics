/**
 * Inline guardrail refusal (ISA2-303): the rule and reason, plus the
 * second-tap hint. Renders nothing when there is no refusal.
 */
export function GuardrailNotice({ refusal, className = '' }) {
  if (!refusal) return null;
  return (
    <div
      data-testid="guardrail-refusal"
      className={`rounded-lg border border-amber-500/60 bg-amber-900/40 px-3 py-2 text-sm text-amber-200 ${className}`}
    >
      <span className="font-semibold">Refused ({refusal.rule}):</span> {refusal.reason}
      <span className="ml-2 text-amber-400">Tap again to force.</span>
    </div>
  );
}

/** Recent refusals and forced overrides for the competition, newest first. */
export function GuardrailActivity({ events }) {
  if (!events?.length) return null;
  return (
    <div data-testid="guardrail-activity" className="bg-zinc-800 rounded-xl p-4">
      <div className="text-sm text-zinc-400 uppercase tracking-wide mb-2">Guardrail activity</div>
      <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
        {events.map(e => (
          <li key={e.id} className={e.kind === 'override' ? 'text-orange-300' : 'text-amber-200'}>
            <span className="text-zinc-500">{new Date(e.at).toLocaleTimeString()}</span>{' '}
            {e.kind === 'override' ? 'Override' : 'Refused'} {e.actionId}
            {e.rule ? ` (${e.rule})` : ''}{e.reason ? `: ${e.reason}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
