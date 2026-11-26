import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { AvatarId } from '../../../shared/pictures';
import { navigate } from '../../app/navigation';
import { Tock } from '../../art/guide/Tock';
import { allTimeZones, deviceTimeZone } from '../../lib/zones';
import { api, ApiError } from '../../sync/api';
import { store } from '../../sync/store';
import { Button, Field, PicturePicker, Select, TextInput } from '../ui/kit';
import styles from './Auth.module.css';

/**
 * Coming in: signing in, starting a household, joining one with an invitation, and getting back in after a
 * forgotten password. HOMEBASE sends no e-mail — an address is only a name to sign in with — so getting back in
 * is by a recovery code written down at the start, or a link the household's owner makes.
 */

export type AuthMode = 'signin' | 'signup' | 'join' | 'recover' | 'reset';

function wordsOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Nothing was changed.';
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.tock} aria-hidden="true">
          <Tock pose="wave" />
        </div>
        <h1>HOMEBASE</h1>
        <p>The grown-ups’ side</p>
      </div>
      <div className={styles.card}>
        <h2>{title}</h2>
        {children}
      </div>
    </main>
  );
}

export function Auth({ start = 'signin', code = null }: { start?: AuthMode; code?: string | null }) {
  const [mode, setMode] = useState<AuthMode>(start);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('owl');
  const [householdName, setHouseholdName] = useState('');
  const [timeZone, setTimeZone] = useState(() => deviceTimeZone());
  const zoneList = allTimeZones();
  const [invite, setInvite] = useState(code ?? '');
  const [inviteInfo, setInviteInfo] = useState<{ householdName: string; role: string } | null>(null);
  const [recoveryCode, setRecoveryCode] = useState('');

  useEffect(() => {
    let current = true;
    api<{ mode?: string }>('GET', '/health')
      .then((health) => {
        if (current) setDemo(health.mode === 'demo');
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  const change = (next: AuthMode) => {
    setMode(next);
    setProblem(null);
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } catch (error) {
      setProblem(wordsOf(error));
    } finally {
      setBusy(false);
    }
  };

  const enter = async () => {
    await store.reset();
    if (window.location.pathname === '/join' || window.location.pathname === '/reset')
      navigate({ name: 'parent', section: 'today', rest: [] });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'signin') {
      void run(async () => {
        await api('POST', '/auth/login', { email, password });
        await enter();
      });
    } else if (mode === 'signup') {
      void run(async () => {
        const made = await api<{ recoveryCodes: string[] }>('POST', '/auth/signup', {
          email,
          password,
          displayName,
          avatar,
          householdName,
          timeZone,
        });
        setCodes(made.recoveryCodes);
      });
    } else if (mode === 'join') {
      void run(async () => {
        if (!inviteInfo) {
          setInviteInfo(await api('POST', '/auth/invites/peek', { code: invite }));
          return;
        }
        await api('POST', '/auth/join', { code: invite, email, password, displayName, avatar });
        await enter();
      });
    } else if (mode === 'recover') {
      void run(async () => {
        await api('POST', '/auth/recover', { email, recoveryCode, password });
        await api('POST', '/auth/login', { email, password });
        await enter();
      });
    } else {
      void run(async () => {
        await api('POST', '/auth/reset', { code: invite, password });
        setMode('signin');
        setPassword('');
        setProblem('Your new password is saved. Sign in with it.');
      });
    }
  };

  if (codes) {
    return (
      <Frame title="Write these down">
        <p>
          If you ever forget your password, one of these codes lets you back in. Each works once. They are not
          shown again.
        </p>
        <ul className={styles.codes} data-testid="recovery-codes">
          {codes.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
        <Button
          tone="quiet"
          onClick={() => void navigator.clipboard?.writeText(codes.join('\n')).catch(() => undefined)}
        >
          Copy them
        </Button>
        <Button tone="primary" full testId="codes-done" onClick={() => void enter()}>
          I have written them down
        </Button>
      </Frame>
    );
  }

  const who = (
    <>
      <Field label="Your name" hint="What the family calls you. Shown on the wall beside your picture.">
        <TextInput
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="nickname"
          maxLength={30}
          required
          testId="auth-name"
        />
      </Field>
      <div>
        <span style={{ fontWeight: 700, fontSize: 15, display: 'block', marginBottom: 6 }}>Your picture</span>
        <PicturePicker kind="avatar" value={avatar} onChange={setAvatar} label="Your picture" />
      </div>
    </>
  );
  const account = (newPassword: boolean) => (
    <>
      <Field
        label="E-mail address"
        hint={newPassword ? 'Only a name to sign in with. Nothing is ever sent to it.' : undefined}
      >
        <TextInput
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          required
          testId="auth-email"
        />
      </Field>
      <Field
        label={newPassword ? 'Choose a password' : 'Password'}
        hint={newPassword ? 'Ten characters or more.' : undefined}
      >
        <TextInput
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          minLength={newPassword ? 10 : undefined}
          required
          testId="auth-password"
        />
      </Field>
    </>
  );

  const titles: Record<AuthMode, string> = {
    signin: 'Sign in',
    signup: 'Start a household',
    join: 'Join with an invitation',
    recover: 'Get back in',
    reset: 'Choose a new password',
  };

  return (
    <Frame title={titles[mode]}>
      {problem && (
        <p className={styles.problem} role="alert" data-testid="auth-problem">
          {problem}
        </p>
      )}
      <form className={styles.form} onSubmit={submit}>
        {mode === 'signin' && account(false)}
        {mode === 'signup' && (
          <>
            {who}
            {account(true)}
            <Field label="Name your household" hint="For example “The Maple Street house”.">
              <TextInput
                value={householdName}
                onChange={(event) => setHouseholdName(event.target.value)}
                maxLength={40}
                required
                testId="auth-household"
              />
            </Field>
            <Field label="Where you are" hint="So that “today” and bedtime are right.">
              {zoneList.length > 0 ? (
                <Select
                  value={timeZone}
                  onChange={setTimeZone}
                  options={zoneList.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))}
                />
              ) : (
                <TextInput value={timeZone} onChange={(event) => setTimeZone(event.target.value)} required />
              )}
            </Field>
          </>
        )}
        {mode === 'join' && (
          <>
            <Field
              label="Invitation code"
              hint="From the grown-up who invited you. It works once, for two days."
            >
              <TextInput
                value={invite}
                onChange={(event) => {
                  setInvite(event.target.value);
                  setInviteInfo(null);
                }}
                autoCapitalize="characters"
                autoComplete="off"
                required
                testId="auth-code"
              />
            </Field>
            {inviteInfo && (
              <>
                <p>
                  You are joining <strong>{inviteInfo.householdName}</strong> as a{' '}
                  {inviteInfo.role === 'caregiver' ? 'helper' : 'parent'}.
                </p>
                {who}
                {account(true)}
              </>
            )}
          </>
        )}
        {mode === 'recover' && (
          <>
            <Field label="E-mail address">
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </Field>
            <Field label="One of your recovery codes" hint="From the list you wrote down when you signed up.">
              <TextInput
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                required
              />
            </Field>
            <Field label="Choose a new password" hint="Ten characters or more.">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
            </Field>
          </>
        )}
        {mode === 'reset' && (
          <>
            <Field label="Reset code" hint="From the owner of your household. It works once, for a day.">
              <TextInput
                value={invite}
                onChange={(event) => setInvite(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                required
              />
            </Field>
            <Field label="Choose a new password" hint="Ten characters or more.">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
            </Field>
          </>
        )}
        <Button type="submit" tone="primary" full busy={busy} testId="auth-submit">
          {mode === 'signin'
            ? 'Sign in'
            : mode === 'signup'
              ? 'Start'
              : mode === 'join'
                ? inviteInfo
                  ? 'Join'
                  : 'Look up the code'
                : 'Save and sign in'}
        </Button>
      </form>

      <div className={styles.links}>
        {mode !== 'signin' && (
          <Button tone="quiet" onClick={() => change('signin')}>
            I already have an account
          </Button>
        )}
        {mode !== 'signup' && (
          <Button tone="quiet" onClick={() => change('signup')} testId="auth-to-signup">
            Start a new household
          </Button>
        )}
        {mode !== 'join' && (
          <Button tone="quiet" onClick={() => change('join')}>
            I have an invitation code
          </Button>
        )}
        {mode === 'signin' && (
          <Button tone="quiet" onClick={() => change('recover')}>
            I forgot my password
          </Button>
        )}
      </div>

      {demo && (
        <>
          <p className={styles.small}>This is a demo with a made-up family. Nothing in it is real.</p>
          <Button
            full
            testId="demo-parent"
            onClick={() =>
              void run(async () => {
                await api('POST', '/demo/enter', { as: 'guardian' });
                await enter();
              })
            }
          >
            Look around the demo as a parent
          </Button>
        </>
      )}
      <p className={styles.small}>
        Setting up the screen on the wall? <a href="/wall">Open the wall.</a>
      </p>
    </Frame>
  );
}
