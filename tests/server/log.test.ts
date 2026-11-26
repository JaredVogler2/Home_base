import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { asSystem } from '../../server/db/client.js';
import { describeError, scrubMessage } from '../../server/log.js';
import { addChild, newFamily, startServer } from './harness.js';

/** What the query builder throws: the statement and its values in the message, the driver's error underneath. */
function queryError(): Error {
  const driver = Object.assign(
    new Error('duplicate key value violates unique constraint "profiles_nickname_key"'),
    {
      name: 'error',
      code: '23505',
      table: 'profiles',
      constraint: 'profiles_nickname_key',
      detail: 'Key (household_id, nickname)=(7b1f…, Juniper) already exists.',
    },
  );
  return Object.assign(
    new Error(
      'Failed query: insert into "homebase"."profiles" ("nickname", "note") values ($1, $2)\nparams: Juniper,allergic to walnuts',
      { cause: driver },
    ),
    { name: 'DrizzleQueryError' },
  );
}

describe('what the server writes to its log', () => {
  it('says what kind of database error it was, and none of the statement or its values', () => {
    const line = describeError(queryError());
    expect(line).toContain('DrizzleQueryError');
    expect(line).toContain('code=23505');
    expect(line).toContain('table=profiles');
    expect(line).toContain('constraint=profiles_nickname_key');
    expect(line).not.toContain('Juniper');
    expect(line).not.toContain('walnuts');
    expect(line).not.toContain('insert into');
    expect(line).not.toContain('params');
  });

  it('takes quoted words, key values and e-mail addresses out of a message', () => {
    expect(scrubMessage('invalid input syntax for type uuid: "Milo\'s list"')).toBe(
      'invalid input syntax for type uuid: …',
    );
    expect(scrubMessage('Key (email)=(sam@example.test) already exists.')).toBe(
      'Key (…)=(…) already exists.',
    );
    expect(scrubMessage('could not reach sam@example.test today')).toBe('could not reach … today');
    expect(scrubMessage('Unexpected token \'M\', "Milk and eggs" is not valid JSON')).toBe(
      'Unexpected token …, … is not valid JSON',
    );
    expect(scrubMessage('first line\nsecond line with "a secret"')).toBe('first line');
  });

  it('copes with things that are not errors', () => {
    expect(describeError(null)).toBe('an unknown error');
    expect(describeError('plain "words"')).toBe('plain …');
    expect(describeError(new RangeError('too far'))).toContain('RangeError — too far');
  });

  it('keeps a real failed statement’s values out of the log line', async () => {
    const server = await startServer({}, '2026-03-03T21:00:00Z');
    try {
      const family = await newFamily(server);
      await addChild(family, 'Juniper');
      let caught: unknown;
      try {
        // A statement that fails inside the database, carrying a value a person typed.
        const typed = 'Juniper is allergic to walnuts';
        await asSystem(server.database, (tx) => tx.execute(sql`select ${typed}::uuid`));
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      const line = describeError(caught);
      expect(line).not.toContain('Juniper');
      expect(line).not.toContain('walnuts');
      expect(line.length).toBeGreaterThan(5);
    } finally {
      await server.close();
    }
  });
});
