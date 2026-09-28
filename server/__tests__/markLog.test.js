/**
 * Marking mode (ISA2-297): marks append to events.jsonl, undo removes them, and
 * replaying the marked log reproduces the same state. Uses the real ECAC package;
 * events.jsonl is backed up and restored around the tests.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { loadRecordingPackage, loadEvents, recordingDir } from '../lib/recordings/recordingPackage.js';
import { RecordedEventSource } from '../lib/recordings/recordedEventSource.js';
import { getMarkState, appendMark, undoLastMark, startMeasuredLog, expectedOrder } from '../lib/recordings/markLog.js';

const NAME = 'ecac-2026';
const file = path.join(recordingDir(NAME), 'events.jsonl');
const synthetic = path.join(recordingDir(NAME), 'events.synthetic.jsonl');
let backup;
let hadSynthetic;

describe('markLog', () => {
  before(() => {
    backup = fs.readFileSync(file);
    hadSynthetic = fs.existsSync(synthetic);
    startMeasuredLog(NAME);
  });
  after(() => {
    fs.writeFileSync(file, backup);
    if (!hadSynthetic) fs.rmSync(synthetic, { force: true });
  });

  it('starts a measured log with only a header', () => {
    assert.equal(loadEvents(NAME).length, 1);
    assert.equal(getMarkState(NAME).synthetic, false);
  });

  it('orders athletes per apparatus from the Virtius export', () => {
    const order = expectedOrder(loadRecordingPackage(NAME).virtiusFinal);
    assert.ok(order.FLOOR.length > 6);
    assert.equal(order.FLOOR[0].team, 'NAVY');
  });

  it('a green light and a score write two lines and the state replays to the same result', () => {
    const before = getMarkState(NAME).events.find(e => e.event === 'FLOOR');
    const first = before.nextGreen;
    appendMark(NAME, { kind: 'greenLight', event: 'FLOOR', tVideoMs: 1063000 });
    appendMark(NAME, { kind: 'scorePosted', event: 'FLOOR', tVideoMs: 1090000 });
    const rows = loadEvents(NAME);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.slice(1).map(r => r.type), ['greenLight', 'scorePosted']);
    assert.equal(rows[2].athlete.id, first.athlete.id);
    assert.equal(rows[2].score, first.score);
    assert.equal(rows[2].teamTotal, first.score);

    const pkg = loadRecordingPackage(NAME);
    const a = RecordedEventSource.fromPackage(pkg);
    const b = RecordedEventSource.fromPackage(loadRecordingPackage(NAME));
    const strip = (s) => JSON.parse(JSON.stringify(s));
    assert.deepEqual(strip(a.stateAt(1100000)), strip(b.stateAt(1100000)));
    assert.notDeepEqual(strip(a.stateAt(1100000)), strip(a.stateAt(1000000)));

    const state = getMarkState(NAME);
    assert.equal(state.marks, 2);
    assert.equal(state.events.find(e => e.event === 'FLOOR').greenLights, 1);
  });

  it('the next mark moves on to the next expected athlete', () => {
    const next = getMarkState(NAME).events.find(e => e.event === 'FLOOR');
    assert.notEqual(next.nextGreen.athlete.id, loadEvents(NAME)[1].athlete.id);
  });

  it('undo removes the last mark only', () => {
    const undone = undoLastMark(NAME);
    assert.equal(undone.lines[0].type, 'scorePosted');
    assert.equal(loadEvents(NAME).length, 2);
    undoLastMark(NAME);
    assert.equal(loadEvents(NAME).length, 1);
    assert.throws(() => undoLastMark(NAME), /Nothing to undo/);
  });

  it('rejects unknown events and kinds', () => {
    assert.throws(() => appendMark(NAME, { kind: 'greenLight', event: 'NOPE', tVideoMs: 1 }), /Unknown event/);
    assert.throws(() => appendMark(NAME, { kind: 'boo', event: 'FLOOR', tVideoMs: 1 }), /kind/);
  });
});
