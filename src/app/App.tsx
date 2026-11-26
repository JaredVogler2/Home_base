import { lazy, Suspense, useEffect } from 'react';
import { Landing } from './Landing';
import { navigate, useRoute } from './navigation';

const Studio = lazy(() => import('./Studio').then((module) => ({ default: module.Studio })));
const Wall = lazy(() => import('../wall/Wall').then((module) => ({ default: module.Wall })));
const Parent = lazy(() => import('../parent/Parent').then((module) => ({ default: module.Parent })));
const Entry = lazy(() => import('../parent/auth/Entry').then((module) => ({ default: module.Entry })));

/**
 * One app, two sides. `/wall` is the picture-led house for the screen on the wall; `/parent` is the grown-ups'
 * side for a phone. Each is fetched only when it is asked for, so a wall never loads the settings pages and a
 * phone never loads the house's drawings unless it looks at them.
 */
export function App() {
  const route = useRoute();

  // A scanned pairing code belongs on the grown-ups' "add a screen" page, signed in.
  useEffect(() => {
    if (route.name === 'pair') {
      navigate(
        { name: 'parent', section: 'more', rest: route.code ? ['screens', route.code] : ['screens'] },
        { replace: true },
      );
    }
  }, [route]);

  return (
    <Suspense fallback={null}>
      {route.name === 'studio' ? (
        <Studio view={route.view} />
      ) : route.name === 'wall' ? (
        <Wall />
      ) : route.name === 'parent' ? (
        <Parent />
      ) : route.name === 'join' ? (
        <Entry start="join" code={route.code} />
      ) : route.name === 'reset' ? (
        <Entry start="reset" code={route.code} />
      ) : route.name === 'landing' ? (
        <Landing />
      ) : route.name === 'pair' ? null : (
        <main style={{ padding: 32, textAlign: 'center' }}>
          <h1>That page is not here</h1>
          <p style={{ marginTop: 12 }}>
            <a href="/">Back to the front door</a>
          </p>
        </main>
      )}
    </Suspense>
  );
}
