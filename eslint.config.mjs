import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      'components/reportos-canonical-sync.tsx',
    ],
    rules: {
      // `useServerVersion` is an event callback created with useCallback,
      // not a custom hook. The default naming heuristic flags its click
      // invocation even though hook ordering is unchanged.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'coverage/**',
    'next-env.d.ts',
  ]),
]);
