import { getRequestListener } from '@hono/node-server';
import { runtimeApp } from './runtime.js';

/** The API as a plain Node request listener: what Vite's development server and the standalone server mount. */
export const listener = getRequestListener(runtimeApp().fetch);
