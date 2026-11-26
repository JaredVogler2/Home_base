/**
 * Everything the server reads from its environment, in one place. Names only appear here and in .env.example;
 * values never appear anywhere in the repository.
 */

export interface Config {
  /** Hosted Postgres. Absent, the server keeps a database of its own in a folder (or in memory). */
  databaseUrl: string | null;
  databaseSsl: boolean;
  /** Where the local database lives; `memory://` keeps nothing. */
  localData: string;
  /** Fill an empty database with the made-up family and offer one-tap sign-in to it. */
  demo: boolean;
  openSignup: boolean;
  /** 32 random bytes, base64url. Encrypts stored connection secrets and peppers PINs. */
  secretKey: string | null;
  cronSecret: string | null;
  autoMigrate: boolean;
  /** True when running as a Vercel function. */
  onVercel: boolean;
  /** `production`, `preview` or `development`. */
  environment: string;
  /** The commit this build was made from, where the host says. */
  commit: string | null;
  anthropicKey: string | null;
  openaiKey: string | null;
  anthropicModel: string | null;
  openaiModel: string | null;
  /** "input,output" in US dollars per million tokens, for whichever model each provider uses. See server/ai/pricing.ts. */
  aiPriceAnthropic: string | null;
  aiPriceOpenai: string | null;
  /** Never reach an outside service (weather, calendars, models): for tests and for the demo. */
  offline: boolean;
  /** Hosts the Academy may be opened at, beyond its own public address. */
  academyHosts: string[];
  /** Which weather service to ask, for households that switch the weather on. See docs/integrations/WEATHER.md. */
  weather: WeatherMode;
  /** How many bytes of photos one household may keep, all copies counted. */
  mediaLimitBytes: number;
}

/** `auto`: the US National Weather Service inside the US, Open-Meteo elsewhere. `off`: never ask anyone. */
export type WeatherMode = 'auto' | 'nws' | 'open-meteo' | 'off';

/** An unrecognised value turns the weather off: a mistyped "off" must not reach out. */
function weatherMode(value: string | undefined): WeatherMode {
  const mode = (value ?? '').trim().toLowerCase();
  if (mode === '') return 'auto';
  return mode === 'auto' || mode === 'nws' || mode === 'open-meteo' ? mode : 'off';
}

/** A whole number of megabytes, as bytes; anything else gives the default. */
function megabytes(value: string | undefined, fallback: number): number {
  const mb = Number((value ?? '').trim());
  return (Number.isInteger(mb) && mb > 0 ? mb : fallback) * 1024 * 1024;
}

const flag = (value: string | undefined): boolean => value === '1' || value === 'true';
const text = (value: string | undefined): string | null =>
  value && value.trim() !== '' ? value.trim() : null;

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const databaseUrl = text(env.DATABASE_URL);
  const onVercel = flag(env.VERCEL);
  return {
    databaseUrl,
    databaseSsl: env.HOMEBASE_DB_SSL === 'require',
    // A function's own disk is not kept between calls, so without a database the hosted demo lives in memory.
    localData: text(env.HOMEBASE_DATA_DIR) ?? (onVercel ? 'memory://' : '.data/pglite'),
    // A deployment with no database can only ever be the demo.
    demo: flag(env.HOMEBASE_DEMO) || (onVercel && !databaseUrl),
    openSignup: flag(env.HOMEBASE_OPEN_SIGNUP),
    secretKey: text(env.HOMEBASE_SECRET_KEY),
    cronSecret: text(env.CRON_SECRET),
    autoMigrate: env.HOMEBASE_AUTO_MIGRATE !== '0',
    onVercel,
    environment: text(env.VERCEL_ENV) ?? (env.NODE_ENV === 'production' ? 'production' : 'development'),
    commit: text(env.VERCEL_GIT_COMMIT_SHA)?.slice(0, 7) ?? null,
    anthropicKey: text(env.ANTHROPIC_API_KEY),
    openaiKey: text(env.OPENAI_API_KEY),
    anthropicModel: text(env.HOMEBASE_AI_ANTHROPIC_MODEL),
    openaiModel: text(env.HOMEBASE_AI_OPENAI_MODEL),
    aiPriceAnthropic: text(env.HOMEBASE_AI_PRICE_ANTHROPIC),
    aiPriceOpenai: text(env.HOMEBASE_AI_PRICE_OPENAI),
    offline: flag(env.HOMEBASE_OFFLINE),
    academyHosts: (env.HOMEBASE_ACADEMY_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter((host) => /^[a-z0-9.-]+$/.test(host)),
    weather: weatherMode(env.HOMEBASE_WEATHER),
    mediaLimitBytes: megabytes(env.HOMEBASE_MEDIA_LIMIT_MB, 200),
  };
}
