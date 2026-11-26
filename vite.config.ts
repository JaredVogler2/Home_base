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

export default defineConfig({
  plugins: [react(), homebaseApi()],
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
