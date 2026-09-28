import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  validateDossier, validateFact, validateSocial, validateTeamSource, matchesExclusion,
} from '../lib/holinshed/types.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'holinshed');
const load = (n) => JSON.parse(readFileSync(path.join(dir, n), 'utf8'));
const sources = load('ecac-sources.json');
const teams = Object.entries(sources).filter(([k]) => !k.startsWith('_'));

test('dossier fixtures validate', () => {
  for (const n of ['dossier-army.json', 'dossier-athlete.json']) {
    assert.deepEqual(validateDossier(load(n)), [], n);
  }
});

test('registry fixtures cover the six ECAC teams and validate', () => {
  assert.deepEqual(teams.map(([k]) => k).sort(),
    ['army', 'greenville', 'navy', 'simpson', 'springfield', 'william-and-mary']);
  for (const [k, s] of teams) {
    assert.equal(s.teamKey, k);
    assert.deepEqual(validateTeamSource(s), [], k);
  }
});

test('validators reject bad input', () => {
  const good = load('dossier-athlete.json');
  const bad = structuredClone(good);
  bad.facts[0].type = 'gossip';
  bad.facts[0].confidence = 2;
  delete bad.facts[0].source.url;
  const errs = validateDossier(bad);
  assert.ok(errs.some((e) => e.includes('.type')));
  assert.ok(errs.some((e) => e.includes('.confidence')));
  assert.ok(errs.some((e) => e.includes('source.url')));
  assert.ok(validateSocial({ ...good.socials[0], public: false }).length > 0);
  assert.ok(validateDossier({ ...good, actorId: 'Bad Id!' }).length > 0);
  const dup = structuredClone(good);
  dup.facts.push(dup.facts[0]);
  assert.ok(validateDossier(dup).some((e) => e.includes('duplicate')));
});

test('exclusion rules reject injury and discipline facts', () => {
  const fact = load('dossier-athlete.json').facts[0];
  assert.deepEqual(validateFact(fact), []);
  assert.ok(matchesExclusion('Missed 2024 with a torn ACL.'));
  assert.ok(matchesExclusion('Was suspended for a team violation.'));
  assert.ok(!matchesExclusion('Back in the lineup on rings.'));
  assert.ok(validateFact({ ...fact, text: 'Returned after a shoulder injury.' }).length > 0);
});

// Live check: skipped when offline. Every registry URL must answer 2xx/3xx.
let online = false;
try {
  await dns.lookup('example.com');
  online = true;
} catch { /* offline */ }

test('registry URLs resolve to live pages', { skip: !online && 'offline' }, async () => {
  const failures = [];
  for (const [k, s] of teams) {
    for (const [field, url] of [['bioUrl', s.registry.bioUrl], ['recapArchiveUrl', s.registry.recapArchiveUrl]]) {
      try {
        const res = await fetch(url, {
          method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20000),
          headers: { 'User-Agent': 'Mozilla/5.0 (Holinshed registry check)' },
        });
        if (!res.ok) failures.push(`${k}.${field} ${url} -> ${res.status}`);
      } catch (err) {
        if (err?.cause?.code === 'ENOTFOUND' || err?.cause?.code === 'ECONNREFUSED' || err?.cause?.code === 'EAI_AGAIN') {
          failures.push(`${k}.${field} ${url} -> ${err.cause.code}`);
        } else failures.push(`${k}.${field} ${url} -> ${err.message}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
