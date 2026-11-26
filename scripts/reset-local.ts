/**
 * Throw away the local development database:  npm run db:reset
 *
 * Only ever touches the folder the local server keeps its own database in (.data/ unless HOMEBASE_DATA_DIR says
 * otherwise). It refuses to run when DATABASE_URL is set, so it can never be pointed at a real family's data.
 */
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfig } from '../server/config.js';

const config = readConfig();
if (config.databaseUrl) {
  console.error('DATABASE_URL is set. This script only resets the local folder database; unset it first.');
  process.exit(1);
}
if (config.localData.startsWith('memory://')) {
  console.log('The local database is in memory: there is nothing to reset.');
  process.exit(0);
}
const folder = resolve(config.localData);
if (!folder.startsWith(resolve('.'))) {
  console.error(`Refusing to delete ${folder}: it is outside this project.`);
  process.exit(1);
}
if (existsSync(folder)) rmSync(folder, { recursive: true, force: true });
console.log(`Removed ${folder}. The next "npm run dev" starts with a fresh database.`);
