import { useCallback, useEffect, useState } from 'react';
import type { Member } from '../../../shared/model';
import type { AvatarId } from '../../../shared/pictures';
import { Avatar } from '../../art/pictures';
import { Qr } from '../../art/Qr';
import { copyText } from '../../app/clipboard';
import { api, ApiError } from '../../sync/api';
import { store } from '../../sync/store';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  Field,
  kit,
  Line,
  PicturePicker,
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
 * The grown-ups of the household: who they are, how another joins, and each one's own way in — a password for
 * their phone and a PIN for the wall. HOMEBASE sends no e-mail, so an invitation is a code to pass on yourself.
 */

const ROLE_WORDS: Record<Member['role'], string> = {
  owner: 'Parent (owner)',
  guardian: 'Parent',
  caregiver: 'Helper',
};

interface Invite {
  id: string;
  kind: string;
  role: string;
  expiresAt: string;
}

function wordsOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Nothing was changed.';
}

export function GrownUps() {
  const parent = useParent();
  const toast = useToast();
  const { view, me } = parent;
  const owner = parent.can('owner');
  const guardian = parent.can('guardian');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [made, setMade] = useState<{ code: string; what: 'join' | 'reset'; who?: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [role, setRole] = useState<'guardian' | 'caregiver'>('guardian');
  const [account, setAccount] = useState(false);
  const [member, setMember] = useState<Member | null>(null);

  const load = useCallback(() => {
    if (!guardian) return;
    api<{ invites: Invite[] }>('GET', '/auth/invites')
      .then((reply) => setInvites(reply.invites))
      .catch(() => undefined);
  }, [guardian]);
  useEffect(() => {
    let current = true;
    if (guardian)
      api<{ invites: Invite[] }>('GET', '/auth/invites')
        .then((reply) => {
          if (current) setInvites(reply.invites);
        })
        .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [guardian, view.rev]);

  const link = made ? `${window.location.origin}/${made.what}?code=${encodeURIComponent(made.code)}` : '';

  return (
    <>
      <PageHead title="Grown-ups" onBack={() => parent.go('more')} />
      <Rows>
        {view.members.map((person) => (
          <Row
            key={person.userId}
            round
            picture={<Avatar id={person.avatar} />}
            title={
              <>
                {person.displayName}
                {person.userId === me?.userId ? ' (you)' : ''}
              </>
            }
            detail={`${ROLE_WORDS[person.role]} · ${person.hasPin ? 'has a wall PIN' : 'no wall PIN yet'}`}
            onClick={
              person.userId === me?.userId
                ? () => setAccount(true)
                : owner
                  ? () => setMember(person)
                  : undefined
            }
            testId={`member-${person.displayName}`}
          />
        ))}
      </Rows>

      {me && !me.hasPin && (
        <Card tone="honey">
          <Stack gap="s">
            <p>
              <strong>Choose a wall PIN.</strong> It opens the grown-ups’ window on the wall, so you can say
              yes to a finished mission without your phone.
            </p>
            <Button tone="primary" onClick={() => setAccount(true)}>
              Set my PIN
            </Button>
          </Stack>
        </Card>
      )}

      {guardian && (
        <Section
          title="Invite another grown-up"
          hint="The other parent, or a helper such as a grandparent or a sitter."
        >
          <Button onClick={() => setInviting(true)} testId="invite">
            Make an invitation
          </Button>
          {invites.length > 0 && (
            <Rows>
              {invites.map((invite) => (
                <Row
                  key={invite.id}
                  title={
                    invite.kind === 'reset'
                      ? 'A reset code'
                      : `An invitation for a ${invite.role === 'caregiver' ? 'helper' : 'parent'}`
                  }
                  detail={`Not used yet · runs out ${new Date(invite.expiresAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`}
                  right={
                    <ConfirmButton
                      size="s"
                      label="Cancel"
                      confirmLabel="Cancel it"
                      onConfirm={() => {
                        void api('DELETE', `/auth/invites/${invite.id}`)
                          .then(load)
                          .catch((error: unknown) => toast(wordsOf(error), { tone: 'problem' }));
                      }}
                    />
                  }
                />
              ))}
            </Rows>
          )}
        </Section>
      )}

      <Section title="What each can do">
        <Card>
          <Stack gap="s">
            <p>
              <strong>A parent</strong> can do everything: missions, routines, rewards, stars, children,
              screens and settings.
            </p>
            <p>
              <strong>A helper</strong> can say yes to finished missions, mark things done, and keep the
              shopping list. A helper cannot change the plan, the stars or the settings.
            </p>
            <p>
              <strong>The owner</strong> is the parent who also decides who the grown-ups are.
            </p>
          </Stack>
        </Card>
      </Section>

      <Line>
        <Button
          onClick={() => {
            // Whoever signs in next starts at Today, not on the page this was left on.
            void store.signOut().then(() => parent.go('today'));
          }}
          testId="sign-out"
        >
          Sign out of this phone
        </Button>
      </Line>

      {inviting && (
        <Sheet
          title="An invitation"
          onClose={() => setInviting(false)}
          footer={
            <Button
              tone="primary"
              testId="make-invite"
              onClick={() => {
                void api<{ code: string }>('POST', '/auth/invites', { role })
                  .then((reply) => {
                    setMade({ code: reply.code, what: 'join' });
                    setInviting(false);
                    load();
                  })
                  .catch((error: unknown) => toast(wordsOf(error), { tone: 'problem' }));
              }}
            >
              Make the code
            </Button>
          }
        >
          <Segmented
            label="Who is it for?"
            value={role}
            onChange={setRole}
            options={[
              { value: 'guardian', label: 'A parent' },
              { value: 'caregiver', label: 'A helper' },
            ]}
          />
          <p>The code works once and lasts two days. Pass it on yourself: HOMEBASE does not send messages.</p>
        </Sheet>
      )}

      {made && (
        <Sheet
          title={made.what === 'join' ? 'Pass this on' : `A reset code for ${made.who ?? 'them'}`}
          onClose={() => setMade(null)}
          testId="code-sheet"
        >
          <p>
            {made.what === 'join'
              ? 'They open this link on their own phone, or scan the square, and choose their own password.'
              : 'They open this link on their own phone and choose a new password. It works once, for a day.'}
          </p>
          <Line>
            <Qr text={link} label="A square code that opens the link" />
            <div>
              <p className={kit.mono} data-testid="made-code">
                {made.code}
              </p>
              <Button
                size="s"
                onClick={() =>
                  void (navigator.share
                    ? navigator.share({ text: link }).catch(() => undefined)
                    : copyText(link).then((copied) =>
                        toast(copied ? 'Copied.' : 'Could not copy. Read the code out instead.'),
                      ))
                }
              >
                Share the link
              </Button>
            </div>
          </Line>
          <p className={styles.itemNote}>
            This is shown only now. If it is lost, cancel it and make another.
          </p>
        </Sheet>
      )}

      {account && me && <MyAccount me={me} onClose={() => setAccount(false)} />}

      {member && (
        <Sheet title={member.displayName} onClose={() => setMember(null)} testId="member-sheet">
          <Segmented
            label="What they are"
            value={member.role === 'caregiver' ? 'caregiver' : 'guardian'}
            onChange={(next) => {
              parent.tell('member.role', { userId: member.userId, role: next });
              setMember({ ...member, role: next });
            }}
            options={[
              { value: 'guardian', label: 'A parent' },
              { value: 'caregiver', label: 'A helper' },
            ]}
          />
          <Button
            full
            onClick={() => {
              void api<{ code: string }>('POST', '/auth/reset-link', { userId: member.userId })
                .then((reply) => {
                  setMade({ code: reply.code, what: 'reset', who: member.displayName });
                  setMember(null);
                })
                .catch((error: unknown) => toast(wordsOf(error), { tone: 'problem' }));
            }}
          >
            They forgot their password
          </Button>
          <ConfirmButton
            label="Remove from the household"
            confirmLabel={`Remove ${member.displayName}`}
            onConfirm={() => {
              parent.tell('member.remove', { userId: member.userId });
              setMember(null);
            }}
          />
          <p className={styles.itemNote}>
            Removing someone signs them out everywhere and stops their wall PIN and their Siri shortcuts. What
            they did stays in the records.
          </p>
        </Sheet>
      )}
    </>
  );
}

function MyAccount({ me, onClose }: { me: Member; onClose: () => void }) {
  const parent = useParent();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [avatar, setAvatar] = useState<AvatarId>(me.avatar);
  const [pin, setPin] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codePassword, setCodePassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const run = (work: () => Promise<void>, done: string) => {
    setProblem(null);
    void work()
      .then(() => {
        toast(done);
        return store.sync();
      })
      .catch((error: unknown) => setProblem(wordsOf(error)));
  };

  return (
    <Sheet title="You" onClose={onClose} testId="account-sheet">
      {problem && (
        <p className={styles.warning} role="alert">
          {problem}
        </p>
      )}
      <Section title="Your name and picture">
        <Line>
          <PicturePicker kind="avatar" value={avatar} onChange={setAvatar} label="Your picture" />
          <div style={{ flex: 1, minWidth: 180 }}>
            <Field label="Your name">
              <TextInput
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={30}
              />
            </Field>
          </div>
        </Line>
        <Button
          disabled={displayName.trim() === '' || (displayName === me.displayName && avatar === me.avatar)}
          onClick={() => run(() => api('POST', '/auth/profile', { displayName, avatar }), 'Saved.')}
        >
          Save
        </Button>
      </Section>

      <Section
        title="Your wall PIN"
        hint="Four to eight digits. It opens the grown-ups’ window on the wall for a couple of minutes at a time."
      >
        <Line>
          <div style={{ width: 160 }}>
            <TextInput
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
              aria-label="New PIN"
              placeholder={me.hasPin ? 'New PIN' : 'PIN'}
              testId="pin-input"
            />
          </div>
          <Button
            tone="primary"
            disabled={pin.length < 4}
            testId="pin-save"
            onClick={() =>
              run(async () => {
                await api('POST', '/auth/pin', { pin });
                setPin('');
              }, 'Your PIN is set.')
            }
          >
            {me.hasPin ? 'Change it' : 'Set it'}
          </Button>
          {me.hasPin && (
            <ConfirmButton
              label="Remove"
              confirmLabel="Remove my PIN"
              onConfirm={() => run(() => api('DELETE', '/auth/pin'), 'Your PIN is removed.')}
            />
          )}
        </Line>
      </Section>

      <Section title="Your password">
        <Field label="The one you have now">
          <TextInput
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </Field>
        <Field
          label="A new one"
          hint="Ten characters or more. Changing it signs you out of your other devices."
        >
          <TextInput
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            minLength={10}
          />
        </Field>
        <Button
          disabled={current === '' || next.length < 10}
          onClick={() =>
            run(async () => {
              await api('POST', '/auth/password', { current, next });
              setCurrent('');
              setNext('');
            }, 'Your password is changed.')
          }
        >
          Change my password
        </Button>
      </Section>

      <Section
        title="Recovery codes"
        hint="For getting back in if you forget your password. Making new ones cancels the old ones."
      >
        {codes ? (
          <Card tone="honey">
            <Stack gap="s">
              <p>Write these down. Each works once. They are not shown again.</p>
              <p className={kit.mono} style={{ fontSize: 16, lineHeight: 1.8 }} data-testid="new-codes">
                {codes.join('  ')}
              </p>
            </Stack>
          </Card>
        ) : (
          <Line>
            <div style={{ flex: 1, minWidth: 160 }}>
              <TextInput
                type="password"
                autoComplete="current-password"
                value={codePassword}
                onChange={(event) => setCodePassword(event.target.value)}
                aria-label="Your password, to make new recovery codes"
                placeholder="Your password"
              />
            </div>
            <Button
              disabled={codePassword === ''}
              onClick={() => {
                setProblem(null);
                void api<{ recoveryCodes: string[] }>('POST', '/auth/recovery-codes', {
                  password: codePassword,
                })
                  .then((reply) => {
                    setCodes(reply.recoveryCodes);
                    setCodePassword('');
                  })
                  .catch((error: unknown) => setProblem(wordsOf(error)));
              }}
            >
              Make new codes
            </Button>
          </Line>
        )}
      </Section>

      {me.role !== 'owner' && (
        <ConfirmButton
          label="Leave this household"
          confirmLabel="Yes, leave"
          onConfirm={() => {
            void api('POST', '/auth/leave', {})
              .then(() => store.signOut())
              .catch((error: unknown) => setProblem(wordsOf(error)));
          }}
        />
      )}
      {!parent.online && <Badge tone="terra">Out of touch: these need the server.</Badge>}
    </Sheet>
  );
}
