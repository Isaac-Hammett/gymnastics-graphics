import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompetitionStateService } from '../lib/competitionState/service.js';
import { injectInputs, registerStateInjection } from '../lib/competitionState/devInject.js';

const gy = (id, order, score) => ({ gymnast_id: id, full_name: `G${id}`, order, final_score: score });
const snap = (s1) => ({ meet: { teams: [{ tricode: 'AAA', name: 'A', events: [
  { event_name: 'FLOOR', rotation: 1, gymnasts: [gy(1, 1, s1), gy(2, 2, null)] }] }] } });

describe('competitionState dev inject', () => {
  it('refuses competitions off the allowlist', () => {
    const svc = new CompetitionStateService({ compId: 'real-meet' });
    const r = injectInputs(svc, { compId: 'real-meet', input: { snapshot: snap('9.0') } });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'inject_not_allowed_for_competition');
    assert.equal(svc.getPublicState().hasSnapshot, false);
  });

  it('drives a test comp to in_progress via greenLight', () => {
    const svc = new CompetitionStateService({ compId: 'ecac-2026-agent-test' });
    const r = injectInputs(svc, { compId: 'ecac-2026-agent-test', inputs: [
      { snapshot: snap('9.0') }, { signal: { type: 'greenLight', event: 'FLOOR', team: 'AAA' } }] });
    assert.equal(r.ok, true);
    assert.equal(svc.getPublicState().events.FLOOR.teams.AAA.routineStatus, 'in_progress');
  });

  it('rejects empty and malformed input', () => {
    const svc = new CompetitionStateService({ compId: 'ecac-2026-agent-test' });
    assert.equal(injectInputs(svc, { compId: 'ecac-2026-agent-test' }).error, 'no_input');
    assert.equal(injectInputs(svc, { compId: 'ecac-2026-agent-test', input: { x: 1 } }).error, 'input_needs_snapshot_or_signal');
  });
});

describe('competitionState inject socket gate (ISA2-317)', () => {
  const fakeSocket = () => { const h = {}; return { h, on: (e, f) => { h[e] = f; } }; };
  const mk = () => new CompetitionStateService({ compId: 'ecac-2026-agent-test' });
  const payload = { compId: 'ecac-2026-agent-test', input: { snapshot: snap('9.0') } };

  it('does not register the event without the flag', () => {
    const s = fakeSocket();
    assert.equal(registerStateInjection(s, { getService: mk }, {}), false);
    assert.equal(registerStateInjection(s, { getService: mk }, { ALLOW_STATE_INJECTION: '0' }), false);
    assert.equal(s.h['competitionState:inject'], undefined);
  });

  it('handles the event with the flag', () => {
    const s = fakeSocket();
    assert.equal(registerStateInjection(s, { getService: mk }, { ALLOW_STATE_INJECTION: '1' }), true);
    let res; s.h['competitionState:inject'](payload, (r) => { res = r; });
    assert.equal(res.ok, true);
  });
});
