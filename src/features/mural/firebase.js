import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: 'forum-helper-mural.firebaseapp.com',
  projectId: 'forum-helper-mural',
  storageBucket: 'forum-helper-mural.firebasestorage.app',
  messagingSenderId: '766618057183',
  appId: '1:766618057183:web:39021b79b4c49636f2ec6a',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
