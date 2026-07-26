#!/usr/bin/env node
/**
 * Shared pre-server boot steps, used by BOTH entrypoints:
 *   • app.cjs  — the cPanel / Phusion Passenger entrypoint (runs the
 *                server in-process via the tsx ESM API)
 *   • boot.mjs — the Railway entrypoint (spawns `npx tsx`)
 *
 * The two entrypoints differ only in HOW they start the server; the
 * setup work (apply migrations, ensure the admin user) is identical, so
 * it lives here and can't drift between the two.
 *
 * Every step is best-effort: a non-zero exit is logged but never
 * throws, because the server must always come up so the platform
 * healthcheck on `/` passes. Per-route data errors surface inside the
 * app rather than taking the whole process down at boot.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STEPS = [
  { label: 'Applying migrations', script: 'scripts/apply-all-migrations.mjs' },
  { label: 'Ensuring admin user', script: 'scripts/reset-admin-password.mjs' },
];

/** Run each setup step in a child `node` process, best-effort. */
export function runSetupSteps() {
  for (const { label, script } of STEPS) {
    console.log(`\n[boot] ${label}`);
    const full = path.join(ROOT, script);
    if (!fs.existsSync(full)) {
      console.warn(`[boot] skip "${label}" — ${script} missing.`);
      continue;
    }
    const r = spawnSync('node', [script], { stdio: 'inherit', env: process.env, cwd: ROOT });
    if (r.status !== 0) {
      console.error(`[boot] step "${label}" exited ${r.status} — continuing anyway.`);
    }
  }
}
