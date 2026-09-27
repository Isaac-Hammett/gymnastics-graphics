/**
 * Graphic Payload Tests (ISA2-272)
 *
 * The payload builder moved out of timesheetEngine._triggerGraphic into
 * graphicPayload.js so the rundown engine and the action bus write the same
 * thing. These tests pin that down two ways:
 *
 *  1. Golden payloads — the exact objects the pre-extraction engine wrote for
 *     an overlay graphic, a stage graphic, a per-team roster, a sponsors
 *     graphic, and a custom graphic. Any drift fails here.
 *  2. Equivalence — what TimesheetEngine writes to currentGraphic for a
 *     rundown segment equals buildGraphicPayload() for the same graphic, which
 *     equals what the action bus writes.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createFakeDb } from './helpers/fakeFirebaseDb.js';
import { MockOBSWebSocket } from './helpers/mockOBS.js';
import {
  buildGraphicPayload,
  buildClearPayload,
  getGraphicById,
  baseGraphicId,
  resolveDb,
} from '../lib/graphicPayload.js';
import { ActionBus } from '../lib/actionBus.js';
import { TimesheetEngine } from '../lib/timesheetEngine.js';

const COMP_ID = 'ecac-2026-agent-test';
const GRAPHIC_PATH = `competitions/${COMP_ID}/currentGraphic`;
const FIXED_TS = 1_700_000_000_000;

const CONFIG = {
  compType: 'womens-dual',
  eventName: 'ECAC Test Meet',
  meetDate: '2026-09-27',
  venue: 'Test Arena',
  location: 'Testville',
  hosts: 'Isaac',
  virtiusSessionId: 'vs-1',
  meetTheme: '',
  team1Name: 'Navy',
  team1Logo: 'navy.png',
  team1Key: 'navy-womens',
  team1Ave: '195.1',
  team1High: '197.0',
  team1Con: '9.75',
  team1Coaches: 'Coach A',
  team2Name: 'Army',
  team2Logo: 'army.png',
  team2Key: 'army-womens',
};

/** The team1..team6 block the builder always emits, from CONFIG. */
function teamFields() {
  const fields = {};
  for (let i = 1; i <= 6; i++) {
    fields[`team${i}Name`] = CONFIG[`team${i}Name`] || '';
    fields[`team${i}Logo`] = CONFIG[`team${i}Logo`] || '';
    fields[`team${i}Ave`] = CONFIG[`team${i}Ave`] || '';
    fields[`team${i}High`] = CONFIG[`team${i}High`] || '';
    fields[`team${i}Con`] = CONFIG[`team${i}Con`] || '';
    fields[`team${i}Coaches`] = CONFIG[`team${i}Coaches`] || '';
  }
  return fields;
}

/** The config-derived data object, before per-graphic extras. */
function baseData(extraParams = {}) {
  return {
    eventName: CONFIG.eventName,
    meetDate: CONFIG.meetDate,
    venue: CONFIG.venue,
    location: CONFIG.location,
    hosts: CONFIG.hosts,
    virtiusSessionId: CONFIG.virtiusSessionId,
    meetTheme: CONFIG.meetTheme,
    ...teamFields(),
    ...extraParams,
  };
}

function seed() {
  const db = createFakeDb();
  db._seed(`competitions/${COMP_ID}/config`, CONFIG);
  return db;
}

describe('graphicPayload registry lookup', () => {
  it('strips the per-team prefix so team2-roster resolves to team-roster', () => {
    assert.equal(baseGraphicId('team2-roster'), 'team-roster');
    assert.equal(baseGraphicId('team-roster'), 'team-roster');
    assert.equal(baseGraphicId('leaderboard-aa'), 'leaderboard-aa');
    assert.equal(getGraphicById('team2-roster'), null, 'the registry stores team-roster');
    assert.ok(getGraphicById('team-roster'), 'base ID is in the registry');
  });

  it('normalizes a Firebase Admin app and a database handle alike', () => {
    const database = { ref: () => {} };
    const app = { database: () => database };
    assert.equal(resolveDb(database), database);
    assert.equal(resolveDb(app), database);
    assert.equal(resolveDb(null), null);
  });
});

describe('buildGraphicPayload golden payloads', () => {
  let db;

  beforeEach(() => {
    db = seed();
  });

  it('builds an overlay graphic payload', async () => {
    const payload = await buildGraphicPayload({
      db, compId: COMP_ID, graphicId: 'team1-coaches',
      graphicParams: { teamSlot: 1 }, segmentId: 'seg-1', timestamp: FIXED_TS,
    });

    assert.deepEqual(payload, {
      graphic: 'team1-coaches',
      graphicId: 'team1-coaches',
      renderer: 'output',
      data: baseData({ teamSlot: 1 }),
      segmentId: 'seg-1',
      timestamp: FIXED_TS,
    });
  });

  it('builds a stage graphic payload with skeleton and blocks', async () => {
    const payload = await buildGraphicPayload({
      db, compId: COMP_ID, graphicId: 'leaderboard-aa',
      segmentId: 'seg-2', timestamp: FIXED_TS,
    });

    const entry = getGraphicById('leaderboard-aa');
    assert.equal(payload.renderer, 'stage');
    assert.equal(payload.skeleton, entry.skeleton);
    assert.deepEqual(payload.blocks, entry.defaultData.blocks);
    assert.equal(payload.theme, undefined, 'no meetTheme means no theme block');
    assert.deepEqual(payload.data, baseData());
  });

  it('builds a per-team roster payload with the team name and key', async () => {
    const payload = await buildGraphicPayload({
      db, compId: COMP_ID, graphicId: 'team2-roster',
      graphicParams: { teamSlot: 2 }, segmentId: null, timestamp: FIXED_TS,
    });

    assert.equal(payload.renderer, 'stage');
    assert.deepEqual(payload.blocks, [
      { type: 'header-bar', data: { title: 'Army' } },
      { type: 'athlete-grid', data: { teamKey: 'army-womens' } },
    ]);
    assert.equal(payload.segmentId, null);
  });

  it('resolves the theme when the competition has a meetTheme', async () => {
    db._seed(`competitions/${COMP_ID}/config/meetTheme`, 'mpsf-2026');
    db._seed('themes/mpsf-2026', {
      colors: { headerBar: '#003262', textOnHeader: '#FDB515' },
    });

    const payload = await buildGraphicPayload({
      db, compId: COMP_ID, graphicId: 'leaderboard-aa', timestamp: FIXED_TS,
    });

    assert.equal(payload.theme.id, 'mpsf-2026');
    assert.equal(payload.theme.headerBg, '#003262');
    assert.equal(payload.theme.headerText, '#FDB515');
  });

  it('loads sponsors from the home team, sorted and capped at 8', async () => {
    db._seed('teamsDatabase/sponsors/navy-womens', {
      b: { name: 'Second', logoUrl: 'b.png', order: 2 },
      a: { name: 'First', url: 'a.png', order: 1, scale: 120, cropX: 5 },
      skip: { name: 'No URL', order: 0 },
    });

    const payload = await buildGraphicPayload({
      db, compId: COMP_ID, graphicId: 'sponsors-thanks', timestamp: FIXED_TS,
    });

    assert.deepEqual(JSON.parse(payload.data.sponsors), [
      { name: 'First', url: 'a.png', scale: 120, cropX: 5 },
      { name: 'Second', url: 'b.png' },
    ]);
  });

  it('falls back to an empty sponsor list when the team has none', async () => {
    const payload = await buildGraphicPayload({
      db, compId: COMP_ID, graphicId: 'sponsors-thanks', timestamp: FIXED_TS,
    });
    assert.equal(payload.data.sponsors, '[]');
  });

  it('builds a custom graphic payload from customGraphics', async () => {
    db._seed(`competitions/${COMP_ID}/customGraphics/promo`, {
      url: 'https://example.com/promo', label: 'Promo',
    });

    const payload = await buildGraphicPayload({
      db, compId: COMP_ID, graphicId: 'custom-promo',
      segmentId: 'seg-3', timestamp: FIXED_TS,
    });

    assert.equal(payload.graphic, 'custom', 'custom graphics render as "custom"');
    assert.equal(payload.graphicId, 'custom-promo');
    assert.equal(payload.renderer, 'output');
    assert.equal(payload.data.customUrl, 'https://example.com/promo');
    assert.equal(payload.data.customLabel, 'Promo');
    assert.equal(payload.skeleton, undefined);
  });

  it('works with no Firebase at all, passing params straight through', async () => {
    const payload = await buildGraphicPayload({
      db: null, compId: null, graphicId: 'team1-coaches',
      graphicParams: { teamSlot: 1 }, segmentId: 'seg-4', timestamp: FIXED_TS,
    });

    assert.deepEqual(payload, {
      graphic: 'team1-coaches',
      graphicId: 'team1-coaches',
      renderer: 'output',
      data: { teamSlot: 1 },
      segmentId: 'seg-4',
      timestamp: FIXED_TS,
    });
  });

  it('builds the clear payload without a renderer field', () => {
    assert.deepEqual(buildClearPayload(FIXED_TS), {
      graphic: 'clear', data: {}, timestamp: FIXED_TS,
    });
  });
});

describe('TimesheetEngine writes the same payload as the extracted builder', () => {
  let db;

  beforeEach(() => {
    db = seed();
  });

  function makeEngine(segment) {
    return new TimesheetEngine({
      compId: COMP_ID,
      firebase: db,
      showConfig: { segments: [segment] },
    });
  }

  /**
   * Fire a segment's graphic through the engine and return what it wrote
   * alongside the builder's own payload for the same graphic.
   */
  async function compare(segment, { graphicId, graphicParams }) {
    const engine = makeEngine(segment);
    await engine._triggerGraphic(segment);

    const written = db._read(GRAPHIC_PATH);
    assert.ok(written, 'engine wrote nothing to currentGraphic');

    const expected = await buildGraphicPayload({
      db,
      compId: COMP_ID,
      graphicId,
      graphicParams,
      segmentId: segment.id,
      timestamp: written.timestamp,
    });

    return { written, expected: JSON.parse(JSON.stringify(expected)) };
  }

  it('matches for a new-format segment (graphic object with params)', async () => {
    const segment = {
      id: 'seg-roster',
      type: 'graphic',
      graphic: { graphicId: 'team2-roster', params: { teamSlot: 2 } },
    };
    const { written, expected } = await compare(segment, {
      graphicId: 'team2-roster', graphicParams: { teamSlot: 2 },
    });

    assert.deepEqual(written, expected);
    assert.equal(written.segmentId, 'seg-roster');
    assert.equal(written.renderer, 'stage');
    assert.deepEqual(written.blocks, [
      { type: 'header-bar', data: { title: 'Army' } },
      { type: 'athlete-grid', data: { teamKey: 'army-womens' } },
    ]);
  });

  it('matches for a legacy-format segment (graphic string plus graphicData)', async () => {
    const segment = {
      id: 'seg-coaches',
      type: 'graphic',
      graphic: 'team1-coaches',
      graphicData: { teamSlot: 1 },
    };
    const { written, expected } = await compare(segment, {
      graphicId: 'team1-coaches', graphicParams: { teamSlot: 1 },
    });

    assert.deepEqual(written, expected);
    assert.deepEqual(written.data, baseData({ teamSlot: 1 }));
  });

  it('matches for a sponsors segment', async () => {
    db._seed('teamsDatabase/sponsors/navy-womens', {
      a: { name: 'Synergy', logoUrl: 'synergy.png', order: 1 },
    });
    const segment = { id: 'seg-sponsors', type: 'graphic', graphic: 'sponsors-thanks' };
    const { written, expected } = await compare(segment, {
      graphicId: 'sponsors-thanks', graphicParams: {},
    });

    assert.deepEqual(written, expected);
    assert.equal(JSON.parse(written.data.sponsors).length, 1);
  });

  it('matches for a themed stage segment', async () => {
    db._seed(`competitions/${COMP_ID}/config/meetTheme`, 'mpsf-2026');
    db._seed('themes/mpsf-2026', { colors: { headerBar: '#003262' } });

    const segment = { id: 'seg-aa', type: 'graphic', graphic: 'leaderboard-aa' };
    const { written, expected } = await compare(segment, {
      graphicId: 'leaderboard-aa', graphicParams: {},
    });

    assert.deepEqual(written, expected);
    assert.equal(written.theme.headerBg, '#003262');
  });

  it('emits graphicTriggered with the payload it wrote', async () => {
    const segment = { id: 'seg-aa', type: 'graphic', graphic: 'leaderboard-aa' };
    const engine = makeEngine(segment);

    const emitted = [];
    engine.on('graphicTriggered', payload => emitted.push(payload));
    await engine._triggerGraphic(segment);

    assert.equal(emitted.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(emitted[0])), db._read(GRAPHIC_PATH));
  });

  it('still skips the write in rehearsal mode', async () => {
    const segment = { id: 'seg-aa', type: 'graphic', graphic: 'leaderboard-aa' };
    const engine = makeEngine(segment);
    engine.setRehearsalMode(true);

    const emitted = [];
    engine.on('graphicTriggered', payload => emitted.push(payload));
    await engine._triggerGraphic(segment);

    assert.equal(db._read(GRAPHIC_PATH), null, 'rehearsal must not write');
    assert.equal(emitted[0].rehearsalMode, true);
  });

  it('writes byte-identical payloads from the rundown and from the action bus', async () => {
    const segment = {
      id: 'seg-roster',
      type: 'graphic',
      graphic: { graphicId: 'team2-roster', params: { teamSlot: 2 } },
    };

    // The rundown path.
    await makeEngine(segment)._triggerGraphic(segment);
    const fromRundown = db._read(GRAPHIC_PATH);

    // The action bus path.
    const bus = new ActionBus({
      compId: COMP_ID,
      firebase: db,
      obsConnectionManager: { getConnection: () => new MockOBSWebSocket() },
    });
    await bus.buildCatalog();
    const ack = await bus.execute({ actionId: 'graphic:team2-roster', sender: 'xavier' });
    assert.equal(ack.ok, true);
    const fromBus = db._read(GRAPHIC_PATH);

    // Timestamp and segmentId are the only legitimate differences: the bus is
    // not running a rundown segment.
    assert.equal(fromRundown.segmentId, 'seg-roster');
    assert.equal(fromBus.segmentId, null);
    delete fromRundown.timestamp; delete fromBus.timestamp;
    delete fromRundown.segmentId; delete fromBus.segmentId;
    assert.deepEqual(fromBus, fromRundown);
  });
});
