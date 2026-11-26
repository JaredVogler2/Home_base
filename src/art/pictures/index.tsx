import {
  ACTION_PICTURES,
  AVATARS,
  DAY_PICTURES,
  REWARD_PICTURES,
  SHOPPING_PICTURES,
  type ActionPictureId,
  type AvatarId,
  type DayPictureId,
  type RewardPictureId,
  type ShoppingPictureId,
} from '../../../shared/pictures';
import { P } from '../palette';
import { Picture, type PictureProps } from '../Picture';
import { ACTIONS_A } from './actions-a';
import { ACTIONS_B } from './actions-b';
import { ACTIONS_C } from './actions-c';
import { AVATAR_FACES } from './avatars';
import { DAYS } from './days';
import { REWARDS } from './rewards';
import { SHOPPING } from './shopping';
import type { Art } from './kit';

/**
 * Every drawing, by name. The names are the registry's (shared/pictures.ts); a test fails if a name there has
 * no drawing here.
 */

/** Stands in for a drawing that has not been made. It should never be seen: the test above is what prevents it. */
const Missing: Art = () => (
  <>
    <rect x="14" y="14" width="72" height="72" rx="16" fill={P.creamShade} />
    <path
      d="M38 40 q0 -12 12 -12 q12 0 12 11 q0 8 -9 11 q-3 1 -3 6"
      fill="none"
      stroke={P.inkSoft}
      strokeWidth="6"
      strokeLinecap="round"
    />
    <circle cx="50" cy="70" r="4" fill={P.inkSoft} />
  </>
);

export const ACTION_ART: Partial<Record<ActionPictureId, Art>> = { ...ACTIONS_A, ...ACTIONS_B, ...ACTIONS_C };
export const REWARD_ART: Partial<Record<RewardPictureId, Art>> = REWARDS;
export const SHOPPING_ART: Partial<Record<ShoppingPictureId, Art>> = SHOPPING;
export const DAY_ART: Partial<Record<DayPictureId, Art>> = DAYS;
export const AVATAR_ART: Partial<Record<AvatarId, Art>> = AVATAR_FACES;

type Shared = Omit<PictureProps, 'children' | 'label'> & {
  /** Say the picture's own name to a screen reader. Leave off when the words are already beside it. */
  labelled?: boolean;
};

export function ActionPicture({ id, labelled, ...rest }: { id: ActionPictureId } & Shared) {
  const Draw = ACTION_ART[id] ?? Missing;
  return (
    <Picture {...rest} label={labelled ? ACTION_PICTURES[id].label : undefined}>
      <Draw />
    </Picture>
  );
}

export function RewardPicture({ id, labelled, ...rest }: { id: RewardPictureId } & Shared) {
  const Draw = REWARD_ART[id] ?? Missing;
  return (
    <Picture {...rest} label={labelled ? REWARD_PICTURES[id].label : undefined}>
      <Draw />
    </Picture>
  );
}

export function ShoppingPicture({ id, labelled, ...rest }: { id: ShoppingPictureId } & Shared) {
  const Draw = SHOPPING_ART[id] ?? Missing;
  return (
    <Picture {...rest} label={labelled ? SHOPPING_PICTURES[id].label : undefined}>
      <Draw />
    </Picture>
  );
}

export function DayPicture({ id, labelled, ...rest }: { id: DayPictureId } & Shared) {
  const Draw = DAY_ART[id] ?? Missing;
  return (
    <Picture {...rest} label={labelled ? DAY_PICTURES[id].label : undefined}>
      <Draw />
    </Picture>
  );
}

export function Avatar({ id, labelled, ...rest }: { id: AvatarId } & Shared) {
  const Draw = AVATAR_ART[id] ?? Missing;
  return (
    <Picture {...rest} label={labelled ? AVATARS[id].label : undefined}>
      <Draw />
    </Picture>
  );
}

/** Any picture a milestone or a note might carry, whichever sheet it is on. */
export function AnyPicture({ id, ...rest }: { id: string } & Shared) {
  if (id in ACTION_PICTURES) return <ActionPicture id={id as ActionPictureId} {...rest} />;
  if (id in REWARD_PICTURES) return <RewardPicture id={id as RewardPictureId} {...rest} />;
  if (id in DAY_PICTURES) return <DayPicture id={id as DayPictureId} {...rest} />;
  if (id in SHOPPING_PICTURES) return <ShoppingPicture id={id as ShoppingPictureId} {...rest} />;
  return (
    <Picture {...rest}>
      <Missing />
    </Picture>
  );
}
