/**
 * Quick script to add Will Wilson's headshot to Firebase
 * Run with: node scripts/add-will-wilson.js
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
    .replace(/[-_]/g, ' ')
    .replace(/[''`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSafeFirebaseKey(normalizedName) {
  return normalizedName.replace(/[.#$[\]/]/g, '_');
}

async function addWillWilson() {
  const name = 'Will Wilson';
  const headshotUrl = 'https://media.virti.us/upload/images/athlete/VeT07jx5RC-L0MadOmqZ7';
  const teamKey = 'springfield-mens';

  const normalized = normalizeName(name);
  const safeKey = getSafeFirebaseKey(normalized);

  const updates = {};
  updates[`teamsDatabase/headshots/${safeKey}`] = {
    name: name,
    url: headshotUrl,
    teamKey: teamKey,
    updatedAt: new Date().toISOString(),
  };

  try {
    const rootRef = ref(db);
    await update(rootRef, updates);
    console.log(`✅ Successfully added headshot for ${name} to Firebase!`);
    console.log(`   Key: ${safeKey}`);
    console.log(`   URL: ${headshotUrl}`);
  } catch (err) {
    console.error('❌ Error adding headshot:', err.message);
  }

  process.exit(0);
}

addWillWilson();
