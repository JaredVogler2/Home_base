import { useSyncExternalStore } from 'react';
import { parseLocation, pathOf, type Route } from './router';

/** The browser's address bar, as something React can follow. */

const listeners = new Set<() => void>();
let current: Route = parseLocation(window.location.pathname, window.location.search);

function refresh() {
  current = parseLocation(window.location.pathname, window.location.search);
  for (const listener of listeners) listener();
}

window.addEventListener('popstate', refresh);

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const path = pathOf(route);
  if (path === window.location.pathname + window.location.search) return;
  if (options.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  refresh();
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
