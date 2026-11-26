/**
 * Put the made-up Maple Street family into the local database:  npm run db:seed
 *
 * For development only. It refuses to run against a hosted database (DATABASE_URL set) unless HOMEBASE_DEMO=1
 * says that deployment is meant to be a demo, so a real family's database can never be given a pretend one.
 */
import { STRONG_COST } from '../server/auth/crypto.js';
import { readConfig } from '../server/config.js';
import { openDatabase } from '../server/db/client.js';
import { DEMO, seedDemo } from '../server/domain/seed.js';

const config = readConfig();
if (config.databaseUrl && !config.demo) {
  console.error(
    'DATABASE_URL is set and HOMEBASE_DEMO is not: refusing to add a made-up family to a real database.',
  );
  process.exit(1);
}
const database = await openDatabase(config);
try {
  const made = await seedDemo(database, {
    now: new Date(),
    hashCost: STRONG_COST,
    secretKey: config.secretKey,
    academyUrl: null,
  });
  console.log(
    made
      ? `The Maple Street family is in. Sign in as ${DEMO.samEmail} with the demo password in server/domain/seed.ts.`
      : 'The Maple Street family was already there.',
  );
} finally {
  await database.close();
}
