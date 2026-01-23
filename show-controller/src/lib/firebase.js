import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, onValue, push, onDisconnect } from 'firebase/database';

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

export { db, ref, set, get, update, remove, onValue, push, onDisconnect };
