'use client';

import {
  GoogleAuthProvider,
  linkWithPopup,
  type User,
} from 'firebase/auth';

import {
  ensureFirebaseUser,
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

  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: 'select_account',
  });

  try {
    const credential =
      await linkWithPopup(
        user,
        provider
      );

    return summary(
      credential.user
    );
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code ===
        'string'
        ? error.code
        : 'auth/unknown';

    if (
      code ===
        'auth/credential-already-in-use' ||
      code ===
        'auth/email-already-in-use'
    ) {
      throw new Error(
        'That Google account already owns a ReportOS identity. Existing anonymous data was not switched or deleted.'
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
