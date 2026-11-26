/** Every time zone this browser knows by name, asked for once. Empty on a browser too old to say. */
let cached: string[] | null = null;

export function allTimeZones(): string[] {
  if (cached) return cached;
  try {
    cached =
      (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.(
        'timeZone',
      ) ?? [];
  } catch {
    cached = [];
  }
  return cached;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
