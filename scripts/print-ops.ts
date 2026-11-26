/**
 * Prints the operations catalogue (shared/ops.ts) as a Markdown table: each op's name and the least access it
 * needs. docs/API.md carries the same table with a one-line description of each op.
 *
 *   npx tsx scripts/print-ops.ts                 print the table
 *   npx tsx scripts/print-ops.ts --check FILE    check that FILE lists every op with the same access level, and
 *                                                no op that no longer exists (exit code 1 if not)
 *
 * Only reads shared/ops.ts and the file named; writes nothing.
 */
import { readFileSync } from 'node:fs';
import { OPS, OP_TYPES } from '../shared/ops.js';

const args = process.argv.slice(2);
const checkIndex = args.indexOf('--check');

if (checkIndex === -1) {
  console.log('| Op | Least access |');
  console.log('| --- | --- |');
  for (const type of OP_TYPES) console.log(`| \`${type}\` | ${OPS[type].level} |`);
  console.log(`\n${OP_TYPES.length} ops.`);
} else {
  const file = args[checkIndex + 1];
  if (!file) {
    console.error('Usage: npx tsx scripts/print-ops.ts --check docs/API.md');
    process.exit(2);
  }
  const text = readFileSync(file, 'utf8');
  // A table row that starts with an op name in backticks, then its access level.
  const rows = new Map<string, string>();
  for (const match of text.matchAll(/^\|\s*`([a-z]+(?:\.[A-Za-z]+)+)`\s*\|\s*([a-z]+)\s*\|/gm)) {
    rows.set(match[1] as string, match[2] as string);
  }
  const problems: string[] = [];
  for (const type of OP_TYPES) {
    const listed = rows.get(type);
    if (listed === undefined) problems.push(`missing: ${type} (${OPS[type].level})`);
    else if (listed !== OPS[type].level)
      problems.push(`wrong level: ${type} is ${OPS[type].level}, doc says ${listed}`);
  }
  for (const name of rows.keys()) {
    if (!(OP_TYPES as string[]).includes(name)) problems.push(`no longer exists: ${name}`);
  }
  if (problems.length > 0) {
    console.error(`${file} does not match shared/ops.ts:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`${file} lists all ${OP_TYPES.length} ops with the right access levels.`);
}
