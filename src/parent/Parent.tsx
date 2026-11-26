import { lazy, Suspense, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { hasAccess, type AccessLevel, type Snapshot } from '../../shared/model';
import type { OpInput, OpType } from '../../shared/ops';
import { navigate, useRoute } from '../app/navigation';
import { api } from '../sync/api';
import { useSync } from '../sync/hooks';
import { store } from '../sync/store';
import { Auth } from './auth/Auth';
import { ParentContext, type ParentApi } from './context';
import styles from './Parent.module.css';
import { Button, ToastHost, useToast } from './ui/kit';

const Today = lazy(() => import('./pages/Today').then((module) => ({ default: module.Today })));
const Lists = lazy(() => import('./pages/Lists').then((module) => ({ default: module.Lists })));
const Plan = lazy(() => import('./pages/Plan').then((module) => ({ default: module.Plan })));
const History = lazy(() => import('./pages/History').then((module) => ({ default: module.History })));
const More = lazy(() => import('./pages/More').then((module) => ({ default: module.More })));

/**
 * The grown-ups' side: a phone-first place to say yes to finished missions, keep the shopping list, and set
 * the house up. It is the same household the wall shows, kept in step the same way; here words are allowed.
 */

const TABS = [
  {
    section: 'today',
    label: 'Today',
    icon: (
      <>
        <circle cx="14" cy="14" r="5.5" fill="currentColor" />
        <path
          d="M14 3v3M14 22v3M3 14h3M22 14h3M6.2 6.2l2.1 2.1M19.7 19.7l2.1 2.1M6.2 21.8l2.1-2.1M19.7 8.3l2.1-2.1"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    section: 'lists',
    label: 'To buy',
    icon: (
      <>
        <path
          d="M5 11h18l-2 11.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 11q4.5-9 9 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    section: 'plan',
    label: 'Plan',
    icon: (
      <>
        <rect x="6" y="5" width="16" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path
          d="M10.5 11.5l1.8 1.8 3.4-3.6M10.5 18h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  {
    section: 'history',
    label: 'History',
    icon: (
      <path
        d="M5 23V13M11.5 23V6M18 23v-8M24 23V10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    ),
  },
  {
    section: 'more',
    label: 'Family',
    icon: (
      <>
        <path
          d="M4 14L14 5l10 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.5 13v10h13V13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <rect x="12" y="17" width="4" height="6" rx="1" fill="currentColor" />
      </>
    ),
  },
] as const;

export function waitingCount(view: Snapshot): number {
  return (
    view.occurrences.filter((occurrence) => occurrence.status === 'submitted').length +
    view.redemptions.filter((redemption) => redemption.status === 'requested').length +
    view.items.filter((item) => item.status === 'requested').length
  );
}

export function Parent() {
  const sync = useSync();
  useEffect(() => {
    void store.start();
    store.setPace('active');
    return () => store.stop();
  }, []);

  if (sync.phase === 'stranger') {
    return (
      <ToastHost>
        <Auth />
      </ToastHost>
    );
  }
  if (!sync.view) {
    return (
      <div className={styles.waiting} role="status">
        {sync.online ? <p>One moment…</p> : <p>HOMEBASE cannot reach its server yet. It will keep trying.</p>}
      </div>
    );
  }
  if (sync.view.viewer.kind === 'device') return <ThisIsAWall />;
  return (
    <ToastHost>
      <Signed
        view={sync.view}
        online={sync.online}
        pending={sync.pending}
        pendingIds={sync.pendingIds}
        notices={sync.notices}
      />
    </ToastHost>
  );
}

/** A browser that is paired as a wall has no business in the grown-ups' side: send it back to the house. */
function ThisIsAWall() {
  return (
    <div className={styles.waiting}>
      <div>
        <h1>This screen is set up as a wall</h1>
        <p style={{ margin: '12px 0 20px' }}>
          The grown-ups’ side is for your own phone. On the wall, tap the little window under the roof.
        </p>
        <Button tone="primary" onClick={() => navigate({ name: 'wall' })}>
          Back to the house
        </Button>
      </div>
    </div>
  );
}

function Signed({
  view,
  online,
  pending,
  pendingIds,
  notices,
}: {
  view: Snapshot;
  online: boolean;
  pending: number;
  pendingIds: ReadonlySet<string>;
  notices: { id: string; message: string }[];
}) {
  const route = useRoute();
  const toast = useToast();
  const section = route.name === 'parent' ? route.section : 'today';
  const rest = useMemo(() => (route.name === 'parent' ? route.rest : []), [route]);

  // Anything the server turned down is said once, plainly, and then forgotten.
  useEffect(() => {
    for (const notice of notices) {
      toast(notice.message, { tone: 'problem' });
      store.dismissNotice(notice.id);
    }
  }, [notices, toast]);

  const ask = useCallback(
    async <T extends OpType>(type: T, input: OpInput<T>): Promise<boolean> => {
      const outcome = await Promise.race([
        store.request(type, input),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      if (outcome === null) {
        toast('Kept on this phone. It will be sent when you are back in touch.');
        return true;
      }
      // A turned-down request is announced by the notice above.
      return outcome.status === 'applied' || outcome.status === 'noop';
    },
    [toast],
  );

  const value = useMemo<ParentApi>(
    () => ({
      view,
      me: view.members.find((member) => member.userId === view.viewer.userId) ?? null,
      can: (level: AccessLevel) => hasAccess(view.viewer.access, level),
      ask,
      tell: (type, input) => {
        store.dispatch(type, input);
      },
      go: (next, ...more) => navigate({ name: 'parent', section: next, rest: more }),
      online,
      pending,
      isSaving: (id) => pendingIds.has(id),
    }),
    [view, ask, online, pending, pendingIds],
  );

  const waiting = waitingCount(view);
  const state = !online ? 'offline' : pending > 0 ? 'saving' : 'saved';
  let page: ReactNode;
  if (section === 'lists') page = <Lists rest={rest} />;
  else if (section === 'plan') page = <Plan rest={rest} />;
  else if (section === 'history') page = <History rest={rest} />;
  else if (section === 'more') page = <More rest={rest} />;
  else page = <Today />;

  return (
    <ParentContext.Provider value={value}>
      <div className={styles.app}>
        <header className={styles.top}>
          <div className={styles.brand}>
            <svg className={styles.brandMark} viewBox="0 0 40 40" aria-hidden="true">
              <path
                d="M4 20L20 6l16 14"
                fill="none"
                stroke="#f08a62"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 19v15h22V19L20 9.5z"
                fill="#fff6e6"
                stroke="#c9976b"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="17" y="24" width="6" height="10" rx="1.5" fill="#ffc94d" />
            </svg>
            <span>{view.household.name}</span>
          </div>
          <span className={styles.state} data-state={state} role="status" data-testid="sync-state">
            <span className={styles.dot} aria-hidden="true" />
            {state === 'offline' ? 'Out of touch' : state === 'saving' ? 'Saving…' : 'Up to date'}
          </span>
        </header>

        <nav className={styles.tabs} aria-label="Sections">
          {TABS.map((tab) => (
            <a
              key={tab.section}
              href={tab.section === 'today' ? '/parent' : `/parent/${tab.section}`}
              className={styles.tab}
              aria-current={section === tab.section ? 'page' : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                navigate({ name: 'parent', section: tab.section, rest: [] });
              }}
              data-testid={`tab-${tab.section}`}
            >
              <svg viewBox="0 0 28 28" aria-hidden="true">
                {tab.icon}
              </svg>
              {tab.label}
              {tab.section === 'today' && waiting > 0 && (
                <span className={styles.count} aria-label={`${waiting} waiting`}>
                  {waiting}
                </span>
              )}
            </a>
          ))}
        </nav>

        <main className={styles.main}>
          {view.household.demo && (
            <div className={styles.demo}>
              <span>A demo with a made-up family. Nothing here is real.</span>
              <Button
                size="s"
                onClick={() => {
                  void api('POST', '/demo/reset', {})
                    .then(() => store.sync())
                    .then(() => toast('The demo is back to how it started.'))
                    .catch(() => toast('The demo could not be reset just now.', { tone: 'problem' }));
                }}
              >
                Start again
              </Button>
            </div>
          )}
          <Suspense fallback={null}>{page}</Suspense>
        </main>
      </div>
    </ParentContext.Provider>
  );
}
