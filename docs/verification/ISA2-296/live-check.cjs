// ISA2-296 live check: load ECAC on the show clock, seek to 40:00, read the OBS
// cursor and the competition state, screenshot OBS program (Multi View).
// Run from server/:  node ../docs/verification/ISA2-296/live-check.cjs [coordinatorUrl]
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname);
const io = require('socket.io-client')(process.argv[2] || 'http://127.0.0.1:3196', { query: { compId: 'ecac-2026-agent-test' } });
const call = (ev, payload) => new Promise(res => io.emit(ev, payload, res));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const shot = (name) => new Promise(res => {
  io.once('obs:screenshotData', d => { fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(d.imageData.split(',')[1], 'base64')); res(d.sceneName); });
  io.once('obs:screenshotError', e => res('ERR ' + JSON.stringify(e)));
  io.emit('obs:requestScreenshot', { imageWidth: 1280, imageHeight: 720, imageFormat: 'png' });
});
const log = [];
const say = (...a) => { const line = a.join(' '); log.push(line); console.log(line); };

io.on('connect', async () => {
  await sleep(5000); // let the coordinator open its OBS connection
  say('build-scenes', JSON.stringify(await call('recorded:build-scenes', {})));
  say('load', JSON.stringify(await call('recorded:load', { recording: 'ecac-2026' })));
  const t0 = Date.now();
  say('seek 40:00', JSON.stringify(await call('recorded:seek', { tMs: 2400000 })), `(${Date.now() - t0} ms incl. keyframe catch-up)`);
  say('exec', JSON.stringify(await call('action:execute', { actionId: 'scene:Multi View', sender: 'verify' })));
  await sleep(2000);
  const status = await call('recorded:status', { readObs: true });
  say('status', JSON.stringify(status));
  say('OBS cursor vs 40:00 (ms):', status.obsCursorMs - 2400000);
  say('screenshot scene:', await shot('obs-40m00s-multiview'));
  const cs = await call('competitionState:get', {});
  fs.writeFileSync(path.join(out, 'state-40m00s.json'), JSON.stringify(cs, null, 2));
  const s = cs.state || {};
  say('rotation', JSON.stringify(s.rotation));
  say('standings', s.standings.map(r => `${r.rank}. ${r.team} ${r.total}`).join(' | '));
  for (const [ev, e] of Object.entries(s.events || {})) {
    for (const [team, t] of Object.entries(e.teams)) {
      if (t.athleteUp) say(`up ${ev} ${team}: ${t.athleteUp.name} (${t.routineStatus}, confirmed=${!!t.athleteUp.confirmed}, conf=${t.athleteUp.confidence})`);
    }
  }
  fs.writeFileSync(path.join(out, 'live-check-output.txt'), log.join('\n') + '\n');
  process.exit(0);
});
io.on('connect_error', e => { console.error('connect_error', e.message); process.exit(1); });
