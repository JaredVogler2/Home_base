import { useEffect, useState } from 'react';
import { newId } from '../../../shared/ids';
import type { ShoppingItem } from '../../../shared/model';
import { CHILD_REQUEST_PICTURES, SHOPPING_PICTURES, type ShoppingPictureId } from '../../../shared/pictures';
import { classifyItem, describeItem } from '../../../shared/shopping';
import { P } from '../../art/palette';
import { ShoppingPicture } from '../../art/pictures';
import { CloseGlyph, HoldButton } from '../chrome/chrome';
import { useWall } from '../context';
import { childById } from '../derive';
import type { Box } from '../home/layout';
import { Badge, BigButton } from './bits';
import { Frame, Sheet } from './Frame';
import styles from './Pantry.module.css';
import { Who } from './Who';

/**
 * TO BUY: the pantry.
 *
 * What the family needs, as pictures on a shelf. A child can ask for something by tapping its picture — that
 * puts it on the list with a little hourglass until a grown-up says yes. Nothing is ever bought from here.
 * A grown-up at the wall holds a button for two seconds to tick things off or add something.
 */

const GROWN_UP_SECONDS = 90;

export function Pantry({ origin }: { origin: Box | null }) {
  const wall = useWall();
  const { view, who } = wall;
  const child = childById(view, who);
  const [listId, setListId] = useState<string | null>(null);
  const [asking, setAsking] = useState<'child' | 'grownup' | null>(null);
  // A grown-up's turn: a counter that goes up on each thing they do, so the minute and a half starts again.
  const [grownTurn, setGrownTurn] = useState(0);
  const grown = grownTurn > 0;
  const keepGrown = () => setGrownTurn((turn) => turn + 1);
  const lists = view.lists;
  const list =
    lists.find((candidate) => candidate.id === listId) ??
    lists.find((candidate) => candidate.kind === 'groceries') ??
    lists[0];
  const items = list
    ? view.items.filter((item) => item.listId === list.id && item.status !== 'declined')
    : [];
  const needed = items.filter((item) => item.status === 'needed' || item.status === 'requested');
  const ticked = items.filter((item) => item.status === 'checked');
  const holdGate = view.household.settings.wall.holdGate;

  useEffect(() => {
    wall.tell(needed.length === 0 ? 'The basket is empty.' : 'This is what we need.', 'point');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The grown-up's minute and a half runs out by itself.
  useEffect(() => {
    if (grownTurn === 0) return;
    const timer = setTimeout(() => setGrownTurn(0), GROWN_UP_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [grownTurn]);

  const tap = (item: ShoppingItem) => {
    if (!grown || item.status === 'requested') {
      wall.tell(`${describeItem(item)}.`, 'point');
      return;
    }
    wall.sound(item.status === 'checked' ? 'back' : 'step');
    wall.ask('shopping.check', { itemId: item.id, checked: item.status !== 'checked' });
    keepGrown();
  };

  const add = (picture: ShoppingPictureId) => {
    if (!list) return;
    const text = SHOPPING_PICTURES[picture].label;
    wall.sound('step');
    wall.ask('shopping.add', {
      itemId: newId(),
      listId: list.id,
      text,
      quantity: null,
      unit: null,
      note: null,
      url: null,
      store: null,
      priority: false,
      category: classifyItem(text).category,
      picture,
      via: 'picture',
    });
    keepGrown();
  };

  return (
    <Frame tone="teal" origin={origin} testId="scene-pantry" showWho={false}>
      <div className={styles.pantry}>
        <header className={styles.top}>
          {lists.length > 1 && (
            <div className={styles.tabs} role="tablist" aria-label="Lists">
              {lists.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="tab"
                  aria-selected={candidate.id === list?.id}
                  className={styles.tab}
                  onClick={() => {
                    wall.sound('tap');
                    setListId(candidate.id);
                  }}
                >
                  <span className={styles.tabPicture}>
                    <ShoppingPicture id={candidate.kind === 'groceries' ? 'produce' : 'other'} />
                  </span>
                  {candidate.name}
                </button>
              ))}
            </div>
          )}
          <div className={styles.topButtons}>
            <BigButton
              tone="honey"
              word="Can we get…?"
              testId="ask-item"
              onTap={() => {
                wall.sound('open');
                setAsking('child');
                wall.tell(
                  child ? 'What would you like? Tap a picture.' : 'Who is asking? Tap your picture.',
                  'point',
                );
              }}
            >
              <path d="M26 46 h48 l-6 34 h-36 z" fill={P.ink} />
              <path
                d="M36 46 q14 -28 28 0"
                fill="none"
                stroke={P.ink}
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path d="M50 54 v16 M42 62 h16" stroke={P.honey} strokeWidth="6" strokeLinecap="round" />
            </BigButton>
            {holdGate &&
              (grown ? (
                <BigButton
                  tone="plain"
                  word="Add something"
                  testId="grown-add"
                  onTap={() => setAsking('grownup')}
                >
                  <path d="M50 26 v48 M26 50 h48" stroke={P.ink} strokeWidth="10" strokeLinecap="round" />
                </BigButton>
              ) : (
                <HoldButton
                  label="Grown-ups: tick things off"
                  className={styles.hold}
                  testId="grown-hold"
                  onHeld={keepGrown}
                >
                  <Badge kind="adult" />
                  <span>Grown-ups: hold to tick off</span>
                </HoldButton>
              ))}
          </div>
        </header>

        {items.length === 0 ? (
          <div className={styles.empty} data-testid="pantry-empty">
            <div className={styles.emptyPicture}>
              <ShoppingPicture id="other" />
            </div>
          </div>
        ) : (
          <ul className={styles.shelf} data-grown={grown} data-testid="pantry-items">
            {[...needed, ...ticked].map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={styles.item}
                  data-status={item.status}
                  onClick={() => tap(item)}
                  aria-label={`${describeItem(item)}${item.status === 'checked' ? ', ticked off' : item.status === 'requested' ? ', waiting for a grown-up' : ''}`}
                  aria-pressed={grown ? item.status === 'checked' : undefined}
                  data-testid={`item-${item.text}`}
                >
                  <span className={styles.itemPicture}>
                    <ShoppingPicture id={item.picture} />
                  </span>
                  <span className={styles.itemText}>{describeItem(item)}</span>
                  <span className={styles.corner}>
                    {wall.isSaving(item.id) ? (
                      <Badge kind="saving" />
                    ) : item.status === 'checked' ? (
                      <Badge kind="done" />
                    ) : item.status === 'requested' ? (
                      <Badge kind="waiting" />
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {grown && (
          <p className={styles.grownNote} role="status">
            Tap a thing to tick it off. This goes back to pictures by itself.
          </p>
        )}
      </div>

      {asking && (
        <Sheet onClose={() => setAsking(null)} testId="ask-sheet" label="Ask for something">
          {asking === 'child' && !child ? (
            <div className={styles.whoWrap}>
              <Who
                onlyIndependent={false}
                onPick={(picked) =>
                  wall.tell(`${picked.nickname}, what would you like? Tap a picture.`, 'point')
                }
              />
            </div>
          ) : (
            <div className={styles.ask}>
              <ul className={styles.choices}>
                {CHILD_REQUEST_PICTURES.map((picture) => (
                  <li key={picture}>
                    <button
                      type="button"
                      className={styles.choice}
                      onClick={() => {
                        if (asking === 'grownup') {
                          add(picture);
                        } else if (child) {
                          wall.sound('sent');
                          wall.ask('shopping.request', { itemId: newId(), profileId: child.id, picture });
                          wall.tell(
                            `I have asked for ${SHOPPING_PICTURES[picture].label.toLowerCase()}. A grown-up will have a look.`,
                            'cheer',
                          );
                        }
                        setAsking(null);
                      }}
                      aria-label={SHOPPING_PICTURES[picture].label}
                      data-testid={`choice-${picture}`}
                    >
                      <ShoppingPicture id={picture} />
                      {wall.labels && <span>{SHOPPING_PICTURES[picture].label}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <BigButton tone="soft" word="Back" onTap={() => setAsking(null)} testId="sheet-close">
                <CloseGlyph />
              </BigButton>
            </div>
          )}
        </Sheet>
      )}
    </Frame>
  );
}
