/**
 * Badges: small keepsakes for things done over time. They are not stars and buy nothing.
 *
 * Every badge is for something that adds up — never for a streak, a speed or beating anybody. A badge once
 * earned is kept for good: nothing a child does or does not do tomorrow can take it away. The rules are plain
 * sums of what the household already records, so they can be worked out again at any time.
 */

export interface BadgeInfo {
  /** A grown-up's name for it. */
  label: string;
  /** What the guide says when it is earned. */
  say: string;
}

export const BADGES = {
  'first-star': { label: 'First star', say: 'Your very first star!' },
  'stars-10': { label: 'Ten stars', say: 'Ten stars, all yours.' },
  'stars-25': { label: 'Twenty-five stars', say: 'Twenty-five stars!' },
  'stars-50': { label: 'Fifty stars', say: 'Fifty stars. What a lot of helping.' },
  'stars-100': { label: 'A hundred stars', say: 'One hundred stars!' },
  'stars-250': { label: 'A sky of stars', say: 'A whole sky of stars.' },
  'kind-heart': { label: 'Kind heart', say: 'Five kind things. You have a kind heart.' },
  'team-mate': { label: 'Team mate', say: 'Five jobs done for the whole family.' },
  sunrise: { label: 'Sunrise', say: 'Five mornings, all the way through.' },
  moonlight: { label: 'Moonlight', say: 'Five bedtimes, all the way through.' },
  'steady-steps': { label: 'Steady steps', say: 'Twenty routines finished, step by step.' },
  saver: { label: 'Saver', say: 'You saved up for something big.' },
  'brave-asker': { label: 'Brave asker', say: 'Asking for help is brave.' },
} as const satisfies Record<string, BadgeInfo>;

export type BadgeId = keyof typeof BADGES;
export const BADGE_IDS = Object.keys(BADGES) as BadgeId[];

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === 'string' && Object.hasOwn(BADGES, value);
}

/** What has added up for one child, from the household's own records. */
export interface BadgeCounts {
  /** Stars ever earned. */
  lifetime: number;
  /** "A kind thing" missions finished. */
  kind: number;
  /** Missions for the whole family that this child did. */
  shared: number;
  mornings: number;
  bedtimes: number;
  /** Routines of any kind finished. */
  routines: number;
  /** Rewards worth twenty stars or more, saved for and had. */
  bigRewards: number;
  /** Times a hand was asked for. */
  helpAsked: number;
}

const STAR_STEPS: readonly (readonly [number, BadgeId])[] = [
  [1, 'first-star'],
  [10, 'stars-10'],
  [25, 'stars-25'],
  [50, 'stars-50'],
  [100, 'stars-100'],
  [250, 'stars-250'],
];

/** The badges those sums have earned, in the order they are shown. */
export function badgesFor(counts: BadgeCounts): BadgeId[] {
  const earned: BadgeId[] = [];
  for (const [need, badge] of STAR_STEPS) if (counts.lifetime >= need) earned.push(badge);
  if (counts.kind >= 5) earned.push('kind-heart');
  if (counts.shared >= 5) earned.push('team-mate');
  if (counts.mornings >= 5) earned.push('sunrise');
  if (counts.bedtimes >= 5) earned.push('moonlight');
  if (counts.routines >= 20) earned.push('steady-steps');
  if (counts.bigRewards >= 1) earned.push('saver');
  if (counts.helpAsked >= 3) earned.push('brave-asker');
  return earned;
}
