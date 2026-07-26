/**
 * Phusion Passenger entrypoint (cPanel "Application Startup File").
 *
 * Phusion captures the `app.listen(PORT)` call on the SAME process it
 * spawns. Earlier versions of this wrapper used spawn() to launch tsx
 * in a child — that broke Passenger because the listen() fired on a
 * grandchild PID Passenger wasn't watching, so it timed out and Apache
 * fell back to the defaultwebpage.cgi placeholder.
 *
 * The right shape is:
 *   1. Run migrations + admin reset in child processes (one-shot work
 *      that doesn't need to keep the event loop alive).
 *   2. Load the tsx loader IN-PROCESS via its ESM API.
 *   3. Dynamic-import the TypeScript server entry — Express binds
 *      PORT inside THIS process, which is exactly what Passenger
 *      expects to see.
 */
'use strict';

(async () => {
  // dotenv is optional (Passenger injects env vars from cPanel directly);
  // load it best-effort for shells / CI that don't.
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv is optional (Passenger injects env vars directly). Only a
    // missing module is acceptable here — re-throw anything else so a
    // real misconfiguration isn't silently swallowed.
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
  }

  const path = require('node:path');
  const url = require('node:url');
  const ROOT = __dirname;

  // 1–2. Shared setup steps: idempotent migrations + admin upsert.
  // Defined in scripts/boot-steps.mjs so this cPanel entrypoint and the
  // Railway boot.mjs run the exact same sequence and can't drift apart.
  const { runSetupSteps } = await import(
    url.pathToFileURL(path.join(ROOT, 'scripts', 'boot-steps.mjs')).href
  );
  runSetupSteps();

  // 3. Boot the server IN-PROCESS so Passenger sees app.listen().
  console.log('[boot] Starting Express + tRPC server (in-process via tsx)…');
  // Force production. app.cjs is the Phusion Passenger entrypoint — it
  // only runs on the cPanel deploy. If we leave this as `|| 'production'`
  // and the cPanel app env has NODE_ENV=development set, setupVite() fires
  // and dynamic-imports vite.config.ts, which pulls in @vitejs/plugin-react
  // and friends that aren't shipped to prod node_modules. Hard-pin it.
  process.env.NODE_ENV = 'production';

  // tsx ESM API: registers a loader hook, then we dynamic-import the
  // TypeScript entry. The entry's top-level await + listen() execute in
  // THIS process — exactly what Phusion Passenger expects. tsx is a hard
  // dependency here (the server entry is always TypeScript), so failing
  // to load it is fatal rather than something to fall back from.
  try {
    const { tsImport } = await import('tsx/esm/api');
    const baseUrl = url.pathToFileURL(__filename).href;
    const serverEntry = path.join(ROOT, 'server', '_core', 'index.ts');
    await tsImport(serverEntry, baseUrl);
  } catch (err) {
    console.error('[boot] FATAL — server entry failed:', err);
    process.exit(1);
  }
})();
