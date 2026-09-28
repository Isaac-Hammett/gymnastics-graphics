import assert from 'node:assert/strict';
import { bucketIndex, takeRateByBucket, listRuns } from './xavierLog.js';

assert.equal(bucketIndex(0), 0);
assert.equal(bucketIndex(0.3), 3);
assert.equal(bucketIndex(0.87), 8);
assert.equal(bucketIndex(1), 9);
assert.equal(bucketIndex(null), null);
const rows = [
  { confidence: 0.95, outcome: { type: 'took' } },
  { confidence: 0.91, outcome: { type: 'dismissed' } },
  { confidence: 0.55, outcome: { type: 'expired' } },
  { confidence: 0.5, outcome: { type: 'took' } },
];
const b = takeRateByBucket(rows);
assert.deepEqual([b[9].n, b[9].took, b[9].rate], [2, 1, 0.5]);
assert.deepEqual([b[5].n, b[5].took, b[5].rate], [2, 1, 0.5]);
assert.equal(b[0].rate, null);
assert.equal(listRuns([{ runId: 'a', ts: 2 }, { runId: 'a', ts: 1 }, { runId: 'b', ts: 5 }])[0].runId, 'b');
console.log('xavierLog ok');
