import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cacheControlFor, PAGE_HEADERS, TRANSPORT_HEADER } from '../../server/http/security';

/**
 * The deployment's settings are plain files that nothing type-checks. These tests read them as the host would
 * and hold them to what the code says they should be, so that a header cannot quietly go missing from one of
 * the two ways HOMEBASE is served.
 */

interface VercelConfig {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
  functions: Record<string, { maxDuration?: number; includeFiles?: string }>;
  crons: { path: string; schedule: string }[];
  outputDirectory: string;
}

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig;

describe('vercel.json', () => {
  it('sends every page with the same security headers the standalone server sends', () => {
    const everywhere = vercel.headers.find((rule) => rule.source === '/(.*)');
    const sent = Object.fromEntries((everywhere?.headers ?? []).map((header) => [header.key, header.value]));
    for (const [key, value] of Object.entries(PAGE_HEADERS)) expect(sent[key], key).toBe(value);
    expect(sent[TRANSPORT_HEADER[0]]).toBe(TRANSPORT_HEADER[1]);
  });

  it('lets nothing but the app itself be loaded, framed or posted to', () => {
    const policy = PAGE_HEADERS['Content-Security-Policy'] ?? '';
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("form-action 'self'");
    // No script from anywhere else, and none written into a page.
    expect(policy).not.toMatch(/script-src[^;]*(unsafe-inline|unsafe-eval|https?:|\*)/);
    expect(policy).not.toMatch(/connect-src[^;]*(https?:|\*)/);
  });

  it('sends the whole API to the one function and every other address to the app', () => {
    const [api, app] = vercel.rewrites;
    expect(api).toEqual({ source: '/api/(.*)', destination: '/api' });
    expect(app?.destination).toBe('/index.html');
    const pattern = new RegExp(`^${app?.source ?? ''}$`);
    for (const page of ['/wall', '/parent', '/parent/more/screens/ABCD-EFGH', '/join', '/studio/actions']) {
      expect(pattern.test(page), page).toBe(true);
    }
    for (const file of [
      '/api/sync',
      '/api',
      '/assets/index-abc.js',
      '/sw.js',
      '/icons/icon-192.png',
      '/data/zcta.bin',
    ]) {
      expect(pattern.test(file), file).toBe(false);
    }
  });

  it('keeps built files for good and never keeps the page or the service worker', () => {
    const cacheOf = (source: string) =>
      vercel.headers
        .find((rule) => rule.source === source)
        ?.headers.find((header) => header.key === 'Cache-Control')?.value;
    expect(cacheOf('/assets/(.*)')).toBe(cacheControlFor('/assets/index-abc.js'));
    expect(cacheOf('/sw.js')).toBe(cacheControlFor('/sw.js'));
    expect(cacheOf('/index.html')).toBe(cacheControlFor('/index.html'));
    expect(cacheOf('/data/(.*)')).toBe(cacheControlFor('/data/zcta.bin'));
    expect(cacheControlFor('/wall')).toBe('no-cache');
    expect(cacheControlFor('/assets/x.js')).toContain('immutable');
  });

  it('asks for the daily nudge once a day, which is all the free plan allows', () => {
    expect(vercel.crons).toHaveLength(1);
    expect(vercel.crons[0]?.path).toBe('/api/cron/daily');
    const [minute, hour, dayOfMonth, month, weekday] = (vercel.crons[0]?.schedule ?? '').split(' ');
    expect(Number(minute)).toBeGreaterThanOrEqual(0);
    expect(Number(hour)).toBeGreaterThanOrEqual(0);
    expect([dayOfMonth, month, weekday]).toEqual(['*', '*', '*']);
  });

  it('ships the local database engine with the function, for the demo that has no database', () => {
    expect(vercel.functions['api/index.ts']?.includeFiles).toContain('@electric-sql/pglite');
    expect(vercel.outputDirectory).toBe('dist');
  });
});

describe('the web app manifest', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };

  it('can be installed: a start address, a standalone window, and icons that exist', () => {
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons)
      expect(readFileSync(`public${icon.src}`).byteLength).toBeGreaterThan(500);
  });
});
