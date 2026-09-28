import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

export const isFirebaseConfigured = Boolean(apiKey && apiKey !== 'undefined' && apiKey !== '');

const firebaseConfig = {
  apiKey: apiKey || 'mock-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mock-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mock-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mock-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

let appInstance;
if (!getApps().length) {
  try {
    appInstance = initializeApp(firebaseConfig);
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
    appInstance = null;
  }
} else {
  appInstance = getApp();
}

export const app = appInstance;
export const db = appInstance ? getFirestore(appInstance) : (null as unknown as Firestore);
export const auth = appInstance ? getAuth(appInstance) : (null as unknown as Auth);