import { useEffect, useState } from 'react';
import {
  DECLINE_REASONS,
  hasAccess,
  RETURN_REASONS,
  type DeclineReason,
  type Member,
  type ReturnReason,
} from '../../../shared/model';
import { ActionPicture, Avatar, RewardPicture, ShoppingPicture } from '../../art/pictures';
import { api, ApiError } from '../../sync/api';
import { store } from '../../sync/store';
import { useWall } from '../context';
import { childrenOf, isToDo, missionsFor } from '../derive';
import type { Box } from '../home/layout';
import { Frame } from './Frame';
import styles from './GrownUps.module.css';

/**
 * The grown-ups' corner of the wall.
 *
 * Behind the attic window, behind a PIN. It is for the things a parent does standing in the kitchen: say yes to
 * a mission, answer a request, mark something done. Everything else — designing missions, prices, settings — is
 * on a grown-up's own phone. The server decides when this corner locks again; the wall only shows the clock.
 */

export function GrownUps({ origin }: { origin: Box | null }) {
  const wall = useWall();
  const unlocked = hasAccess(wall.view.viewer.access, 'caregiver');
  useEffect(() => {
    wall.tell('', 'idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Frame tone="cream" origin={origin} testId="scene-grownups" showWho={false}>
      {unlocked ? <Panel /> : <PinGate />}
    </Frame>
  );
}

function PinGate() {
  const wall = useWall();
  const members = wall.view.members;
  const withPin = members.filter((member) => member.hasPin);
  const [member, setMember] = useState<Member | null>(withPin.length === 1 ? (withPin[0] ?? null) : null);
  const [pin, setPin] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    if (!member || busy) return;
    setBusy(true);
    try {
      await api('POST', '/wall/unlock', { userId: member.userId, pin: value });
      setProblem(null);
      await store.sync();
    } catch (error) {
      const wait =
        error instanceof ApiError && typeof error.extra.retryAfter === 'number'
          ? Math.ceil(error.extra.retryAfter / 60)
          : null;
      setProblem(
        error instanceof ApiError
          ? wait
            ? `Too many tries. This door is shut for about ${wait} ${wait === 1 ? 'minute' : 'minutes'}.`
            : error.offline
              ? 'The wall is out of touch with the server, so it cannot check a PIN just now.'
              : error.message
          : 'That did not work.',
      );
    } finally {
      setPin('');
      setBusy(false);
    }
  };

  const press = (digit: string) => {
    if (busy || pin.length >= 8) return;
    setProblem(null);
    setPin((current) => current + digit);
  };

  if (withPin.length === 0) {
    return (
      <div className={styles.gate}>
        <h2>For grown-ups</h2>
        <p className={styles.lead} data-testid="no-pin">
          No grown-up has a wall PIN yet. On your phone, open HOMEBASE and choose{' '}
          <strong>Settings → My wall PIN</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.gate}>
      <h2>For grown-ups</h2>
      {!member ? (
        <>
          <p className={styles.lead}>Who is it?</p>
          <ul className={styles.members}>
            {withPin.map((candidate) => (
              <li key={candidate.userId}>
                <button
                  type="button"
                  className={styles.member}
                  onClick={() => setMember(candidate)}
                  data-testid={`member-${candidate.displayName}`}
                >
                  <span className={styles.memberFace}>
                    <Avatar id={candidate.avatar} />
                  </span>
                  {candidate.displayName}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className={styles.pinArea}>
          <p className={styles.lead}>
            {member.displayName}’s PIN
            {withPin.length > 1 && (
              <button type="button" className={styles.link} onClick={() => setMember(null)}>
                Someone else
              </button>
            )}
          </p>
          <p className={styles.dots} aria-label={`${pin.length} digits entered`} data-testid="pin-dots">
            {Array.from({ length: Math.max(4, pin.length) }, (_, index) => (
              <span key={index} data-on={index < pin.length} />
            ))}
          </p>
          {problem && (
            <p className={styles.problem} role="alert" data-testid="pin-problem">
              {problem}
            </p>
          )}
          <div className={styles.pad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                className={styles.key}
                onClick={() => press(digit)}
                data-testid={`key-${digit}`}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className={styles.key}
              data-kind="aux"
              onClick={() => setPin((current) => current.slice(0, -1))}
              aria-label="Delete"
            >
              ⌫
            </button>
            <button type="button" className={styles.key} onClick={() => press('0')} data-testid="key-0">
              0
            </button>
            <button
              type="button"
              className={styles.key}
              data-kind="go"
              onClick={() => void submit(pin)}
              disabled={pin.length < 4 || busy}
              data-testid="key-ok"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel() {
  const wall = useWall();
  const { view } = wall;
  const [returning, setReturning] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const until = view.viewer.unlockedUntil;
  const isWall = view.viewer.kind === 'device';
  const name = view.members.find((member) => member.userId === view.viewer.userId)?.displayName ?? 'there';
  const canDecideRewards = hasAccess(view.viewer.access, 'guardian');

  // The countdown to locking. When it runs out, ask the server: it has already locked.
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const seconds = Math.max(0, Math.round((new Date(until).getTime() - store.serverNow()) / 1000));
      setLeft(seconds);
      if (seconds === 0) void store.sync();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);

  const lock = async () => {
    try {
      await api('POST', '/wall/lock', {});
    } finally {
      await store.sync();
      wall.home();
    }
  };

  const sent = view.occurrences.filter((occurrence) => occurrence.status === 'submitted');
  const asked = view.redemptions.filter((redemption) => redemption.status === 'requested');
  const wanted = view.items.filter((item) => item.status === 'requested');
  const nameOf = (profileId: string | null) =>
    view.profiles.find((profile) => profile.id === profileId)?.nickname ?? 'Someone';
  const nothing = sent.length === 0 && asked.length === 0 && wanted.length === 0;

  return (
    <div className={styles.panel} data-testid="grownups-panel">
      <header className={styles.header}>
        <h2>Hello, {name}</h2>
        {isWall && (
          <button type="button" className={styles.lock} onClick={() => void lock()} data-testid="lock">
            Lock{left !== null ? ` (${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})` : ''}
          </button>
        )}
      </header>

      <div className={styles.columns}>
        <section className={styles.column} aria-label="Waiting for you">
          <h3>Waiting for you</h3>
          {nothing && (
            <p className={styles.quiet} data-testid="nothing-waiting">
              Nothing is waiting.
            </p>
          )}
          <ul className={styles.list}>
            {sent.map((occurrence) => (
              <li key={occurrence.id} className={styles.row} data-testid={`sent-${occurrence.title}`}>
                <span className={styles.rowPicture}>
                  <ActionPicture id={occurrence.picture} />
                </span>
                <span className={styles.rowWords}>
                  <strong>{occurrence.title}</strong>
                  <span>
                    {nameOf(occurrence.doneBy)} says it is done · {occurrence.stars}{' '}
                    {occurrence.stars === 1 ? 'star' : 'stars'}
                  </span>
                </span>
                {returning === occurrence.id ? (
                  <span className={styles.choices}>
                    {(Object.keys(RETURN_REASONS) as ReturnReason[]).map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        className={styles.choice}
                        onClick={() => {
                          wall.ask('occurrence.return', { occurrenceId: occurrence.id, reason });
                          setReturning(null);
                        }}
                      >
                        {RETURN_REASONS[reason]}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className={styles.buttons}>
                    <button
                      type="button"
                      className={styles.yes}
                      onClick={() => wall.ask('occurrence.approve', { occurrenceIds: [occurrence.id] })}
                      data-testid="approve"
                    >
                      Yes, done
                    </button>
                    <button type="button" className={styles.no} onClick={() => setReturning(occurrence.id)}>
                      Another go
                    </button>
                  </span>
                )}
              </li>
            ))}
            {asked.map((redemption) => (
              <li key={redemption.id} className={styles.row} data-testid={`request-${redemption.title}`}>
                <span className={styles.rowPicture}>
                  <RewardPicture id={redemption.picture} />
                </span>
                <span className={styles.rowWords}>
                  <strong>{redemption.title}</strong>
                  <span>
                    {nameOf(redemption.profileId)} is asking · {redemption.price} stars set aside
                  </span>
                </span>
                {!canDecideRewards ? (
                  <span className={styles.quiet}>A parent answers rewards.</span>
                ) : declining === redemption.id ? (
                  <span className={styles.choices}>
                    {(Object.keys(DECLINE_REASONS) as DeclineReason[]).map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        className={styles.choice}
                        onClick={() => {
                          wall.ask('redemption.decide', {
                            redemptionId: redemption.id,
                            approve: false,
                            reason,
                          });
                          setDeclining(null);
                        }}
                      >
                        {DECLINE_REASONS[reason]}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className={styles.buttons}>
                    <button
                      type="button"
                      className={styles.yes}
                      onClick={() =>
                        wall.ask('redemption.decide', { redemptionId: redemption.id, approve: true })
                      }
                      data-testid="say-yes"
                    >
                      Yes
                    </button>
                    <button type="button" className={styles.no} onClick={() => setDeclining(redemption.id)}>
                      Not this time
                    </button>
                  </span>
                )}
              </li>
            ))}
            {wanted.map((item) => (
              <li key={item.id} className={styles.row} data-testid={`wanted-${item.text}`}>
                <span className={styles.rowPicture}>
                  <ShoppingPicture id={item.picture} />
                </span>
                <span className={styles.rowWords}>
                  <strong>{item.text}</strong>
                  <span>{nameOf(item.requestedBy)} would like this on the list</span>
                </span>
                <span className={styles.buttons}>
                  <button
                    type="button"
                    className={styles.yes}
                    onClick={() => wall.ask('shopping.decide', { itemId: item.id, accept: true })}
                  >
                    Add it
                  </button>
                  <button
                    type="button"
                    className={styles.no}
                    onClick={() => wall.ask('shopping.decide', { itemId: item.id, accept: false })}
                  >
                    Not now
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.column} aria-label="Today">
          <h3>Today</h3>
          {childrenOf(view)
            .filter((child) => child.independent)
            .map((child) => {
              const todo = missionsFor(view, child.id, wall.nowMs).filter(isToDo);
              return (
                <div key={child.id} className={styles.child}>
                  <h4>
                    <span className={styles.childFace}>
                      <Avatar id={child.avatar} />
                    </span>
                    {child.nickname}
                  </h4>
                  {todo.length === 0 ? (
                    <p className={styles.quiet}>Nothing left to do today.</p>
                  ) : (
                    <ul className={styles.list}>
                      {todo.map((occurrence) => (
                        <li key={occurrence.id} className={styles.row} data-size="small">
                          <span className={styles.rowPicture}>
                            <ActionPicture id={occurrence.picture} />
                          </span>
                          <span className={styles.rowWords}>
                            <strong>{occurrence.title}</strong>
                          </span>
                          <span className={styles.buttons}>
                            <button
                              type="button"
                              className={styles.yes}
                              onClick={() =>
                                wall.ask('occurrence.markDone', {
                                  occurrenceId: occurrence.id,
                                  profileId: child.id,
                                })
                              }
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              className={styles.no}
                              onClick={() => wall.ask('occurrence.dismiss', { occurrenceId: occurrence.id })}
                            >
                              Not today
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          <p className={styles.quiet}>Missions, routines, rewards and settings are on your phone.</p>
        </section>
      </div>
    </div>
  );
}
