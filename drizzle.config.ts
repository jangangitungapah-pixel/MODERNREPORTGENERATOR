import {
  defineConfig,
} from 'drizzle-kit';

export default defineConfig({
  schema:
    './lib/server/db/schema.ts',
  out:
    './drizzle',
  dialect:
    'sqlite',
});
