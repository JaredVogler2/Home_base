import { runtimeApp } from '../server/runtime.js';

/**
 * The whole API as one Vercel function. vercel.json sends every /api/* request here; the app inside routes it.
 * Everything else about the server lives in /server — this file is only the door.
 */
const app = runtimeApp();

export default {
  fetch(request: Request): Response | Promise<Response> {
    return app.fetch(request);
  },
};
