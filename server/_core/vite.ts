import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";

/**
 * setupVite runs ONLY in development. We dynamic-import `vite` and the
 * project's `vite.config` here so production deployments never have to
 * resolve those packages (they live under devDependencies and are
 * pruned by `npm install --production` on Namecheap / cPanel Stellar).
 */
export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import('vite');
  const viteConfigMod = await import('../../vite.config.js').catch(() => import('../../vite.config.ts' as any));
  const viteConfig = (viteConfigMod as any).default ?? viteConfigMod;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Express 5: bare "*" path is invalid. Pathless catch-all.
  app.use(async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "index.html"
      );

      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // `vite build` writes to <repo>/dist (per vite.config.ts → outDir: 'dist').
  // The runtime file lives at <repo>/server/_core/vite.ts, so the dist
  // folder is two levels up. The fallback paths catch alternate layouts
  // (e.g. when the file is bundled under server/dist or run from a
  // different cwd) so a misplaced upload still serves the SPA.
  const candidates = [
    path.resolve(import.meta.dirname, '..', '..', 'dist'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(import.meta.dirname, 'public'),
  ];
  const distPath = candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
  if (!fs.existsSync(distPath)) {
    console.error(`[serveStatic] No build directory at any of: ${candidates.join(', ')}`);
  } else {
    console.log(`[serveStatic] Serving from ${distPath}`);
  }

  app.use(express.static(distPath));

  // SPA fallback — every unmatched route returns index.html so the React
  // router can take over client-side.
  app.use((_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}
