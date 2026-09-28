// ISA2-273 live check: guardrails on the action bus against the test VM's OBS.
// Run from server/: node ../docs/verification/ISA2-273/live-check.cjs [coordinatorUrl]
const io = require('socket.io-client')(process.argv[2] || 'http://127.0.0.1:3173', {
  query: { compId: 'ecac-2026-agent-test' },
});
const emit = (event, payload) => new Promise((resolve) => io.emit(event, payload, resolve));
const exec = async (label, payload) => {
  const t = Date.now();
  const ack = await emit('action:execute', payload);
  console.log(`${label} (+${Date.now() - t}ms):`, JSON.stringify(ack));
  return ack;
};
const refused = [];
io.on('action:refused', (r) => refused.push(r));
const executed = [];
io.on('action:executed', (r) => executed.push(r));

io.on('connect', () => setTimeout(async () => {
  const catalog = await emit('action:catalog', {});
  const scenes = catalog.actions.filter((a) => a.kind === 'scene' && a.params.source !== 'rundown').map((a) => a.params.sceneName);
  console.log('obsConnected:', catalog.obsConnected, 'scenes:', JSON.stringify(scenes));
  const [a, b] = scenes;

  // 1. Put scene A on program (forced, so the check starts from a known state).
  await exec(`1. producer force cut to "${a}"`, { actionId: `scene:${a}`, sender: 'producer', force: true });
  // 2. The same producer cuts to B inside the 3000ms hold: refused.
  const r2 = await exec(`2. producer cut to "${b}" inside hold`, { actionId: `scene:${b}`, sender: 'producer' });
  // 3. Xavier with force: still refused.
  const r3 = await exec(`3. xavier-auto force cut to "${b}"`, { actionId: `scene:${b}`, sender: 'xavier-auto', force: true });
  // 4. Program scene unchanged: a forced cut to A finds it already live.
  const r4 = await exec(`4. probe: is "${a}" still on program?`, { actionId: `scene:${a}`, sender: 'producer', force: true });
  await new Promise((r) => setTimeout(r, 200));
  const probe = executed[executed.length - 1];
  console.log('   probe broadcast:', JSON.stringify(probe));
  // 5. The same cut with force from a human goes through.
  const r5 = await exec(`5. producer force cut to "${b}"`, { actionId: `scene:${b}`, sender: 'producer', force: true });

  await new Promise((r) => setTimeout(r, 500));
  console.log('action:refused broadcasts:', refused.length, JSON.stringify(refused.map((x) => ({ sender: x.sender, rule: x.guardrail?.rule }))));
  const pass = r2.ok === false && r2.guardrail?.rule === 'minShotHoldMs'
    && r3.ok === false && r3.guardrail?.rule === 'minShotHoldMs'
    && r4.ok === true && probe?.alreadyActive === true
    && r5.ok === true && r5.guardrailOverride?.[0]?.rule === 'minShotHoldMs'
    && refused.length === 2;
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}, 4000));
