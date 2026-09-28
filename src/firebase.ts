import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

export interface FirebaseConfigParams {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function getActiveFirebaseConfig(): FirebaseConfigParams | null {
  // 1. Check environment variables
  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (envKey && envKey !== 'undefined' && envKey !== 'your_api_key_here' && envKey.trim() !== '') {
    return {
      apiKey: envKey.trim(),
      authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`).trim(),
      projectId: (envProjectId || '').trim(),
      storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.appspot.com`).trim(),
      messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
      appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
    };
  }

  // 2. Check stored runtime config
  try {
    const stored = localStorage.getItem('dhulfiqar_firebase_runtime_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse runtime Firebase config:', err);
  }

  return null;
}

const activeConfig = getActiveFirebaseConfig();

export const isFirebaseConfigured = Boolean(
  activeConfig && activeConfig.apiKey && activeConfig.apiKey !== 'mock-api-key'
);

let appInstance: FirebaseApp | null = null;

if (activeConfig) {
  try {
    if (!getApps().length) {
      appInstance = initializeApp(activeConfig);
    } else {
      appInstance = getApp();
    }
  } catch (err) {
    console.warn('Firebase initialization error:', err);
    appInstance = null;
  }
}

export const app = appInstance;
export const db = appInstance ? getFirestore(appInstance) : (null as unknown as Firestore);
export const auth = appInstance ? getAuth(appInstance) : (null as unknown as Auth);

export function saveRuntimeFirebaseConfig(config: FirebaseConfigParams): boolean {
  try {
    localStorage.setItem('dhulfiqar_firebase_runtime_config', JSON.stringify(config));
    window.location.reload();
    return true;
  } catch (err) {
    console.error('Failed to save Firebase config:', err);
    return false;
  }
}

export function clearRuntimeFirebaseConfig(): void {
  localStorage.removeItem('dhulfiqar_firebase_runtime_config');
  window.location.reload();
}