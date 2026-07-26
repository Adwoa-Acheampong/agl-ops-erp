import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'

const __dirname = import.meta.dirname

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    tsconfigPaths(),
    visualizer({ open: false, filename: 'dist/stats.html' }),
  ],
  resolve: {
    alias: {
      // Live aliases — the legacy `./client/src` paths were removed when
      // the old scaffold was deleted. Point at the canonical `./src` tree.
      '@':        path.resolve(__dirname, './src'),
      '@shared':  path.resolve(__dirname, './shared'),
      '@assets':  path.resolve(__dirname, './src/assets'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  // Express (server/_core/index.ts) hosts vite in middleware mode on PORT
  // (default 3000). These options only apply for standalone `npm run dev:client`.
  server: {
    port: 5173,
  },
})
