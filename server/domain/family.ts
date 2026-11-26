import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import * as v from 'valibot';
import type {
  AcademyLink,
  CalendarDay,
  Device,
  MediaItem,
  Member,
  Milestone,
  Profile,
} from '../../shared/model.js';
import type { OpInput } from '../../shared/ops.js';
import type { AvatarId, DayPictureId } from '../../shared/pictures.js';
import {
  checkAcademyUrl,
  DEFAULT_ACADEMY_HOSTS,
  HouseholdSettingsSchema,
  type HouseholdSettings,
} from '../../shared/settings.js';
import { addDays } from '../../shared/time.js';
import {
  academyLinks,
  calendarDays,
  calendarRules,
  devices,
  events,
  households,
  media,
  memberships,
  milestones,
  profiles,
  users,
  wallets,
} from '../db/schema.js';
import { auditLog, Reject, type Ctx } from './context.js';

/**
 * The family itself: its children, its grown-ups, its screens and its settings — and the small things that hang
 * off them (a day's picture on the calendar, a note of something worth remembering).
 */

// ---------------------------------------------------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------------------------------------------------

export async function createProfile(ctx: Ctx, input: OpInput<'profile.create'>): Promise<void> {
  const existing = await ctx.tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, input.profileId));
  if (existing[0]) return;
  const count = await ctx.tx
    .select({ count: sql<number>`count(*)::int`, sort: sql<number>`coalesce(max(${profiles.sort}), 0)::int` })
    .from(profiles)
    .where(eq(profiles.householdId, ctx.household.id));
  if (Number(count[0]?.count ?? 0) >= 12)
    throw new Reject('limit_reached', 'A household can have up to twelve children.');
  await ctx.tx.insert(profiles).values({
    id: input.profileId,
    householdId: ctx.household.id,
    nickname: input.nickname,
    avatar: input.avatar,
    ageBand: input.ageBand,
    // A baby has a picture and a place in the family, and nothing to do.
    independent: input.ageBand === 'baby' ? false : input.independent,
    sort: Number(count[0]?.sort ?? 0) + 1,
    prefs: { showNumbers: input.ageBand === 'early' || input.ageBand === 'older' },
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
  await ctx.tx
    .insert(wallets)
    .values({ profileId: input.profileId, householdId: ctx.household.id })
    .onConflictDoNothing();
  await auditLog(ctx, 'profile.created', { profileId: input.profileId });
}

export async function updateProfile(ctx: Ctx, input: OpInput<'profile.update'>): Promise<void> {
  const rows = await ctx.tx
    .update(profiles)
    .set({
      nickname: input.nickname,
      avatar: input.avatar,
      ageBand: input.ageBand,
      independent: input.ageBand === 'baby' ? false : input.independent,
      prefs: { showNumbers: input.showNumbers },
      updatedAt: ctx.now,
    })
    .where(and(eq(profiles.id, input.profileId), eq(profiles.householdId, ctx.household.id)))
    .returning({ id: profiles.id });
  if (!rows[0]) throw new Reject('not_found', 'That child is not here.');
}

export async function archiveProfile(ctx: Ctx, input: OpInput<'profile.archive'>): Promise<void> {
  const rows = await ctx.tx
    .update(profiles)
    .set({ archivedAt: input.archived ? ctx.now : null, updatedAt: ctx.now })
    .where(and(eq(profiles.id, input.profileId), eq(profiles.householdId, ctx.household.id)))
    .returning({ id: profiles.id });
  if (!rows[0]) throw new Reject('not_found', 'That child is not here.');
  await auditLog(ctx, input.archived ? 'profile.archived' : 'profile.restored', {
    profileId: input.profileId,
  });
}

export async function reorderProfiles(ctx: Ctx, input: OpInput<'profile.reorder'>): Promise<void> {
  let sort = 1;
  for (const profileId of input.profileIds) {
    await ctx.tx
      .update(profiles)
      .set({ sort: sort++ })
      .where(and(eq(profiles.id, profileId), eq(profiles.householdId, ctx.household.id)));
  }
}

export async function listProfiles(ctx: Ctx, includeArchived: boolean): Promise<Profile[]> {
  const rows = await ctx.tx
    .select()
    .from(profiles)
    .where(
      and(
        eq(profiles.householdId, ctx.household.id),
        includeArchived ? undefined : isNull(profiles.archivedAt),
      ),
    )
    .orderBy(asc(profiles.sort), asc(profiles.createdAt));
  return rows.map((row) => ({
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar as AvatarId,
    ageBand: row.ageBand as Profile['ageBand'],
    independent: row.independent,
    sort: row.sort,
    prefs: { showNumbers: row.prefs.showNumbers === true },
    archived: row.archivedAt !== null,
  }));
}

// ---------------------------------------------------------------------------------------------------------------------
// The household and its settings
// ---------------------------------------------------------------------------------------------------------------------

export async function renameHousehold(ctx: Ctx, input: OpInput<'household.rename'>): Promise<void> {
  await ctx.tx
    .update(households)
    .set({ name: input.name, timeZone: input.timeZone })
    .where(eq(households.id, ctx.household.id));
  await auditLog(ctx, 'household.renamed', { timeZoneChanged: input.timeZone !== ctx.household.timeZone });
  ctx.household.name = input.name;
  ctx.household.timeZone = input.timeZone;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lay a partial change over what is there. Arrays and plain values replace; objects merge key by key. */
export function mergeSettings(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const current = out[key];
    out[key] = isPlainObject(value) && isPlainObject(current) ? mergeSettings(current, value) : value;
  }
  return out;
}

export async function patchSettings(
  ctx: Ctx,
  input: OpInput<'household.settings'>,
  academyHosts: readonly string[] = [],
): Promise<{ changed: string[] }> {
  const merged = mergeSettings(ctx.household.settings as unknown as Record<string, unknown>, input.patch);
  const parsed = v.safeParse(HouseholdSettingsSchema, merged);
  if (!parsed.success) {
    const issue = parsed.issues[0];
    const where = issue?.path?.map((part) => String(part.key)).join('.') ?? 'settings';
    throw new Reject('invalid', `That setting is not something HOMEBASE understands (${where}).`);
  }
  const next: HouseholdSettings = parsed.output;

  if (next.academy.url !== null) {
    const checked = checkAcademyUrl(next.academy.url, [...DEFAULT_ACADEMY_HOSTS, ...academyHosts]);
    if (!checked.ok) {
      const why: Record<typeof checked.problem, string> = {
        'not-a-url': 'That does not look like a web address.',
        'not-https': 'The Academy’s address must begin with https://',
        'not-allowed': 'That address is not on this deployment’s list of Academy addresses.',
        'has-credentials': 'The address must not carry a name or a password.',
        'has-query': 'The address must not carry anything after a ? or a #.',
      };
      throw new Reject('invalid', why[checked.problem]);
    }
    next.academy.url = checked.url;
  } else if (next.academy.enabled) {
    next.academy.enabled = false;
  }
  if (next.location) {
    // The middle of a postcode area is plenty for the sun and the weather, and is not an address.
    next.location = {
      lat: Math.round(next.location.lat * 100) / 100,
      lon: Math.round(next.location.lon * 100) / 100,
      label: next.location.label,
    };
  }
  if (next.vacation && next.vacation.to < next.vacation.from)
    throw new Reject('invalid', 'A holiday ends after it begins.');
  if (!next.ai.provider) next.ai.enabled = false;

  const changed = Object.keys(input.patch).filter(
    (key) =>
      JSON.stringify((ctx.household.settings as Record<string, unknown>)[key]) !==
      JSON.stringify((next as Record<string, unknown>)[key]),
  );
  if (changed.length === 0) return { changed };
  await ctx.tx
    .update(households)
    .set({ settings: next as unknown as Record<string, unknown> })
    .where(eq(households.id, ctx.household.id));
  // The record says which parts were changed, never what a location or an address was changed to.
  await auditLog(ctx, 'settings.changed', { parts: changed });
  ctx.household.settings = next;
  return { changed };
}

// ---------------------------------------------------------------------------------------------------------------------
// Grown-ups and screens
// ---------------------------------------------------------------------------------------------------------------------

export async function listMembers(ctx: Ctx): Promise<Member[]> {
  const rows = await ctx.tx
    .select({
      userId: memberships.userId,
      role: memberships.role,
      pinHash: memberships.pinHash,
      displayName: users.displayName,
      avatar: users.avatar,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.householdId, ctx.household.id))
    .orderBy(asc(memberships.createdAt));
  return rows.map((row) => ({
    userId: row.userId,
    displayName: row.displayName,
    avatar: row.avatar as AvatarId,
    role: row.role as Member['role'],
    hasPin: row.pinHash !== null,
  }));
}

export async function setMemberRole(ctx: Ctx, input: OpInput<'member.role'>): Promise<void> {
  const rows = await ctx.tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.householdId, ctx.household.id), eq(memberships.userId, input.userId)))
    .limit(1);
  const member = rows[0];
  if (!member) throw new Reject('not_found', 'That grown-up is not in this household.');
  if (member.role === 'owner')
    throw new Reject('not_allowed_now', 'The owner’s role cannot be changed here.');
  await ctx.tx
    .update(memberships)
    .set({ role: input.role })
    .where(and(eq(memberships.householdId, ctx.household.id), eq(memberships.userId, input.userId)));
  await auditLog(ctx, 'member.role', { userId: input.userId, role: input.role });
}

export async function removeMember(ctx: Ctx, input: OpInput<'member.remove'>): Promise<void> {
  const rows = await ctx.tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.householdId, ctx.household.id), eq(memberships.userId, input.userId)))
    .limit(1);
  const member = rows[0];
  if (!member) return;
  if (member.role === 'owner') throw new Reject('not_allowed_now', 'A household always has its owner.');
  // With the membership gone, that grown-up's sessions stop working at their next request.
  await ctx.tx
    .delete(memberships)
    .where(and(eq(memberships.householdId, ctx.household.id), eq(memberships.userId, input.userId)));
  await auditLog(ctx, 'member.removed', { userId: input.userId });
}

export async function listDevices(ctx: Ctx): Promise<Device[]> {
  const rows = await ctx.tx
    .select()
    .from(devices)
    .where(eq(devices.householdId, ctx.household.id))
    .orderBy(asc(devices.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as Device['kind'],
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    revoked: row.revokedAt !== null,
  }));
}

export async function renameDevice(ctx: Ctx, input: OpInput<'device.rename'>): Promise<void> {
  const rows = await ctx.tx
    .update(devices)
    .set({ name: input.name })
    .where(and(eq(devices.id, input.deviceId), eq(devices.householdId, ctx.household.id)))
    .returning({ id: devices.id });
  if (!rows[0]) throw new Reject('not_found', 'That screen is not paired with this household.');
}

/** Unpair a screen. From its very next request it is a stranger again, and it forgets what it had kept. */
export async function revokeDevice(ctx: Ctx, input: OpInput<'device.revoke'>): Promise<void> {
  const rows = await ctx.tx
    .update(devices)
    .set({ revokedAt: ctx.now })
    .where(
      and(
        eq(devices.id, input.deviceId),
        eq(devices.householdId, ctx.household.id),
        isNull(devices.revokedAt),
      ),
    )
    .returning({ id: devices.id });
  if (rows[0]) await auditLog(ctx, 'device.revoked', { deviceId: input.deviceId });
}

// ---------------------------------------------------------------------------------------------------------------------
// Small things
// ---------------------------------------------------------------------------------------------------------------------

export async function saveMilestone(ctx: Ctx, input: OpInput<'milestone.save'>): Promise<void> {
  if (input.profileId) {
    const child = await ctx.tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.id, input.profileId), eq(profiles.householdId, ctx.household.id)));
    if (!child[0]) throw new Reject('not_found', 'That child is not here.');
  }
  await ctx.tx
    .insert(milestones)
    .values({
      id: input.milestoneId,
      householdId: ctx.household.id,
      localDate: input.date,
      title: input.title,
      picture: input.picture,
      profileId: input.profileId,
      createdBy: ctx.actor.userId,
      createdAt: ctx.now,
    })
    .onConflictDoUpdate({
      target: milestones.id,
      set: { localDate: input.date, title: input.title, picture: input.picture, profileId: input.profileId },
      setWhere: eq(milestones.householdId, ctx.household.id),
    });
}

export async function removeMilestone(ctx: Ctx, input: OpInput<'milestone.remove'>): Promise<void> {
  await ctx.tx
    .delete(milestones)
    .where(and(eq(milestones.id, input.milestoneId), eq(milestones.householdId, ctx.household.id)));
}

export async function listMilestones(ctx: Ctx): Promise<Milestone[]> {
  const rows = await ctx.tx
    .select()
    .from(milestones)
    .where(eq(milestones.householdId, ctx.household.id))
    .orderBy(sql`${milestones.localDate} desc`)
    .limit(200);
  return rows.map((row) => ({
    id: row.id,
    date: row.localDate,
    title: row.title,
    picture: row.picture as Milestone['picture'],
    profileId: row.profileId,
  }));
}

/** A grown-up says what kind of day it is, with pictures a child can see. */
export async function setCalendarDay(ctx: Ctx, input: OpInput<'calendar.setDay'>): Promise<void> {
  await ctx.tx
    .delete(calendarDays)
    .where(
      and(
        eq(calendarDays.householdId, ctx.household.id),
        eq(calendarDays.localDate, input.date),
        eq(calendarDays.source, 'manual'),
      ),
    );
  const labels = [...new Set(input.labels)];
  if (labels.length > 0) {
    await ctx.tx.insert(calendarDays).values(
      labels.map((label) => ({
        householdId: ctx.household.id,
        localDate: input.date,
        label,
        source: 'manual',
      })),
    );
  }
}

export async function saveCalendarRule(ctx: Ctx, input: OpInput<'calendar.rule.save'>): Promise<void> {
  await ctx.tx
    .insert(calendarRules)
    .values({
      id: input.ruleId,
      householdId: ctx.household.id,
      match: input.match.toLowerCase(),
      label: input.label,
      createdAt: ctx.now,
    })
    .onConflictDoUpdate({
      target: calendarRules.id,
      set: { match: input.match.toLowerCase(), label: input.label },
      setWhere: eq(calendarRules.householdId, ctx.household.id),
    });
}

export async function removeCalendarRule(ctx: Ctx, input: OpInput<'calendar.rule.remove'>): Promise<void> {
  await ctx.tx
    .delete(calendarRules)
    .where(and(eq(calendarRules.id, input.ruleId), eq(calendarRules.householdId, ctx.household.id)));
}

/** The pictures for today and the six days after. */
export async function listCalendar(ctx: Ctx): Promise<CalendarDay[]> {
  const rows = await ctx.tx
    .select()
    .from(calendarDays)
    .where(
      and(
        eq(calendarDays.householdId, ctx.household.id),
        gte(calendarDays.localDate, ctx.today),
        lte(calendarDays.localDate, addDays(ctx.today, 6)),
      ),
    )
    .orderBy(asc(calendarDays.localDate));
  const days = new Map<string, Set<DayPictureId>>();
  for (const row of rows) {
    const set = days.get(row.localDate) ?? new Set<DayPictureId>();
    set.add(row.label as DayPictureId);
    days.set(row.localDate, set);
  }
  return [...days.entries()].map(([date, labels]) => ({ date, labels: [...labels].slice(0, 3) }));
}

export async function updateMedia(ctx: Ctx, input: OpInput<'media.update'>): Promise<void> {
  const rows = await ctx.tx
    .update(media)
    .set({ inSlideshow: input.inSlideshow })
    .where(and(eq(media.id, input.mediaId), eq(media.householdId, ctx.household.id), isNull(media.deletedAt)))
    .returning({ id: media.id });
  if (!rows[0]) throw new Reject('not_found', 'That photo is not here any more.');
}

/** Remove a photo: its picture data goes at once, and nothing of it is left but a note that one was removed. */
export async function removeMedia(ctx: Ctx, input: OpInput<'media.remove'>): Promise<void> {
  const rows = await ctx.tx
    .delete(media)
    .where(and(eq(media.id, input.mediaId), eq(media.householdId, ctx.household.id)))
    .returning({ id: media.id });
  if (rows[0]) await auditLog(ctx, 'media.removed', {});
}

export async function listMedia(ctx: Ctx, slideshowOnly: boolean): Promise<MediaItem[]> {
  const rows = await ctx.tx
    .select()
    .from(media)
    .where(
      and(
        eq(media.householdId, ctx.household.id),
        isNull(media.deletedAt),
        slideshowOnly ? eq(media.inSlideshow, true) : undefined,
      ),
    )
    .orderBy(asc(media.createdAt));
  return rows.map((row) => ({
    id: row.id,
    width: row.width,
    height: row.height,
    widths: row.widths,
    inSlideshow: row.inSlideshow,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listAcademyLinks(ctx: Ctx): Promise<AcademyLink[]> {
  const rows = await ctx.tx.select().from(academyLinks).where(eq(academyLinks.householdId, ctx.household.id));
  return rows.map((row) => ({
    profileId: row.profileId,
    playerId: row.playerId,
    lastImportAt: row.lastImportAt?.toISOString() ?? null,
  }));
}

export async function unlinkAcademy(ctx: Ctx, input: OpInput<'academy.unlink'>): Promise<void> {
  await ctx.tx
    .delete(academyLinks)
    .where(and(eq(academyLinks.profileId, input.profileId), eq(academyLinks.householdId, ctx.household.id)));
  await ctx.tx.execute(
    sql`delete from "homebase"."academy_sessions" where "household_id" = ${ctx.household.id} and "profile_id" = ${input.profileId}`,
  );
  await auditLog(ctx, 'academy.unlinked', { profileId: input.profileId });
}

/** Take one line out of the family's history: a record that was simply wrong. */
export async function forgetEvent(ctx: Ctx, input: OpInput<'history.forget'>): Promise<void> {
  const rows = await ctx.tx
    .delete(events)
    .where(and(eq(events.id, input.eventId), eq(events.householdId, ctx.household.id)))
    .returning({ kind: events.kind });
  if (rows[0]) await auditLog(ctx, 'history.forgot', { kind: rows[0].kind });
}
