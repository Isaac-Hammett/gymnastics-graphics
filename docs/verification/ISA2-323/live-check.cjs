// ISA2-323: Xavier Auto with Jev over a recorded ECAC meet on the test VM.
// Run from server/: node ../docs/verification/ISA2-323/live-check.cjs <port> [startMs] [durationSec] [manualCutAtSec]
// No xavier:inject. Recommendations come from Jev; the recorded show feeds competition state.
const C = 'ecac-2026-agent-test';
const port = process.argv[2] || 3123;
const startMs = Number(process.argv[3]) || 2072000; // 34:32
const durationSec = Number(process.argv[4]) || 420;
const cutAtSec = Number(process.argv[5]) || Math.floor(durationSec / 2);
const io = require('socket.io-client')(`http://127.0.0.1:${port}`, { query: { compId: C } });
const call = (ev, p) => new Promise(r => io.emit(ev, p, r));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const out = { startMs, durationSec, steps: [] };
const log = (step, result) => { out.steps.push({ step, result }); console.error(step); };
const recs = [], executed = [], auto = [], statuses = [];
io.on('xavier:recommendations', r => recs.push({ at: r.at, trigger: r.trigger, latencyMs: r.latencyMs, model: r.model, hold: r.holdProbability, top: (r.recommendations || []).map(x => ({ id: x.actionId, p: x.probability })) }));
io.on('xavier:status', s => statuses.push({ at: Date.now(), ...s }));
io.on('action:executed', e => executed.push({ actionId: e.actionId, sender: e.sender, ok: e.ok, guardrail: e.guardrail?.rule || null, at: e.at }));
io.on('xavier:auto', e => auto.push({ at: Date.now(), actionId: e.actionId, outcome: e.outcome, confidence: e.confidence, threshold: e.threshold, reason: e.reason || null, rule: e.guardrail?.rule || null }));
io.on('connect', async () => {
  await sleep(5000);
  await call('xavier:setMode', { compId: C, mode: 'off' });
  const ld = await call('recorded:load', { compId: C, startMs });
  log('recorded:load', ld);
  log('xavier:setMode auto', (({ ok, control }) => ({ ok, mode: control?.mode, thresholds: control?.thresholds }))(await call('xavier:setMode', { compId: C, mode: 'auto' })));
  log('recorded:play', await call('recorded:play', { compId: C }));
  const t0 = Date.now();
  let cut = null;
  while ((Date.now() - t0) / 1000 < durationSec) {
    await sleep(1000);
    const el = (Date.now() - t0) / 1000;
    if (!cut && el >= cutAtSec) {
      const s = await call('xavier:get', { compId: C });
      const pending = s.control?.pending || null;
      const c = await call('action:execute', { compId: C, actionId: 'scene:Cam FX', sender: 'producer' });
      await sleep(300);
      const s2 = await call('xavier:get', { compId: C });
      cut = { pendingBefore: pending, cut: { ok: c.ok, error: c.error }, cooldownUntil: s2.control?.cooldownUntil, pendingAfter: s2.control?.pending || null, autoDuringCooldown: null, at: Date.now() };
      log('manual cut', cut);
    }
    if (el % 30 < 1) console.error(`t=${Math.round(el)}s recs=${recs.length} auto=${auto.length} status=${statuses.at(-1)?.reason ?? 'ok'}`);
  }
  log('recorded:status', await call('recorded:status', { compId: C }));
  await call('recorded:pause', { compId: C });
  await call('xavier:setMode', { compId: C, mode: 'suggest' });
  if (cut) cut.autoAfterCutWithin10s = auto.filter(a => a.outcome === 'auto' && a.at > cut.at && a.at < cut.at + 10000).length;
  const lat = recs.map(r => r.latencyMs).filter(Number.isFinite).sort((a, b) => a - b);
  const q = (p) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null;
  out.summary = { recommendations: recs.length, latencyMs: { n: lat.length, min: lat[0] ?? null, p50: q(0.5), p90: q(0.9), max: lat.at(-1) ?? null }, autoOutcomes: auto.reduce((m, a) => (m[a.outcome] = (m[a.outcome] || 0) + 1, m), {}), statusChanges: statuses.length };
  out.recommendations = recs; out.auto = auto; out.executed = executed; out.statuses = statuses;
  console.log(JSON.stringify(out, null, 2));
  process.exit();
});
