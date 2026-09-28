// Live check against the coordinator: node live-check.cjs (run from server/)
const io = require('socket.io-client');
const fs = require('fs');
const out = process.argv[2] || '../docs/verification/ISA2-295';
const s = io('http://127.0.0.1:3195', { query: { compId: 'ecac-2026-agent-test' } });
const emit = (ev, p) => new Promise(r => s.emit(ev, p, r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = (name) => new Promise(res => {
  s.once('obs:screenshotData', d => { fs.writeFileSync(`${out}/${name}.png`, Buffer.from(d.imageData.split(',')[1], 'base64')); res(d.sceneName); });
  s.once('obs:screenshotError', e => res('ERR ' + JSON.stringify(e)));
  s.emit('obs:requestScreenshot', { imageWidth: 960, imageHeight: 540, imageFormat: 'png' });
});
s.on('connect', async () => {
  await sleep(4000);
  console.log('build1', JSON.stringify(await emit('recorded:build-scenes', {})));
  console.log('build2', JSON.stringify(await emit('recorded:build-scenes', {})));
  const cat = await emit('action:catalog', {});
  console.log('catalog has Cam FX:', cat.actions.some(a => a.id === 'scene:Cam FX'), cat.actions.filter(a => /^scene:(Cam|Multi)/.test(a.id)).map(a => a.id).join(','));
  for (const [t, name] of [[2400000, 'layout-3x2-cam-fx'], [4800000, 'layout-2x2-cam-fx']]) {
    console.log('apply', t, JSON.stringify(await emit('recorded:apply-layout', { tMs: t })));
    console.log('seek', JSON.stringify(await emit('recorded:seek', { tMs: t })));
    console.log('exec', JSON.stringify(await emit('action:execute', { actionId: 'scene:Cam FX', sender: 'verify' })));
    await sleep(2500);
    console.log('shot', name, await shot(name));
  }
  process.exit(0);
});
