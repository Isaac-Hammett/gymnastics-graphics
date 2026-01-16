import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, onValue, push } from 'firebase/database';

const prodConfig = {
  apiKey: "AIzaSyCh0aZUvKl6Qvqsva3hvOgJJlleP1OwcTY",
  authDomain: "gymnastics-graphics.firebaseapp.com",
  databaseURL: "https://gymnastics-graphics-default-rtdb.firebaseio.com",
  projectId: "gymnastics-graphics",
  storageBucket: "gymnastics-graphics.firebasestorage.app",
  messagingSenderId: "702072609550",
  appId: "1:702072609550:web:ac74a811186d3ff45b955f"
};

const devConfig = {
  apiKey: "AIzaSyC80TXIe5TXf_urnvn8cMd8aDJjRT8Iocw",
  authDomain: "gymnastics-graphics-dev.firebaseapp.com",
  databaseURL: "https://gymnastics-graphics-dev-default-rtdb.firebaseio.com",
  projectId: "gymnastics-graphics-dev",
  storageBucket: "gymnastics-graphics-dev.firebasestorage.app",
  messagingSenderId: "373973427915",
  appId: "1:373973427915:web:4d4b4cafba59f6c8d65d4e"
};

const env = import.meta.env.VITE_FIREBASE_ENV || 'prod';
const firebaseConfig = env === 'dev' ? devConfig : prodConfig;

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Log which environment we're using (helpful for debugging)
if (import.meta.env.DEV) {
  console.log(`Firebase: using ${env} environment`)
}

export { db, ref, set, get, update, remove, onValue, push };
