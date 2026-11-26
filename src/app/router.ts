/**
 * Where an address leads. Pure: the browser's part is in navigation.ts.
 *
 * The wall and the phone are one app. `/wall` is the picture-led house for the screen on the wall (and for a
 * child's tablet); `/parent` is the grown-ups' side for a phone. `/` decides between them.
 */
export type Route =
  | { name: 'landing' }
  | { name: 'wall' }
  | { name: 'parent'; section: string; rest: string[] }
  | { name: 'join'; code: string | null }
  | { name: 'reset'; code: string | null }
  | { name: 'pair'; code: string | null }
  | { name: 'studio'; view: string }
  | { name: 'not-found'; path: string };

const CODE = /^[A-Za-z0-9-]{4,24}$/;

function codeOf(search: string): string | null {
  const code = new URLSearchParams(search).get('code');
  return code && CODE.test(code) ? code : null;
}

export function parseLocation(pathname: string, search = ''): Route {
  const parts = pathname.split('/').filter((part) => part !== '');
  const [first, second, ...rest] = parts;
  if (first === undefined) return { name: 'landing' };
  if (first === 'wall' && second === undefined) return { name: 'wall' };
  if (first === 'parent') return { name: 'parent', section: second ?? 'today', rest };
  if (first === 'join' && second === undefined) return { name: 'join', code: codeOf(search) };
  if (first === 'reset' && second === undefined) return { name: 'reset', code: codeOf(search) };
  if (first === 'pair' && second === undefined) return { name: 'pair', code: codeOf(search) };
  if (first === 'studio') return { name: 'studio', view: second ?? 'all' };
  return { name: 'not-found', path: pathname };
}

export function pathOf(route: Route): string {
  switch (route.name) {
    case 'landing':
      return '/';
    case 'wall':
      return '/wall';
    case 'parent':
      return ['/parent', route.section, ...route.rest].join('/').replace(/\/today$/, '');
    case 'join':
      return route.code ? `/join?code=${encodeURIComponent(route.code)}` : '/join';
    case 'reset':
      return route.code ? `/reset?code=${encodeURIComponent(route.code)}` : '/reset';
    case 'pair':
      return route.code ? `/pair?code=${encodeURIComponent(route.code)}` : '/pair';
    case 'studio':
      return route.view === 'all' ? '/studio' : `/studio/${route.view}`;
    case 'not-found':
      return route.path;
  }
}
