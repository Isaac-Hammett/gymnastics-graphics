/**
 * Recording Package Tests (ISA2-294)
 *
 * Covers the loader (meta.json, virtius-final.json, events.jsonl) and
 * tileFor() across the 3x2 → 2x2 layout switch recorded for ecac-2026.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  listRecordings,
  loadMeta,
  loadVirtiusFinal,
  loadEvents,
  layoutEntryAt,
  loadRecordingPackage,
} from '../lib/recordings/recordingPackage.js';

const RECORDING = 'ecac-2026';

describe('recordingPackage', () => {
  it('lists the committed ecac-2026 recording', () => {
    assert.ok(listRecordings().includes(RECORDING));
  });

  it('loads meta.json with a layout timeline covering the whole video', () => {
    const meta = loadMeta(RECORDING);
    assert.ok(meta);
    assert.equal(meta.width, 1280);
    assert.equal(meta.height, 720);
    assert.ok(meta.durationMs > 0);
    assert.ok(Array.isArray(meta.layoutTimeline));
    assert.equal(meta.layoutTimeline[0].fromMs, 0);
    for (const entry of meta.layoutTimeline) {
      assert.ok(entry.tiles && typeof entry.tiles === 'object');
    }
  });

  it('loads virtius-final.json with the 6 Olympic-order events', () => {
    const virtiusFinal = loadVirtiusFinal(RECORDING);
    assert.ok(virtiusFinal);
    const eventNames = virtiusFinal.meet.event_results.map(e => e.event_name);
    for (const ev of ['FLOOR', 'HORSE', 'RINGS', 'VAULT', 'PBARS', 'BAR']) {
      assert.ok(eventNames.includes(ev));
    }
  });

  it('returns an empty array for events.jsonl before Step 7d writes it', () => {
    assert.deepEqual(loadEvents(RECORDING), []);
  });

  it('returns null for an unknown recording', () => {
    assert.equal(loadMeta('does-not-exist'), null);
    assert.equal(loadVirtiusFinal('does-not-exist'), null);
    assert.deepEqual(loadEvents('does-not-exist'), []);
  });

  it('layoutEntryAt picks the last entry whose fromMs has passed', () => {
    const meta = loadMeta(RECORDING);
    assert.equal(layoutEntryAt(meta, 0).layout, 'other');
    assert.equal(layoutEntryAt(meta, 2399999).layout, 'other');
    assert.equal(layoutEntryAt(meta, 2400000).layout, '3x2');
    assert.equal(layoutEntryAt(meta, 4799999).layout, '3x2');
    assert.equal(layoutEntryAt(meta, 4800000).layout, '2x2');
    assert.equal(layoutEntryAt(meta, meta.durationMs - 1).layout, '2x2');
  });

  it('tileFor returns null before the grid layouts start', () => {
    const pkg = loadRecordingPackage(RECORDING);
    assert.equal(pkg.tileFor('FLOOR', 0), null);
    assert.equal(pkg.tileFor('FLOOR', 2399999), null);
  });

  it('tileFor returns the 3x2 Olympic-order tiles just after the 40:00 switch', () => {
    const pkg = loadRecordingPackage(RECORDING);
    const t = 2400000; // 40:00
    assert.deepEqual(pkg.tileFor('FLOOR', t), { x: 0, y: 0, w: 582, h: 332 });
    assert.deepEqual(pkg.tileFor('HORSE', t), { x: 582, y: 0, w: 388, h: 332 });
    assert.deepEqual(pkg.tileFor('RINGS', t), { x: 970, y: 0, w: 310, h: 332 });
    assert.deepEqual(pkg.tileFor('VAULT', t), { x: 0, y: 332, w: 582, h: 298 });
    assert.deepEqual(pkg.tileFor('PBARS', t), { x: 582, y: 332, w: 388, h: 298 });
    assert.deepEqual(pkg.tileFor('BAR', t), { x: 970, y: 332, w: 310, h: 298 });
  });

  it('tileFor returns the 2x2 tiles just after the 1:20:00 switch, dropping HORSE and VAULT', () => {
    const pkg = loadRecordingPackage(RECORDING);
    const t = 4800000; // 1:20:00
    assert.deepEqual(pkg.tileFor('FLOOR', t), { x: 28, y: 8, w: 610, h: 337 });
    assert.deepEqual(pkg.tileFor('PBARS', t), { x: 642, y: 8, w: 610, h: 337 });
    assert.deepEqual(pkg.tileFor('RINGS', t), { x: 28, y: 349, w: 610, h: 279 });
    assert.deepEqual(pkg.tileFor('BAR', t), { x: 642, y: 349, w: 610, h: 279 });
    assert.equal(pkg.tileFor('HORSE', t), null);
    assert.equal(pkg.tileFor('VAULT', t), null);
  });

  it('tileFor is stable right at the switch boundary (no straddling gap)', () => {
    const pkg = loadRecordingPackage(RECORDING);
    assert.equal(pkg.tileFor('FLOOR', 2399999), null);
    assert.ok(pkg.tileFor('FLOOR', 2400000));
  });
});
