import { useMemo } from 'react';
import { weekdayOf } from '../../../shared/time';
import { Backdrop, Boat } from '../../art/house/Backdrop';
import {
  BankRoom,
  CalendarRoom,
  ClockRoom,
  MemoriesRoom,
  PantryRoom,
  QuestRoom,
} from '../../art/house/rooms';
import '../../art/house/house.css';
import { Face, Guide, KeyGlyph, Label, RoundButton, SpeakerGlyph } from '../chrome/chrome';
import { useWall, type Scene } from '../context';
import { basketOf, boardOf, childrenOf, clockOf, starsOf, waitingRedemptions } from '../derive';
import type { SkyLook } from '../sky';
import styles from './Home.module.css';
import { place, type Box, type RoomId } from './layout';

/**
 * HOME: the house.
 *
 * Each room is one whole button, and its picture is its news. Children's rooms are on the ground floor, within
 * reach; the family's are upstairs; the grown-ups' door is the attic window, which a small child cannot reach.
 * Along the path at the bottom are the family's faces: tap yours and the house becomes yours — your missions on
 * the board, your stars on the tray.
 */

const SCENE_OF: Record<RoomId, Scene> = {
  memories: 'memories',
  calendar: 'calendar',
  quest: 'quest',
  routines: 'routines',
  bank: 'bank',
  pantry: 'pantry',
};

const WORD: Record<RoomId | 'academy', string> = {
  memories: 'Photos',
  calendar: 'Calendar',
  quest: 'Missions',
  routines: 'My day',
  bank: 'Stars',
  pantry: 'To buy',
  academy: 'Academy',
};

export function Home({ look }: { look: SkyLook }) {
  const wall = useWall();
  const { view, layout, who, nowMs, minutes } = wall;
  const children = childrenOf(view);
  const board = useMemo(() => boardOf(view, who, nowMs), [view, who, nowMs]);
  const clock = clockOf(view, who, minutes);
  const basket = basketOf(view);
  const stars = starsOf(view, who);
  const waiting = waitingRedemptions(view, who).length > 0;
  const todays = view.calendar.find((day) => day.date === view.today)?.labels ?? [];
  const photos = view.media.slice(0, 3).map((item) => `/api/media/${item.id}/${item.widths[0] ?? 480}`);
  const academy = view.household.settings.academy;
  const resting = !academy.enabled || !academy.url;
  const guideName = view.household.settings.guideName;

  const open = (room: RoomId) => {
    wall.sound('open');
    wall.go(SCENE_OF[room], layout.rooms[room]);
  };

  const faces = layout.faces;
  const span = children.length * faces.size + Math.max(0, children.length - 1) * faces.gap;
  const faceBox = (index: number): Box => ({
    x: faces.cx - span / 2 + index * (faces.size + faces.gap),
    y: faces.cy - faces.size / 2,
    w: faces.size,
    h: faces.size,
  });

  return (
    <div className={styles.home} data-testid="scene-home">
      <Backdrop layout={layout} look={look} />

      <div className={styles.rooms} style={{ opacity: 'var(--dim, 1)' }}>
        <button
          type="button"
          className={styles.room}
          style={place(layout, layout.rooms.memories)}
          onClick={() => open('memories')}
          data-testid="room-memories"
        >
          <MemoriesRoom photos={photos} />
        </button>
        <button
          type="button"
          className={styles.room}
          style={place(layout, layout.rooms.calendar)}
          onClick={() => open('calendar')}
          data-testid="room-calendar"
        >
          <CalendarRoom
            weekday={weekdayOf(view.today)}
            weekStart={view.household.settings.weekStart}
            labels={todays}
          />
        </button>
        <button
          type="button"
          className={styles.room}
          style={place(layout, layout.rooms.quest)}
          onClick={() => open('quest')}
          data-testid="room-quest"
        >
          <QuestRoom cards={board.cards} done={board.done} total={board.total} />
        </button>
        <button
          type="button"
          className={styles.room}
          style={place(layout, layout.rooms.routines)}
          onClick={() => open('routines')}
          data-testid="room-routines"
        >
          <ClockRoom turn={minutes / 1440} next={clock.next} running={clock.running} />
        </button>
        <button
          type="button"
          className={styles.room}
          style={place(layout, layout.rooms.bank)}
          onClick={() => open('bank')}
          data-testid="room-bank"
        >
          <BankRoom stars={stars} waiting={waiting} />
        </button>
        <button
          type="button"
          className={styles.room}
          style={place(layout, layout.rooms.pantry)}
          onClick={() => open('pantry')}
          data-testid="room-pantry"
        >
          <PantryRoom pictures={basket.pictures} count={basket.count} asked={basket.asked} />
        </button>
      </div>
      {/* lamplight over the rooms at night: one flat wash, no blending modes */}
      <div
        className={styles.lamplight}
        style={place(layout, {
          x: layout.frame.x + 16,
          y: layout.frame.y + 16,
          w: layout.frame.w - 32,
          h: layout.frame.h - 56,
        })}
        aria-hidden="true"
      />

      <button
        type="button"
        className={styles.boat}
        style={place(layout, layout.boat)}
        onClick={() => {
          wall.sound('open');
          wall.go('academy', layout.boat);
        }}
        aria-label={resting ? 'The Academy boat. It is resting.' : 'The boat to the Training Academy.'}
        data-testid="room-academy"
      >
        <Boat resting={resting} />
      </button>

      {/* The grown-ups' door: high up, small, and behind a PIN. */}
      <button
        type="button"
        className={styles.attic}
        style={place(layout, {
          x: layout.attic.cx - layout.attic.r,
          y: layout.attic.cy - layout.attic.r,
          w: layout.attic.r * 2,
          h: layout.attic.r * 2,
        })}
        onClick={() => wall.go('grownups')}
        aria-label="Grown-ups"
        data-testid="room-grownups"
      >
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <KeyGlyph />
        </svg>
      </button>

      {wall.labels && (
        <>
          {(Object.keys(WORD) as (RoomId | 'academy')[]).map((key) => (
            <Label
              key={key}
              style={{
                left: `${(layout.labels[key].cx / layout.sheet.w) * 100}%`,
                top: `${(layout.labels[key].cy / layout.sheet.h) * 100}%`,
              }}
            >
              {WORD[key]}
            </Label>
          ))}
        </>
      )}

      <div className={styles.faces} role="group" aria-label="Who is playing?">
        {children.map((child, index) => (
          <Face
            key={child.id}
            profile={child}
            active={who === child.id}
            style={{ position: 'absolute', ...place(layout, faceBox(index)) }}
            onTap={() => {
              wall.sound('tap');
              if (who === child.id) {
                wall.setWho(null);
                wall.tell('Who is playing?', 'wave');
              } else {
                wall.setWho(child.id);
                wall.tell(
                  child.independent ? `Hello, ${child.nickname}!` : `Hello, little ${child.nickname}!`,
                  'wave',
                );
              }
            }}
          />
        ))}
      </div>

      <Guide
        name={guideName}
        words={wall.said.words}
        pose={wall.said.pose}
        style={place(layout, layout.guide)}
        side={layout.shape === 'tall' ? 'above' : 'left'}
        onTap={() => {
          wall.sound('chirp');
          wall.tell(wall.said.words || `Hello! I am ${guideName}.`, 'wave');
        }}
      />
      <RoundButton
        label="Say it again"
        style={{ position: 'absolute', ...place(layout, layout.sayAgain) }}
        onTap={() => wall.tell(wall.said.words || `Hello! I am ${guideName}.`, 'wave')}
        testId="say-again"
      >
        <SpeakerGlyph />
      </RoundButton>
    </div>
  );
}
