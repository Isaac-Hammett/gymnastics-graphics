// ISA2-277 live check against the test VM's OBS (run from server/: node ../docs/verification/ISA2-277/live-check.cjs <port>)
// Auto fires a graphic above threshold; a manual cut during the cooldown is not overridden.
const C = 'ecac-2026-agent-test';
const io = require('socket.io-client')(`http://127.0.0.1:${process.argv[2] || 3177}`, { query: { compId: C } });
const call = (ev, p) => new Promise(r => io.emit(ev, p, r));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const out = []; const log = (step, result) => out.push({ step, result });
const executed = []; const auto = [];
io.on('action:executed', e => executed.push({ actionId: e.actionId, sender: e.sender, ok: e.ok, guardrail: e.guardrail?.rule || null, at: e.at }));
io.on('xavier:auto', e => auto.push({ actionId: e.actionId, outcome: e.outcome, confidence: e.confidence, threshold: e.threshold, reason: e.reason || null, rule: e.guardrail?.rule || null }));
io.on('connect', async () => {
  await sleep(5000);
  const snap = await call('xavier:get', { compId: C });
  log('control before', { mode: snap.control?.mode, thresholds: snap.control?.thresholds, cooldownMs: snap.control?.cooldownMs });
  const cat = await call('action:catalog', { compId: C });
  const graphics = cat.actions.filter(a => a.kind === 'graphic').map(a => a.id);
  const scenes = cat.actions.filter(a => a.kind === 'scene').map(a => a.id);
  log('catalog', { obsScenes: scenes.length, graphics: graphics.length });
  const g = graphics.includes('graphic:team1-roster') ? 'graphic:team1-roster' : graphics.find(id => id !== 'graphic:clear');

  log('inject rejected for a real comp', await call('xavier:inject', { compId: 'ecac-2026', recommendations: [{ actionId: g, probability: 0.9 }] }));
  const m = await call('xavier:setMode', { compId: C, mode: 'auto' });
  log('setMode auto', { ok: m.ok, persisted: m.persisted, mode: m.control?.mode, running: m.running });
  log('producer clears graphic', await call('action:execute', { compId: C, actionId: 'graphic:clear', sender: 'producer' }));
  await sleep(10500); // let that producer action's cooldown pass

  log(`inject ${g} at 0.90 (graphic threshold 0.80)`, (await call('xavier:inject', { compId: C, recommendations: [{ actionId: g, probability: 0.9 }], holdProbability: 0.05, trigger: 'Score posted (injected)' })).ok);
  await sleep(2500);
  log('after auto graphic', { auto: auto.slice(), executed: executed.filter(e => e.sender === 'xavier-auto') });

  log('inject scene:Cam PH at 0.85 (scene threshold 0.92): suggest only', (await call('xavier:inject', { compId: C, recommendations: [{ actionId: 'scene:Cam PH', probability: 0.85 }] })).ok);
  await sleep(2000);
  log('xavier-auto commands so far', executed.filter(e => e.sender === 'xavier-auto').length);

  await sleep(1500);
  const cut = await call('action:execute', { compId: C, actionId: 'scene:Cam FX', sender: 'producer' });
  log('producer manual cut to Cam FX', cut);
  log('inject scene:Cam PH at 0.99 during cooldown', (await call('xavier:inject', { compId: C, recommendations: [{ actionId: 'scene:Cam PH', probability: 0.99 }] })).ok);
  await sleep(2500);
  const s2 = await call('xavier:get', { compId: C });
  log('during cooldown', { cooldownUntil: s2.control?.cooldownUntil, pending: s2.control?.pending, xavierAutoCommands: executed.filter(e => e.sender === 'xavier-auto').map(e => e.actionId) });
  const probe = await call('action:execute', { compId: C, actionId: 'scene:Cam FX', sender: 'producer-probe' });
  log('program still Cam FX (probe re-cut is a no-op)', { ok: probe.ok, alreadyActive: probe.alreadyActive ?? null, error: probe.error });

  // A pending action cancelled by a producer action.
  await sleep(10500);
  await call('xavier:inject', { compId: C, recommendations: [{ actionId: 'graphic:clear', probability: 0.95 }] });
  await sleep(100);
  const s3 = await call('xavier:get', { compId: C });
  log('pending before producer action', s3.control?.pending?.actionId || null);
  await call('action:execute', { compId: C, actionId: g, sender: 'producer' });
  await sleep(1500);
  log('xavier:auto records', auto);
  log('all commands', executed);
  console.log(JSON.stringify(out, null, 2));
  process.exit();
});
