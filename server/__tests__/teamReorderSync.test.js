/**
 * BUG-039: Team Reorder RTN Sync Tests
 *
 * Tests that when team names are reordered in a competition config,
 * the system correctly detects the change and re-syncs coaches,
 * teamData, and stats to match the new team positions.
 *
 * Related: docs/PRD-RTN-Stats-Integration/BUGS.md#BUG-039
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { syncStatsToConfig, parseCompetitionType, buildTeamDbKey } from '../lib/rtnStatsService.js';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Detects whether any team names changed between old and new config.
 * This is the logic extracted from the BUG-039 fix in useCompetitions.js.
 * Extracted here as a pure function for testability.
 */
function detectTeamNameChanges(oldConfig, newConfig) {
  for (let i = 1; i <= 7; i++) {
    const field = `team${i}Name`;
    if (newConfig[field] !== undefined && newConfig[field] !== oldConfig[field]) {
      return true;
    }
  }
  return false;
}

/**
 * Simulates buildCoachUpdates logic: maps teamData coaches to config fields.
 * Extracted from useCompetitions.js for testability.
 */
function buildCoachUpdatesFromTeamData(teamData, locks = {}) {
  const configUpdates = {};

  for (const teamKey of Object.keys(teamData)) {
    const lockField = `${teamKey}Coaches`;
    if (locks[lockField]) continue;

    const coaches = teamData[teamKey]?.coaches;
    if (coaches && Array.isArray(coaches) && coaches.length > 0) {
      configUpdates[lockField] = coaches.map(c => c.fullName).join('\n');
    }
  }

  return configUpdates;
}

// ============================================================================
// Test Data
// ============================================================================

function makeConfig(teamNames) {
  const config = { compType: 'mens-5', gender: 'mens' };
  teamNames.forEach((name, i) => {
    config[`team${i + 1}Name`] = name;
    config[`team${i + 1}Coaches`] = 'Coach Name';
    config[`team${i + 1}Ave`] = '0.000';
    config[`team${i + 1}High`] = '0.000';
    config[`team${i + 1}Key`] = name ? `${name.toLowerCase().replace(/\s+/g, '-')}-mens` : '';
  });
  return config;
}

function makeTeamData(entries) {
  // entries: [{slot: 'team1', coaches: [{fullName: 'X'}], ...}]
  const data = {};
  for (const entry of entries) {
    data[entry.slot] = {
      coaches: entry.coaches || [],
      rtnId: entry.rtnId || null,
      fetchedAt: new Date().toISOString(),
      roster: [],
      rankings: null,
    };
  }
  return data;
}

// ============================================================================
// Tests: Team Name Change Detection
// ============================================================================

describe('BUG-039: detectTeamNameChanges', () => {
  it('returns false when no team names change', () => {
    const oldConfig = makeConfig(['Stanford', 'California', 'Air Force', 'France', 'Quebec']);
    const newConfig = makeConfig(['Stanford', 'California', 'Air Force', 'France', 'Quebec']);
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), false);
  });

  it('detects when team1 and team5 are swapped', () => {
    const oldConfig = makeConfig(['Quebec', 'California', 'Air Force', 'France', 'Stanford']);
    const newConfig = makeConfig(['Stanford', 'California', 'Air Force', 'France', 'Quebec']);
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), true);
  });

  it('detects when a single team name changes', () => {
    const oldConfig = makeConfig(['Stanford', 'California', 'Air Force', '', '']);
    const newConfig = makeConfig(['Stanford', 'Oklahoma', 'Air Force', '', '']);
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), true);
  });

  it('detects when teams are completely reordered', () => {
    const oldConfig = makeConfig(['A', 'B', 'C', 'D', 'E']);
    const newConfig = makeConfig(['E', 'D', 'C', 'B', 'A']);
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), true);
  });

  it('returns false for partial config update with no team name fields', () => {
    const oldConfig = makeConfig(['Stanford', 'California', '', '', '']);
    const newConfig = { venue: 'Burnham Pavilion', meetDate: 'March 14, 2026' };
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), false);
  });

  it('detects when a team is added to an empty slot', () => {
    const oldConfig = makeConfig(['Stanford', 'California', '', '', '']);
    const newConfig = { team3Name: 'Air Force' };
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), true);
  });

  it('detects when a team is removed (set to empty string)', () => {
    const oldConfig = makeConfig(['Stanford', 'California', 'Air Force', '', '']);
    const newConfig = { team3Name: '' };
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), true);
  });

  it('handles undefined fields in new config gracefully', () => {
    const oldConfig = makeConfig(['Stanford', 'California', '', '', '']);
    // newConfig only updates team1, doesn't mention team2-5
    const newConfig = { team1Name: 'Stanford' };
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), false);
  });

  it('treats case-sensitive names as different', () => {
    const oldConfig = makeConfig(['stanford', '', '', '', '']);
    const newConfig = { team1Name: 'Stanford' };
    assert.equal(detectTeamNameChanges(oldConfig, newConfig), true);
  });
});

// ============================================================================
// Tests: Coach Updates from TeamData
// ============================================================================

describe('BUG-039: buildCoachUpdatesFromTeamData', () => {
  it('maps coaches from teamData to correct config fields', () => {
    const teamData = makeTeamData([
      { slot: 'team1', coaches: [{ fullName: 'Thom Glielmi' }, { fullName: 'Ruben Lopez Martinez' }] },
      { slot: 'team2', coaches: [{ fullName: 'Bryan Del Castillo' }] },
    ]);

    const updates = buildCoachUpdatesFromTeamData(teamData);

    assert.equal(updates.team1Coaches, 'Thom Glielmi\nRuben Lopez Martinez');
    assert.equal(updates.team2Coaches, 'Bryan Del Castillo');
    assert.equal(updates.team3Coaches, undefined); // No team3 in data
  });

  it('skips teams with no coaches (international teams)', () => {
    const teamData = makeTeamData([
      { slot: 'team1', coaches: [{ fullName: 'Thom Glielmi' }] },
      { slot: 'team4', coaches: [] }, // France — no RTN coaches
    ]);

    const updates = buildCoachUpdatesFromTeamData(teamData);

    assert.equal(updates.team1Coaches, 'Thom Glielmi');
    assert.equal(updates.team4Coaches, undefined); // Not set — empty coaches array
  });

  it('respects manual override locks', () => {
    const teamData = makeTeamData([
      { slot: 'team1', coaches: [{ fullName: 'Thom Glielmi' }] },
      { slot: 'team2', coaches: [{ fullName: 'Bryan Del Castillo' }] },
    ]);

    const locks = { team2Coaches: true };
    const updates = buildCoachUpdatesFromTeamData(teamData, locks);

    assert.equal(updates.team1Coaches, 'Thom Glielmi');
    assert.equal(updates.team2Coaches, undefined); // Locked — not overwritten
  });

  it('handles stale teamData with wrong keys (the original bug)', () => {
    // Before fix: teamData had old keys (team2=Cal, team3=AirForce, team5=Stanford)
    // Config had: team1=Stanford, team2=Cal, team3=AirForce
    // buildCoachUpdates would write Cal coaches to team2Coaches (correct by coincidence)
    // and Stanford coaches to team5Coaches (wrong — Stanford is now team1)
    const staleTeamData = makeTeamData([
      { slot: 'team2', coaches: [{ fullName: 'Bryan Del Castillo' }] },
      { slot: 'team3', coaches: [{ fullName: 'Josh Loeser' }] },
      { slot: 'team5', coaches: [{ fullName: 'Thom Glielmi' }] },
    ]);

    const updates = buildCoachUpdatesFromTeamData(staleTeamData);

    // team5Coaches gets Stanford coaches, but Stanford is now team1 — BUG
    assert.equal(updates.team5Coaches, 'Thom Glielmi');
    assert.equal(updates.team1Coaches, undefined); // team1 never set — BUG
    // This test documents the incorrect behavior from stale teamData
  });

  it('handles refreshed teamData with correct keys (after fix)', () => {
    // After fix: enrichTeamsWithRTN re-runs, teamData gets correct keys
    const freshTeamData = makeTeamData([
      { slot: 'team1', coaches: [{ fullName: 'Thom Glielmi' }] },     // Stanford (now team1)
      { slot: 'team2', coaches: [{ fullName: 'Bryan Del Castillo' }] }, // California (team2)
      { slot: 'team3', coaches: [{ fullName: 'Josh Loeser' }] },       // Air Force (team3)
    ]);

    const updates = buildCoachUpdatesFromTeamData(freshTeamData);

    assert.equal(updates.team1Coaches, 'Thom Glielmi');       // Stanford — correct
    assert.equal(updates.team2Coaches, 'Bryan Del Castillo'); // Cal — correct
    assert.equal(updates.team3Coaches, 'Josh Loeser');        // Air Force — correct
  });
});

// ============================================================================
// Tests: buildTeamDbKey consistency
// ============================================================================

describe('BUG-039: buildTeamDbKey consistency on reorder', () => {
  it('builds the same key regardless of team position', () => {
    // The key for "Stanford" should always be "stanford-mens" no matter
    // whether it is team1 or team5 in the config
    const key1 = buildTeamDbKey('Stanford', 'mens');
    const key2 = buildTeamDbKey('Stanford', 'mens');
    assert.equal(key1, key2);
    assert.equal(key1, 'stanford-mens');
  });

  it('handles international teams that may not have RTN data', () => {
    const key = buildTeamDbKey('France', 'mens');
    assert.equal(key, 'france-mens');
    // Key is valid — just no stats at that path
  });

  it('handles multi-word team names', () => {
    const key = buildTeamDbKey('Air Force', 'mens');
    assert.equal(key, 'air-force-mens');
  });
});

// ============================================================================
// Tests: parseCompetitionType for various formats
// ============================================================================

describe('BUG-039: parseCompetitionType handles all team counts', () => {
  it('parses mens-5 correctly', () => {
    const { gender, teamCount } = parseCompetitionType('mens-5');
    assert.equal(gender, 'mens');
    assert.equal(teamCount, 5);
  });

  it('parses mens-dual as 2 teams', () => {
    const { gender, teamCount } = parseCompetitionType('mens-dual');
    assert.equal(gender, 'mens');
    assert.equal(teamCount, 2);
  });

  it('parses womens-tri as 3 teams', () => {
    const { gender, teamCount } = parseCompetitionType('womens-tri');
    assert.equal(gender, 'womens');
    assert.equal(teamCount, 3);
  });

  it('parses womens-quad as 4 teams', () => {
    const { gender, teamCount } = parseCompetitionType('womens-quad');
    assert.equal(gender, 'womens');
    assert.equal(teamCount, 4);
  });
});

// ============================================================================
// Tests: Full integration scenario — team reorder
// ============================================================================

describe('BUG-039: Full reorder scenario', () => {
  it('detects change, and fresh teamData produces correct coach updates', () => {
    // Original config: Quebec, Cal, Air Force, France, Stanford
    const oldConfig = makeConfig(['Quebec', 'California', 'Air Force', 'France', 'Stanford']);

    // User swaps team1 and team5: Stanford, Cal, Air Force, France, Quebec
    const newConfig = makeConfig(['Stanford', 'California', 'Air Force', 'France', 'Quebec']);

    // Step 1: Detect change
    const changed = detectTeamNameChanges(oldConfig, newConfig);
    assert.equal(changed, true, 'Should detect team name swap');

    // Step 2: enrichTeamsWithRTN would re-run (mocked here as fresh teamData)
    // Only NCAA teams succeed (Stanford, Cal, Air Force). France/Quebec fail.
    const freshTeamData = makeTeamData([
      { slot: 'team1', coaches: [{ fullName: 'Thom Glielmi' }, { fullName: 'Ruben Lopez Martinez' }] },
      { slot: 'team2', coaches: [{ fullName: 'Bryan Del Castillo' }, { fullName: 'Karl Ziehn' }] },
      { slot: 'team3', coaches: [{ fullName: 'Josh Loeser' }, { fullName: 'Sergey Resnick' }] },
    ]);

    // Step 3: Build coach updates
    const coachUpdates = buildCoachUpdatesFromTeamData(freshTeamData);

    // Verify coaches map to correct positions
    assert.equal(coachUpdates.team1Coaches, 'Thom Glielmi\nRuben Lopez Martinez');
    assert.equal(coachUpdates.team2Coaches, 'Bryan Del Castillo\nKarl Ziehn');
    assert.equal(coachUpdates.team3Coaches, 'Josh Loeser\nSergey Resnick');
    assert.equal(coachUpdates.team4Coaches, undefined); // France — no RTN
    assert.equal(coachUpdates.team5Coaches, undefined); // Quebec — no RTN
  });

  it('does not trigger refresh when only non-team fields change', () => {
    const oldConfig = makeConfig(['Stanford', 'California', '', '', '']);
    const newConfig = {
      venue: 'Burnham Pavilion',
      meetDate: 'March 14, 2026',
      hosts: 'Brandon Briones\nZach Martin',
    };

    const changed = detectTeamNameChanges(oldConfig, newConfig);
    assert.equal(changed, false, 'Should not trigger refresh for non-team changes');
  });

  it('handles the edit-without-reorder case (same teams, different metadata)', () => {
    const oldConfig = makeConfig(['Stanford', 'California', 'Air Force', '', '']);
    // Same team names, just updating tricodes
    const newConfig = {
      team1Name: 'Stanford',
      team1Tricode: 'STAN',
      team2Name: 'California',
      team2Tricode: 'CAL',
      team3Name: 'Air Force',
      team3Tricode: 'AFA',
    };

    const changed = detectTeamNameChanges(oldConfig, newConfig);
    assert.equal(changed, false, 'Should not refresh when team names are unchanged');
  });
});
