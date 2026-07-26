#!/usr/bin/env node
/**
 * Diagnostic: list tables in the configured DATABASE_URL.
 *   railway run --service mysql2 -- node scripts/list-tables.mjs
 * or (locally)
 *   DATABASE_URL=mysql://... node scripts/list-tables.mjs
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL
  || `mysql://root:${process.env.MYSQL_ROOT_PASSWORD}@${process.env.RAILWAY_PRIVATE_DOMAIN}:3306/${process.env.MYSQL_DATABASE}`;

const c = await mysql.createConnection({ uri: url });
const [tables] = await c.query('SHOW TABLES');
console.log(`Database has ${tables.length} table(s):`);
for (const row of tables) {
  const name = Object.values(row)[0];
  const [[{ n }]] = await c.query(`SELECT COUNT(*) AS n FROM \`${name}\``);
  console.log(` ${String(n).padStart(6)} · ${name}`);
}
await c.end();
