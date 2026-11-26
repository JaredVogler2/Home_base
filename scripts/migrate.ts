/**
 * Bring a database up to date:  npm run db:migrate
 *
 * Reads DATABASE_URL (and HOMEBASE_DB_SSL) like the server does. Run it once against a new hosted database,
 * and again after pulling a version of HOMEBASE that has new migrations. It is safe to run twice: each
 * migration is applied once, under a lock, and recorded. With no DATABASE_URL it migrates the local database
 * in .data/, which the development server would have done by itself anyway.
 */
import { readConfig } from '../server/config.js';
import { openDatabase } from '../server/db/client.js';
import { migrate } from '../server/db/migrate.js';

const config = readConfig();
const database = await openDatabase({ ...config, autoMigrate: false });
try {
  const result = await migrate(database.db);
  console.log(
    result.applied.length === 0
      ? `Already up to date (${result.current}).`
      : `Applied ${result.applied.join(', ')}. Now at ${result.current}.`,
  );
  console.log(
    `Engine: ${database.engine}. Row-level security: ${database.rls ? 'on' : 'off (PGlite as its owner)'}.`,
  );
} finally {
  await database.close();
}
