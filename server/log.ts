/**
 * Saying what went wrong without saying anything about a family.
 *
 * An error from the database layer carries the statement that failed and the values that were bound to it — a
 * nickname, a list item, an e-mail address. The host keeps its logs for a time and shows them to whoever runs
 * the deployment, so none of that may reach them. What is logged is the kind of error, the database's own code
 * and the names of the things involved (a table, a constraint), the first line of the message with anything
 * quoted taken out, and where in the code it happened.
 */

interface DatabaseError {
  code?: unknown;
  constraint?: unknown;
  table?: unknown;
  column?: unknown;
  routine?: unknown;
}

const identifier = (value: unknown): string | null =>
  typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : null;

/** The innermost cause: the driver's error under the query builder's wrapper. */
function rootOf(error: unknown): unknown {
  let current = error;
  for (let depth = 0; depth < 5; depth++) {
    const cause = (current as { cause?: unknown } | null)?.cause;
    if (cause === undefined || cause === null) break;
    current = cause;
  }
  return current;
}

/** A message with everything that could be somebody's words taken out. */
export function scrubMessage(message: string): string {
  const firstLine = (message.split('\n')[0] ?? '').trim();
  // The query builder's wrapper puts the whole statement on the first line: none of it is kept.
  if (/^failed query\b/i.test(firstLine)) return 'Failed query';
  return firstLine
    .replace(/"[^"]*"|'[^']*'|`[^`]*`|“[^”]*”/g, '…')
    .replace(/\(([^()]*)\)=\(([^()]*)\)/g, '(…)=(…)')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '…')
    .slice(0, 200);
}

function whereOf(error: unknown): string | null {
  const stack = (error as { stack?: unknown } | null)?.stack;
  if (typeof stack !== 'string') return null;
  const frames = stack
    .split('\n')
    .filter(
      (line) =>
        /^\s+at /.test(line) &&
        !line.includes('node_modules') &&
        !line.includes('node:') &&
        !line.includes('wasm://'),
    )
    .slice(0, 3)
    .map((line) =>
      line
        .trim()
        .replace(/^at /, '')
        .replace(/\(?(?:file:\/\/)?[^\s()]*\/(server|shared|api)\//, '($1/'),
    );
  return frames.length > 0 ? frames.join(' < ') : null;
}

/** One line for a log: what kind of thing went wrong and where, and nothing a person typed. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return typeof error === 'string' ? scrubMessage(error) : 'an unknown error';
  const root = rootOf(error);
  const parts: string[] = [error.name];
  const outer = scrubMessage(error.message);
  if (outer) parts.push(outer);
  if (root !== error && root instanceof Error) {
    parts.push(`caused by ${root.name}: ${scrubMessage(root.message)}`);
  }
  const database = root as DatabaseError | null;
  const facts = [
    ['code', identifier(database?.code)],
    ['table', identifier(database?.table)],
    ['column', identifier(database?.column)],
    ['constraint', identifier(database?.constraint)],
    ['routine', identifier(database?.routine)],
  ]
    .filter((fact): fact is [string, string] => fact[1] !== null)
    .map(([name, value]) => `${name}=${value}`);
  if (facts.length > 0) parts.push(`[${facts.join(' ')}]`);
  // The wrapper's stack is the one that passes through this server's own code.
  const where = whereOf(error) ?? whereOf(root);
  if (where) parts.push(`at ${where}`);
  return parts.join(' — ');
}
