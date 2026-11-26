import { sql } from 'drizzle-orm';
import { MIGRATIONS, type EmbeddedMigration } from './migrations.generated.js';
import type { Db } from './types.js';

/**
 * Brings a database up to the schema this code expects.
 *
 * All pending migrations run inside one transaction, under a lock that ends with it, so two servers starting at
 * the same moment cannot both apply one, and a migration that fails leaves the database exactly as it was.
 */

const BREAKPOINT = '--> statement-breakpoint';
/** An arbitrary number that means "HOMEBASE is migrating" to pg_advisory_xact_lock. */
const LOCK_KEY = 4_846_251;

function checksum(text: string): string {
  // FNV-1a, 32 bits: enough to notice a migration that was edited after it was applied.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function statementsOf(migration: EmbeddedMigration): string[] {
  return migration.sql
    .split(BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) =>
      // The schema is made before the first migration, to hold the table that records them.
      statement === 'CREATE SCHEMA "homebase";' ? 'CREATE SCHEMA IF NOT EXISTS "homebase";' : statement,
    );
}

export const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1]?.tag ?? 'none';

export interface MigrationReport {
  applied: string[];
  current: string;
}

export async function migrate(
  db: Db,
  migrations: readonly EmbeddedMigration[] = MIGRATIONS,
): Promise<MigrationReport> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
    await tx.execute(sql`create schema if not exists "homebase"`);
    await tx.execute(sql`
      create table if not exists "homebase"."schema_migrations" (
        "tag" text primary key,
        "checksum" text not null,
        "applied_at" timestamptz not null default now()
      )`);
    await tx.execute(sql`alter table "homebase"."schema_migrations" enable row level security`);
    const done = await tx.execute(sql`select "tag", "checksum" from "homebase"."schema_migrations"`);
    const applied = new Map<string, string>();
    for (const row of done.rows as { tag: string; checksum: string }[]) applied.set(row.tag, row.checksum);

    const report: MigrationReport = { applied: [], current: 'none' };
    for (const migration of migrations) {
      const sum = checksum(migration.sql);
      const before = applied.get(migration.tag);
      if (before !== undefined) {
        if (before !== sum) {
          throw new Error(
            `Migration ${migration.tag} has changed since it was applied to this database. ` +
              'Migrations are never edited once applied: add a new one instead.',
          );
        }
        report.current = migration.tag;
        continue;
      }
      for (const statement of statementsOf(migration)) await tx.execute(sql.raw(statement));
      await tx.execute(
        sql`insert into "homebase"."schema_migrations" ("tag", "checksum") values (${migration.tag}, ${sum})`,
      );
      report.applied.push(migration.tag);
      report.current = migration.tag;
    }
    return report;
  });
}

/** The newest migration this database has had, or null where there is no HOMEBASE schema in it at all. */
export async function currentMigration(db: Db): Promise<string | null> {
  const exists = await db.execute(
    sql`select to_regclass('homebase.schema_migrations') is not null as present`,
  );
  if (!(exists.rows[0] as { present: boolean } | undefined)?.present) return null;
  const rows = await db.execute(
    sql`select "tag" from "homebase"."schema_migrations" order by "tag" desc limit 1`,
  );
  return (rows.rows[0] as { tag: string } | undefined)?.tag ?? null;
}
