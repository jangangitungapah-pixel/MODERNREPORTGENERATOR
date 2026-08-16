import {
  defineConfig,
} from 'drizzle-kit';

export default defineConfig({
  schema: [
    './lib/server/db/schema.ts',
    './lib/server/db/state-schema.ts',
  ],
  out:
    './drizzle',
  dialect:
    'sqlite',
});
