import { useState } from 'react';
import { newId } from '../../../shared/ids';
import type { Profile, Reward, Snapshot } from '../../../shared/model';
import { REWARD_PICTURES, type RewardPictureId } from '../../../shared/pictures';
import { useParent } from '../context';
import {
  Button,
  Card,
  ChildChips,
  ConfirmButton,
  Field,
  Line,
  PicturePicker,
  Sheet,
  Stepper,
  TextInput,
  Toggle,
  useToast,
} from '../ui/kit';

/**
 * A reward a child can save for. Rewards are things a family does or small treats a grown-up has agreed to —
 * never food, rest, affection or anything else a child simply needs.
 */

/** The most stars a child's present missions could bring in a week: a ceiling, not a forecast. */
export function weeklyCeiling(view: Snapshot, child: Profile): number {
  let total = 0;
  for (const template of view.templates ?? []) {
    if (template.status !== 'active' || template.shared) continue;
    if (template.assignees.length > 0 && !template.assignees.includes(child.id)) continue;
    const schedule = template.schedule;
    const times =
      schedule.kind === 'daily'
        ? 7
        : schedule.kind === 'weekdays'
          ? 5
          : schedule.kind === 'weekly'
            ? schedule.days.length
            : schedule.kind === 'flexible'
              ? schedule.timesPerWeek
              : 0;
    total += template.stars * times;
  }
  const rate = view.household.settings.bank.spendRatePercent / 100;
  const allowance = view.household.settings.bank.allowance;
  return Math.floor(total * rate) + (allowance.enabled ? allowance.stars : 0);
}

export function RewardEditor({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const parent = useParent();
  const toast = useToast();
  const { view } = parent;
  const children = view.profiles.filter((profile) => !profile.archived && profile.independent);
  const [picture, setPicture] = useState<RewardPictureId>(reward?.picture ?? 'game');
  const [title, setTitle] = useState(reward?.title ?? '');
  const [say, setSay] = useState(reward?.say ?? '');
  const [price, setPrice] = useState(reward?.price ?? 10);
  const [limited, setLimited] = useState(reward?.stock != null);
  const [stock, setStock] = useState(reward?.stock ?? 1);
  const [profiles, setProfiles] = useState<string[]>(reward?.profiles ?? []);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const fields = {
      title,
      picture,
      say: say.trim() === '' ? null : say,
      price,
      stock: limited ? stock : null,
      profiles,
    };
    const ok = reward
      ? await parent.ask('reward.update', { rewardId: reward.id, baseVersion: reward.version, ...fields })
      : await parent.ask('reward.create', { rewardId: newId(), ...fields });
    setBusy(false);
    if (ok) {
      toast(reward ? 'Saved.' : 'The reward is in the shop.');
      onClose();
    }
  };

  const savers = children.filter((child) => profiles.length === 0 || profiles.includes(child.id));

  return (
    <Sheet
      title={reward ? 'Change a reward' : 'New reward'}
      onClose={onClose}
      testId="reward-editor"
      footer={
        <>
          {reward && (
            <ConfirmButton
              label={reward.status === 'archived' ? 'Bring back' : 'Put away'}
              confirmLabel={reward.status === 'archived' ? 'Bring it back' : 'Put it away'}
              tone="plain"
              onConfirm={() => {
                parent.tell('reward.status', {
                  rewardId: reward.id,
                  status: reward.status === 'archived' ? 'active' : 'archived',
                });
                onClose();
              }}
            />
          )}
          <Button
            tone="primary"
            busy={busy}
            disabled={title.trim() === ''}
            onClick={() => void save()}
            testId="save-reward"
          >
            Save
          </Button>
        </>
      }
    >
      <Line>
        <PicturePicker
          kind="reward"
          value={picture}
          onChange={setPicture}
          label="Picture"
          testId="reward-picture"
        />
        <div style={{ flex: 1, minWidth: 190 }}>
          <Field label="What it is">
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              placeholder={REWARD_PICTURES[picture].label}
              testId="reward-title"
            />
          </Field>
        </div>
      </Line>
      <Field
        label="What the guide says (optional)"
        hint={`Left empty, he says: “${REWARD_PICTURES[picture].say}”`}
      >
        <TextInput value={say} onChange={(event) => setSay(event.target.value)} maxLength={120} />
      </Field>
      <Stepper
        label="Price in stars"
        value={price}
        min={1}
        max={200}
        onChange={setPrice}
        show={(value) => `★ ${value}`}
        testId="reward-price"
      />
      {savers.length > 0 && (
        <Card tone="blue">
          {savers.map((child) => {
            const ceiling = weeklyCeiling(view, child);
            const have = view.wallets.find((wallet) => wallet.profileId === child.id)?.available ?? 0;
            const short = Math.max(0, price - have);
            return (
              <p key={child.id}>
                <strong>{child.nickname}</strong> has {have}.{' '}
                {short === 0
                  ? 'That is enough already.'
                  : ceiling === 0
                    ? 'No missions earn stars yet, so this cannot be reached.'
                    : `At most ${ceiling} a week from missions now, so about ${Math.ceil(short / ceiling)} ${Math.ceil(short / ceiling) === 1 ? 'week' : 'weeks'} or more.`}
              </p>
            );
          })}
        </Card>
      )}
      <ChildChips
        label="Who may choose it?"
        profiles={children}
        value={profiles}
        onChange={setProfiles}
        everyone="Every child"
      />
      <Toggle
        label="Only a few of these"
        hint="For a one-off: when they are gone it leaves the shop."
        checked={limited}
        onChange={setLimited}
      />
      {limited && <Stepper label="How many are left" value={stock} min={0} max={99} onChange={setStock} />}
      {reward && reward.status !== 'archived' && (
        <Toggle
          label="In the shop"
          hint="Switch off to rest it without losing it."
          checked={reward.status === 'active'}
          onChange={(on) =>
            parent.tell('reward.status', { rewardId: reward.id, status: on ? 'active' : 'paused' })
          }
        />
      )}
    </Sheet>
  );
}
