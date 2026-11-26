import { describe, expect, it } from 'vitest';
import { isSharedRoleRace, migrate } from '../../server/db/migrate';
import type { Db } from '../../server/db/types';

/**
 * Two databases on one fresh server, migrating at the same moment, both try to make the role they share. The
 * loser must simply try again — and any other failure must not be retried or hidden.
 */

const driverError = (fields: Record<string, string>) =>
  Object.assign(new Error(fields.message ?? ''), fields);
const wrapped = (cause: unknown) => new Error('Failed query: DO $$ … $$', { cause });

describe('migrating beside another database on the same server', () => {
  it('recognises the role having been made, or granted, by someone else at the same moment', () => {
    expect(
      isSharedRoleRace(
        wrapped(
          driverError({
            code: '23505',
            constraint: 'pg_authid_rolname_index',
            message: 'duplicate key value violates unique constraint "pg_authid_rolname_index"',
          }),
        ),
      ),
    ).toBe(true);
    expect(
      isSharedRoleRace(
        driverError({ code: '23505', message: 'duplicate key … "pg_auth_members_role_member_index"' }),
      ),
    ).toBe(true);
    expect(
      isSharedRoleRace(driverError({ code: '42710', message: 'role "homebase_app" already exists' })),
    ).toBe(true);
    expect(
      isSharedRoleRace(wrapped(driverError({ code: 'XX000', message: 'tuple concurrently updated' }))),
    ).toBe(true);
  });

  it('does not mistake anything else for it', () => {
    // A household's own duplicate, a missing permission, a broken statement: all real, none retried.
    expect(
      isSharedRoleRace(
        driverError({ code: '23505', constraint: 'profiles_nickname_key', message: 'duplicate key' }),
      ),
    ).toBe(false);
    expect(
      isSharedRoleRace(driverError({ code: '42501', message: 'permission denied to create role' })),
    ).toBe(false);
    expect(isSharedRoleRace(driverError({ code: '42601', message: 'syntax error at or near "CREAT"' }))).toBe(
      false,
    );
    expect(isSharedRoleRace(new Error('Migration 0001_security has changed since it was applied'))).toBe(
      false,
    );
    expect(isSharedRoleRace(null)).toBe(false);
  });

  it('tries again when it loses that race, and gives up at once on anything else', async () => {
    let calls = 0;
    const racing = {
      transaction: async () => {
        calls += 1;
        if (calls < 3) throw wrapped(driverError({ code: '23505', constraint: 'pg_authid_rolname_index' }));
        return { applied: ['0000_init', '0001_security'], current: '0001_security' };
      },
    } as unknown as Db;
    expect(await migrate(racing, [])).toEqual({
      applied: ['0000_init', '0001_security'],
      current: '0001_security',
    });
    expect(calls).toBe(3);

    let tries = 0;
    const broken = {
      transaction: async () => {
        tries += 1;
        throw driverError({ code: '42501', message: 'permission denied to create role' });
      },
    } as unknown as Db;
    await expect(migrate(broken, [])).rejects.toThrow('permission denied');
    expect(tries).toBe(1);
  });
});
