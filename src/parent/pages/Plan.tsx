import { useState } from 'react';
import type { Reward, Routine, TaskTemplate } from '../../../shared/model';
import { describeSchedule } from '../../../shared/schedule';
import { ActionPicture, RewardPicture } from '../../art/pictures';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import { Badge, Button, Card, Empty, Glyph, Row, Rows, Section, Segmented, StarCount } from '../ui/kit';
import { MissionEditor, MissionIdeas, type MissionSeed } from './MissionEditor';
import { RewardEditor } from './RewardEditor';
import { RoutineEditor } from './RoutineEditor';

/**
 * The plan: what the wall hands out. Missions (things to do, some earning stars), routines (steps in order),
 * and rewards (things to save for). Only a parent changes these; a helper can look.
 */

type Tab = 'missions' | 'routines' | 'rewards';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Plan({ rest }: { rest: string[] }) {
  const parent = useParent();
  const { view } = parent;
  const tab: Tab = rest[0] === 'routines' || rest[0] === 'rewards' ? rest[0] : 'missions';
  const guardian = parent.can('guardian');
  const [mission, setMission] = useState<TaskTemplate | 'new' | null>(null);
  const [seed, setSeed] = useState<MissionSeed | undefined>(undefined);
  const [ideas, setIdeas] = useState(false);
  const [routine, setRoutine] = useState<Routine | 'new' | null>(null);
  const [reward, setReward] = useState<Reward | 'new' | null>(null);
  const [showOld, setShowOld] = useState(false);

  const who = (ids: string[], everyone = 'Every child') =>
    ids.length === 0
      ? everyone
      : ids
          .map((id) => view.profiles.find((profile) => profile.id === id)?.nickname)
          .filter(Boolean)
          .join(', ');

  const templates = [...(view.templates ?? [])].sort((a, b) => a.sort - b.sort);
  const live = templates.filter((template) => template.status !== 'archived');
  const old = templates.filter((template) => template.status === 'archived');
  const routines = [...view.routines].sort((a, b) => a.sort - b.sort);
  const rewards = [...view.rewards].sort((a, b) => a.sort - b.sort);

  const missionRow = (template: TaskTemplate) => (
    <Row
      key={template.id}
      picture={<ActionPicture id={template.picture} />}
      title={template.title}
      detail={`${describeSchedule(template.schedule)} · ${template.shared ? 'The family' : who(template.assignees)}`}
      after={
        <>
          {template.status === 'paused' && <Badge>Resting</Badge>}
          {template.status === 'archived' && <Badge>Put away</Badge>}
          {template.stars > 0 && <StarCount n={template.stars} />}
        </>
      }
      onClick={guardian ? () => setMission(template) : undefined}
      testId={`template-${template.title}`}
    />
  );

  return (
    <>
      <PageHead title="Plan" />
      <Segmented
        label="What to plan"
        value={tab}
        onChange={(next) => parent.go('plan', next)}
        testId="plan-tabs"
        options={[
          { value: 'missions', label: 'Missions' },
          { value: 'routines', label: 'Routines' },
          { value: 'rewards', label: 'Rewards' },
        ]}
      />
      {!guardian && <Card tone="blue">You can look at the plan. Only a parent changes it.</Card>}

      {tab === 'missions' && (
        <>
          {guardian && (
            <Button tone="primary" full onClick={() => setIdeas(true)} testId="new-mission">
              {Glyph.plus} New mission
            </Button>
          )}
          {live.length === 0 ? (
            <Card>
              <Empty picture={<ActionPicture id="tidy" />} title="No missions yet">
                <p>A mission is one small thing to do, shown as a picture on the wall.</p>
              </Empty>
            </Card>
          ) : (
            <>
              <Section title="Part of the day">
                <Rows>{live.filter((template) => template.kind === 'core').map(missionRow)}</Rows>
              </Section>
              {live.some((template) => template.kind === 'bonus') && (
                <Section title="Extras to choose">
                  <Rows>{live.filter((template) => template.kind === 'bonus').map(missionRow)}</Rows>
                </Section>
              )}
            </>
          )}
          {old.length > 0 && (
            <Section
              title="Put away"
              action={
                <Button size="s" tone="quiet" onClick={() => setShowOld(!showOld)}>
                  {showOld ? 'Hide' : `Show ${old.length}`}
                </Button>
              }
            >
              {showOld && <Rows>{old.map(missionRow)}</Rows>}
            </Section>
          )}
        </>
      )}

      {tab === 'routines' && (
        <>
          {guardian && (
            <Button tone="primary" full onClick={() => setRoutine('new')} testId="new-routine">
              {Glyph.plus} New routine
            </Button>
          )}
          {routines.length === 0 ? (
            <Card>
              <Empty picture={<ActionPicture id="wake" />} title="No routines yet">
                <p>A routine is a few steps in order: first this, then that.</p>
              </Empty>
            </Card>
          ) : (
            <Rows>
              {routines.map((item) => (
                <Row
                  key={item.id}
                  picture={<ActionPicture id={item.picture} />}
                  title={item.title}
                  detail={`${item.steps.length} steps · ${
                    item.days.length === 7 ? 'every day' : item.days.map((day) => DAYS[day]).join(', ')
                  }${item.start && item.end ? ` · ${item.start}–${item.end}` : ''} · ${who(item.assignees)}`}
                  after={
                    item.status === 'paused' ? (
                      <Badge>Resting</Badge>
                    ) : item.status === 'archived' ? (
                      <Badge>Put away</Badge>
                    ) : undefined
                  }
                  onClick={guardian ? () => setRoutine(item) : undefined}
                  testId={`routine-${item.title}`}
                />
              ))}
            </Rows>
          )}
        </>
      )}

      {tab === 'rewards' && (
        <>
          {guardian && (
            <Button tone="primary" full onClick={() => setReward('new')} testId="new-reward">
              {Glyph.plus} New reward
            </Button>
          )}
          <Card tone="rose">
            Rewards are extras: a game, a story, an outing. Food, rest, comfort and time together are never
            something to earn.
          </Card>
          {rewards.length === 0 ? (
            <Card>
              <Empty picture={<RewardPicture id="game" />} title="No rewards yet" />
            </Card>
          ) : (
            <Rows>
              {rewards.map((item) => (
                <Row
                  key={item.id}
                  picture={<RewardPicture id={item.picture} />}
                  title={item.title}
                  detail={`${who(item.profiles)}${item.stock !== null ? ` · ${item.stock} left` : ''}`}
                  after={
                    <>
                      {item.status === 'paused' && <Badge>Resting</Badge>}
                      {item.status === 'archived' && <Badge>Put away</Badge>}
                      <StarCount n={item.price} />
                    </>
                  }
                  onClick={guardian ? () => setReward(item) : undefined}
                  testId={`reward-${item.title}`}
                />
              ))}
            </Rows>
          )}
        </>
      )}

      {ideas && (
        <MissionIdeas
          onClose={() => setIdeas(false)}
          onPick={(picked) => {
            setSeed(picked);
            setIdeas(false);
            setMission('new');
          }}
        />
      )}
      {mission && (
        <MissionEditor
          template={mission === 'new' ? null : mission}
          seed={mission === 'new' ? seed : undefined}
          onClose={() => setMission(null)}
        />
      )}
      {routine && (
        <RoutineEditor routine={routine === 'new' ? null : routine} onClose={() => setRoutine(null)} />
      )}
      {reward && <RewardEditor reward={reward === 'new' ? null : reward} onClose={() => setReward(null)} />}
    </>
  );
}
