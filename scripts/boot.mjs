#!/usr/bin/env node
/**
 * Railway production boot wrapper. Runs the shared setup steps
 * (migrations + admin upsert), then starts the server as a child
 * `npx tsx` process.
 *
 * NOTE: cPanel uses app.cjs instead of this file — it runs the server
 * IN-PROCESS via the tsx ESM API so Phusion Passenger sees app.listen()
 * on the process it spawned. The setup steps are identical and shared
 * via scripts/boot-steps.mjs; only the server-start strategy differs.
 */
import { spawn } from 'node:child_process';
import { runSetupSteps } from './boot-steps.mjs';

runSetupSteps();

console.log('\n[boot] Starting server…');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const child = spawn('npx', ['tsx', 'server/_core/index.ts'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
child.on('exit', (code, signal) => {
  console.log(`[boot] server exited code=${code} signal=${signal}`);
  process.exit(code ?? 1);
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT',  () => child.kill('SIGINT'));
