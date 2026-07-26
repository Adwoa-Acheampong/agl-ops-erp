#!/usr/bin/env node
/**
 * Apply every SQL migration in /drizzle in order. Reuses the idempotent
 * runner so already-applied DDL is treated as a no-op (skipped with a
 * "⤳ already applied" line). Safe to invoke as a Railway pre-deploy
 * hook — on every deploy it brings the target DB up to the codebase
 * schema, even if a brand-new MySQL has just been provisioned.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const drizzleDir = path.resolve(process.cwd(), 'drizzle');
const allFiles = fs.readdirSync(drizzleDir).filter((f) => f.endsWith('.sql'));
// Always apply the full-schema bootstrap FIRST. It uses
// CREATE TABLE IF NOT EXISTS so it's safe on hot DBs and creates any
// missing tables on cold ones — closes the gap the incremental
// drizzle migrations leave open when a fresh Railway MySQL is wired
// in mid-project.
const bootstrap = 'bootstrap-schema.sql';
// Sort numbered migrations by their parsed numeric prefix, not lexically
// — otherwise 0009 would sort after 0010 once the project crosses the
// 4-digit boundary (…9999 → 10000). `/^\d+_/` also lets 5+-digit
// prefixes through, which the old `/^\d{4}_/` would have silently
// excluded from the run.
const numbered = allFiles
  .filter((f) => f !== bootstrap && /^\d+_/.test(f))
  .sort((a, b) => (parseInt(a, 10) - parseInt(b, 10)) || a.localeCompare(b));
const sqlFiles = [
  ...(allFiles.includes(bootstrap) ? [bootstrap] : []),
  ...numbered,
];

if (sqlFiles.length === 0) {
  console.log('No migrations to apply.');
  process.exit(0);
}

console.log(`Applying ${sqlFiles.length} migration(s) from ${drizzleDir}:`);
for (const f of sqlFiles) console.log('  ·', f);

// On Railway / any new DB the migration set is applied end-to-end on
// every boot. Individual files may fail (e.g. a stale enum literal,
// or an incompatibility with rows already in the table) but we keep
// going so later migrations still get a chance — boot.mjs treats the
// whole step as best-effort.
const failures = [];
for (const f of sqlFiles) {
  console.log(`\n──── ${f} ────`);
  const r = spawnSync('node', ['scripts/apply-migration.mjs', `drizzle/${f}`], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`[apply-all] ${f} exited ${r.status} — continuing.`);
    failures.push(f);
  }
}
if (failures.length > 0) {
  console.error(`\n[apply-all] ${failures.length} migration(s) reported failures:`);
  failures.forEach((f) => console.error('  ·', f));
  // Exit non-zero so a direct / CI invocation surfaces the failure. The
  // boot wrappers (app.cjs, boot.mjs) intentionally log-and-continue on a
  // non-zero setup step, so this stays best-effort at boot while no
  // longer hiding the truth from anyone who runs it by hand.
  process.exit(1);
}
console.log('\n[apply-all] All migrations applied.');
process.exit(0);
