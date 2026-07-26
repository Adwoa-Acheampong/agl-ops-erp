#!/usr/bin/env node
/**
 * Apply a single .sql migration file against DATABASE_URL.
 *
 *   node scripts/apply-migration.mjs drizzle/0003_staff_compliance_fields.sql
 *
 * Splitting: drizzle emits `--> statement-breakpoint` markers as the
 * canonical statement separator, so we split on those first (an embedded
 * comment then can't leak into the next statement); then we fall back to
 * `;` + newline for hand-written SQL.
 *
 * Idempotent: already-applied DDL (duplicate column / table / index / FK,
 * or an index over a column the live table doesn't have) is logged as
 * "already applied" and skipped instead of aborting the file. This makes
 * the runner safe to re-run against a hot database on every boot.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { getDbConnection } from './_db.mjs';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/apply-migration.mjs <file.sql>'); process.exit(2); }
const abs = path.resolve(process.cwd(), file);
if (!fs.existsSync(abs)) { console.error(`No such file: ${abs}`); process.exit(2); }

/**
 * Strip SQL comments from a statement chunk. Removes block `/* … *\/`
 * comments anywhere, and whole-line `--` comments. It deliberately does
 * NOT strip trailing inline `--` comments: a `--` inside a string
 * literal would be a false positive, and both drizzle output and our
 * hand-written SQL keep comments on their own lines.
 */
function stripComments(chunk) {
  return chunk
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments, anywhere
    .replace(/^\s*--.*$/gm, '');      // whole-line -- comments
}

const sql = fs.readFileSync(abs, 'utf8');
const statements = sql
  .split(/--+>\s*statement-breakpoint\s*/i)
  .flatMap(chunk => chunk.split(/;\s*(?:\r?\n|$)/))
  .map(stripComments)
  .map(s => s.trim())
  .filter(s => s.length > 0);

// Each entry pairs a predicate over the mysql2 error with the label we
// log when it matches. Treating these as success is what makes the
// runner idempotent. To tolerate a new "already applied" shape, add one
// row here rather than another `if` below.
const KNOWN_IDEMPOTENT = [
  { label: 'column exists', test: e => e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message) },
  { label: 'table exists', test: e => e.code === 'ER_TABLE_EXISTS_ERROR' || /already exists/i.test(e.message) },
  { label: 'index exists', test: e => e.code === 'ER_DUP_KEYNAME' || /Duplicate key name/i.test(e.message) },
  // errno 121 = InnoDB duplicate key on write (constraint-name collision);
  // errno 1826 = ER_FK_DUP_NAME. MariaDB sometimes surfaces 121 as
  // ER_CANT_CREATE_TABLE (1005) with the detail only in the message text,
  // so match both the code and the message shapes.
  {
    label: 'FK constraint exists',
    test: e =>
      e.errno === 121 || e.errno === 1826 ||
      /Duplicate (foreign key )?constraint/i.test(e.message) ||
      /errno:\s*121/i.test(e.message) ||
      /Duplicate key on write or update/i.test(e.message),
  },
  // Index references a column the live table doesn't have — usually
  // column-casing drift between the migration and a hand-created table.
  {
    label: "index column doesn't exist (schema drift)",
    test: e => e.code === 'ER_KEY_COLUMN_DOES_NOT_EXITS' || /Key column .* doesn't exist/i.test(e.message),
  },
];

const conn = await getDbConnection({ multipleStatements: false });
console.log(`Applying ${path.basename(abs)} — ${statements.length} statement(s)`);
let i = 0;
for (const stmt of statements) {
  i += 1;
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 100);
  try {
    await conn.query(stmt);
    console.log(`  ✓ [${i}] ${preview}${stmt.length > 100 ? '…' : ''}`);
  } catch (err) {
    const known = KNOWN_IDEMPOTENT.find(k => k.test(err));
    if (known) {
      console.log(`  ⤳ [${i}] already applied (${known.label}) — skipping`);
      continue;
    }
    // Hard failure — print the FULL statement (not just the preview) so
    // the problem is debuggable straight from the log.
    console.error(`  ✗ [${i}] FAILED: ${err.message}`);
    console.error('  ──── full statement ────');
    console.error(stmt);
    console.error('  ────────────────────────');
    await conn.end();
    process.exit(1);
  }
}
await conn.end();
console.log('\nMigration complete.');
