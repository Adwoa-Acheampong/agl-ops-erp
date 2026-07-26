#!/usr/bin/env node
/**
 * Shared MySQL connection helper for the build / boot scripts.
 *
 * The connection string comes from DATABASE_URL exclusively — there is
 * deliberately NO hardcoded fallback. A committed `mysql://root:pass@…`
 * default is a credential leak and silently masks a missing-env-var
 * misconfiguration. Both environments already define DATABASE_URL:
 *   • local dev — in `.env` (loaded by `import 'dotenv/config'`)
 *   • cPanel / Railway — in the host's environment-variable panel
 * so requiring it costs nothing and keeps secrets out of git.
 */
import mysql from 'mysql2/promise';

/** Resolve DATABASE_URL or exit(2) with an actionable message. */
export function getDbUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      'DATABASE_URL is not set. Define it in your environment (or .env) before\n' +
      'running this script, e.g.\n' +
      '  DATABASE_URL="mysql://user:password@localhost:3306/agl_ops"',
    );
    process.exit(2);
  }
  return url;
}

/**
 * Open a connection from DATABASE_URL. `extra` is merged into the
 * mysql2 config (e.g. `{ multipleStatements: false }`). Returns the
 * promise from mysql2/promise — callers `await getDbConnection()`.
 */
export function getDbConnection(extra = {}) {
  return mysql.createConnection({ uri: getDbUrl(), ...extra });
}
