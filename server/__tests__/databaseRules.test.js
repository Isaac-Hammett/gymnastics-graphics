// Dry-run test for database.rules.json. The Firebase emulator needs a JVM, which the
// agent sandbox lacks, so this evaluates the rules with a tiny interpreter that supports
// only the expressions the file uses (true, false, "auth != null") and fails on anything else.
// Semantics match RTDB: literal keys beat $wildcards, and a grant at any ancestor cascades down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { rules } = JSON.parse(readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
const firebaseJson = JSON.parse(readFileSync(path.join(root, 'firebase.json'), 'utf8'));

function evalExpr(expr, auth) {
  if (expr === true || expr === false) return expr;
  if (expr === 'auth != null') return auth != null;
  throw new Error(`Unsupported rule expression: ${expr}`);
}

function allowed(kind, dbPath, auth) {
  let node = rules;
  if (node[kind] !== undefined && evalExpr(node[kind], auth)) return true;
  for (const seg of dbPath.split('/').filter(Boolean)) {
    if (node[seg] !== undefined && typeof node[seg] === 'object') node = node[seg];
    else {
      const wild = Object.keys(node).find((k) => k.startsWith('$'));
      if (!wild) return false;
      node = node[wild];
    }
    if (node[kind] !== undefined && evalExpr(node[kind], auth)) return true;
  }
  return false;
}
const canRead = (p, auth) => allowed('.read', p, auth);
const canWrite = (p, auth) => allowed('.write', p, auth);
const user = { uid: 'u1' };

test('firebase.json points at database.rules.json', () => {
  assert.equal(firebaseJson.database.rules, 'database.rules.json');
});

test('unauthenticated read of shakespeare is denied, authenticated allowed', () => {
  const p = 'competitions/ecac-2026/shakespeare/propositions/top';
  assert.equal(canRead(p, null), false);
  assert.equal(canRead(p, user), true);
});

test('dossiers and shakespeare are closed to unauthenticated read and write', () => {
  for (const sub of ['shakespeare', 'dossiers', 'dossiers/abc', 'shakespeare/x/y']) {
    const p = `competitions/c1/${sub}`;
    assert.equal(canRead(p, null), false, `read ${p}`);
    assert.equal(canWrite(p, null), false, `write ${p}`);
    assert.equal(canWrite(p, user), true, `auth write ${p}`);
  }
});

test('renderers keep reading currentGraphic and scoring without auth', () => {
  for (const sub of ['currentGraphic', 'scoring', 'config/meetTheme', 'production/engineHeartbeat']) {
    assert.equal(canRead(`competitions/c1/${sub}`, null), true, sub);
  }
  assert.equal(canRead('themes/t1', null), true);
  assert.equal(canRead('teamsDatabase/headshots', null), true);
});

test('public booking and survey page paths are unchanged', () => {
  assert.equal(canRead('bookingTokens/tok', null), true);
  assert.equal(canWrite('bookingTokens/tok', null), true);
  assert.equal(canRead('talentRoster/t1', null), true);
  assert.equal(canWrite('talentRoster/t1/interested', null), true);
  assert.equal(canWrite('talentRoster/t1/email', null), false);
  assert.equal(canRead('talentRoster', null), false);
  assert.equal(canWrite('surveyResponses/2026/pushKey', null), true);
  assert.equal(canRead('surveyResponses/2026', null), false);
  assert.equal(canWrite('competitions/c1/commentary/t1', null), true);
});

test('whole-tree read of competitions needs auth; public pages use /api/competitions/index instead', () => {
  assert.equal(canRead('competitions', null), false);
  assert.equal(canRead('competitions', user), true);
  // BookingPage and SurveyPage must not read the whole tree signed-out (it would include shakespeare/dossiers).
  for (const f of ['BookingPage.jsx', 'SurveyPage.jsx']) {
    const src = readFileSync(path.join(root, 'show-controller', 'src', 'pages', f), 'utf8');
    assert.ok(!/get\(ref\(db, 'competitions'\)\)/.test(src), `${f} reads whole competitions tree`);
    assert.ok(src.includes('/api/competitions/index'), `${f} uses the coordinator index`);
  }
});
