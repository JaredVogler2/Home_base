import type { OpInput, OpType } from '../../shared/ops.js';
import * as bank from '../domain/bank.js';
import type { Ctx } from '../domain/context.js';
import * as family from '../domain/family.js';
import * as quest from '../domain/quest.js';
import * as routines from '../domain/routines.js';
import * as shopping from '../domain/shopping.js';

/**
 * What each kind of request does. The table is exhaustive by construction: a request added to the catalogue
 * (shared/ops.ts) without an entry here does not compile. Every entry is a thin sentence — the rules themselves
 * live in server/domain.
 */

export interface Done {
  /** False when there was nothing to do: screens are not told there is news. */
  changed: boolean;
  data?: Record<string, unknown>;
}

type Handlers = { [T in OpType]: (ctx: Ctx, input: OpInput<T>) => Promise<Done> };

const changed = (data?: Record<string, unknown>): Done => ({ changed: true, data });

export const HANDLERS: Handlers = {
  // --- missions ---
  'occurrence.start': async (ctx, input) => {
    const result = await quest.startOccurrence(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'occurrence.submit': async (ctx, input) => {
    const result = await quest.submitOccurrence(ctx, input);
    return { changed: result.changed, data: { status: result.status, starsGiven: result.starsGiven } };
  },
  'occurrence.undo': async (ctx, input) => {
    const result = await quest.undoOccurrence(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'occurrence.help': async (ctx, input) => {
    const result = await quest.askForHelp(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'occurrence.skip': async (ctx, input) => {
    const result = await quest.skipOccurrence(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'occurrence.approve': async (ctx, input) => {
    const result = await quest.approveOccurrences(ctx, input);
    return { changed: result.approved.length > 0, data: { ...result } };
  },
  'occurrence.return': async (ctx, input) => {
    const result = await quest.returnOccurrence(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'occurrence.markDone': async (ctx, input) => {
    const result = await quest.markDone(ctx, input);
    return { changed: result.changed, data: { status: result.status, starsGiven: result.starsGiven } };
  },
  'occurrence.snooze': async (ctx, input) => {
    const result = await quest.snoozeOccurrence(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'occurrence.dismiss': async (ctx, input) => {
    const result = await quest.skipOccurrence(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'occurrence.reverse': async (ctx, input) => {
    const result = await quest.reverseOccurrence(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'task.create': async (ctx, input) => changed(await quest.createTask(ctx, input)),
  'task.update': async (ctx, input) => changed(await quest.updateTask(ctx, input)),
  'task.status': async (ctx, input) => {
    await quest.setTaskStatus(ctx, input);
    return changed();
  },
  'task.reorder': async (ctx, input) => {
    await quest.reorderTasks(ctx, input);
    return changed();
  },

  // --- routines ---
  'routine.create': async (ctx, input) => changed(await routines.createRoutine(ctx, input)),
  'routine.update': async (ctx, input) => changed(await routines.updateRoutine(ctx, input)),
  'routine.status': async (ctx, input) => {
    await routines.setRoutineStatus(ctx, input);
    return changed();
  },
  'routine.clone': async (ctx, input) => {
    await routines.cloneRoutine(ctx, input);
    return changed();
  },
  'run.start': async (ctx, input) => {
    const result = await routines.startRun(ctx, input);
    return { changed: result.started, data: { runId: result.runId } };
  },
  'run.step': async (ctx, input) => {
    const result = await routines.stepRun(ctx, input);
    return { changed: result.changed, data: { completed: result.completed, starsGiven: result.starsGiven } };
  },
  'run.together': async (ctx, input) => {
    const result = await routines.togetherStep(ctx, input);
    return { changed: result.changed, data: { completed: result.completed } };
  },
  'run.pause': async (ctx, input) => routines.pauseRun(ctx, input),
  'run.resume': async (ctx, input) => routines.resumeRun(ctx, input),
  'run.finish': async (ctx, input) => routines.finishRun(ctx, input),

  // --- the bank ---
  'reward.create': async (ctx, input) => {
    await bank.createReward(ctx, input);
    return changed();
  },
  'reward.update': async (ctx, input) => changed(await bank.updateReward(ctx, input)),
  'reward.status': async (ctx, input) => {
    await bank.setRewardStatus(ctx, input);
    return changed();
  },
  'redemption.request': async (ctx, input) => changed(await bank.requestRedemption(ctx, input)),
  'redemption.cancel': async (ctx, input) => bank.cancelRedemption(ctx, input),
  'redemption.decide': async (ctx, input) => {
    const result = await bank.decideRedemption(ctx, input);
    return { changed: result.changed, data: { status: result.status } };
  },
  'redemption.fulfill': async (ctx, input) => bank.fulfillRedemption(ctx, input),
  'redemption.refund': async (ctx, input) => bank.refundRedemption(ctx, input),
  'goal.set': async (ctx, input) => {
    await bank.setGoal(ctx, input);
    return changed();
  },
  'ledger.bonus': async (ctx, input) => changed(await bank.giveBonus(ctx, input)),
  'ledger.correct': async (ctx, input) => changed(await bank.correctLedger(ctx, input)),

  // --- to buy ---
  'shopping.add': async (ctx, input) => changed({ ...(await shopping.addItem(ctx, input)) }),
  'shopping.check': async (ctx, input) => shopping.checkItem(ctx, input),
  'shopping.edit': async (ctx, input) => {
    const result = await shopping.editItem(ctx, input);
    return { changed: result.changed.length > 0, data: { fields: result.changed } };
  },
  'shopping.remove': async (ctx, input) => shopping.removeItem(ctx, input),
  'shopping.restore': async (ctx, input) => shopping.restoreItem(ctx, input),
  'shopping.clearChecked': async (ctx, input) => {
    const result = await shopping.clearChecked(ctx, input);
    return { changed: result.cleared > 0, data: { ...result } };
  },
  'shopping.favourite': async (ctx, input) => shopping.setFavourite(ctx, input),
  'shopping.request': async (ctx, input) => changed({ ...(await shopping.requestItem(ctx, input)) }),
  'shopping.decide': async (ctx, input) => shopping.decideRequest(ctx, input),
  'list.create': async (ctx, input) => {
    await shopping.createList(ctx, input);
    return changed();
  },
  'list.update': async (ctx, input) => {
    await shopping.updateList(ctx, input);
    return changed();
  },

  // --- the family ---
  'profile.create': async (ctx, input) => {
    await family.createProfile(ctx, input);
    await quest.ensureOccurrences(ctx, ctx.today);
    return changed();
  },
  'profile.update': async (ctx, input) => {
    await family.updateProfile(ctx, input);
    await quest.ensureOccurrences(ctx, ctx.today);
    return changed();
  },
  'profile.archive': async (ctx, input) => {
    await family.archiveProfile(ctx, input);
    return changed();
  },
  'profile.reorder': async (ctx, input) => {
    await family.reorderProfiles(ctx, input);
    return changed();
  },
  'household.rename': async (ctx, input) => {
    await family.renameHousehold(ctx, input);
    return changed();
  },
  'household.settings': async (ctx, input) => {
    const result = await family.patchSettings(ctx, input, ctx.deploy.academyHosts);
    return { changed: result.changed.length > 0, data: { parts: result.changed } };
  },
  'member.role': async (ctx, input) => {
    await family.setMemberRole(ctx, input);
    return changed();
  },
  'member.remove': async (ctx, input) => {
    await family.removeMember(ctx, input);
    return changed();
  },
  'device.rename': async (ctx, input) => {
    await family.renameDevice(ctx, input);
    return changed();
  },
  'device.revoke': async (ctx, input) => {
    await family.revokeDevice(ctx, input);
    return changed();
  },
  'milestone.save': async (ctx, input) => {
    await family.saveMilestone(ctx, input);
    return changed();
  },
  'milestone.remove': async (ctx, input) => {
    await family.removeMilestone(ctx, input);
    return changed();
  },
  'calendar.setDay': async (ctx, input) => {
    await family.setCalendarDay(ctx, input);
    return changed();
  },
  'calendar.rule.save': async (ctx, input) => {
    await family.saveCalendarRule(ctx, input);
    return changed();
  },
  'calendar.rule.remove': async (ctx, input) => {
    await family.removeCalendarRule(ctx, input);
    return changed();
  },
  'media.update': async (ctx, input) => {
    await family.updateMedia(ctx, input);
    return changed();
  },
  'media.remove': async (ctx, input) => {
    await family.removeMedia(ctx, input);
    return changed();
  },
  'academy.unlink': async (ctx, input) => {
    await family.unlinkAcademy(ctx, input);
    return changed();
  },
  'history.forget': async (ctx, input) => {
    await family.forgetEvent(ctx, input);
    return changed();
  },
};
