/**
 * Dev/test input injection for the competition state service (ISA2-314).
 *
 * Lets a test drive a running coordinator's state service into `in_progress`
 * (or any state) without a real Virtius session. Gated to an allowlist of test
 * competitions so it can never touch a real one. Default allowlist:
 * `ecac-2026-agent-test`; override with DEV_STATE_INJECT_COMP_IDS (comma list).
 */

const DEFAULT_ALLOWED = ['ecac-2026-agent-test'];

export function devInjectAllowedComps(env = process.env) {
  const raw = env.DEV_STATE_INJECT_COMP_IDS;
  if (!raw) return DEFAULT_ALLOWED;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Feed one input, or a list, into a state service.
 * @param {Object} svc CompetitionStateService
 * @param {Object} payload { compId, input?, inputs? } where an input is
 *   { t?, snapshot } or { t?, signal }; `t` defaults to Date.now()
 * @returns {{ok:boolean,error?:string,ingested?:number,events?:Object[]}}
 */
export function injectInputs(svc, payload, now = Date.now()) {
  const compId = payload?.compId;
  if (!compId) return { ok: false, error: 'no_comp_id' };
  if (!devInjectAllowedComps().includes(compId)) return { ok: false, error: 'inject_not_allowed_for_competition' };
  const list = Array.isArray(payload.inputs) ? payload.inputs : (payload.input ? [payload.input] : []);
  if (list.length === 0) return { ok: false, error: 'no_input' };
  if (!list.every(i => i && typeof i === 'object' && (i.snapshot || i.signal))) {
    return { ok: false, error: 'input_needs_snapshot_or_signal' };
  }
  const events = [];
  list.forEach((input, idx) => {
    events.push(...svc.ingest({ ...input, t: input.t ?? now + idx }));
  });
  return { ok: true, ingested: list.length, events };
}
