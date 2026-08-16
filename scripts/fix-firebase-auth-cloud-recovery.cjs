const fs = require('fs');
const path = require('path');

const root = process.cwd();
const stamp = Date.now();
const backups = new Set();

function target(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  const file = target(relativePath);

  if (!fs.existsSync(file)) {
    throw new Error(
      `Required file not found: ${relativePath}`
    );
  }

  return fs.readFileSync(file, 'utf8');
}

function backup(relativePath, source) {
  if (backups.has(relativePath)) {
    return;
  }

  fs.writeFileSync(
    `${target(relativePath)}.bak-${stamp}`,
    source,
    'utf8'
  );

  backups.add(relativePath);
}

function write(relativePath, source) {
  fs.writeFileSync(
    target(relativePath),
    source,
    'utf8'
  );

  console.log(`updated ${relativePath}`);
}

function replaceOnce(
  source,
  search,
  replacement,
  label
) {
  if (!source.includes(search)) {
    throw new Error(
      `Patch anchor not found: ${label}`
    );
  }

  return source.replace(
    search,
    replacement
  );
}

// -----------------------------------------------------------------------------
// 1. FIREBASE AUTH PROVIDER AS CODE
// -----------------------------------------------------------------------------

{
  const relativePath = 'firebase.json';
  const original = read(relativePath);

  const config = JSON.parse(original);

  config.auth = {
    providers: {
      anonymous: true,
    },
  };

  // Keep a stable, readable order.
  const next = {
    auth: config.auth,
    firestore: config.firestore,
    hosting: config.hosting,
  };

  const source =
    JSON.stringify(next, null, 2) +
    '\n';

  backup(relativePath, original);
  write(relativePath, source);
}

// -----------------------------------------------------------------------------
// 2. EXPLICIT FIREBASE DEPLOY SCRIPTS
// -----------------------------------------------------------------------------

{
  const relativePath = 'package.json';
  const original = read(relativePath);
  const pkg = JSON.parse(original);

  pkg.scripts = {
    ...pkg.scripts,
    'firebase:deploy:auth':
      'firebase deploy --only auth --project reportgeneratornoc',
    'firebase:deploy':
      'npm run build && firebase deploy --only auth,firestore,hosting --project reportgeneratornoc',
  };

  const source =
    JSON.stringify(pkg, null, 2) +
    '\n';

  backup(relativePath, original);
  write(relativePath, source);
}

// -----------------------------------------------------------------------------
// 3. FRIENDLIER CLOUD RECOVERY ERROR DIAGNOSTICS
// -----------------------------------------------------------------------------

{
  const relativePath =
    'components/firebase-cloud-recovery.tsx';

  const original = read(relativePath);

  if (
    original.includes(
      'function firebaseCloudErrorMessage('
    )
  ) {
    throw new Error(
      'Firebase Cloud Recovery diagnostics already appear to be installed.'
    );
  }

  let source = original;

  const helperAnchor = String.raw`function shortUid(
  uid: string
): string {
  if (uid.length <= 10) {
    return uid;
  }

  return (
    uid.slice(0, 6) +
    '…' +
    uid.slice(-4)
  );
}
`;

  const helperReplacement = helperAnchor + String.raw`
function firebaseCloudErrorMessage(
  error: unknown
): string {
  const candidate =
    error &&
    typeof error ===
      'object'
      ? error as {
          code?: unknown;
          message?: unknown;
        }
      : null;

  const code =
    typeof candidate?.code ===
      'string'
      ? candidate.code
      : '';

  if (
    code ===
      'auth/configuration-not-found' ||
    code ===
      'auth/operation-not-allowed'
  ) {
    return (
      'Firebase Anonymous Authentication is not enabled for project ' +
      'reportgeneratornoc. Deploy the Auth configuration first, then retry sync.'
    );
  }

  if (
    code ===
    'permission-denied'
  ) {
    return (
      'Firestore rejected this request. Deploy the repository Firestore rules ' +
      'for project reportgeneratornoc, then retry sync.'
    );
  }

  if (
    code ===
    'auth/network-request-failed'
  ) {
    return (
      'Firebase Authentication could not reach the network. ' +
      'Local draft is still preserved; retry when connectivity returns.'
    );
  }

  if (
    code ===
    'auth/too-many-requests'
  ) {
    return (
      'Firebase temporarily rate-limited authentication attempts. ' +
      'Wait briefly and retry.'
    );
  }

  return typeof candidate?.message ===
    'string'
    ? candidate.message
    : 'Firebase cloud operation failed.';
}
`;

  source = replaceOnce(
    source,
    helperAnchor,
    helperReplacement,
    'insert Firebase error translator'
  );

  source = source.replace(
    String.raw`          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Cloud sync failed.'
          );`,
    String.raw`          setErrorMessage(
            firebaseCloudErrorMessage(
              error
            )
          );`
  );

  source = source.replace(
    String.raw`          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Firebase initialization failed.'
          );`,
    String.raw`          setErrorMessage(
            firebaseCloudErrorMessage(
              error
            )
          );`
  );

  source = source.replace(
    String.raw`      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Cloud sync failed.'
      );`,
    String.raw`      setErrorMessage(
        firebaseCloudErrorMessage(
          error
        )
      );`
  );

  source = source.replace(
    String.raw`      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Cloud restore failed.'
      );`,
    String.raw`      setErrorMessage(
        firebaseCloudErrorMessage(
          error
        )
      );`
  );

  source = source.replace(
    String.raw`      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Snapshot restore failed.'
      );`,
    String.raw`      setErrorMessage(
        firebaseCloudErrorMessage(
          error
        )
      );`
  );

  source = source.replace(
    String.raw`      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to delete snapshot.'
      );`,
    String.raw`      setErrorMessage(
        firebaseCloudErrorMessage(
          error
        )
      );`
  );

  backup(relativePath, original);
  write(relativePath, source);
}

console.log('');
console.log(
  'Firebase Auth + Cloud Recovery configuration fix applied.'
);
console.log(
  'Anonymous Authentication is now declared in firebase.json.'
);
console.log(
  'Use npm run firebase:deploy:auth to enable Auth only, or npm run firebase:deploy for Auth + Firestore + Hosting.'
);
console.log(
  'No dependency changes were required.'
);
