import {
  getApp,
  getApps,
  initializeApp,
} from 'firebase/app';

import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously,
  type User,
} from 'firebase/auth';

import {
  getFirestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:
    'AIzaSyAXwoMQarNdVBdL4VD1XlRpn4hKZXgc43Y',
  authDomain:
    'reportgeneratornoc.firebaseapp.com',
  projectId:
    'reportgeneratornoc',
  storageBucket:
    'reportgeneratornoc.firebasestorage.app',
  messagingSenderId:
    '672045632533',
  appId:
    '1:672045632533:web:900aa26d24ad537dadd21c',
  measurementId:
    'G-BZD004WJV8',
} as const;

export const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        firebaseConfig
      );

export const firebaseAuth =
  getAuth(firebaseApp);

export const firestoreDb =
  getFirestore(firebaseApp);

let authReadyPromise:
  Promise<User> | null = null;

export function ensureFirebaseUser(): Promise<User> {
  if (firebaseAuth.currentUser) {
    return Promise.resolve(
      firebaseAuth.currentUser
    );
  }

  if (authReadyPromise) {
    return authReadyPromise;
  }

  authReadyPromise =
    (async () => {
      await setPersistence(
        firebaseAuth,
        browserLocalPersistence
      );

      if (
        firebaseAuth.currentUser
      ) {
        return firebaseAuth.currentUser;
      }

      const credential =
        await signInAnonymously(
          firebaseAuth
        );

      return credential.user;
    })().finally(() => {
      authReadyPromise = null;
    });

  return authReadyPromise;
}

export async function initializeFirebaseAnalytics(): Promise<void> {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  try {
    const {
      getAnalytics,
      isSupported,
    } = await import(
      'firebase/analytics'
    );

    if (
      await isSupported()
    ) {
      getAnalytics(
        firebaseApp
      );
    }
  } catch {
    // Analytics is optional and must never block ReportOS.
  }
}
