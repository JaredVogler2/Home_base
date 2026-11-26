import { useState } from 'react';
import type { HouseholdSettings } from '../../../shared/settings';
import { allTimeZones } from '../../lib/zones';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Button,
  Card,
  Field,
  Line,
  Section,
  Segmented,
  Select,
  Stack,
  Stepper,
  TextInput,
  Toggle,
  useToast,
} from '../ui/kit';

/**
 * Settings, a page for each part of the house. Every switch takes effect on the wall within a few seconds; none
 * needs a "save" button, and each says in a line what it does.
 */

type Patch = { [K in keyof HouseholdSettings]?: Partial<HouseholdSettings[K]> | HouseholdSettings[K] };

export function useSettings(): [HouseholdSettings, (patch: Patch) => void, boolean] {
  const parent = useParent();
  const guardian = parent.can('guardian');
  return [
    parent.view.household.settings,
    (patch) => {
      if (guardian) parent.tell('household.settings', { patch: patch as Record<string, unknown> });
    },
    guardian,
  ];
}

function ReadOnly() {
  return <Card tone="blue">You can look at the settings. Only a parent changes them.</Card>;
}

const minutes = (seconds: number) =>
  seconds < 60
    ? `${seconds} s`
    : seconds % 60 === 0
      ? `${seconds / 60} min`
      : `${(seconds / 60).toFixed(1)} min`;

export function WallSettings() {
  const parent = useParent();
  const [settings, set, guardian] = useSettings();
  const [guide, setGuide] = useState(settings.guideName);
  return (
    <>
      <PageHead title="The wall" onBack={() => parent.go('more')} />
      {!guardian && <ReadOnly />}

      <Section
        title="Sound and voice"
        hint="Nothing on the wall ever needs sound: every instruction is also a picture."
      >
        <Card>
          <Stack gap="s">
            <Toggle
              label="The guide speaks"
              hint="Instructions are said aloud by the wall’s own voice. Nothing a child says is ever listened to."
              checked={settings.voice.enabled}
              onChange={(enabled) => set({ voice: { enabled } })}
              testId="set-voice"
            />
            {settings.voice.enabled && (
              <Segmented
                label="How fast he speaks"
                value={settings.voice.rate < 0.86 ? 'slow' : settings.voice.rate > 1 ? 'quick' : 'steady'}
                onChange={(next) =>
                  set({ voice: { rate: next === 'slow' ? 0.78 : next === 'quick' ? 1.08 : 0.92 } })
                }
                options={[
                  { value: 'slow', label: 'Slowly' },
                  { value: 'steady', label: 'Steadily' },
                  { value: 'quick', label: 'Quicker' },
                ]}
              />
            )}
            <Toggle
              label="Little sounds"
              hint="A soft tap, a chime when something is done."
              checked={settings.sounds}
              onChange={(sounds) => set({ sounds })}
            />
          </Stack>
        </Card>
      </Section>

      <Section title="How it looks">
        <Card>
          <Stack gap="s">
            <Toggle
              label="Words under the pictures"
              hint="One word each, for a child beginning to read."
              checked={settings.labels}
              onChange={(labels) => set({ labels })}
              testId="set-labels"
            />
            <Toggle
              label="Calm mode"
              hint="Things hold still: no drifting clouds, no dancing stars, softer sounds."
              checked={settings.calm}
              onChange={(calm) => set({ calm })}
              testId="set-calm"
            />
            <Toggle
              label="Stronger contrast"
              hint="Darker words and edges, for a bright room or tired eyes."
              checked={settings.contrast === 'high'}
              onChange={(on) => set({ contrast: on ? 'high' : 'normal' })}
            />
            <Field label="The season outside the house">
              <Select
                value={settings.decor}
                onChange={(decor) => set({ decor })}
                options={[
                  { value: 'auto', label: 'Follow the calendar' },
                  { value: 'spring', label: 'Spring' },
                  { value: 'summer', label: 'Summer' },
                  { value: 'autumn', label: 'Autumn' },
                  { value: 'winter', label: 'Winter' },
                ]}
              />
            </Field>
            <Field label="The guide’s name" hint="The bluebird who lives in the day clock.">
              <Line>
                <div style={{ flex: 1 }}>
                  <TextInput
                    value={guide}
                    onChange={(event) => setGuide(event.target.value)}
                    maxLength={20}
                  />
                </div>
                <Button
                  disabled={!guardian || guide.trim() === '' || guide.trim() === settings.guideName}
                  onClick={() => set({ guideName: guide.trim() })}
                >
                  Rename
                </Button>
              </Line>
            </Field>
          </Stack>
        </Card>
      </Section>

      <Section title="Quiet hours" hint="For evenings and nights: the wall dims, makes no sound and rests.">
        <Card>
          <Stack gap="s">
            <Toggle
              label="Keep quiet hours"
              checked={settings.quietHours.enabled}
              onChange={(enabled) => set({ quietHours: { enabled } })}
            />
            {settings.quietHours.enabled && (
              <>
                <Line>
                  <Field label="From">
                    <TextInput
                      type="time"
                      value={settings.quietHours.start}
                      onChange={(event) =>
                        event.target.value && set({ quietHours: { start: event.target.value } })
                      }
                    />
                  </Field>
                  <Field label="Until">
                    <TextInput
                      type="time"
                      value={settings.quietHours.end}
                      onChange={(event) =>
                        event.target.value && set({ quietHours: { end: event.target.value } })
                      }
                    />
                  </Field>
                </Line>
                <Toggle
                  label="Dim the picture"
                  checked={settings.quietHours.dim}
                  onChange={(dim) => set({ quietHours: { dim } })}
                />
              </>
            )}
          </Stack>
        </Card>
      </Section>

      <Section title="When nobody is there">
        <Card>
          <Stack>
            <Stepper
              label="Go back to the house after"
              value={settings.wall.idleHomeSeconds}
              min={30}
              max={600}
              step={30}
              onChange={(idleHomeSeconds) => set({ wall: { idleHomeSeconds } })}
              show={minutes}
            />
            <Stepper
              label="Start the photos after"
              value={settings.wall.slideshowAfterMinutes}
              min={0}
              max={60}
              step={5}
              onChange={(slideshowAfterMinutes) => set({ wall: { slideshowAfterMinutes } })}
              show={(value) => (value === 0 ? 'never' : `${value} min`)}
            />
          </Stack>
        </Card>
      </Section>

      <Section title="Grown-ups at the wall">
        <Card>
          <Stack>
            <Stepper
              label="Lock the grown-ups’ window after"
              value={settings.wall.relockSeconds}
              min={30}
              max={600}
              step={30}
              onChange={(relockSeconds) => set({ wall: { relockSeconds } })}
              show={minutes}
            />
            <Toggle
              label="Everyday things with a long press"
              hint="Ticking the shopping list and “we did that together” need a two-second press, not a PIN. A long press is not a lock: nothing about stars or settings is behind it."
              checked={settings.wall.holdGate}
              onChange={(holdGate) => set({ wall: { holdGate } })}
            />
          </Stack>
        </Card>
      </Section>
    </>
  );
}

export function RuleSettings() {
  const parent = useParent();
  const toast = useToast();
  const [settings, set, guardian] = useSettings();
  const today = parent.view.today;
  const [from, setFrom] = useState(settings.vacation?.from ?? today);
  const [to, setTo] = useState(settings.vacation?.to ?? today);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (
    <>
      <PageHead title="Stars and missions" onBack={() => parent.go('more')} />
      {!guardian && <ReadOnly />}

      <Section title="Missions">
        <Card>
          <Stack>
            <Stepper
              label="Missions shown at once"
              value={settings.quest.showAtOnce}
              min={1}
              max={8}
              onChange={(showAtOnce) => set({ quest: { showAtOnce } })}
            />
            <Stepper
              label="“Oops, not yet” is offered for"
              value={settings.quest.undoSeconds}
              min={0}
              max={600}
              step={30}
              onChange={(undoSeconds) => set({ quest: { undoSeconds } })}
              show={(value) => (value === 0 ? 'not offered' : minutes(value))}
            />
            <Toggle
              label="A daily limit on stars without a look"
              hint="Past the limit, missions that would pay straight away wait for a grown-up instead."
              checked={settings.quest.dailyAutoCreditCap !== null}
              onChange={(on) => set({ quest: { dailyAutoCreditCap: on ? 10 : null } })}
            />
            {settings.quest.dailyAutoCreditCap !== null && (
              <Stepper
                label="Stars a day without a look"
                value={settings.quest.dailyAutoCreditCap}
                min={1}
                max={50}
                onChange={(dailyAutoCreditCap) => set({ quest: { dailyAutoCreditCap } })}
              />
            )}
          </Stack>
        </Card>
      </Section>

      <Section
        title="Stars"
        hint="Stars are not money. Every star ever earned stays in “earned in all”, whatever is spent."
      >
        <Card>
          <Stack>
            <Stepper
              label="Stars to spend for each star earned"
              value={settings.bank.spendRatePercent}
              min={0}
              max={300}
              step={25}
              onChange={(spendRatePercent) => set({ bank: { spendRatePercent } })}
              show={(value) => (value === 100 ? 'one for one' : `${value / 100} for one`)}
            />
            <Toggle
              label="Weekly stars"
              hint="A gift each week that is not tied to any task."
              checked={settings.bank.allowance.enabled}
              onChange={(enabled) =>
                set({
                  bank: {
                    allowance: {
                      ...settings.bank.allowance,
                      enabled,
                      stars: settings.bank.allowance.stars || 3,
                    },
                  },
                })
              }
            />
            {settings.bank.allowance.enabled && (
              <>
                <Stepper
                  label="How many"
                  value={settings.bank.allowance.stars}
                  min={1}
                  max={50}
                  onChange={(stars) => set({ bank: { allowance: { ...settings.bank.allowance, stars } } })}
                />
                <Field label="On">
                  <Select
                    value={String(settings.bank.allowance.weekday)}
                    onChange={(weekday) =>
                      set({ bank: { allowance: { ...settings.bank.allowance, weekday: Number(weekday) } } })
                    }
                    options={days.map((label, index) => ({ value: String(index), label }))}
                  />
                </Field>
              </>
            )}
          </Stack>
        </Card>
      </Section>

      <Section title="Routines">
        <Card>
          <Stack>
            <Toggle
              label="Stars for finishing a routine"
              hint="Off by default: getting dressed and brushing teeth are part of the day, not something to be paid for."
              checked={settings.routines.awardStars}
              onChange={(awardStars) => set({ routines: { awardStars } })}
            />
            {settings.routines.awardStars && (
              <Stepper
                label="How many"
                value={settings.routines.stars}
                min={1}
                max={10}
                onChange={(stars) => set({ routines: { stars } })}
              />
            )}
          </Stack>
        </Card>
      </Section>

      <Section
        title="Holiday mode"
        hint="While away, no missions or routines are handed out and nothing counts as missed."
      >
        <Card tone={settings.vacation ? 'blue' : undefined}>
          <Stack>
            <Line>
              <Field label="From">
                <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
              <Field label="Until">
                <TextInput
                  type="date"
                  value={to}
                  min={from}
                  onChange={(event) => setTo(event.target.value)}
                />
              </Field>
            </Line>
            <Line>
              <Button
                tone="primary"
                disabled={!guardian || !from || !to || to < from}
                onClick={() => {
                  set({ vacation: { from, to } });
                  toast('Holiday mode is set.');
                }}
              >
                {settings.vacation ? 'Change the dates' : 'Set holiday mode'}
              </Button>
              {settings.vacation && (
                <Button
                  onClick={() => {
                    parent.tell('household.settings', { patch: { vacation: null } });
                    toast('Holiday mode is off.');
                  }}
                >
                  Switch it off
                </Button>
              )}
            </Line>
          </Stack>
        </Card>
      </Section>

      <Section title="The week">
        <Card>
          <Segmented
            label="Weeks begin on"
            value={settings.weekStart}
            onChange={(weekStart) => set({ weekStart })}
            options={[
              { value: 0, label: 'Sunday' },
              { value: 1, label: 'Monday' },
            ]}
          />
        </Card>
      </Section>
    </>
  );
}

export function HouseholdPage() {
  const parent = useParent();
  const toast = useToast();
  const { view } = parent;
  const guardian = parent.can('guardian');
  const [name, setName] = useState(view.household.name);
  const [timeZone, setTimeZone] = useState(view.household.timeZone);
  const [busy, setBusy] = useState(false);
  const zones = allTimeZones();
  return (
    <>
      <PageHead title="The household" onBack={() => parent.go('more')} />
      {!guardian && <ReadOnly />}
      <Card>
        <Stack>
          <Field label="Its name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
          </Field>
          <Field label="Where you are" hint="Decides when “today” begins and ends, and when bedtime is.">
            {zones.length > 0 ? (
              <Select
                value={timeZone}
                onChange={setTimeZone}
                options={[...new Set([timeZone, ...zones])].map((zone) => ({
                  value: zone,
                  label: zone.replace(/_/g, ' '),
                }))}
              />
            ) : (
              <TextInput value={timeZone} onChange={(event) => setTimeZone(event.target.value)} />
            )}
          </Field>
          <Button
            tone="primary"
            busy={busy}
            disabled={
              !guardian ||
              name.trim() === '' ||
              (name === view.household.name && timeZone === view.household.timeZone)
            }
            onClick={async () => {
              setBusy(true);
              const ok = await parent.ask('household.rename', { name, timeZone });
              setBusy(false);
              if (ok) toast('Saved.');
            }}
          >
            Save
          </Button>
        </Stack>
      </Card>
    </>
  );
}
