import { lazy, Suspense, type ReactNode } from 'react';
import { ActionPicture, Avatar, DayPicture, RewardPicture, ShoppingPicture } from '../../art/pictures';
import { store } from '../../sync/store';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import { Badge, Button, Glyph, Row, Rows, Section } from '../ui/kit';
import { Children } from './Children';

const GrownUps = lazy(() => import('./GrownUps').then((module) => ({ default: module.GrownUps })));
const Screens = lazy(() => import('./Screens').then((module) => ({ default: module.Screens })));
const CalendarDays = lazy(() =>
  import('./CalendarDays').then((module) => ({ default: module.CalendarDays })),
);
const AcademyPage = lazy(() => import('./AcademyPage').then((module) => ({ default: module.AcademyPage })));
const Sky = lazy(() => import('./Sky').then((module) => ({ default: module.Sky })));
const Photos = lazy(() => import('./Photos').then((module) => ({ default: module.Photos })));
const Shortcuts = lazy(() => import('./Shortcuts').then((module) => ({ default: module.Shortcuts })));
const Records = lazy(() => import('./Records').then((module) => ({ default: module.Records })));
const Helper = lazy(() => import('./Helper').then((module) => ({ default: module.Helper })));
const Connections = lazy(() => import('./Connections').then((module) => ({ default: module.Connections })));
const WallSettings = lazy(() => import('./Settings').then((module) => ({ default: module.WallSettings })));
const RuleSettings = lazy(() => import('./Settings').then((module) => ({ default: module.RuleSettings })));
const HouseholdPage = lazy(() => import('./Settings').then((module) => ({ default: module.HouseholdPage })));

/**
 * Family: who is in the household, the screens it has, and how everything is set. Each line is one small page.
 */
export function More({ rest }: { rest: string[] }) {
  const parent = useParent();
  const { view, me } = parent;
  const page = rest[0];

  let inner: ReactNode = null;
  if (page === 'children') inner = <Children />;
  else if (page === 'grownups') inner = <GrownUps />;
  else if (page === 'screens') inner = <Screens code={rest[1] ?? ''} />;
  else if (page === 'wall') inner = <WallSettings />;
  else if (page === 'rules') inner = <RuleSettings />;
  else if (page === 'household') inner = <HouseholdPage />;
  else if (page === 'sky') inner = <Sky />;
  else if (page === 'calendar') inner = <CalendarDays />;
  else if (page === 'academy') inner = <AcademyPage />;
  else if (page === 'photos') inner = <Photos />;
  else if (page === 'shortcuts') inner = <Shortcuts />;
  else if (page === 'records') inner = <Records />;
  else if (page === 'helper') inner = <Helper />;
  else if (page === 'connections') inner = <Connections />;
  if (inner) return <Suspense fallback={null}>{inner}</Suspense>;

  const settings = view.household.settings;
  const children = view.profiles.filter((profile) => !profile.archived);
  const screens = (view.devices ?? []).filter((device) => !device.revoked);
  const arrow = <span style={{ color: 'var(--ink-faint)', display: 'grid' }}>{Glyph.next}</span>;
  const line = (
    to: string,
    title: string,
    detail: ReactNode,
    picture: ReactNode,
    extra?: ReactNode,
    round = false,
  ) => (
    <Row
      key={to}
      picture={picture}
      round={round}
      title={title}
      detail={detail}
      after={
        <>
          {extra}
          {arrow}
        </>
      }
      onClick={() => parent.go('more', to)}
      testId={`more-${to}`}
    />
  );

  return (
    <>
      <PageHead title="Family" />
      <Section title="The household">
        <Rows>
          {line(
            'children',
            'Children',
            children.length === 0 ? 'Nobody yet' : children.map((child) => child.nickname).join(', '),
            <Avatar id={children[0]?.avatar ?? 'fox'} />,
            undefined,
            true,
          )}
          {line(
            'grownups',
            'Grown-ups',
            view.members.map((member) => member.displayName).join(', '),
            <Avatar id={me?.avatar ?? 'owl'} />,
            me && !me.hasPin ? <Badge tone="honey">Set a PIN</Badge> : undefined,
            true,
          )}
          {line(
            'screens',
            'Screens',
            screens.length === 0 ? 'No wall yet' : screens.map((device) => device.name).join(', '),
            <DayPicture id="homeday" />,
            screens.length === 0 ? <Badge tone="honey">Add one</Badge> : undefined,
          )}
          {line(
            'household',
            'Name and time zone',
            `${view.household.name} · ${view.household.timeZone.replace(/_/g, ' ')}`,
            <DayPicture id="visitor" />,
          )}
        </Rows>
      </Section>

      <Section title="The wall">
        <Rows>
          {line(
            'wall',
            'Sound, looks and quiet hours',
            [
              settings.voice.enabled ? 'speaks' : 'silent',
              settings.calm ? 'calm' : null,
              settings.quietHours.enabled
                ? `quiet ${settings.quietHours.start}–${settings.quietHours.end}`
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
            <ActionPicture id="music" />,
          )}
          {line(
            'rules',
            'Stars and missions',
            settings.vacation
              ? `Holiday until ${settings.vacation.to}`
              : 'Limits, weekly stars, holiday mode',
            <RewardPicture id="stickers" />,
            settings.vacation ? <Badge tone="blue">Holiday</Badge> : undefined,
          )}
          {line(
            'calendar',
            'Kinds of day',
            'School, a visitor, a birthday: pictures for the children’s calendar',
            <DayPicture id="school" />,
          )}
          {line(
            'photos',
            'Photos',
            settings.memories.hidden ? 'Hidden for now' : `${view.media.length} in the slideshow`,
            <RewardPicture id="picnic" />,
          )}
          {line(
            'sky',
            'Sky and weather',
            settings.location
              ? settings.sky.weather
                ? 'Real sun, moon and weather'
                : 'Real sun and moon'
              : 'By the clock',
            <ActionPicture id="wake" />,
          )}
          {line(
            'academy',
            'Training Academy',
            settings.academy.enabled ? 'The boat sails' : 'The boat is resting',
            <DayPicture id="lesson" />,
          )}
        </Rows>
      </Section>

      <Section title="More">
        <Rows>
          {line(
            'shortcuts',
            'Siri and Shortcuts',
            '“Add milk to the shopping list”',
            <ShoppingPicture id="milk" />,
          )}
          {line(
            'helper',
            'The planning helper',
            settings.ai.enabled ? 'On' : 'Off: everything works without it',
            <ActionPicture id="drawing" />,
          )}
          {parent.can('guardian') &&
            line(
              'connections',
              'Connections',
              'Weather, helper, Academy, Siri and screens: how each is doing',
              <ActionPicture id="plant" />,
            )}
          {line(
            'records',
            'Records, export and deleting',
            'What is kept, for how long, and how to take it away',
            <ActionPicture id="books" />,
          )}
        </Rows>
      </Section>

      <Button onClick={() => void store.signOut().then(() => parent.go('today'))} testId="sign-out-main">
        Sign out of this phone
      </Button>
    </>
  );
}
