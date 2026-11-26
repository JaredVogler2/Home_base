import { eq } from 'drizzle-orm';
import { hasAccess, type Snapshot, type Viewer, type Wallet } from '../../shared/model.js';
import { wallets } from '../db/schema.js';
import { listBadges } from './badges.js';
import { listGoals, listRedemptions, listRewards } from './bank.js';
import type { Ctx } from './context.js';
import {
  listAcademyLinks,
  listCalendar,
  listDevices,
  listMedia,
  listMembers,
  listMilestones,
  listProfiles,
} from './family.js';
import { listOccurrences, listTemplates } from './quest.js';
import { listRoutines, listRuns } from './routines.js';
import { listItems, listLists } from './shopping.js';
import { readWeather } from '../weather/service.js';

/**
 * Everything a screen needs, in one piece, as of one revision of the household.
 *
 * A household's working data is small — a few children, a day's missions, a shopping list — so a screen that is
 * behind is simply sent all of it again. There is nothing to merge on the screen and so nothing to merge wrongly.
 * What is in it depends on who is looking: a wall in child mode is never sent the parts only a grown-up may see.
 */
export async function buildSnapshot(ctx: Ctx, viewer: Viewer): Promise<Snapshot> {
  const grownUp = hasAccess(viewer.access, 'caregiver');
  const parent = hasAccess(viewer.access, 'guardian');

  const walletRows = await ctx.tx.select().from(wallets).where(eq(wallets.householdId, ctx.household.id));
  const walletList: Wallet[] = walletRows.map((row) => ({
    profileId: row.profileId,
    available: row.available,
    reserved: row.reserved,
    lifetime: row.lifetime,
  }));

  const snapshot: Snapshot = {
    rev: ctx.household.revision,
    serverTime: ctx.now.toISOString(),
    today: ctx.today,
    viewer,
    household: {
      id: ctx.household.id,
      name: ctx.household.name,
      timeZone: ctx.household.timeZone,
      settings: grownUp ? ctx.household.settings : forChildren(ctx.household.settings),
      demo: ctx.household.demo,
    },
    profiles: await listProfiles(ctx, grownUp),
    wallets: walletList,
    occurrences: await listOccurrences(ctx),
    routines: await listRoutines(ctx, grownUp),
    runs: await listRuns(ctx),
    rewards: await listRewards(ctx, grownUp),
    redemptions: await listRedemptions(ctx),
    goals: await listGoals(ctx),
    lists: await listLists(ctx),
    items: await listItems(ctx),
    calendar: await listCalendar(ctx),
    media: ctx.household.settings.memories.hidden && !grownUp ? [] : await listMedia(ctx, !grownUp),
    members: await listMembers(ctx),
    badges: await listBadges(ctx),
    weather: await readWeather(ctx),
  };
  if (grownUp) {
    snapshot.templates = await listTemplates(ctx);
    snapshot.milestones = await listMilestones(ctx);
    snapshot.academyLinks = await listAcademyLinks(ctx);
  }
  if (parent) snapshot.devices = await listDevices(ctx);
  return snapshot;
}

/** The settings a wall in child mode needs to draw itself — and none of the rest. */
function forChildren(settings: Ctx['household']['settings']): Ctx['household']['settings'] {
  return {
    ...settings,
    // The wall works out sunrise and sunset itself, so that the sky is right with no signal: it is sent the
    // rounded position it stands at, and not what a grown-up typed to find it.
    location: settings.location
      ? { lat: settings.location.lat, lon: settings.location.lon, label: '' }
      : null,
    ai: { ...settings.ai, share: [], provider: null },
    // The favourites shelf is a grown-up's, on a phone. A child's screen has no use for it and is not sent it.
    shopping: { ...settings.shopping, favourites: [] },
  };
}
