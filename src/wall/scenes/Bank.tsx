import { useEffect, useState } from 'react';
import { newId } from '../../../shared/ids';
import { DECLINE_REASONS, type Redemption, type Reward } from '../../../shared/model';
import { REWARD_PICTURES } from '../../../shared/pictures';
import { Piggy, StarTray } from '../../art/house/rooms';
import { P } from '../../art/palette';
import { RewardPicture } from '../../art/pictures';
import { CloseGlyph } from '../chrome/chrome';
import { useWall } from '../context';
import { childById, goalOf, reach, rewardsFor, starsOf } from '../derive';
import type { Box } from '../home/layout';
import { Badge, BigButton, Stars } from './bits';
import { Frame, Sheet } from './Frame';
import styles from './Bank.module.css';
import { Who } from './Who';

/**
 * BANK: the piggy bank and the shop.
 *
 * Stars are things to look at here, in frames of ten — five and five, the way hands count — so that "how many"
 * and "is it enough" can be seen without a number. Each thing in the shop shows its price as places for stars,
 * filled as far as the child's stars go: full means "you can have it", and the empty places are how many more.
 * Asking sets the stars aside and waits for a grown-up; nothing is taken until they say yes.
 */

export function Bank({ origin }: { origin: Box | null }) {
  const wall = useWall();
  const { view, who } = wall;
  const child = childById(view, who);
  const stars = starsOf(view, who);
  const rewards = rewardsFor(view, who);
  const goal = goalOf(view, who);
  const mine = who ? view.redemptions.filter((redemption) => redemption.profileId === who) : [];
  const waiting = mine.filter((redemption) => redemption.status === 'requested');
  const yes = mine.filter((redemption) => redemption.status === 'approved');
  const no = mine.filter(
    (redemption) =>
      redemption.status === 'declined' &&
      redemption.decidedAt !== null &&
      wall.nowMs - new Date(redemption.decidedAt).getTime() < 36 * 3_600_000,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rewards.find((reward) => reward.id === openId) ?? null;
  const trays = Math.max(1, Math.min(5, Math.ceil(stars / 10)));

  useEffect(() => {
    if (!child) wall.tell('Who is here? Tap your picture.', 'wave');
    else if (waiting.length > 0) wall.tell('A grown-up is thinking about it.', 'think');
    else
      wall.tell(
        stars === 0
          ? `No stars yet, ${child.nickname}. Missions make stars.`
          : `${child.nickname}, these are your stars.`,
        'point',
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.id]);

  return (
    <Frame tone="rose" origin={origin} testId="scene-bank">
      {!child ? (
        <Who />
      ) : (
        <div className={styles.bank}>
          <section className={styles.mine} aria-label={`${child.nickname}'s stars: ${stars}`}>
            <svg
              className={styles.piggy}
              viewBox="20 40 200 170"
              role="img"
              aria-label="The piggy bank"
              focusable="false"
            >
              <ellipse cx="119" cy="200" rx="72" ry="8" fill={P.ink} opacity="0.14" />
              <Piggy happy={stars > 0} />
            </svg>
            <div className={styles.trays} data-testid="star-trays" data-stars={stars}>
              {Array.from({ length: trays }, (_, index) => (
                <svg
                  key={index}
                  viewBox="-18 -20 156 68"
                  className={styles.tray}
                  aria-hidden="true"
                  focusable="false"
                >
                  <StarTray stars={Math.max(0, Math.min(10, stars - index * 10))} cell={30} />
                </svg>
              ))}
              {stars > 50 && <span className={styles.more}>+</span>}
            </div>
            {child.prefs.showNumbers && (
              <p className={styles.count} data-testid="star-count">
                {stars}
              </p>
            )}
            {goal && (
              <button
                type="button"
                className={styles.goal}
                onClick={() => setOpenId(goal.id)}
                aria-label={`Saving for ${goal.title}`}
                data-testid="goal"
              >
                <span className={styles.goalPicture}>
                  <RewardPicture id={goal.picture} />
                </span>
                <Stars
                  filled={Math.min(stars, goal.price)}
                  of={goal.price}
                  size="1.5cqw"
                  label={`${Math.min(stars, goal.price)} of ${goal.price} stars saved`}
                />
              </button>
            )}
          </section>

          <section className={styles.shop} aria-label="The reward shop">
            {(waiting.length > 0 || yes.length > 0 || no.length > 0) && (
              <ul className={styles.asked}>
                {[...waiting, ...yes, ...no].slice(0, 3).map((redemption) => (
                  <li key={redemption.id}>
                    <AskedCard redemption={redemption} saving={wall.isSaving(redemption.id)} />
                  </li>
                ))}
              </ul>
            )}
            {rewards.length === 0 ? (
              <p className={styles.none} data-testid="shop-empty">
                The shop is empty. A grown-up can fill it.
              </p>
            ) : (
              <ul className={styles.rewards}>
                {rewards.map((reward) => {
                  const { canHave } = reach(reward.price, stars);
                  const soldOut = reward.stock !== null && reward.stock <= 0;
                  return (
                    <li key={reward.id}>
                      <button
                        type="button"
                        className={styles.reward}
                        data-can={canHave && !soldOut}
                        data-goal={goal?.id === reward.id}
                        onClick={() => {
                          wall.sound('tap');
                          setOpenId(reward.id);
                          wall.tell(reward.say ?? REWARD_PICTURES[reward.picture].say, 'point');
                        }}
                        aria-label={`${reward.title}: ${reward.price} stars. ${soldOut ? 'None left.' : canHave ? 'You have enough.' : `${reward.price - stars} more to go.`}`}
                        data-testid={`reward-${reward.title}`}
                      >
                        <span className={styles.rewardPicture}>
                          <RewardPicture id={reward.picture} />
                        </span>
                        {wall.labels && <span className={styles.rewardTitle}>{reward.title}</span>}
                        <Stars
                          filled={Math.min(stars, reward.price)}
                          of={reward.price}
                          size={reward.price > 20 ? '1.05cqw' : reward.price > 10 ? '1.3cqw' : '1.7cqw'}
                          label={`${reward.price} stars`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
      {open && child && (
        <RewardSheet
          reward={open}
          stars={stars}
          profileId={child.id}
          isGoal={goal?.id === open.id}
          onClose={() => setOpenId(null)}
        />
      )}
    </Frame>
  );
}

function AskedCard({ redemption, saving }: { redemption: Redemption; saving: boolean }) {
  const wall = useWall();
  const waiting = redemption.status === 'requested';
  const approved = redemption.status === 'approved';
  const words = waiting
    ? 'Waiting for a grown-up'
    : approved
      ? 'Yes!'
      : DECLINE_REASONS[redemption.declineReason ?? 'later'];
  return (
    <div
      className={styles.askedCard}
      data-status={redemption.status}
      data-testid={`asked-${redemption.title}`}
    >
      <span className={styles.askedPicture}>
        <RewardPicture id={redemption.picture} />
      </span>
      <span className={styles.askedWords}>
        <strong>{redemption.title}</strong>
        <span>{words}</span>
      </span>
      <span className={styles.askedBadge}>
        {saving ? (
          <Badge kind="saving" />
        ) : waiting ? (
          <Badge kind="waiting" />
        ) : approved ? (
          <Badge kind="done" />
        ) : null}
      </span>
      {waiting && (
        <button
          type="button"
          className={styles.changeMind}
          onClick={() => {
            wall.sound('back');
            wall.ask('redemption.cancel', { redemptionId: redemption.id });
            wall.tell('All right. Your stars are back.', 'idle');
          }}
          data-testid="change-mind"
        >
          I changed my mind
        </button>
      )}
    </div>
  );
}

function RewardSheet({
  reward,
  stars,
  profileId,
  isGoal,
  onClose,
}: {
  reward: Reward;
  stars: number;
  profileId: string;
  isGoal: boolean;
  onClose: () => void;
}) {
  const wall = useWall();
  const { canHave, more } = reach(reward.price, stars);
  const soldOut = reward.stock !== null && reward.stock <= 0;
  return (
    <Sheet onClose={onClose} testId="reward-sheet" label={reward.title}>
      <div className={styles.sheet}>
        <div className={styles.show}>
          <RewardPicture id={reward.picture} play />
        </div>
        <div className={styles.side}>
          <h2 className={styles.heading}>{reward.title}</h2>
          <Stars
            filled={Math.min(stars, reward.price)}
            of={reward.price}
            size={reward.price > 20 ? '1.9cqw' : '2.6cqw'}
            label={`It costs ${reward.price} stars. You have ${stars}.`}
          />
          <p className={styles.reachWords} data-testid="reach">
            {soldOut
              ? 'There are none left just now.'
              : canHave
                ? 'You have enough stars!'
                : `${more} more ${more === 1 ? 'star' : 'stars'} to go.`}
          </p>
          <div className={styles.actions}>
            {canHave && !soldOut && (
              <BigButton
                tone="honey"
                word="Ask for it"
                testId="ask-for-it"
                onTap={() => {
                  wall.sound('sent');
                  wall.ask('redemption.request', {
                    redemptionId: newId(),
                    profileId,
                    rewardId: reward.id,
                    rewardVersion: reward.version,
                    price: reward.price,
                  });
                  wall.tell('I have asked a grown-up for you.', 'cheer');
                  onClose();
                }}
              >
                <path
                  d="M50 20 L58 40 L80 42 L63 56 L68 78 L50 66 L32 78 L37 56 L20 42 L42 40 Z"
                  fill={P.ink}
                  stroke={P.ink}
                  strokeWidth="5"
                  strokeLinejoin="round"
                />
              </BigButton>
            )}
            {!canHave && !soldOut && (
              <BigButton
                tone={isGoal ? 'soft' : 'honey'}
                word={isGoal ? 'I am saving for this' : 'Save up for it'}
                testId="save-for-it"
                disabled={isGoal}
                onTap={() => {
                  wall.sound('step');
                  wall.ask('goal.set', { profileId, rewardId: reward.id });
                  wall.tell('Good idea. I will keep it by the piggy bank.', 'cheer');
                  onClose();
                }}
              >
                <path d="M26 44 h48 l-5 34 h-38 z" fill={P.ink} />
                <path
                  d="M34 44 q16 -30 32 0"
                  fill="none"
                  stroke={P.ink}
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </BigButton>
            )}
            <BigButton tone="soft" word="Back" onTap={onClose} testId="sheet-close">
              <CloseGlyph />
            </BigButton>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
