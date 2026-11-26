import * as v from 'valibot';

/**
 * What a household can set. Everything has a default, so a setting added later simply appears with its default
 * in a household saved before it existed. Nothing here names a real person or place: a family's own values live
 * in its database row, never in this file.
 */

const time = v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm'));
const date = v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'));
const int = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const withDefault = <T extends v.GenericSchema>(schema: T, fallback: v.InferOutput<T>) =>
  v.optional(schema, fallback as never);

export const AI_DATA_CATEGORIES = [
  'tasks',
  'routines',
  'rewards',
  'shopping',
  'calendar',
  'academy',
] as const;
export type AiDataCategory = (typeof AI_DATA_CATEGORIES)[number];

const VoiceSchema = v.object({
  enabled: withDefault(v.boolean(), true),
  /** The browser's own name for a voice on the wall display; null takes the display's default. */
  voiceName: withDefault(v.nullable(v.pipe(v.string(), v.maxLength(120))), null),
  rate: withDefault(v.pipe(v.number(), v.minValue(0.6), v.maxValue(1.3)), 0.92),
  pitch: withDefault(v.pipe(v.number(), v.minValue(0.6), v.maxValue(1.6)), 1.05),
});

const QuietHoursSchema = v.object({
  enabled: withDefault(v.boolean(), true),
  start: withDefault(time, '19:30'),
  end: withDefault(time, '06:30'),
  /** During quiet hours the wall is dimmed, silent, and stops asking the server for news. */
  dim: withDefault(v.boolean(), true),
});

const WallSchema = v.object({
  /** With nobody touching it, the wall goes home and forgets who was playing. */
  idleHomeSeconds: withDefault(int(20, 900), 90),
  /** Photos begin after this long at home with nobody touching it. 0 switches the slideshow off. */
  slideshowAfterMinutes: withDefault(int(0, 120), 10),
  /** The grown-ups' area on the wall locks itself after this long without a touch. */
  relockSeconds: withDefault(int(30, 900), 120),
  /**
   * Everyday household things — ticking the shopping list, "we did that together" — behind a two-second press
   * on the wall instead of a PIN. A press is not a lock; nothing that moves stars or changes settings is in it.
   */
  holdGate: withDefault(v.boolean(), true),
});

const QuestSchema = v.object({
  /** Stars a child can be given in one day without a grown-up looking. Beyond it, missions wait for approval. */
  dailyAutoCreditCap: withDefault(v.nullable(int(1, 500)), null),
  /** How long "oops, not yet" is offered after "I did it". */
  undoSeconds: withDefault(int(0, 900), 120),
  /** A handful at a time, never a wall of chores. */
  showAtOnce: withDefault(int(1, 8), 5),
});

const BankSchema = v.object({
  /** Stars to spend for each star earned, in percent. 100 is one for one. Lifetime stars are never scaled. */
  spendRatePercent: withDefault(int(0, 300), 100),
  /** A weekly gift of stars that is not tied to any task, like pocket money but not money. */
  allowance: withDefault(
    v.object({
      enabled: withDefault(v.boolean(), false),
      stars: withDefault(int(0, 200), 0),
      /** 0 = Sunday … 6 = Saturday. */
      weekday: withDefault(int(0, 6), 6),
    }),
    { enabled: false, stars: 0, weekday: 6 },
  ),
});

const RoutinesSchema = v.object({
  /** Getting dressed and brushing teeth earn nothing unless a family decides otherwise. */
  awardStars: withDefault(v.boolean(), false),
  /** Stars for finishing a routine, where a family has switched that on. */
  stars: withDefault(int(0, 10), 1),
});

const AcademySchema = v.object({
  enabled: withDefault(v.boolean(), false),
  /** The Academy's own address. Only an https address on the allow-list below is ever opened. */
  url: withDefault(v.nullable(v.pipe(v.string(), v.maxLength(300))), null),
  /** Stars for taking part — never for speed or for being right. Off unless a grown-up says so. */
  participation: withDefault(
    v.object({
      enabled: withDefault(v.boolean(), false),
      starsPerSession: withDefault(int(0, 20), 1),
      dailyCap: withDefault(int(0, 50), 2),
    }),
    { enabled: false, starsPerSession: 1, dailyCap: 2 },
  ),
});

const MemoriesSchema = v.object({
  secondsPerPhoto: withDefault(int(8, 600), 25),
  fit: withDefault(v.picklist(['cover', 'contain']), 'cover'),
  clock: withDefault(v.boolean(), true),
  /** For when there are visitors: no family photos on the wall. */
  hidden: withDefault(v.boolean(), false),
});

const LocationSchema = v.object({
  /** Rounded to two places — the middle of a postcode area, never a street address. */
  lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
  lon: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  /** What the grown-up typed to find it (a postcode or a town), shown back to them only. */
  label: v.pipe(v.string(), v.maxLength(60)),
});

const SkySchema = v.object({
  /** The sky follows the real sun and moon where the family lives. Needs a location. */
  daylight: withDefault(v.boolean(), true),
  /** The sky shows the real weather. Needs a location and reaches a weather service from the server. */
  weather: withDefault(v.boolean(), false),
  units: withDefault(v.picklist(['us', 'metric']), 'us'),
});

const HistorySchema = v.object({
  paused: withDefault(v.boolean(), false),
  /** Day-by-day records (who did what, when) are kept this long. */
  detailDays: withDefault(int(14, 730), 90),
  /** Weekly totals are kept this long. */
  trendMonths: withDefault(int(1, 60), 12),
});

const AiSchema = v.object({
  enabled: withDefault(v.boolean(), false),
  provider: withDefault(v.nullable(v.picklist(['anthropic', 'openai'])), null),
  /** Which kinds of household data may be sent to the provider. All off until a grown-up ticks them. */
  share: withDefault(v.array(v.picklist(AI_DATA_CATEGORIES)), []),
  dailyCapCents: withDefault(int(0, 10_000), 50),
  monthlyCapCents: withDefault(int(0, 100_000), 500),
  keepTranscripts: withDefault(v.boolean(), false),
});

export const HouseholdSettingsSchema = v.object({
  /** 0 = weeks begin on Sunday, 1 = on Monday. */
  weekStart: withDefault(v.picklist([0, 1]), 0),
  guideName: withDefault(text(20), 'Tock'),
  /** One-word labels under the pictures, for children beginning to read. */
  labels: withDefault(v.boolean(), true),
  voice: withDefault(VoiceSchema, v.getDefaults(VoiceSchema) as v.InferOutput<typeof VoiceSchema>),
  sounds: withDefault(v.boolean(), true),
  /** Less movement, softer sound, no celebrations that move. */
  calm: withDefault(v.boolean(), false),
  contrast: withDefault(v.picklist(['normal', 'high']), 'normal'),
  decor: withDefault(v.picklist(['auto', 'none', 'spring', 'summer', 'autumn', 'winter']), 'auto'),
  quietHours: withDefault(
    QuietHoursSchema,
    v.getDefaults(QuietHoursSchema) as v.InferOutput<typeof QuietHoursSchema>,
  ),
  wall: withDefault(WallSchema, v.getDefaults(WallSchema) as v.InferOutput<typeof WallSchema>),
  quest: withDefault(QuestSchema, v.getDefaults(QuestSchema) as v.InferOutput<typeof QuestSchema>),
  bank: withDefault(BankSchema, v.getDefaults(BankSchema) as v.InferOutput<typeof BankSchema>),
  routines: withDefault(
    RoutinesSchema,
    v.getDefaults(RoutinesSchema) as v.InferOutput<typeof RoutinesSchema>,
  ),
  academy: withDefault(AcademySchema, v.getDefaults(AcademySchema) as v.InferOutput<typeof AcademySchema>),
  memories: withDefault(
    MemoriesSchema,
    v.getDefaults(MemoriesSchema) as v.InferOutput<typeof MemoriesSchema>,
  ),
  location: withDefault(v.nullable(LocationSchema), null),
  sky: withDefault(SkySchema, v.getDefaults(SkySchema) as v.InferOutput<typeof SkySchema>),
  /** While set, missions and routines are not handed out. Nothing is counted as missed. */
  vacation: withDefault(v.nullable(v.object({ from: date, to: date })), null),
  history: withDefault(HistorySchema, v.getDefaults(HistorySchema) as v.InferOutput<typeof HistorySchema>),
  ai: withDefault(AiSchema, v.getDefaults(AiSchema) as v.InferOutput<typeof AiSchema>),
});

export type HouseholdSettings = v.InferOutput<typeof HouseholdSettingsSchema>;

/** Read stored settings, whatever version wrote them: unknown keys are dropped, missing ones take their default. */
export function readSettings(stored: unknown): HouseholdSettings {
  const parsed = v.safeParse(HouseholdSettingsSchema, stored ?? {});
  if (parsed.success) return parsed.output;
  // A damaged value must never lock a family out of its own household: fall back to the defaults.
  return v.parse(HouseholdSettingsSchema, {});
}

export const DEFAULT_SETTINGS: HouseholdSettings = v.parse(HouseholdSettingsSchema, {});

/**
 * Checking an Academy address before the wall is ever sent to it.
 *
 * A parent can only choose an https address whose host is on the deployment's allow-list (the Academy's own
 * public address by default; more with the HOMEBASE_ACADEMY_HOSTS setting). Anything else is refused on the
 * server, so a mistyped or malicious address can never become the place a child's tap leads.
 */
export const DEFAULT_ACADEMY_HOSTS: readonly string[] = ['training-academy-dun.vercel.app'];

export type AcademyUrlProblem = 'not-a-url' | 'not-https' | 'not-allowed' | 'has-credentials' | 'has-query';

export function checkAcademyUrl(
  input: string,
  allowedHosts: readonly string[] = DEFAULT_ACADEMY_HOSTS,
): { ok: true; url: string } | { ok: false; problem: AcademyUrlProblem } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, problem: 'not-a-url' };
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    return { ok: false, problem: 'not-https' };
  if (url.username || url.password) return { ok: false, problem: 'has-credentials' };
  // Nothing rides along in the address: no token, no profile, no tracking.
  if (url.search || url.hash) return { ok: false, problem: 'has-query' };
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.some((allowed) => allowed.toLowerCase() === host))
    return { ok: false, problem: 'not-allowed' };
  return { ok: true, url: `${url.origin}${url.pathname}` };
}
