import { defineConfig } from 'drizzle-kit';

/** Only used to write migrations (`npm run db:generate`). Nothing here connects to a database. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
});
