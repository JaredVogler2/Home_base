/**
 * What every page of HOMEBASE is served with, in one place.
 *
 * The same values are in vercel.json (which is what a Vercel deployment actually reads) and are used directly
 * by the standalone server; a test fails if the two ever differ. The idea is simple: this app loads nothing
 * from anywhere but itself, cannot be put inside another site's frame, and tells the browser so.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Styles come from the app's own files; 'unsafe-inline' covers only style attributes that drawings set.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const PAGE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // The wall has no camera or microphone business at all. A parent's phone may be asked where it roughly is,
  // once, to set the sky (Family → Sky and weather).
  'Permissions-Policy':
    'accelerometer=(), browsing-topics=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  // A family's home screen has no place in a search engine.
  'X-Robots-Tag': 'noindex, nofollow',
};

/** Sent only over https: tells the browser never to come back over plain http. */
export const TRANSPORT_HEADER = ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'] as const;

/** How long a browser may keep a file. Built files carry their contents in their names and never change. */
export function cacheControlFor(pathname: string): string {
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (
    pathname === '/sw.js' ||
    pathname === '/index.html' ||
    pathname === '/' ||
    !/\.[a-z0-9]+$/i.test(pathname)
  )
    return 'no-cache';
  if (pathname.startsWith('/data/')) return 'public, max-age=604800';
  return 'public, max-age=86400';
}
