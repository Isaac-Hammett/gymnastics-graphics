/**
 * One-time script to import Springfield Men's headshots to Firebase
 * Run with: node scripts/import-springfield.js
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCh0aZUvKl6Qvqsva3hvOgJJlleP1OwcTY",
  authDomain: "gymnastics-graphics.firebaseapp.com",
  databaseURL: "https://gymnastics-graphics-default-rtdb.firebaseio.com",
  projectId: "gymnastics-graphics",
  storageBucket: "gymnastics-graphics.firebasestorage.app",
  messagingSenderId: "702072609550",
  appId: "1:702072609550:web:ac74a811186d3ff45b955f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Springfield Men's roster from Virtius
const springfieldRoster = [
  { name: 'Anthony Casciano', headshotUrl: 'https://media.virti.us/upload/images/athlete/f3FTrzYdYhkqi8KfZ6yxh' },
  { name: 'Blaise Rousseau', headshotUrl: 'https://media.virti.us/upload/images/athlete/Ccc4vEfQKKg-QuFJ4JJsQ' },
  { name: 'Brian Delf', headshotUrl: 'https://media.virti.us/upload/images/athlete/FPdzpw_g-9OaTKsm14v-c' },
  { name: 'Broc Rousseau', headshotUrl: 'https://media.virti.us/upload/images/athlete/sBCDWfbrtvJY7o0duJpe0' },
  { name: 'Cameron Rhymes', headshotUrl: 'https://media.virti.us/upload/images/athlete/7H0rIAF64oTza5f8n68h8' },
  { name: 'Carl Jacob Soederqvist', headshotUrl: 'https://media.virti.us/upload/images/athlete/MMaGzcJheX9gMczgLgcSU' },
  { name: 'Devon Felsenstein', headshotUrl: 'https://media.virti.us/upload/images/athlete/Lysvvs5Qz5u6kAhZ4_UUv' },
  { name: 'Donovan Salva', headshotUrl: 'https://media.virti.us/upload/images/athlete/xeJ-cLTczocd7XTYDebQk' },
  { name: 'Evan Reichert', headshotUrl: 'https://media.virti.us/upload/images/athlete/C8Xt7B9TwtDqRWy5ykzMx' },
  { name: 'Gustavin Suess', headshotUrl: 'https://media.virti.us/upload/images/athlete/e-3Q2hZh85uQDpM-en45I' },
  { name: 'Jesse Listopad', headshotUrl: 'https://media.virti.us/upload/images/athlete/-KXkq_ziAnH9EF7oeQd7M' },
  { name: 'Joshua Szitanko', headshotUrl: 'https://media.virti.us/upload/images/athlete/Lu4PHkbGEWo7ST2nRNYXQ' },
  { name: 'Kaleb Palacio', headshotUrl: 'https://media.virti.us/upload/images/athlete/T5IsDeBKJeZnSzIHOXXeC' },
  { name: 'Mason Lupp', headshotUrl: 'https://media.virti.us/upload/images/athlete/8FxceCAOuEMwwf1SSxKL3' },
  { name: 'Michael Dalton', headshotUrl: 'https://media.virti.us/upload/images/athlete/NepM59heoWSqWqNergLDj' },
  { name: 'Noam Toledano', headshotUrl: 'https://media.virti.us/upload/images/athlete/WH79uMnMVV771QuNrA4k_' },
  { name: 'Nolan Prim', headshotUrl: 'https://media.virti.us/upload/images/athlete/hsZuLotJqCirKHxUXG0uE' },
  { name: 'Owen Carney', headshotUrl: 'https://media.virti.us/upload/images/athlete/Hq4hJCkkLbc0r_A47-usA' },
  { name: 'Peyton Cramer', headshotUrl: 'https://media.virti.us/upload/images/athlete/tmf9oeuj81avJ3l15xjKP' },
  { name: 'Sergio Gasparini', headshotUrl: 'https://media.virti.us/upload/images/athlete/t4GG0fHsBAe7yxRtfBXW8' },
  { name: 'Skyler Cook', headshotUrl: 'https://media.virti.us/upload/images/athlete/U3iWMODiQavfRcWRjTfju' },
  { name: 'Tristan Tacconi', headshotUrl: 'https://media.virti.us/upload/images/athlete/lqns4FsV8-pcHagx6VHNo' },
  { name: 'Tyler Beekman', headshotUrl: 'https://media.virti.us/upload/images/athlete/Nn4Q7hTuWRbEdOXdeLBP8' },
];

/**
 * UNIFIED NAME NORMALIZATION
 * Must match the normalization in:
 * - show-controller/src/lib/nameNormalization.js
 * - output.html
 */
function normalizeAccents(str) {
  if (!str) return '';
  return str
    .replace(/ö/g, 'oe').replace(/Ö/g, 'oe')
    .replace(/ä/g, 'ae').replace(/Ä/g, 'ae')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[éèêë]/g, 'e').replace(/[ÉÈÊË]/g, 'e')
    .replace(/[áàâãå]/g, 'a').replace(/[ÁÀÂÃÅ]/g, 'a')
    .replace(/[íìîï]/g, 'i').replace(/[ÍÌÎÏ]/g, 'i')
    .replace(/[óòôõø]/g, 'o').replace(/[ÓÒÔÕØ]/g, 'o')
    .replace(/[úùûü]/g, 'u').replace(/[ÚÙÛÜ]/g, 'u')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'n')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'ae')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'oe');
}

function normalizeName(name) {
  if (!name) return '';
  return normalizeAccents(name)
    .toLowerCase()
    .replace(/[-_]/g, ' ')      // Hyphens and underscores to spaces
    .replace(/[''`]/g, '')      // Remove apostrophes
    .replace(/\s+/g, ' ')
    .trim();
}

function getSafeFirebaseKey(normalizedName) {
  return normalizedName.replace(/[.#$[\]/]/g, '_');
}

async function importSpringfieldHeadshots() {
  console.log('Importing Springfield Men\'s headshots to Firebase...');
  console.log(`Found ${springfieldRoster.length} athletes\n`);

  const updates = {};
  const teamKey = 'springfield-mens';

  for (const { name, headshotUrl } of springfieldRoster) {
    const normalized = normalizeName(name);
    const safeKey = getSafeFirebaseKey(normalized);

    updates[`teamsDatabase/headshots/${safeKey}`] = {
      name: name,
      url: headshotUrl,
      teamKey: teamKey,
      updatedAt: new Date().toISOString(),
    };

    console.log(`  ✓ ${name}`);
  }

  // Also update the team roster
  updates[`teamsDatabase/teams/${teamKey}`] = {
    displayName: "Springfield Men's",
    school: "Springfield",
    gender: "mens",
    logo: "", // Will need to be added separately
    roster: springfieldRoster.map(a => a.name),
    updatedAt: new Date().toISOString(),
  };

  try {
    const rootRef = ref(db);
    await update(rootRef, updates);
    console.log(`\n✅ Successfully imported ${springfieldRoster.length} headshots to Firebase!`);
    console.log('Team roster also saved to teamsDatabase/teams/springfield-mens');
  } catch (err) {
    console.error('❌ Error importing headshots:', err.message);
  }

  process.exit(0);
}

importSpringfieldHeadshots();
