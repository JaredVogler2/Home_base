import { sql } from 'drizzle-orm';
import type { Config } from '../config.js';
import { migrate, type MigrationReport } from './migrate.js';
import * as schema from './schema.js';
import type { Db, Tx } from './types.js';

/**
 * Opening the database, and the two ways of working in it.
 *
 *   inHousehold(...)  for everything done on behalf of a family. The transaction steps down to a role that the
 *                     database confines to that household's rows.
 *   asSystem(...)     for the little that happens before a household is known — signing in, pairing a screen —
 *                     and for housekeeping. Nothing else may use it; a lint rule and a test keep it to the files
 *                     that are allowed.
 */

export interface Database {
  db: Db;
  engine: 'postgres' | 'pglite';
  /** Whether the database itself is enforcing household isolation (it always should be). */
  rls: boolean;
  migration: MigrationReport | null;
  close(): Promise<void>;
}

async function openPostgres(config: Config): Promise<{ db: Db; close: () => Promise<void> }> {
  const { default: pg } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new pg.Pool({
    connectionString: config.databaseUrl ?? undefined,
    // A function instance serves a few requests at once; a handful of connections is plenty, and a hosted
    // pooler sits in front in production.
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  });
  pool.on('error', (error) => console.error('[db] idle connection error:', error.message));
  if (config.onVercel) {
    // Lets the platform close idle connections before it freezes the function.
    const { attachDatabasePool } = await import('@vercel/functions');
    attachDatabasePool(pool);
  }
  return { db: drizzle(pool, { schema }) as unknown as Db, close: () => pool.end() };
}

async function openPglite(dataDir: string): Promise<{ db: Db; close: () => Promise<void> }> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  if (!dataDir.startsWith('memory://')) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dataDir, { recursive: true });
  }
  const client = new PGlite(dataDir);
  await client.waitReady;
  return { db: drizzle(client, { schema }) as unknown as Db, close: () => client.close() };
}

async function detectRls(db: Db): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local role homebase_app`);
    });
    return true;
  } catch {
    return false;
  }
}

export async function openDatabase(config: Config): Promise<Database> {
  const engine = config.databaseUrl ? 'postgres' : 'pglite';
  const { db, close } =
    engine === 'postgres' ? await openPostgres(config) : await openPglite(config.localData);
  // A local database is always brought up to date; a hosted one unless that has been switched off.
  const migration = engine === 'pglite' || config.autoMigrate ? await migrate(db) : null;
  const rls = await detectRls(db);
  if (!rls) {
    console.warn(
      '[db] The role "homebase_app" could not be used, so the database is NOT enforcing household isolation. ' +
        'The application still scopes every query. See docs/DEPLOYMENT.md, "Row-level security".',
    );
  }
  return { db, engine, rls, migration, close };
}

const HOLDER = Symbol.for('homebase.database');
type Holder = { [HOLDER]?: Promise<Database> };

/**
 * The one database of this process. Kept on `globalThis` so that a development server that reloads its modules
 * keeps its connection (a local database can only be opened once).
 */
export function sharedDatabase(config: Config): Promise<Database> {
  const holder = globalThis as Holder;
  if (!holder[HOLDER]) {
    holder[HOLDER] = openDatabase(config).catch((error: unknown) => {
      delete holder[HOLDER];
      throw error;
    });
  }
  return holder[HOLDER];
}

export async function closeSharedDatabase(): Promise<void> {
  const holder = globalThis as Holder;
  const pending = holder[HOLDER];
  delete holder[HOLDER];
  if (pending) await (await pending).close();
}

/** Work for one household, confined to it by the database. */
export async function inHousehold<T>(
  database: Database,
  householdId: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return database.db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.household_id', ${householdId}, true)`);
    if (database.rls) await tx.execute(sql`set local role homebase_app`);
    return work(tx as Tx);
  });
}

/** Work with no household: sign-in, sessions, pairing, housekeeping. */
export async function asSystem<T>(database: Database, work: (tx: Tx) => Promise<T>): Promise<T> {
  return database.db.transaction(async (tx) => work(tx as Tx));
}
