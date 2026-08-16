const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const eslintPath = path.join(root, 'eslint.config.mjs');
const nextEnvPath = path.join(root, 'next-env.d.ts');

if (!fs.existsSync(eslintPath)) {
  throw new Error('eslint.config.mjs tidak ditemukan.');
}

if (!fs.existsSync(nextEnvPath)) {
  throw new Error('next-env.d.ts tidak ditemukan.');
}

let eslint = fs.readFileSync(eslintPath, 'utf8');

const generatedIgnores = [
  "    '.open-next/**',",
  "    '.wrangler/**',",
];

for (const ignoreLine of generatedIgnores) {
  if (!eslint.includes(ignoreLine)) {
    const anchor = "    '.next/**',";

    if (!eslint.includes(anchor)) {
      throw new Error(
        'Anchor .next/** tidak ditemukan di eslint.config.mjs.'
      );
    }

    eslint = eslint.replace(
      anchor,
      `${anchor}\n${ignoreLine}`
    );
  }
}

fs.writeFileSync(
  eslintPath,
  eslint,
  'utf8'
);

let nextEnv = fs.readFileSync(
  nextEnvPath,
  'utf8'
);

nextEnv = nextEnv.replace(
  'import "./.next/dev/types/routes.d.ts";',
  'import "./.next/types/routes.d.ts";'
);

fs.writeFileSync(
  nextEnvPath,
  nextEnv,
  'utf8'
);

console.log('');
console.log('ReportOS tooling repair applied.');
console.log('');
console.log('- .open-next/** ignored by ESLint');
console.log('- .wrangler/** ignored by ESLint');
console.log('- next-env.d.ts normalized to production route types');
console.log('');
