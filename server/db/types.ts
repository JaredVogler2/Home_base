import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type * as schema from './schema.js';

/**
 * The database as the rest of the server sees it: the same type whether it is hosted Postgres (in production) or
 * PGlite, Postgres compiled to run inside Node (on a laptop, in tests, in the demo).
 */
export type Schema = typeof schema;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the two drivers differ only in this result type
export type Db = PgDatabase<PgQueryResultHKT & { type: any }, Schema>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tx = PgTransaction<PgQueryResultHKT & { type: any }, Schema, ExtractTablesWithRelations<Schema>>;
/** Either: code that only reads or writes rows can run on the pool or inside a transaction. */
export type Executor = Db | Tx;
