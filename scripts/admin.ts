/**
 * A few things only the person who runs the server can do, from the command line:
 *
 *   npm run admin -- households                 list households (name, grown-ups, screens; nothing about children)
 *   npm run admin -- reset-code <e-mail>        make a one-use code so that grown-up can choose a new password
 *   npm run admin -- check                      is the database up to date, and is household isolation enforced?
 *
 * "reset-code" is the way back in when the owner of a household has forgotten their password and has lost
 * their recovery codes: there is nobody above an owner inside the app, so the person with the database does it.
 * The code is printed once, lasts a day, and is used at /reset on the phone. Nothing is deleted.
 *
 * It reads DATABASE_URL like the server; with none it uses the local database in .data/.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { codeFingerprint, newCode } from '../server/auth/crypto.js';
import { readConfig } from '../server/config.js';
import { asSystem, openDatabase } from '../server/db/client.js';
import { LATEST_MIGRATION } from '../server/db/migrate.js';
import { devices, households, invites, memberships, users } from '../server/db/schema.js';

const [command, argument] = process.argv.slice(2);
const database = await openDatabase({ ...readConfig(), demo: false });

try {
  if (command === 'households') {
    const rows = await asSystem(database, (tx) =>
      tx
        .select({
          id: households.id,
          name: households.name,
          demo: households.demo,
          createdAt: households.createdAt,
          grownUps: sql<number>`(select count(*)::int from "homebase"."memberships" m where m."household_id" = ${households.id})`,
          screens: sql<number>`(select count(*)::int from "homebase"."devices" d where d."household_id" = ${households.id} and d."revoked_at" is null)`,
        })
        .from(households),
    );
    if (rows.length === 0) console.log('No households yet.');
    for (const row of rows) {
      console.log(
        `${row.name}${row.demo ? ' (demo)' : ''} — ${row.grownUps} grown-up(s), ${row.screens} screen(s), since ${row.createdAt.toISOString().slice(0, 10)}`,
      );
    }
    void devices;
  } else if (command === 'reset-code') {
    const email = (argument ?? '').trim().toLowerCase();
    if (!email) throw new Error('Give the e-mail address the grown-up signs in with.');
    const made = await asSystem(database, async (tx) => {
      const found = await tx
        .select({ userId: users.id, householdId: memberships.householdId, role: memberships.role })
        .from(users)
        .innerJoin(memberships, eq(memberships.userId, users.id))
        .where(and(eq(users.email, email), isNull(users.disabledAt)))
        .limit(1);
      const person = found[0];
      if (!person) return null;
      const code = newCode(10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await tx.insert(invites).values({
        id: crypto.randomUUID(),
        householdId: person.householdId,
        kind: 'reset',
        codeHash: codeFingerprint(code),
        role: person.role === 'caregiver' ? 'caregiver' : 'guardian',
        userId: person.userId,
        createdBy: null,
        expiresAt,
      });
      await tx.execute(
        sql`insert into "homebase"."audit" ("id", "household_id", "action", "actor", "detail")
            values (${crypto.randomUUID()}::uuid, ${person.householdId}::uuid, 'guardian.reset_code_made', 'admin:command-line', '{}'::jsonb)`,
      );
      return { code, expiresAt };
    });
    if (!made) console.log('Nobody signs in with that address.');
    else {
      console.log(`Reset code: ${made.code.slice(0, 5)}-${made.code.slice(5)}`);
      console.log(
        `Good once, until ${made.expiresAt.toISOString()}. They open /reset on their phone and type it.`,
      );
    }
  } else if (command === 'check') {
    console.log(`Engine: ${database.engine}`);
    console.log(
      `Schema: ${database.migration?.current ?? '(not migrated by this run)'}; this code expects ${LATEST_MIGRATION}`,
    );
    console.log(
      database.rls
        ? 'Household isolation: enforced by the database (row-level security as the app role).'
        : 'Household isolation: NOT enforced by the database. See docs/DEPLOYMENT.md, "Row-level security".',
    );
  } else {
    console.log('Usage: npm run admin -- households | reset-code <e-mail> | check');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await database.close();
}
