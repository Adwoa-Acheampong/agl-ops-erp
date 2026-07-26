#!/usr/bin/env node
/**
 * Ensure an admin user exists / reset an admin's password.
 *
 *   ADMIN_PASSWORD=secret node scripts/reset-admin-password.mjs
 *   node scripts/reset-admin-password.mjs --email=x@y --password=secret --name="Jane Doe"
 *
 * The password is read from `--password=` or the ADMIN_PASSWORD env var.
 * If neither is set the script is a NO-OP (logs and exits 0) — this
 * keeps the boot sequence stable without committing a default password
 * to source. Email and display name are likewise configurable via flag
 * or env, with sensible defaults.
 *
 * Uses scrypt (Node built-in) — matches server/_core/session.ts.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { getDbConnection } from './_db.mjs';

const args = process.argv.slice(2);
// `--key=value` reader. `.slice(1).join('=')` so values may contain `=`
// (e.g. base64 passwords or `--name="A=B"`).
const arg = (name) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
};

const email = arg('email') ?? process.env.ADMIN_EMAIL ?? 'admin@aglops.test';
const password = arg('password') ?? process.env.ADMIN_PASSWORD;
const name = arg('name') ?? process.env.ADMIN_NAME ?? 'Principal';

if (!password) {
  console.log('[reset-admin] No --password / ADMIN_PASSWORD provided — skipping admin reset.');
  process.exit(0);
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

const conn = await getDbConnection();

const [rows] = await conn.query('SELECT id, email, role FROM users WHERE email = ? LIMIT 1', [email]);
if (rows.length === 0) {
  console.log(`No user with email ${email}. Creating one as admin.`);
  await conn.query(
    `INSERT INTO users (openId, name, email, loginMethod, role, passwordHash) VALUES (?, ?, ?, ?, ?, ?)`,
    [`local-admin-${Date.now()}`, name, email, 'local', 'admin', hashPassword(password)],
  );
} else {
  await conn.query(
    'UPDATE users SET passwordHash = ?, loginMethod = ? WHERE email = ?',
    [hashPassword(password), 'local', email],
  );
  console.log(`Updated existing user id=${rows[0].id} (${rows[0].role}).`);
}

// The password is supplied by the operator (arg/env) so it's not echoed
// back to the logs.
console.log('');
console.log('  ✅ Admin credentials updated');
console.log(`     Email: ${email}`);
console.log('');

await conn.end();
