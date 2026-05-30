import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBxyHgyUDRBZJegDeeppU9PLYSoIt0qkII',
  authDomain: 'wedding-album-70296.firebaseapp.com',
  projectId: 'wedding-album-70296',
  storageBucket: 'wedding-album-70296.firebasestorage.app',
  messagingSenderId: '984133041852',
  appId: '1:984133041852:web:c419a0758914b69aaf5ab9',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Prevent "auth/already-initialized" errors during Hot Module Replacement (HMR)
let auth;
if ((global as any).firebaseAuth) {
  auth = (global as any).firebaseAuth;
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  (global as any).firebaseAuth = auth;
}

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export { app, auth, db };
