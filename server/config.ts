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
  /** Never reach an outside service (weather, calendars, models): for tests and for the demo. */
  offline: boolean;
  /** Hosts the Academy may be opened at, beyond its own public address. */
  academyHosts: string[];
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
    offline: flag(env.HOMEBASE_OFFLINE),
    academyHosts: (env.HOMEBASE_ACADEMY_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter((host) => /^[a-z0-9.-]+$/.test(host)),
  };
}
