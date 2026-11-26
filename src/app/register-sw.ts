/**
 * Keeping the app's own files on the device, and taking a new version when there is one.
 *
 * A wall is never reloaded in the middle of somebody's turn: when a new version has arrived, the page waits
 * until nobody has touched it for a minute, then starts afresh. Anything queued to send is in IndexedDB and is
 * sent by the new page exactly as the old one would have.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let lastTouch = Date.now();
  const touched = () => {
    lastTouch = Date.now();
  };
  window.addEventListener('pointerdown', touched, { passive: true });
  window.addEventListener('keydown', touched);

  const hadController = Boolean(navigator.serviceWorker.controller);
  let waiting = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first install is not an update: there is nothing newer to show.
    if (!hadController || waiting) return;
    waiting = true;
    const timer = window.setInterval(() => {
      if (Date.now() - lastTouch > 60_000) {
        window.clearInterval(timer);
        window.location.reload();
      }
    }, 5_000);
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Ask now and then whether there is a new version: a wall may stay open for weeks.
        window.setInterval(() => void registration.update().catch(() => undefined), 60 * 60_000);
      })
      .catch(() => undefined);
  });
}
