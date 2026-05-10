import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBxyHgyUDRBZJegDeeppU9PLYSoIt0qkII',
  authDomain: 'wedding-album-70296.firebaseapp.com',
  projectId: 'wedding-album-70296',
  storageBucket: 'wedding-album-70296.firebasestorage.app',
  messagingSenderId: '984133041852',
  appId: '1:984133041852:web:c419a0758914b69aaf5ab9',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
