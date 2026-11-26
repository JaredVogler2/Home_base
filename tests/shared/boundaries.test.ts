import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Lines that are easy to cross by accident, held by reading the source.
 *
 * `asSystem` works in the database with no household set: row-level security does not confine it. It is for the
 * little that happens before a household is known (signing in, pairing, a shortcut's key), for counting attempts,
 * and for housekeeping. Every file that uses it is named here with its reason; using it anywhere else fails this
 * test, so that doing so is a decision somebody made and wrote down, not something that slipped in.
 */

const root = join(import.meta.dirname, '..', '..');

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const SYSTEM_ACCESS: Record<string, string> = {
  'server/db/client.ts': 'where it is defined',
  'server/app.ts': 'the health check, and finding a session before any household is known',
  'server/domain/seed.ts': 'making the made-up family in an empty database',
  'server/http/routes/auth.ts': 'sign-up, sign-in, invitations, reset codes: before a household is known',
  'server/http/routes/pair.ts': 'pairing a screen: before it belongs to a household',
  'server/http/routes/shortcuts.ts':
    'finding which household a shortcut key belongs to, and counting attempts',
  'server/http/routes/demo.ts': 'entering and resetting the demo',
  'server/http/routes/cron.ts': 'the daily nudge goes through every household in turn',
  'server/http/routes/sync.ts': 'the owner-run sweep of old sessions, attempts and logs',
  'server/http/routes/history.ts': 'counting wrong passwords before a household is deleted',
  'server/http/routes/media.ts': 'counting uploads',
  'server/http/routes/ai.ts': 'counting runs of the helper',
};

describe('boundaries', () => {
  it('uses system-level database access only in the files that have a reason to', () => {
    const users = [...filesUnder(join(root, 'server')), ...filesUnder(join(root, 'api'))]
      .filter((path) => /\basSystem\s*\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path).replaceAll('\\', '/'))
      .sort();
    expect(users).toEqual(Object.keys(SYSTEM_ACCESS).sort());
  });

  it('keeps the rules of the household free of the web and of the database connection', () => {
    // server/domain is given a transaction and a household; it never opens one or reads a request.
    const offenders = filesUnder(join(root, 'server', 'domain'))
      .filter((path) => !path.endsWith('seed.ts'))
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return /from '(?:\.\.\/)+http\//.test(source) || /\b(?:asSystem|inHousehold)\s*\(/.test(source);
      })
      .map((path) => relative(root, path));
    expect(offenders).toEqual([]);
  });

  it('keeps what the browser runs free of anything from the server', () => {
    const offenders = filesUnder(join(root, 'src'))
      .filter((path) => /from '(?:\.\.\/)+server\//.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path));
    expect(offenders).toEqual([]);
  });
});
