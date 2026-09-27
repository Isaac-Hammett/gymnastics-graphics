/**
 * The VM pool must keep working from Firebase when AWS is unavailable, so a coordinator without AWS
 * access (a laptop, an agent test coordinator, a server whose IAM role is missing) can still find the VM
 * assigned to a competition and connect to its OBS. Nothing may be removed from the pool in that mode.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VMPoolManager } from '../lib/vmPoolManager.js';

const ASSIGNED_VM = {
  instanceId: 'i-0b914e8ea3a6bf62b',
  publicIp: '54.162.253.32',
  status: 'assigned',
  assignedTo: 'ecac-2026-agent-test',
};

function stubbedPool({ awsFails }) {
  const pool = new VMPoolManager();
  const calls = { removed: [] };
  pool._loadPoolConfig = async () => { pool._poolConfig = { warmCount: 0 }; };
  pool._syncWithAWS = async () => {
    if (awsFails) {
      const err = new Error('Could not load credentials from any providers');
      err.name = 'CredentialsProviderError';
      throw err;
    }
  };
  // Stands in for the Firebase 'value' listener on vmPool/vms.
  pool._setupFirebaseListener = () => { pool._vms.set('vm-4e8ea3a6', { ...ASSIGNED_VM }); };
  return { pool, calls };
}

test('pool initializes from Firebase when AWS is unavailable', async () => {
  const { pool } = stubbedPool({ awsFails: true });
  const result = await pool.initializePool();

  assert.equal(result.success, true);
  assert.equal(pool.isInitialized(), true);
  assert.equal(pool.getPoolStatus().awsAvailable, false);
});

test('an assigned VM is found for its competition without AWS', async () => {
  const { pool } = stubbedPool({ awsFails: true });
  await pool.initializePool();

  const vm = pool.getVMForCompetition('ecac-2026-agent-test');
  assert.ok(vm, 'expected the assigned VM');
  assert.equal(vm.publicIp, '54.162.253.32');
  assert.equal(pool.getVMForCompetition('some-other-competition'), null);
});

test('pool reports AWS available when the sync succeeds', async () => {
  const { pool } = stubbedPool({ awsFails: false });
  await pool.initializePool();

  assert.equal(pool.isInitialized(), true);
  assert.equal(pool.getPoolStatus().awsAvailable, true);
});
