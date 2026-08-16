'use client';

import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  type User,
} from 'firebase/auth';

import {
  ensureFirebaseUser,
  firebaseAuth,
} from './firebase-client';

export type IdentitySummary = {
  uid: string;
  anonymous: boolean;
  email: string | null;
  displayName: string | null;
};

function summary(
  user: User
): IdentitySummary {
  return {
    uid: user.uid,
    anonymous:
      user.isAnonymous,
    email:
      user.email,
    displayName:
      user.displayName,
  };
}

function googleProvider(): GoogleAuthProvider {
  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: 'select_account',
  });

  return provider;
}

function authErrorCode(
  error: unknown
): string {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : 'auth/unknown'
  );
}

export async function currentIdentity(): Promise<IdentitySummary> {
  return summary(
    await ensureFirebaseUser()
  );
}

export async function linkCurrentUserWithGoogle(): Promise<IdentitySummary> {
  const user =
    await ensureFirebaseUser();

  if (!user.isAnonymous) {
    return summary(user);
  }

  try {
    const credential =
      await linkWithPopup(
        user,
        googleProvider()
      );

    return summary(
      credential.user
    );
  } catch (error) {
    const code =
      authErrorCode(error);

    if (
      code ===
        'auth/credential-already-in-use' ||
      code ===
        'auth/email-already-in-use'
    ) {
      throw new Error(
        'That Google account already owns a ReportOS identity. Use “Sign in to existing Google identity” instead. Existing anonymous data was not switched or deleted.'
      );
    }

    if (
      code ===
      'auth/popup-closed-by-user'
    ) {
      throw new Error(
        'Google account linking was cancelled.'
      );
    }

    throw new Error(
      'Google account linking is unavailable. Verify the Google provider is enabled in Firebase Authentication.'
    );
  }
}

export async function signInWithGoogleIdentity(): Promise<IdentitySummary> {
  try {
    const credential =
      await signInWithPopup(
        firebaseAuth,
        googleProvider()
      );

    return summary(
      credential.user
    );
  } catch (error) {
    const code =
      authErrorCode(error);

    if (
      code ===
      'auth/popup-closed-by-user'
    ) {
      throw new Error(
        'Google sign-in was cancelled.'
      );
    }

    throw new Error(
      'Google sign-in is unavailable. Verify the Google provider is enabled in Firebase Authentication.'
    );
  }
}
