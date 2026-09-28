/**
 * Recording Package Tests (ISA2-294)
 *
 * Covers the loader (meta.json, virtius-final.json, events.jsonl) and
 * tileFor() across the 3x2 → 2x2 layout switch recorded for ecac-2026, and
 * (ISA2-301) across the cutaways: 5-tile, 2-panel, single cam, full-screen
 * leaderboards, and the trophy ceremony.
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
    assert.equal(layoutEntryAt(meta, 1037999).layout, 'other');
    assert.equal(layoutEntryAt(meta, 1038000).layout, '3x2');
    assert.equal(layoutEntryAt(meta, 1431999).layout, '3x2');
    assert.equal(layoutEntryAt(meta, 1432000).layout, '5-tile');
    assert.equal(layoutEntryAt(meta, meta.durationMs - 1).layout, 'ceremony');
  });

  it('timeline is sorted and every entry is tiles-or-null shaped', () => {
    const { layoutTimeline } = loadMeta(RECORDING);
    for (let i = 1; i < layoutTimeline.length; i++) {
      assert.ok(layoutTimeline[i].fromMs > layoutTimeline[i - 1].fromMs);
    }
    for (const entry of layoutTimeline) {
      assert.ok(entry.note && entry.note.length > 0);
      if (Object.keys(entry.tiles).length === 0) {
        assert.ok(['other', '5-tile', '2-panel', 'single-cam', 'leaderboard', 'ceremony'].includes(entry.layout));
      } else {
        assert.ok(['3x2', '2x2'].includes(entry.layout));
      }
    }
  });

  it('tileFor returns null before the first grid layout starts (17:18)', () => {
    const pkg = loadRecordingPackage(RECORDING);
    assert.equal(pkg.tileFor('FLOOR', 0), null);
    assert.equal(pkg.tileFor('FLOOR', 1037999), null);
  });

  it('tileFor returns the 3x2 Olympic-order tiles from 17:18, well before the old 40:00 switch', () => {
    const pkg = loadRecordingPackage(RECORDING);
    for (const t of [1038000, 1300000, 2200000, 2400000]) {
      assert.deepEqual(pkg.tileFor('FLOOR', t), { x: 0, y: 0, w: 582, h: 332 });
      assert.deepEqual(pkg.tileFor('HORSE', t), { x: 582, y: 0, w: 388, h: 332 });
      assert.deepEqual(pkg.tileFor('RINGS', t), { x: 970, y: 0, w: 310, h: 332 });
      assert.deepEqual(pkg.tileFor('VAULT', t), { x: 0, y: 332, w: 582, h: 298 });
      assert.deepEqual(pkg.tileFor('PBARS', t), { x: 582, y: 332, w: 388, h: 298 });
      assert.deepEqual(pkg.tileFor('BAR', t), { x: 970, y: 332, w: 310, h: 298 });
    }
  });

  it('tileFor returns the 2x2 tiles at 1:20:00 (inside the 1:19:29 2x2 block), dropping HORSE and VAULT', () => {
    const pkg = loadRecordingPackage(RECORDING);
    const t = 4800000; // 1:20:00
    assert.deepEqual(pkg.tileFor('FLOOR', t), { x: 28, y: 8, w: 610, h: 337 });
    assert.deepEqual(pkg.tileFor('PBARS', t), { x: 642, y: 8, w: 610, h: 337 });
    assert.deepEqual(pkg.tileFor('RINGS', t), { x: 28, y: 349, w: 610, h: 279 });
    assert.deepEqual(pkg.tileFor('BAR', t), { x: 642, y: 349, w: 610, h: 279 });
    assert.equal(pkg.tileFor('HORSE', t), null);
    assert.equal(pkg.tileFor('VAULT', t), null);
  });

  it('the last 2x2 block (1:55:06) puts HORSE top-right and has no PBARS', () => {
    const pkg = loadRecordingPackage(RECORDING);
    const t = 6960000;
    assert.equal(layoutEntryAt(pkg.meta, t).layout, '2x2');
    assert.deepEqual(pkg.tileFor('HORSE', t), { x: 642, y: 8, w: 610, h: 337 });
    assert.equal(pkg.tileFor('PBARS', t), null);
    assert.equal(pkg.tileFor('VAULT', t), null);
  });

  it('tileFor is null for every event inside each cutaway kind', () => {
    const pkg = loadRecordingPackage(RECORDING);
    const events = ['FLOOR', 'HORSE', 'RINGS', 'VAULT', 'PBARS', 'BAR'];
    const probes = {
      '5-tile': [1584000, 5812000],
      '2-panel': [1798000, 6004000],
      'single-cam': [1917000, 4994000, 7619000],
      leaderboard: [2023000, 4110000, 7289000, 7475000],
      ceremony: [8217000, 8734000],
    };
    for (const [layout, times] of Object.entries(probes)) {
      for (const t of times) {
        assert.equal(layoutEntryAt(pkg.meta, t).layout, layout, `${layout} at ${t}`);
        for (const ev of events) assert.equal(pkg.tileFor(ev, t), null, `${ev} at ${t}`);
      }
    }
  });

  it('tileFor returns null through the rotation 5 and 6 cutaway gaps between 3x2 blocks', () => {
    const pkg = loadRecordingPackage(RECORDING);
    // 5-tile after rotation 4 3x2, 5-tile and 2-panel after rotation 5 3x2
    for (const t of [4700000, 5700000, 5960000, 6100000, 6200000]) {
      assert.equal(pkg.tileFor('FLOOR', t), null, `FLOOR at ${t}`);
    }
    // ...and the 3x2 blocks between them are back to full geometry
    assert.deepEqual(pkg.tileFor('VAULT', 5500000), { x: 0, y: 332, w: 582, h: 298 });
    assert.deepEqual(pkg.tileFor('VAULT', 6500000), { x: 0, y: 332, w: 582, h: 298 });
  });

  it('the ceremony is its own entry starting at 2:08:20 and running to the end', () => {
    const { layoutTimeline, durationMs } = loadMeta(RECORDING);
    const last = layoutTimeline[layoutTimeline.length - 1];
    assert.equal(last.layout, 'ceremony');
    assert.equal(last.fromMs, 7700000);
    assert.ok(last.fromMs < durationMs);
    assert.equal(layoutTimeline.filter(e => e.layout === 'ceremony').length, 1);
  });

  it('tileFor is stable right at the switch boundary (no straddling gap)', () => {
    const pkg = loadRecordingPackage(RECORDING);
    assert.equal(pkg.tileFor('FLOOR', 1037999), null);
    assert.ok(pkg.tileFor('FLOOR', 1038000));
    // 3x2 → 5-tile cutaway at 23:52
    assert.ok(pkg.tileFor('FLOOR', 1431999));
    assert.equal(pkg.tileFor('FLOOR', 1432000), null);
  });
});
