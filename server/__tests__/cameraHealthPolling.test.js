import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraHealthMonitor } from '../lib/cameraHealth.js';

const cams = [{ id: 'c1', name: 'Cam 1', srtPort: 9001 }];

test('does not poll when no Nimble host is configured', () => {
  const m = new CameraHealthMonitor({ cameras: cams, nimbleServer: {} });
  let calls = 0;
  m.fetchNimbleStats = async () => { calls++; return {}; };
  m.start();
  assert.equal(calls, 0);
  assert.equal(m._pollTimer, null);
  m.stop();
});

test('never runs overlapping polls', async () => {
  const m = new CameraHealthMonitor({ cameras: cams, nimbleServer: { host: 'x', statsPort: 1, pollIntervalMs: 10 } });
  let calls = 0;
  let release;
  m.fetchNimbleStats = () => { calls++; return new Promise(r => { release = r; }); };
  m._isRunning = true;
  const first = m.pollHealth();
  await m.pollHealth();
  await m.pollHealth();
  assert.equal(calls, 1);
  release({});
  await first;
  m._isRunning = false;
});

test('backs off after failures and resets on success', async () => {
  const m = new CameraHealthMonitor({ cameras: cams, nimbleServer: { host: 'x', statsPort: 1, pollIntervalMs: 2000 } });
  m.on('error', () => {});
  let calls = 0;
  let fail = true;
  m.fetchNimbleStats = async () => { calls++; if (fail) throw new Error('down'); return {}; };
  m._isRunning = true;
  await m.pollHealth();
  await m.pollHealth(); // skipped: backing off
  await m.pollHealth();
  assert.equal(calls, 1);
  assert.ok(m._skipUntil > Date.now());
  m._skipUntil = 0;
  fail = false;
  await m.pollHealth();
  assert.equal(calls, 2);
  assert.equal(m._failStreak, 0);
  m._isRunning = false;
});
