const FIREBASE_API_KEY =
  'AIzaSyAXwoMQarNdVBdL4VD1XlRpn4hKZXgc43Y';

const LOOKUP_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
  FIREBASE_API_KEY;

export type AuthenticatedPrincipal = {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  provider: string;
  anonymous: boolean;
};

export class AuthenticationError extends Error {
  readonly status = 401;
  readonly code: string;

  constructor(
    code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
  }
}

function bearerToken(
  request: Request
): string {
  const authorization =
    request.headers.get('authorization');

  const match =
    authorization?.match(
      /^Bearer\s+(.+)$/i
    );

  const token =
    match?.[1]?.trim();

  if (!token) {
    throw new AuthenticationError(
      'AUTH_REQUIRED',
      'Authentication is required.'
    );
  }

  return token;
}

type FirebaseLookupUser = {
  localId?: unknown;
  email?: unknown;
  emailVerified?: unknown;
  displayName?: unknown;
  providerUserInfo?: unknown;
  passwordHash?: unknown;
  customAuth?: unknown;
};

type FirebaseLookupResponse = {
  users?: FirebaseLookupUser[];
};

function providerFromUser(
  user: FirebaseLookupUser
): string {
  if (
    Array.isArray(
      user.providerUserInfo
    ) &&
    user.providerUserInfo.length > 0
  ) {
    const first =
      user.providerUserInfo[0];

    if (
      typeof first === 'object' &&
      first !== null &&
      'providerId' in first &&
      typeof first.providerId ===
        'string'
    ) {
      return first.providerId;
    }
  }

  if (
    typeof user.passwordHash ===
    'string'
  ) {
    return 'password';
  }

  if (user.customAuth === true) {
    return 'custom';
  }

  return 'anonymous';
}

export async function requireFirebasePrincipal(
  request: Request
): Promise<AuthenticatedPrincipal> {
  const idToken =
    bearerToken(request);

  const response =
    await fetch(
      LOOKUP_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          idToken,
        }),
        cache: 'no-store',
      }
    );

  if (!response.ok) {
    throw new AuthenticationError(
      'AUTH_INVALID_TOKEN',
      'Authentication token is invalid or expired.'
    );
  }

  const body =
    (await response.json()) as
      FirebaseLookupResponse;

  const user =
    body.users?.[0];

  const uid =
    typeof user?.localId ===
      'string'
      ? user.localId.trim()
      : '';

  if (!uid) {
    throw new AuthenticationError(
      'AUTH_INVALID_USER',
      'Authenticated user could not be resolved.'
    );
  }

  const provider =
    providerFromUser(user);

  return {
    uid,
    email:
      typeof user.email ===
        'string'
        ? user.email
        : null,
    displayName:
      typeof user.displayName ===
        'string'
        ? user.displayName
        : null,
    emailVerified:
      user.emailVerified === true,
    provider,
    anonymous:
      provider === 'anonymous',
  };
}
