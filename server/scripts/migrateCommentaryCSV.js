#!/usr/bin/env node
/**
 * Migration Script: Commentary Talent CSV → Firebase
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=... node server/scripts/migrateCommentaryCSV.js [--dry-run]
 *
 * Reads 3 CSVs from docs/PRD-Commentary-Talent-CRM/:
 *   - Master 2026_ Commentary Tracker - Commentators 2026.csv
 *   - Master 2026_ Commentary Tracker - 2026 Assignment.csv
 *   - Official Virtius Remote Commentary 2026 (Responses) - Form Responses 1 (6).csv
 *
 * Writes to Firebase: talentRoster/{talentId}
 * Outputs log: server/scripts/migration-log.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

// ── Firebase init ────────────────────────────────────────────────────────────
const databaseURL = 'https://gymnastics-graphics-default-rtdb.firebaseio.com';
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL
});
const db = admin.database();

// ── CSV paths ────────────────────────────────────────────────────────────────
const CSV_DIR = resolve(__dirname, '../../docs/PRD-Commentary-Talent-CRM');
const COMMENTATORS_CSV = resolve(CSV_DIR, 'Master 2026_ Commentary Tracker - Commentators 2026.csv');
const ASSIGNMENTS_CSV  = resolve(CSV_DIR, 'Master 2026_ Commentary Tracker - 2026 Assignment.csv');
const SURVEY_CSV       = resolve(CSV_DIR, 'Official Virtius Remote Commentary 2026 (Responses) - Form Responses 1 (6).csv');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Levenshtein distance */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

/** Similarity 0–1 */
function similarity(a, b) {
  const al = a.toLowerCase().trim(), bl = b.toLowerCase().trim();
  if (!al || !bl) return 0;
  const dist = levenshtein(al, bl);
  return 1 - dist / Math.max(al.length, bl.length);
}

/** Generate talentId from name */
function makeTalentId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Validate email */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

/** Validate phone (loose: must have ≥7 digits) */
function isValidPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 7;
}

/** Map status string from CSV to enum */
function mapStatus(raw) {
  const s = (raw || '').toLowerCase();
  if (s.includes('ready'))       return 'ready';
  if (s.includes('did 2025'))    return 'did-2025';
  if (s.includes('has contact')) return 'has-contact';
  if (s.includes('need info'))   return 'need-info';
  return 'need-info';
}

/** Map role string to enum */
function mapRole(raw) {
  const r = (raw || '').toLowerCase();
  if (r.includes('play by play') || r.includes('lead') || r.includes('pbp')) return 'pbp';
  if (r.includes('color') || r.includes('analyst'))                           return 'analyst';
  return 'both';
}

/** Parse internet speed string "Upload: 50 Mbps, Download: 100 Mbps" or "50/100" etc. */
function parseSpeed(raw) {
  if (!raw) return { upload: null, download: null };
  const nums = raw.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 1) return { upload: null, download: null };
  // Heuristic: first number = upload, second = download
  return {
    upload:   parseFloat(nums[0]) || null,
    download: parseFloat(nums[1]) || null,
  };
}

/** Slugify a meet name into a compId-like string */
function slugifyMeet(event, date) {
  const base = `${date || 'undated'}-${event || 'unknown'}`;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

// ── Parse CSVs ───────────────────────────────────────────────────────────────

console.log('Reading CSVs…');

// Commentators: first 3 rows are metadata/banner, row 4 is the header
const commentatorsRaw = readFileSync(COMMENTATORS_CSV, 'utf8');
const commentators = parse(commentatorsRaw, {
  columns: true,
  skip_empty_lines: true,
  from_line: 4,     // skip 3 preamble rows; row 4 becomes header
  trim: true,
  relax_column_count: true,
});

// Assignments: first 2 rows are metadata, row 3 is header
const assignmentsRaw = readFileSync(ASSIGNMENTS_CSV, 'utf8');
const assignments = parse(assignmentsRaw, {
  columns: true,
  skip_empty_lines: false,   // keep rows so row numbering works
  from_line: 3,
  trim: true,
  relax_column_count: true,
});

// Survey: row 1 is header
const surveyRaw = readFileSync(SURVEY_CSV, 'utf8');
const surveyResponses = parse(surveyRaw, {
  columns: true,
  skip_empty_lines: true,
  from_line: 1,
  trim: true,
  relax_column_count: true,
});

console.log(`Parsed: ${commentators.length} commentators, ${assignments.length} assignment rows, ${surveyResponses.length} survey responses`);

// ── Build assignment map: talentName → competitionHistory entries ─────────────

/**
 * Assignment CSV columns (from_line: 3, so row 3 is header):
 *   Week, Event, Date, Type, Lead, Color, (empty col 7 header), Producer, Status,
 *   "Talent grooup chat", "Available Talent"
 */
const assignmentMap = {}; // talentName (lowercase) → [ { compId, role, date } ]

for (const row of assignments) {
  const event = row['Event'];
  const date  = row['Date'];
  const lead  = (row['Lead'] || '').trim();
  const color = (row['Color'] || '').trim();

  if (!event || event.toLowerCase().includes('week')) continue; // skip blank/header-like rows

  const compId = slugifyMeet(event, date);

  const addAssignment = (name, role) => {
    const key = name.toLowerCase().trim();
    if (!key || key === 'n/a' || key === 'tbd' || key === '') return;
    if (!assignmentMap[key]) assignmentMap[key] = [];
    assignmentMap[key].push({ compId, role, date: date || '' });
  };

  addAssignment(lead, 'pbp');
  addAssignment(color, 'analyst');
}

// ── Build survey map: email (lowercase) → survey data ───────────────────────

/**
 * Survey column names (verbatim from CSV header row):
 *   "Please provide your name"
 *   "Please provide your email"
 *   "Please provide your phone number"
 *   "Please select all competitions that you would be available to participate in. "
 *   "Please run an internet speed test..."
 *   "What type of gymnastics are you interested in commentating?"
 *   "What role would you like to have while commentating?"
 *   "Do you have headphones?"
 *   "Select all microphone options you own:"
 *   "Please create an account, download, and install discord..."
 */

// Find column keys by substring matching since they're long/formatted
function findCol(row, substring) {
  return Object.keys(row).find(k => k.toLowerCase().includes(substring.toLowerCase()));
}

const surveyMap = {}; // email lowercase → merged object

for (const row of surveyResponses) {
  const nameKey  = findCol(row, 'provide your name');
  const emailKey = findCol(row, 'provide your email');
  const phoneKey = findCol(row, 'provide your phone');
  const speedKey = findCol(row, 'speed test');
  const wagMagKey = findCol(row, 'type of gymnastics');
  const roleKey  = findCol(row, 'role would you like');
  const headphoneKey = findCol(row, 'headphones');
  const micKey   = findCol(row, 'microphone options');
  const discordKey = findCol(row, 'discord');

  const email = emailKey ? (row[emailKey] || '').toLowerCase().trim() : '';
  if (!email) continue;

  const speedRaw = speedKey ? row[speedKey] : '';
  const speeds = parseSpeed(speedRaw);

  surveyMap[email] = {
    name:                  nameKey  ? row[nameKey]  : '',
    email,
    phone:                 phoneKey ? row[phoneKey] : '',
    wagMag:                wagMagKey ? row[wagMagKey] : '',
    commentaryRole:        roleKey  ? mapRole(row[roleKey]) : 'both',
    hasHeadphones:         headphoneKey ? (row[headphoneKey] || '').toLowerCase().includes('yes') : false,
    micType:               micKey   ? row[micKey]   : '',
    discordStatus:         discordKey ? row[discordKey] : '',
    internetUploadMbps:    speeds.upload,
    internetDownloadMbps:  speeds.download,
    surveyCompleted:       true,
  };
}

console.log(`Survey map: ${Object.keys(surveyMap).length} entries keyed by email`);

// ── Process commentators → talentRoster records ──────────────────────────────

const records = []; // { talentId, record }
const usedIds = {}; // talentId → index in records (for collision detection)
const flagged = []; // { row, reason }
const names = [];   // lowercase names for fuzzy dup check

for (const row of commentators) {
  const name = (row['Name'] || '').trim();
  if (!name) continue;

  const rawPhone  = (row['Phone'] || '').trim();
  const rawEmail  = (row['Email'] || '').trim();
  const rawStatus = (row['Status'] || '').trim();
  const rawRole   = (row['Commentary Role'] || '').trim();
  const rawWagMag = (row['WAG/MAG'] || '').trim();

  // Flag malformed phone/email
  if (rawPhone && !isValidPhone(rawPhone)) {
    flagged.push({ name, field: 'phone', value: rawPhone, reason: 'Malformed phone number' });
  }
  if (rawEmail && !isValidEmail(rawEmail)) {
    flagged.push({ name, field: 'email', value: rawEmail, reason: 'Malformed email' });
  }

  // Fuzzy duplicate check against already-processed names
  const nameLower = name.toLowerCase();
  for (const existing of names) {
    if (similarity(nameLower, existing) > 0.9 && nameLower !== existing) {
      flagged.push({ name, reason: `Possible duplicate of "${existing}" (similarity > 90%)` });
      break;
    }
  }
  names.push(nameLower);

  // Build talentId (collision-safe)
  let talentId = makeTalentId(name);
  if (usedIds[talentId] !== undefined) {
    let suffix = 2;
    while (usedIds[`${talentId}-${suffix}`] !== undefined) suffix++;
    talentId = `${talentId}-${suffix}`;
  }
  usedIds[talentId] = records.length;

  // Build history from assignment map
  const competitionHistory = [];
  const nameVariants = [nameLower];
  // Also try first-last only (some assignment rows use "First Last" vs "First M. Last")
  const nameParts = nameLower.split(/\s+/);
  if (nameParts.length > 2) nameVariants.push(`${nameParts[0]} ${nameParts[nameParts.length - 1]}`);

  for (const variant of nameVariants) {
    // Direct match
    if (assignmentMap[variant]) {
      competitionHistory.push(...assignmentMap[variant]);
      break;
    }
    // Fuzzy match in assignment keys
    for (const [key, entries] of Object.entries(assignmentMap)) {
      if (similarity(variant, key) > 0.9) {
        competitionHistory.push(...entries);
        break;
      }
    }
  }

  // Merge survey data (match by email)
  const emailKey = rawEmail.toLowerCase();
  const surveyData = surveyMap[emailKey] || {};

  // Build final record
  const record = {
    name,
    phone:           rawPhone || null,
    email:           rawEmail || null,
    wagMag:          rawWagMag || surveyData.wagMag || null,
    commentaryRole:  rawRole ? mapRole(rawRole) : (surveyData.commentaryRole || 'both'),
    status:          mapStatus(rawStatus),
    affiliation:     (row['Affiliation'] || '').trim() || null,
    conference:      (row['Conference'] || '').trim() || null,
    canProduce:      (row['Producer'] || '').trim() === '✓',
    notes:           (row['Notes'] || '').trim() || null,
    competitionHistory: competitionHistory.length > 0 ? competitionHistory : null,
    surveyCompleted: (row['2026 Survey'] || '').trim() === '✓' || surveyData.surveyCompleted || false,
    textSent:        (row['Text Sent'] || '').trim() === '✓',
    discordAdded:    surveyData.discordStatus ? surveyData.discordStatus.toLowerCase().includes('yes') : false,
    internetUploadMbps:   surveyData.internetUploadMbps || null,
    internetDownloadMbps: surveyData.internetDownloadMbps || null,
    hasHeadphones:   surveyData.hasHeadphones || null,
    micType:         surveyData.micType || null,
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
  };

  // Remove null fields to keep Firebase clean
  for (const k of Object.keys(record)) {
    if (record[k] === null) delete record[k];
  }

  records.push({ talentId, record, emailKey });
}

// ── Summary ──────────────────────────────────────────────────────────────────

const surveyEnriched = records.filter(r => surveyMap[r.emailKey]).length;
const assignmentsAdded = records.reduce((acc, r) => acc + (r.record.competitionHistory?.length || 0), 0);

console.log('\n── Summary ──────────────────────────────────────────────────────');
console.log(`  Contacts to create/update : ${records.length}`);
console.log(`  Survey enrichments        : ${surveyEnriched}`);
console.log(`  Assignment records        : ${assignmentsAdded}`);
console.log(`  Flagged rows              : ${flagged.length}`);
console.log('─────────────────────────────────────────────────────────────────\n');

if (DRY_RUN) {
  console.log('DRY RUN — no writes to Firebase.');
  console.log(`Sample record (first):`);
  if (records[0]) console.log(JSON.stringify(records[0].record, null, 2));
} else {
  // ── Write to Firebase ──────────────────────────────────────────────────────
  console.log('Writing to Firebase talentRoster/…');

  let created = 0, enriched = 0;

  for (const { talentId, record, emailKey } of records) {
    const ref = db.ref(`talentRoster/${talentId}`);
    const existing = await ref.once('value');

    if (existing.exists()) {
      // Merge (update) — preserve any existing fields not in our record
      await ref.update({ ...record, updatedAt: new Date().toISOString() });
      enriched++;
    } else {
      await ref.set(record);
      created++;
    }

    if ((created + enriched) % 50 === 0) {
      process.stdout.write(`  …${created + enriched} / ${records.length}\r`);
    }
  }

  console.log(`\n✓ Done — ${created} created, ${enriched} enriched (survey), ${assignmentsAdded} assignments added, ${flagged.length} flagged`);
}

// ── Write log ────────────────────────────────────────────────────────────────

const logPath = resolve(__dirname, 'migration-log.json');
const log = {
  runAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  summary: {
    total: records.length,
    surveyEnriched,
    assignmentsAdded,
    flagged: flagged.length,
  },
  flaggedRows: flagged,
};
writeFileSync(logPath, JSON.stringify(log, null, 2));
console.log(`\nLog written to ${logPath}`);

process.exit(0);
