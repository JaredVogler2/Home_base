import { useState } from 'react';
import type { Device } from '../../../shared/model';
import { api, ApiError } from '../../sync/api';
import { store } from '../../sync/store';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  Empty,
  Field,
  Row,
  Rows,
  Section,
  Segmented,
  Sheet,
  Stack,
  TextInput,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';

/**
 * The screens of the house: the wall, and any tablet a child uses. A screen is never given a password. It shows
 * a code; a parent, signed in on their own phone, types or scans it here; and the screen can be switched off
 * from here again at any time.
 */

function ago(iso: string | null, now: number): string {
  if (!iso) return 'not seen yet';
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 3) return 'on now';
  if (minutes < 90) return `seen ${minutes} minutes ago`;
  if (minutes < 60 * 36) return `seen ${Math.round(minutes / 60)} hours ago`;
  return `seen ${Math.round(minutes / 1440)} days ago`;
}

export function Screens({ code = '' }: { code?: string }) {
  const parent = useParent();
  const toast = useToast();
  const { view } = parent;
  const guardian = parent.can('guardian');
  const [typed, setTyped] = useState(code);
  const [name, setName] = useState('Kitchen wall');
  const [kind, setKind] = useState<'wall' | 'tablet'>('wall');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [rename, setRename] = useState('');
  const now = new Date(view.serverTime).getTime();
  const devices = (view.devices ?? []).filter((device) => !device.revoked);
  const gone = (view.devices ?? []).filter((device) => device.revoked);

  const claim = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api('POST', '/pair/claim', { code: typed, name, kind });
      setDone(true);
      setTyped('');
      await store.sync();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That did not work. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Screens" onBack={() => parent.go('more')} />
      {guardian && (
        <Section
          title="Add a screen"
          hint="On the screen itself, open HOMEBASE: it shows a code and a square to scan."
        >
          <Card tone={done ? 'sage' : undefined}>
            {done ? (
              <Stack gap="s">
                <p>
                  <strong>Done.</strong> The screen will come to life in a few seconds.
                </p>
                <Button onClick={() => setDone(false)}>Add another</Button>
              </Stack>
            ) : (
              <Stack>
                {problem && (
                  <p className={styles.warning} role="alert">
                    {problem}
                  </p>
                )}
                <Field label="The code on the screen">
                  <TextInput
                    value={typed}
                    onChange={(event) => setTyped(event.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    autoComplete="off"
                    maxLength={12}
                    placeholder="ABCD-EFGH"
                    testId="pair-code-input"
                  />
                </Field>
                <Field label="What to call it">
                  <TextInput
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={40}
                    testId="pair-name"
                  />
                </Field>
                <Segmented
                  label="What it is"
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: 'wall', label: 'The wall display' },
                    { value: 'tablet', label: 'A child’s tablet' },
                  ]}
                />
                <Button
                  tone="primary"
                  busy={busy}
                  disabled={typed.replace(/[^A-Z0-9]/gi, '').length < 6 || name.trim() === ''}
                  onClick={() => void claim()}
                  testId="pair-claim"
                >
                  This screen is ours
                </Button>
              </Stack>
            )}
          </Card>
        </Section>
      )}

      <Section title="Your screens">
        {devices.length === 0 ? (
          <Card>
            <Empty title="No screens yet" />
          </Card>
        ) : (
          <Rows>
            {devices.map((device) => (
              <Row
                key={device.id}
                title={device.name}
                detail={`${device.kind === 'wall' ? 'Wall display' : 'Tablet'} · ${ago(device.lastSeenAt, now)}`}
                after={ago(device.lastSeenAt, now) === 'on now' ? <Badge tone="sage">On</Badge> : undefined}
                onClick={
                  guardian
                    ? () => {
                        setEditing(device);
                        setRename(device.name);
                      }
                    : undefined
                }
                testId={`device-${device.name}`}
              />
            ))}
          </Rows>
        )}
        {gone.length > 0 && (
          <p className={styles.itemNote}>Switched off: {gone.map((device) => device.name).join(', ')}.</p>
        )}
      </Section>

      {editing && (
        <Sheet
          title={editing.name}
          onClose={() => setEditing(null)}
          footer={
            <>
              <ConfirmButton
                label="Switch this screen off"
                confirmLabel="Switch it off"
                testId="revoke-device"
                onConfirm={() => {
                  parent.tell('device.revoke', { deviceId: editing.id });
                  toast(`${editing.name} is switched off. It shows a new code if it is opened again.`);
                  setEditing(null);
                }}
              />
              <Button
                tone="primary"
                disabled={rename.trim() === '' || rename === editing.name}
                onClick={() => {
                  parent.tell('device.rename', { deviceId: editing.id, name: rename.trim() });
                  setEditing(null);
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <Field label="Name">
            <TextInput value={rename} onChange={(event) => setRename(event.target.value)} maxLength={40} />
          </Field>
          <p className={styles.itemNote}>
            Switching a screen off signs it out at once and clears what it had kept of the family. Do this if
            a tablet is lost, sold or lent.
          </p>
        </Sheet>
      )}
    </>
  );
}
