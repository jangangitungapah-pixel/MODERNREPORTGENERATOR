const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const stamp = Date.now();
const backups = new Set();

function target(relativePath) {
  return path.join(root, relativePath);
}

function normalize(value) {
  return value.replace(/\r\n/g, '\n');
}

function read(relativePath) {
  const file = target(relativePath);

  if (!fs.existsSync(file)) {
    throw new Error(
      `Required file not found: ${relativePath}`
    );
  }

  return normalize(
    fs.readFileSync(
      file,
      'utf8'
    )
  );
}

function ensureDir(relativePath) {
  fs.mkdirSync(
    target(relativePath),
    {
      recursive: true,
    }
  );
}

function backup(relativePath, original) {
  if (backups.has(relativePath)) {
    return;
  }

  fs.writeFileSync(
    `${target(relativePath)}.bak-${stamp}`,
    original,
    'utf8'
  );

  backups.add(relativePath);
}

function write(relativePath, source) {
  const file = target(relativePath);

  ensureDir(
    path.dirname(relativePath)
  );

  const original =
    fs.existsSync(file)
      ? fs.readFileSync(
          file,
          'utf8'
        )
      : null;

  const next =
    normalize(source);

  if (
    original !== null &&
    normalize(original) ===
      next
  ) {
    console.log(
      `verified ${relativePath}`
    );

    return;
  }

  if (original !== null) {
    backup(
      relativePath,
      original
    );
  }

  fs.writeFileSync(
    file,
    next,
    'utf8'
  );

  console.log(
    `${original === null
      ? 'created'
      : 'updated'} ${relativePath}`
  );
}

function assertCleanTrackedTree() {
  try {
    cp.execFileSync(
      'git',
      [
        'diff',
        '--quiet',
      ],
      {
        cwd: root,
        stdio: 'ignore',
      }
    );

    cp.execFileSync(
      'git',
      [
        'diff',
        '--cached',
        '--quiet',
      ],
      {
        cwd: root,
        stdio: 'ignore',
      }
    );
  } catch {
    throw new Error(
      'Tracked working tree is not clean. Commit or restore the current work before starting FS-1.'
    );
  }
}

// -----------------------------------------------------------------------------
// PRE-FLIGHT
// -----------------------------------------------------------------------------

assertCleanTrackedTree();

const pkg =
  JSON.parse(
    read('package.json')
  );

if (
  pkg.name !==
  'modern-report-generator'
) {
  throw new Error(
    'Unexpected package.json. Refusing to patch the wrong project.'
  );
}

if (
  !pkg.dependencies?.[
    'drizzle-orm'
  ] ||
  !pkg.dependencies?.zod ||
  !pkg.devDependencies?.[
    '@opennextjs/cloudflare'
  ]
) {
  throw new Error(
    'FS-0 foundation is incomplete. drizzle-orm, zod and OpenNext must exist before FS-1.'
  );
}

// -----------------------------------------------------------------------------
// 1. PACKAGE: ONLY THE NEW DEPENDENCY FS-1 ACTUALLY USES
// -----------------------------------------------------------------------------

{
  const relativePath =
    'package.json';

  const current =
    JSON.parse(
      read(relativePath)
    );

  current.dependencies = {
    ...(current.dependencies ??
      {}),
    jose: '6.2.5',
  };

  current.scripts = {
    ...(current.scripts ??
      {}),
    'd1:provision':
      'node scripts/provision-reportos-d1.cjs',
    'db:migrate:local':
      'wrangler d1 migrations apply reportos-db --local',
    'db:migrate:remote':
      'wrangler d1 migrations apply reportos-db --remote',
    'db:migrations:local':
      'wrangler d1 migrations list reportos-db --local',
    'db:migrations:remote':
      'wrangler d1 migrations list reportos-db --remote',
  };

  current.dependencies =
    Object.fromEntries(
      Object.entries(
        current.dependencies
      ).sort(
        ([left], [right]) =>
          left.localeCompare(
            right
          )
      )
    );

  write(
    relativePath,
    JSON.stringify(
      current,
      null,
      2
    ) + '\n'
  );
}

// -----------------------------------------------------------------------------
// 2. SHARED API ERROR CONTRACT
// -----------------------------------------------------------------------------

write(
  'lib/contracts/api.ts',
  `import {
  z,
} from 'zod';

export const apiErrorSchema =
  z.object({
    ok: z.literal(false),
    error: z.object({
      code:
        z.string().min(1),
      message:
        z.string().min(1),
      requestId:
        z.string().min(1),
    }),
  });

export type ApiErrorEnvelope =
  z.infer<
    typeof apiErrorSchema
  >;
`
);

// -----------------------------------------------------------------------------
// 3. SESSION CONTRACT
// -----------------------------------------------------------------------------

write(
  'lib/contracts/session.ts',
  `import {
  z,
} from 'zod';

export const workspaceRoleSchema =
  z.enum([
    'operator',
    'supervisor',
    'admin',
  ]);

export const reportOsSessionSchema =
  z.object({
    ok: z.literal(true),
    requestId:
      z.string().min(1),
    timestamp:
      z.string().datetime(),
    user: z.object({
      uid:
        z.string().min(1),
      email:
        z.string().email().nullable(),
      displayName:
        z.string().nullable(),
      provider:
        z.string().min(1),
      anonymous:
        z.boolean(),
    }),
    workspace: z.object({
      id:
        z.string().min(1),
      name:
        z.string().min(1),
      role:
        workspaceRoleSchema,
    }),
  });

export type WorkspaceRole =
  z.infer<
    typeof workspaceRoleSchema
  >;

export type ReportOsSession =
  z.infer<
    typeof reportOsSessionSchema
  >;
`
);

// -----------------------------------------------------------------------------
// 4. REQUEST ID + API PROBLEM
// -----------------------------------------------------------------------------

write(
  'lib/server/http/api-problem.ts',
  `import {
  NextResponse,
} from 'next/server';

import {
  apiErrorSchema,
} from '@/lib/contracts/api';

export class ApiProblem
  extends Error {
  readonly status: number;
  readonly code: string;

  constructor({
    status,
    code,
    message,
  }: {
    status: number;
    code: string;
    message: string;
  }) {
    super(message);

    this.name =
      'ApiProblem';

    this.status =
      status;

    this.code =
      code;
  }
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function apiProblemResponse(
  error: unknown,
  requestId: string
) {
  const problem =
    error instanceof ApiProblem
      ? error
      : new ApiProblem({
          status: 500,
          code:
            'INTERNAL_ERROR',
          message:
            'ReportOS could not complete the request.',
        });

  const payload =
    apiErrorSchema.parse({
      ok: false,
      error: {
        code:
          problem.code,
        message:
          problem.message,
        requestId,
      },
    });

  return NextResponse.json(
    payload,
    {
      status:
        problem.status,
      headers: {
        'Cache-Control':
          'no-store',
        'X-Request-Id':
          requestId,
      },
    }
  );
}
`
);

// -----------------------------------------------------------------------------
// 5. PURE RBAC POLICY
// -----------------------------------------------------------------------------

write(
  'lib/server/auth/rbac.ts',
  `import {
  type WorkspaceRole,
} from '@/lib/contracts/session';

const roleRank:
  Record<
    WorkspaceRole,
    number
  > = {
  operator: 10,
  supervisor: 20,
  admin: 30,
};

export function roleAtLeast(
  actual: WorkspaceRole,
  required: WorkspaceRole
): boolean {
  return (
    roleRank[actual] >=
    roleRank[required]
  );
}
`
);

write(
  'lib/server/auth/rbac.test.ts',
  `import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  roleAtLeast,
} from './rbac';

describe(
  'ReportOS RBAC',
  () => {
    it(
      'orders workspace authority',
      () => {
        expect(
          roleAtLeast(
            'operator',
            'operator'
          )
        ).toBe(true);

        expect(
          roleAtLeast(
            'operator',
            'supervisor'
          )
        ).toBe(false);

        expect(
          roleAtLeast(
            'supervisor',
            'operator'
          )
        ).toBe(true);

        expect(
          roleAtLeast(
            'admin',
            'supervisor'
          )
        ).toBe(true);
      }
    );
  }
);
`
);

// -----------------------------------------------------------------------------
// 6. FIREBASE ID TOKEN VERIFICATION FOR WORKERS
// -----------------------------------------------------------------------------

write(
  'lib/server/auth/firebase-token.ts',
  `import {
  decodeProtectedHeader,
  importX509,
  jwtVerify,
  type JWTPayload,
  type KeyLike,
} from 'jose';

import {
  ApiProblem,
} from '@/lib/server/http/api-problem';

const FIREBASE_PROJECT_ID =
  'reportgeneratornoc';

const FIREBASE_ISSUER =
  'https://securetoken.google.com/' +
  FIREBASE_PROJECT_ID;

const FIREBASE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/' +
  'securetoken@system.gserviceaccount.com';

type FirebasePayload =
  JWTPayload & {
    auth_time?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
    firebase?: {
      sign_in_provider?:
        unknown;
    };
  };

export type FirebasePrincipal = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  provider: string;
};

type CertificateCache = {
  expiresAt: number;
  certificates:
    Record<
      string,
      string
    >;
};

let certificateCache:
  CertificateCache | null =
    null;

function parseMaxAge(
  cacheControl: string | null
): number {
  if (!cacheControl) {
    return 300;
  }

  const match =
    cacheControl.match(
      /(?:^|,)\s*max-age=(\d+)/i
    );

  if (!match) {
    return 300;
  }

  const seconds =
    Number(
      match[1]
    );

  return Number.isFinite(
    seconds
  )
    ? Math.max(
        60,
        seconds
      )
    : 300;
}

async function loadCertificates(): Promise<
  Record<string, string>
> {
  const now =
    Date.now();

  if (
    certificateCache &&
    certificateCache.expiresAt >
      now + 5_000
  ) {
    return (
      certificateCache
        .certificates
    );
  }

  const response =
    await fetch(
      FIREBASE_CERT_URL,
      {
        headers: {
          Accept:
            'application/json',
        },
      }
    );

  if (!response.ok) {
    throw new ApiProblem({
      status: 503,
      code:
        'AUTH_KEYS_UNAVAILABLE',
      message:
        'Authentication keys are temporarily unavailable.',
    });
  }

  const value =
    (await response.json()) as
      unknown;

  if (
    typeof value !==
      'object' ||
    value === null
  ) {
    throw new ApiProblem({
      status: 503,
      code:
        'AUTH_KEYS_INVALID',
      message:
        'Authentication keys could not be loaded.',
    });
  }

  const certificates:
    Record<
      string,
      string
    > = {};

  for (
    const [
      key,
      certificate,
    ] of Object.entries(
      value
    )
  ) {
    if (
      typeof certificate ===
      'string'
    ) {
      certificates[key] =
        certificate;
    }
  }

  if (
    Object.keys(
      certificates
    ).length === 0
  ) {
    throw new ApiProblem({
      status: 503,
      code:
        'AUTH_KEYS_EMPTY',
      message:
        'Authentication keys are temporarily unavailable.',
    });
  }

  const maxAge =
    parseMaxAge(
      response.headers.get(
        'cache-control'
      )
    );

  certificateCache = {
    certificates,
    expiresAt:
      now +
      maxAge * 1_000,
  };

  return certificates;
}

export function bearerTokenFromHeader(
  authorization:
    string | null
): string | null {
  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  const token =
    match?.[1]?.trim();

  return token
    ? token
    : null;
}

function assertFirebaseClaims(
  payload: FirebasePayload,
  nowEpochSeconds: number
): FirebasePrincipal {
  const uid =
    typeof payload.sub ===
      'string'
      ? payload.sub.trim()
      : '';

  if (!uid) {
    throw new ApiProblem({
      status: 401,
      code:
        'AUTH_INVALID_SUBJECT',
      message:
        'Authentication token has no valid user identity.',
    });
  }

  if (
    typeof payload.iat !==
      'number' ||
    payload.iat >
      nowEpochSeconds + 60
  ) {
    throw new ApiProblem({
      status: 401,
      code:
        'AUTH_INVALID_ISSUED_AT',
      message:
        'Authentication token has an invalid issued-at time.',
    });
  }

  if (
    typeof payload.auth_time !==
      'number' ||
    payload.auth_time >
      nowEpochSeconds + 60
  ) {
    throw new ApiProblem({
      status: 401,
      code:
        'AUTH_INVALID_TIME',
      message:
        'Authentication token has an invalid authentication time.',
    });
  }

  const provider =
    typeof payload.firebase
      ?.sign_in_provider ===
      'string'
      ? payload.firebase
          .sign_in_provider
      : 'unknown';

  return {
    uid,
    email:
      typeof payload.email ===
        'string'
        ? payload.email
        : null,
    emailVerified:
      payload.email_verified ===
      true,
    displayName:
      typeof payload.name ===
        'string'
        ? payload.name
        : null,
    provider,
  };
}

export async function verifyFirebaseJwtWithKey({
  token,
  key,
  nowEpochSeconds =
    Math.floor(
      Date.now() / 1_000
    ),
}: {
  token: string;
  key: KeyLike | CryptoKey;
  nowEpochSeconds?: number;
}): Promise<FirebasePrincipal> {
  try {
    const {
      payload,
    } =
      await jwtVerify(
        token,
        key,
        {
          algorithms: [
            'RS256',
          ],
          audience:
            FIREBASE_PROJECT_ID,
          issuer:
            FIREBASE_ISSUER,
          currentDate:
            new Date(
              nowEpochSeconds *
                1_000
            ),
        }
      );

    return assertFirebaseClaims(
      payload as FirebasePayload,
      nowEpochSeconds
    );
  } catch (error) {
    if (
      error instanceof
      ApiProblem
    ) {
      throw error;
    }

    throw new ApiProblem({
      status: 401,
      code:
        'AUTH_INVALID_TOKEN',
      message:
        'Authentication token is invalid or expired.',
    });
  }
}

export async function verifyFirebaseIdToken(
  token: string
): Promise<FirebasePrincipal> {
  let header:
    ReturnType<
      typeof decodeProtectedHeader
    >;

  try {
    header =
      decodeProtectedHeader(
        token
      );
  } catch {
    throw new ApiProblem({
      status: 401,
      code:
        'AUTH_MALFORMED_TOKEN',
      message:
        'Authentication token is malformed.',
    });
  }

  if (
    header.alg !==
      'RS256' ||
    typeof header.kid !==
      'string' ||
    !header.kid
  ) {
    throw new ApiProblem({
      status: 401,
      code:
        'AUTH_INVALID_HEADER',
      message:
        'Authentication token header is invalid.',
    });
  }

  const certificates =
    await loadCertificates();

  const certificate =
    certificates[
      header.kid
    ];

  if (!certificate) {
    certificateCache =
      null;

    throw new ApiProblem({
      status: 401,
      code:
        'AUTH_UNKNOWN_KEY',
      message:
        'Authentication token signing key is not recognized.',
    });
  }

  const key =
    await importX509(
      certificate,
      'RS256'
    );

  return verifyFirebaseJwtWithKey({
    token,
    key,
  });
}

export async function requireFirebasePrincipal(
  request: Request
): Promise<FirebasePrincipal> {
  const token =
    bearerTokenFromHeader(
      request.headers.get(
        'authorization'
      )
    );

  if (!token) {
    throw new ApiProblem({
      status: 401,
      code:
        'AUTH_REQUIRED',
      message:
        'Authentication is required.',
    });
  }

  return verifyFirebaseIdToken(
    token
  );
}
`
);

// -----------------------------------------------------------------------------
// 7. TOKEN VERIFICATION TEST WITH AN ACTUAL RS256 JWT
// -----------------------------------------------------------------------------

write(
  'lib/server/auth/firebase-token.test.ts',
  `import {
  generateKeyPair,
  SignJWT,
} from 'jose';

import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  bearerTokenFromHeader,
  verifyFirebaseJwtWithKey,
} from './firebase-token';

const projectId =
  'reportgeneratornoc';

describe(
  'Firebase backend identity',
  () => {
    it(
      'extracts bearer tokens safely',
      () => {
        expect(
          bearerTokenFromHeader(
            'Bearer abc.def.ghi'
          )
        ).toBe(
          'abc.def.ghi'
        );

        expect(
          bearerTokenFromHeader(
            'Basic abc'
          )
        ).toBeNull();

        expect(
          bearerTokenFromHeader(
            null
          )
        ).toBeNull();
      }
    );

    it(
      'verifies Firebase issuer, audience, signature and identity claims',
      async () => {
        const now =
          1_786_880_000;

        const {
          publicKey,
          privateKey,
        } =
          await generateKeyPair(
            'RS256'
          );

        const token =
          await new SignJWT({
            auth_time:
              now - 10,
            email:
              'noc@example.com',
            email_verified:
              true,
            name:
              'NOC Operator',
            firebase: {
              sign_in_provider:
                'password',
            },
          })
            .setProtectedHeader({
              alg:
                'RS256',
              kid:
                'unit-test',
            })
            .setIssuer(
              'https://securetoken.google.com/' +
                projectId
            )
            .setAudience(
              projectId
            )
            .setSubject(
              'uid-test'
            )
            .setIssuedAt(
              now - 5
            )
            .setExpirationTime(
              now + 3_600
            )
            .sign(
              privateKey
            );

        await expect(
          verifyFirebaseJwtWithKey({
            token,
            key:
              publicKey,
            nowEpochSeconds:
              now,
          })
        ).resolves.toEqual({
          uid:
            'uid-test',
          email:
            'noc@example.com',
          emailVerified:
            true,
          displayName:
            'NOC Operator',
          provider:
            'password',
        });
      }
    );

    it(
      'rejects the wrong Firebase audience',
      async () => {
        const now =
          1_786_880_000;

        const {
          publicKey,
          privateKey,
        } =
          await generateKeyPair(
            'RS256'
          );

        const token =
          await new SignJWT({
            auth_time:
              now - 10,
          })
            .setProtectedHeader({
              alg:
                'RS256',
              kid:
                'unit-test',
            })
            .setIssuer(
              'https://securetoken.google.com/' +
                projectId
            )
            .setAudience(
              'wrong-project'
            )
            .setSubject(
              'uid-test'
            )
            .setIssuedAt(
              now - 5
            )
            .setExpirationTime(
              now + 3_600
            )
            .sign(
              privateKey
            );

        await expect(
          verifyFirebaseJwtWithKey({
            token,
            key:
              publicKey,
            nowEpochSeconds:
              now,
          })
        ).rejects.toMatchObject({
          status: 401,
          code:
            'AUTH_INVALID_TOKEN',
        });
      }
    );
  }
);
`
);

// -----------------------------------------------------------------------------
// 8. D1 CLIENT — REQUEST-SCOPED, OPENNEXT BINDING
// -----------------------------------------------------------------------------

write(
  'lib/server/db/client.ts',
  `import {
  getCloudflareContext,
} from '@opennextjs/cloudflare';

import {
  drizzle,
} from 'drizzle-orm/d1';

import * as schema
  from './schema';

import {
  ApiProblem,
} from '@/lib/server/http/api-problem';

type D1Binding =
  Parameters<
    typeof drizzle
  >[0];

type ReportOsEnv = {
  DB?: D1Binding;
  REPORTOS_ENV?: string;
};

export function getDb() {
  const {
    env,
  } =
    getCloudflareContext();

  const reportOsEnv =
    env as unknown as
      ReportOsEnv;

  if (
    !reportOsEnv.DB
  ) {
    throw new ApiProblem({
      status: 503,
      code:
        'DATABASE_UNAVAILABLE',
      message:
        'ReportOS database binding is not configured.',
    });
  }

  return drizzle(
    reportOsEnv.DB,
    {
      schema,
    }
  );
}
`
);

// -----------------------------------------------------------------------------
// 9. USER / WORKSPACE BOOTSTRAP
// -----------------------------------------------------------------------------

write(
  'lib/server/db/session-repository.ts',
  `import {
  and,
  eq,
} from 'drizzle-orm';

import {
  type WorkspaceRole,
} from '@/lib/contracts/session';

import {
  type FirebasePrincipal,
} from '@/lib/server/auth/firebase-token';

import {
  ApiProblem,
} from '@/lib/server/http/api-problem';

import {
  getDb,
} from './client';

import {
  appUsers,
  workspaceMembers,
  workspaces,
} from './schema';

export type SessionWorkspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

function personalWorkspaceId(
  uid: string
): string {
  return (
    'workspace-' +
    uid
  );
}

export async function ensurePersonalWorkspace(
  principal:
    FirebasePrincipal
): Promise<SessionWorkspace> {
  const db =
    getDb();

  const now =
    Date.now();

  const workspaceId =
    personalWorkspaceId(
      principal.uid
    );

  await db
    .insert(
      appUsers
    )
    .values({
      uid:
        principal.uid,
      email:
        principal.email,
      displayName:
        principal.displayName,
      role:
        'admin',
      createdAt:
        now,
      updatedAt:
        now,
    })
    .onConflictDoUpdate({
      target:
        appUsers.uid,
      set: {
        email:
          principal.email,
        displayName:
          principal.displayName,
        updatedAt:
          now,
      },
    });

  await db
    .insert(
      workspaces
    )
    .values({
      id:
        workspaceId,
      ownerUid:
        principal.uid,
      name:
        'ReportOS Workspace',
      createdAt:
        now,
      updatedAt:
        now,
    })
    .onConflictDoNothing({
      target:
        workspaces.id,
    });

  await db
    .insert(
      workspaceMembers
    )
    .values({
      workspaceId,
      uid:
        principal.uid,
      role:
        'admin',
      createdAt:
        now,
    })
    .onConflictDoNothing({
      target: [
        workspaceMembers
          .workspaceId,
        workspaceMembers
          .uid,
      ],
    });

  const rows =
    await db
      .select({
        id:
          workspaces.id,
        name:
          workspaces.name,
        role:
          workspaceMembers.role,
      })
      .from(
        workspaceMembers
      )
      .innerJoin(
        workspaces,
        eq(
          workspaces.id,
          workspaceMembers
            .workspaceId
        )
      )
      .where(
        and(
          eq(
            workspaceMembers.uid,
            principal.uid
          ),
          eq(
            workspaceMembers
              .workspaceId,
            workspaceId
          )
        )
      )
      .limit(1);

  const workspace =
    rows[0];

  if (!workspace) {
    throw new ApiProblem({
      status: 500,
      code:
        'WORKSPACE_BOOTSTRAP_FAILED',
      message:
        'ReportOS could not initialize the user workspace.',
    });
  }

  return {
    id:
      workspace.id,
    name:
      workspace.name,
    role:
      workspace.role as
        WorkspaceRole,
  };
}
`
);

// -----------------------------------------------------------------------------
// 10. AUTHENTICATED SESSION API
// -----------------------------------------------------------------------------

write(
  'app/api/v1/session/route.ts',
  `import {
  NextResponse,
} from 'next/server';

import {
  reportOsSessionSchema,
} from '@/lib/contracts/session';

import {
  requireFirebasePrincipal,
} from '@/lib/server/auth/firebase-token';

import {
  ensurePersonalWorkspace,
} from '@/lib/server/db/session-repository';

import {
  apiProblemResponse,
  createRequestId,
} from '@/lib/server/http/api-problem';

export const dynamic =
  'force-dynamic';

export async function GET(
  request: Request
) {
  const requestId =
    createRequestId();

  try {
    const principal =
      await requireFirebasePrincipal(
        request
      );

    const workspace =
      await ensurePersonalWorkspace(
        principal
      );

    const payload =
      reportOsSessionSchema.parse({
        ok: true,
        requestId,
        timestamp:
          new Date()
            .toISOString(),
        user: {
          uid:
            principal.uid,
          email:
            principal.email,
          displayName:
            principal.displayName,
          provider:
            principal.provider,
          anonymous:
            principal.provider ===
            'anonymous',
        },
        workspace,
      });

    return NextResponse.json(
      payload,
      {
        headers: {
          'Cache-Control':
            'no-store',
          'X-Request-Id':
            requestId,
        },
      }
    );
  } catch (error) {
    return apiProblemResponse(
      error,
      requestId
    );
  }
}
`
);

// -----------------------------------------------------------------------------
// 11. BROWSER CLIENT FOR THE SECURE SERVER SESSION
// -----------------------------------------------------------------------------

write(
  'lib/reportos-session-client.ts',
  `'use client';

import {
  apiErrorSchema,
} from '@/lib/contracts/api';

import {
  reportOsSessionSchema,
  type ReportOsSession,
} from '@/lib/contracts/session';

import {
  ensureFirebaseUser,
} from '@/lib/firebase-client';

export class ReportOsApiError
  extends Error {
  readonly code: string;
  readonly requestId: string;

  constructor({
    code,
    message,
    requestId,
  }: {
    code: string;
    message: string;
    requestId: string;
  }) {
    super(message);

    this.name =
      'ReportOsApiError';

    this.code =
      code;

    this.requestId =
      requestId;
  }
}

export async function loadReportOsSession(): Promise<
  ReportOsSession
> {
  const user =
    await ensureFirebaseUser();

  const idToken =
    await user.getIdToken();

  const response =
    await fetch(
      '/api/v1/session',
      {
        method: 'GET',
        headers: {
          Authorization:
            'Bearer ' +
            idToken,
        },
        cache:
          'no-store',
      }
    );

  const body =
    (await response.json()) as
      unknown;

  if (!response.ok) {
    const parsed =
      apiErrorSchema
        .safeParse(
          body
        );

    if (parsed.success) {
      throw new ReportOsApiError(
        parsed.data.error
      );
    }

    throw new ReportOsApiError({
      code:
        'INVALID_API_RESPONSE',
      message:
        'ReportOS server returned an invalid error response.',
      requestId:
        response.headers.get(
          'x-request-id'
        ) ??
        'unknown',
    });
  }

  return reportOsSessionSchema.parse(
    body
  );
}
`
);

// -----------------------------------------------------------------------------
// 12. SESSION CONTRACT TEST
// -----------------------------------------------------------------------------

write(
  'lib/contracts/session.test.ts',
  `import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  reportOsSessionSchema,
} from './session';

describe(
  'ReportOS session contract',
  () => {
    it(
      'accepts a verified server session',
      () => {
        const parsed =
          reportOsSessionSchema.parse({
            ok: true,
            requestId:
              'request-1',
            timestamp:
              '2026-08-16T11:00:00.000Z',
            user: {
              uid:
                'uid-1',
              email: null,
              displayName:
                null,
              provider:
                'anonymous',
              anonymous:
                true,
            },
            workspace: {
              id:
                'workspace-uid-1',
              name:
                'ReportOS Workspace',
              role:
                'admin',
            },
          });

        expect(
          parsed.workspace.role
        ).toBe(
          'admin'
        );
      }
    );
  }
);
`
);

// -----------------------------------------------------------------------------
// 13. D1 PROVISIONER
// -----------------------------------------------------------------------------

write(
  'scripts/provision-reportos-d1.cjs',
  `const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const wranglerPath =
  path.join(
    root,
    'wrangler.jsonc'
  );

const databaseName =
  'reportos-db';

const bindingName =
  'DB';

const npx =
  process.platform ===
  'win32'
    ? 'npx.cmd'
    : 'npx';

function run(
  args,
  options = {}
) {
  return cp.execFileSync(
    npx,
    [
      'wrangler',
      ...args,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      ...options,
    }
  );
}

function listDatabases() {
  const raw =
    run([
      'd1',
      'list',
      '--json',
    ]);

  const parsed =
    JSON.parse(raw);

  return Array.isArray(
    parsed
  )
    ? parsed
    : [];
}

function findDatabase(
  databases
) {
  return databases.find(
    (database) =>
      database?.name ===
      databaseName
  );
}

if (
  !fs.existsSync(
    wranglerPath
  )
) {
  throw new Error(
    'wrangler.jsonc not found.'
  );
}

let databases;

try {
  databases =
    listDatabases();
} catch {
  throw new Error(
    'Cloudflare authentication is required. Run: npx wrangler login'
  );
}

let database =
  findDatabase(
    databases
  );

if (!database) {
  console.log(
    'Creating free-tier D1 database: ' +
      databaseName
  );

  run(
    [
      'd1',
      'create',
      databaseName,
    ],
    {
      stdio: 'inherit',
    }
  );

  databases =
    listDatabases();

  database =
    findDatabase(
      databases
    );
}

if (
  !database ||
  typeof database.uuid !==
    'string'
) {
  throw new Error(
    'Unable to resolve the D1 database UUID.'
  );
}

const original =
  fs.readFileSync(
    wranglerPath,
    'utf8'
  );

let config;

try {
  config =
    JSON.parse(
      original
    );
} catch {
  throw new Error(
    'wrangler.jsonc must remain JSON-compatible before D1 provisioning.'
  );
}

config.d1_databases = [
  {
    binding:
      bindingName,
    database_name:
      databaseName,
    database_id:
      database.uuid,
    migrations_dir:
      'drizzle',
  },
];

const next =
  JSON.stringify(
    config,
    null,
    2
  ) + '\\n';

if (next !== original) {
  fs.writeFileSync(
    wranglerPath +
      '.bak-' +
      Date.now(),
    original,
    'utf8'
  );

  fs.writeFileSync(
    wranglerPath,
    next,
    'utf8'
  );

  console.log(
    'Updated wrangler.jsonc with D1 binding DB.'
  );
} else {
  console.log(
    'Verified existing D1 binding DB.'
  );
}

console.log(
  'Applying D1 migration locally...'
);

run(
  [
    'd1',
    'migrations',
    'apply',
    databaseName,
    '--local',
  ],
  {
    stdio:
      'inherit',
  }
);

console.log('');
console.log(
  'D1 provisioning complete.'
);
console.log(
  'Database: ' +
    databaseName
);
console.log(
  'Binding: ' +
    bindingName
);
console.log(
  'Remote migration is intentionally separate.'
);
console.log(
  'Next: npm run db:migrate:remote'
);
`
);

// -----------------------------------------------------------------------------
// 14. FS-1 SECURITY DOCUMENT
// -----------------------------------------------------------------------------

write(
  'docs/FS1_IDENTITY_SERVER_BOUNDARY.md',
  `# FS-1 — Identity & Secure Server Boundary

## Trust model

The browser is untrusted.

ReportOS never accepts a UID from request JSON, query parameters, or browser storage as proof of identity.

The client obtains a Firebase ID token and sends it as:

\`\`\`text
Authorization: Bearer <firebase-id-token>
\`\`\`

The Worker verifies:

- RS256
- signing key ID
- Google/Firebase signing certificate
- audience = reportgeneratornoc
- issuer = https://securetoken.google.com/reportgeneratornoc
- expiration
- issued-at time
- authentication time
- non-empty subject / UID

Only the verified JWT subject becomes the ReportOS UID.

## Authorization model

Roles live in D1 rather than browser state:

\`\`\`text
operator < supervisor < admin
\`\`\`

The personal workspace owner is bootstrapped as admin.

Future shared workspaces can assign a different role in \`workspace_members\`.

## Database boundary

D1 is accessed only through the server runtime.

Client components never receive a D1 binding and never issue SQL.

OpenNext exposes Cloudflare bindings to server routes through \`getCloudflareContext()\`.

## Endpoint introduced

\`\`\`text
GET /api/v1/session
\`\`\`

Success:

- verified user identity
- auth provider
- anonymous/non-anonymous state
- personal workspace
- workspace role
- request ID

Failure:

- stable error code
- safe user-facing message
- request ID

## D1 provisioning

\`\`\`text
npm run d1:provision
npm run db:migrate:remote
\`\`\`

The provisioner:

1. checks Cloudflare authentication
2. finds or creates \`reportos-db\`
3. binds it as \`DB\`
4. configures the \`drizzle\` migrations directory
5. applies migrations to local D1

Remote migration is deliberately a separate explicit command.

## No service account secret

FS-1 does not put a Firebase service-account private key in Workers.

Firebase ID tokens are verified using Firebase's published signing certificates and a JWT library.

## Phase exit criteria

- valid Firebase ID token reaches /api/v1/session
- invalid/missing token returns 401
- D1 user bootstraps once
- personal workspace bootstraps once
- workspace membership is admin for its owner
- no client-supplied UID is trusted
- typecheck/lint/test/build pass
- OpenNext Worker build passes on Linux CI
`
);

// -----------------------------------------------------------------------------
// FINAL VALIDATION
// -----------------------------------------------------------------------------

const checks = [
  [
    'package.json',
    '"jose": "6.2.5"',
  ],
  [
    'lib/server/auth/firebase-token.ts',
    'verifyFirebaseIdToken',
  ],
  [
    'lib/server/auth/firebase-token.ts',
    'securetoken.google.com',
  ],
  [
    'lib/server/auth/rbac.ts',
    'roleAtLeast',
  ],
  [
    'lib/server/db/client.ts',
    'getCloudflareContext',
  ],
  [
    'lib/server/db/session-repository.ts',
    'ensurePersonalWorkspace',
  ],
  [
    'app/api/v1/session/route.ts',
    'requireFirebasePrincipal',
  ],
  [
    'lib/reportos-session-client.ts',
    'Authorization:',
  ],
  [
    'scripts/provision-reportos-d1.cjs',
    'reportos-db',
  ],
];

for (
  const [
    relativePath,
    token,
  ] of checks
) {
  if (
    !read(
      relativePath
    ).includes(token)
  ) {
    throw new Error(
      `Validation failed: ${token} missing from ${relativePath}`
    );
  }
}

console.log('');
console.log(
  'FS-1 Identity & Secure Server Boundary applied.'
);
console.log(
  'Firebase ID token verification, RBAC, authenticated session API and D1 user/workspace bootstrap are ready.'
);
console.log(
  'Run npm install, then npm run d1:provision.'
);
console.log(
  'Remote D1 migration remains an explicit separate step.'
);
