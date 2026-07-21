import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signInAnonymously, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { LiveAgentSession } from './types';

type FirebaseAppConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
};

const mergedFirebaseConfig: FirebaseAppConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? firebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? firebaseConfig.measurementId,
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID ?? firebaseConfig.oAuthClientId,
  recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY ?? firebaseConfig.recaptchaSiteKey,
};

const requiredConfigKeys: (keyof FirebaseAppConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingConfigKeys = requiredConfigKeys.filter((key) => !mergedFirebaseConfig[key]);

export const isFirebaseEnabled = missingConfigKeys.length === 0;

export const appFirebaseConfig = mergedFirebaseConfig;

const app = isFirebaseEnabled ? initializeApp(appFirebaseConfig) : null;
export const auth = isFirebaseEnabled && app ? getAuth(app) : {
  currentUser: null,
  signOut: async () => undefined,
};
export const db = isFirebaseEnabled && app ? getFirestore(app) : null;

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

export const signInAnonymouslyIfNeeded = async () => {
  if (!isFirebaseEnabled) return;
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth as any);
    } catch (e) {
      console.error("Failed to sign in anonymously:", e);
    }
  }
};

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  if (!isFirebaseEnabled) {
    onAuthFailure?.();
    return () => undefined;
  }

  return onAuthStateChanged(auth as any, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        try {
          cachedAccessToken = sessionStorage.getItem('_g_w_token_');
        } catch (e) {
          console.error("Failed to read token from sessionStorage", e);
        }
      }
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem('_g_w_token_');
      } catch (e) {
        console.error("Failed to remove token from sessionStorage", e);
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!isFirebaseEnabled) {
    throw new Error('Firebase is not configured for this deployment. Set the VITE_FIREBASE_* variables to enable Google sign-in.');
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      sessionStorage.setItem('_g_w_token_', cachedAccessToken);
    } catch (e) {
      console.error("Failed to write token to sessionStorage", e);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/documents');

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    try {
      cachedAccessToken = sessionStorage.getItem('_g_w_token_');
    } catch (e) {
      console.error("Failed to read token from sessionStorage", e);
    }
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth as any);
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem('_g_w_token_');
  } catch (e) {
    console.error("Failed to remove token from sessionStorage", e);
  }
};

// Firestore Error Handler from Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Real-time Session helpers
export const upsertSession = async (session: LiveAgentSession) => {
  if (!isFirebaseEnabled || !auth.currentUser || !db) return;
  const uid = auth.currentUser.uid;
  const path = `agent_sessions/${uid}`;
  try {
    await setDoc(doc(db, 'agent_sessions', uid), {
      ...session,
      id: uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteSession = async (agentId: string) => {
  if (!isFirebaseEnabled || !auth.currentUser || !db) return;
  const uid = auth.currentUser.uid;
  const path = `agent_sessions/${uid}`;
  try {
    await deleteDoc(doc(db, 'agent_sessions', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const listenToSessions = (onUpdate: (sessions: LiveAgentSession[]) => void) => {
  if (!isFirebaseEnabled || !db) {
    onUpdate([]);
    return () => undefined;
  }

  const path = 'agent_sessions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const sessions: LiveAgentSession[] = [];
      snapshot.forEach((doc) => {
        sessions.push(doc.data() as LiveAgentSession);
      });
      onUpdate(sessions);
    },
    (error) => {
      console.warn('Firestore agent_sessions subscription info (unauthenticated or offline):', error.message);
    }
  );
};

// Real-time Breaks helpers
export const upsertBreak = async (breakEvent: any) => {
  if (!isFirebaseEnabled || !auth.currentUser || !db) return;
  const path = `breaks/${breakEvent.id}`;
  try {
    await setDoc(doc(db, 'breaks', breakEvent.id), breakEvent);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const listenToBreaks = (onUpdate: (breaks: any[]) => void) => {
  if (!isFirebaseEnabled || !db) {
    onUpdate([]);
    return () => undefined;
  }

  const path = 'breaks';
  const q = query(collection(db, path), orderBy('startTime', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const breaksList: any[] = [];
      snapshot.forEach((doc) => {
        breaksList.push(doc.data());
      });
      onUpdate(breaksList);
    },
    (error) => {
      console.warn('Firestore breaks subscription info (unauthenticated or offline):', error.message);
    }
  );
};

// Global spreadsheet config helpers
export const saveSpreadsheetConfig = async (spreadsheetId: string, spreadsheetUrl: string) => {
  if (!isFirebaseEnabled || !auth.currentUser || !db) return;
  const path = 'config/spreadsheet';
  try {
    await setDoc(doc(db, 'config', 'spreadsheet'), { spreadsheetId, spreadsheetUrl, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const listenToSpreadsheetConfig = (onUpdate: (config: { spreadsheetId: string; spreadsheetUrl: string } | null) => void) => {
  if (!isFirebaseEnabled || !db) {
    onUpdate(null);
    return () => undefined;
  }

  const path = 'config/spreadsheet';
  return onSnapshot(
    doc(db, 'config', 'spreadsheet'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          spreadsheetId: data.spreadsheetId || '',
          spreadsheetUrl: data.spreadsheetUrl || ''
        });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Firestore config subscription info:', error.message);
    }
  );
};

export interface PersonalPreferences {
  isDarkMode: boolean;
  autoClockIn: boolean;
  audioNotifications: boolean;
  defaultBreakReason: string;
  compactSidebar: boolean;
  showWarnings: boolean;
  customAlias: string;
}

export const savePersonalPreferences = async (agentId: string, prefs: PersonalPreferences) => {
  if (!isFirebaseEnabled || !auth.currentUser || !db) return;
  const path = `config/preferences_${agentId}`;
  try {
    await setDoc(doc(db, 'config', `preferences_${agentId}`), { ...prefs, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const listenToPersonalPreferences = (agentId: string, onUpdate: (prefs: PersonalPreferences | null) => void) => {
  if (!isFirebaseEnabled || !db) {
    onUpdate(null);
    return () => undefined;
  }

  const path = `config/preferences_${agentId}`;
  return onSnapshot(
    doc(db, 'config', `preferences_${agentId}`),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          isDarkMode: data.isDarkMode ?? true,
          autoClockIn: data.autoClockIn ?? false,
          audioNotifications: data.audioNotifications ?? true,
          defaultBreakReason: data.defaultBreakReason ?? 'Short Break',
          compactSidebar: data.compactSidebar ?? false,
          showWarnings: data.showWarnings ?? true,
          customAlias: data.customAlias ?? ''
        });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Firestore personal preferences subscription info:', error.message);
    }
  );
};





