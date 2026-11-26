import { lazy, Suspense } from 'react';
import { useRoute } from './navigation';

const Studio = lazy(() => import('./Studio').then((module) => ({ default: module.Studio })));
const Wall = lazy(() => import('../wall/Wall').then((module) => ({ default: module.Wall })));

export function App() {
  const route = useRoute();
  return (
    <Suspense fallback={null}>
      {route.name === 'studio' ? (
        <Studio view={route.view} />
      ) : route.name === 'wall' ? (
        <Wall />
      ) : (
        <p style={{ padding: 24 }}>HOMEBASE is being built. See /wall and /studio.</p>
      )}
    </Suspense>
  );
}
