import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * One command, one port: in development the API runs inside Vite's own server. The module is loaded through Vite
 * so an edit to server code takes effect on the next request; the database handle is kept on `globalThis` (see
 * server/db/client.ts) so it survives those reloads.
 */
function homebaseApi(): Plugin {
  return {
    name: 'homebase-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/') && req.url !== '/api') return next();
        server
          .ssrLoadModule('/server/node-listener.ts')
          .then((mod) => (mod as { listener: (req: unknown, res: unknown) => unknown }).listener(req, res))
          .catch((error: unknown) => {
            if (error instanceof Error) server.ssrFixStacktrace(error);
            next(error);
          });
      });
    },
  };
}

/**
 * The service worker, written at build time with the list of the app's own files in it, so that a wall which
 * has loaded once can draw the house with no signal. Only the build knows the files' names (their contents are
 * in them); the worker's logic is in src/sw/sw.template.js.
 */
function homebaseServiceWorker(): Plugin {
  return {
    name: 'homebase-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        // Scripts and styles, and the fonts for the letters the app itself uses; other alphabets are fetched
        // (and then kept) only if a family's own words need them.
        .filter((name) => /\.(js|css)$/.test(name) || /-latin-(wght|\d+)-normal-.*\.woff2$/.test(name))
        .map((name) => `/${name}`)
        .sort();
      const shell = ['/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', ...files];
      const version = createHash('sha256').update(shell.join('\n')).digest('hex').slice(0, 12);
      const template = readFileSync(
        fileURLToPath(new URL('./src/sw/sw.template.js', import.meta.url)),
        'utf8',
      );
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__SHELL__', JSON.stringify(shell)),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), homebaseApi(), homebaseServiceWorker()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    modules: { localsConvention: 'camelCaseOnly' },
  },
  build: {
    outDir: 'dist',
    target: ['chrome109', 'safari16.4'],
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,
  },
  server: { port: 5173, strictPort: false },
});
