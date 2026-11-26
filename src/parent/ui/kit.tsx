import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import type { Profile } from '../../../shared/model';
import {
  ACTION_PICTURE_IDS,
  ACTION_PICTURES,
  AVATAR_IDS,
  AVATARS,
  DAY_PICTURE_IDS,
  DAY_PICTURES,
  REWARD_PICTURE_IDS,
  REWARD_PICTURES,
  SHOPPING_PICTURE_IDS,
  SHOPPING_PICTURES,
} from '../../../shared/pictures';
import { P } from '../../art/palette';
import { AnyPicture, Avatar, ShoppingPicture } from '../../art/pictures';
import styles from './kit.module.css';

/**
 * The parts the grown-ups' screens are built from. Each is an ordinary control with its ordinary keyboard and
 * screen-reader behaviour — a button is a button, a switch says it is a switch — dressed in the house colours.
 */

export { styles as kit };

// --- buttons ---------------------------------------------------------------------------------------------------------

type Tone = 'plain' | 'primary' | 'good' | 'danger' | 'quiet';

export function Button({
  tone = 'plain',
  size = 'm',
  busy = false,
  full = false,
  testId,
  children,
  ...rest
}: {
  tone?: Tone;
  size?: 's' | 'm';
  busy?: boolean;
  full?: boolean;
  testId?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={styles.button}
      data-tone={tone}
      data-size={size}
      data-full={full}
      data-busy={busy}
      data-testid={testId}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/** A button that asks "really?" once before it does a thing that cannot be taken back with one tap. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  tone = 'danger',
  size = 'm',
  testId,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: Tone;
  size?: 's' | 'm';
  testId?: string;
}) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 5000);
    return () => clearTimeout(timer);
  }, [asking]);
  return asking ? (
    <Button
      tone={tone}
      size={size}
      testId={testId ? `${testId}-confirm` : undefined}
      onClick={() => {
        setAsking(false);
        onConfirm();
      }}
    >
      {confirmLabel}
    </Button>
  ) : (
    <Button tone="quiet" size={size} testId={testId} onClick={() => setAsking(true)}>
      {label}
    </Button>
  );
}

export const Glyph = {
  close: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.5 5l-7 7 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9.5 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  up: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 14.5l7-7 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  down: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 9.5l7 7 7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  tick: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  bin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  ),
};

// --- forms -----------------------------------------------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    // The control is inside the label, so a tap on the words reaches it and a screen reader names it.
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
      {error && (
        <span className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement> & { testId?: string }) {
  const { testId, ...rest } = props;
  return <input type="text" {...rest} className={styles.input} data-testid={testId} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { testId?: string }) {
  const { testId, ...rest } = props;
  return <textarea {...rest} className={styles.textarea} data-testid={testId} />;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  testId,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  testId?: string;
}) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      data-testid={testId}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  testId,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
  disabled?: boolean;
}) {
  const hintId = useId();
  return (
    // A tap anywhere on the words reaches the switch, because the switch is inside its label.
    <label className={styles.toggle} data-disabled={disabled}>
      <span className={styles.toggleWords}>
        <span className={styles.toggleLabel}>{label}</span>
        {hint && (
          <span className={styles.toggleHint} id={hintId}>
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? hintId : undefined}
        className={styles.toggleTrack}
        onClick={() => onChange(!checked)}
        data-testid={testId}
        disabled={disabled}
      />
    </label>
  );
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testId?: string;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel} id={`${testId ?? label}-label`}>
        {label}
      </span>
      <div className={styles.segmented} role="radiogroup" aria-label={label} data-testid={testId}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className={styles.segment}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  show,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** How to write the value; the number alone if left out. */
  show?: (value: number) => ReactNode;
  testId?: string;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.stepper} role="group" aria-label={label} data-testid={testId}>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label={`Less: ${label}`}
        >
          −
        </button>
        <span className={styles.stepperValue} aria-live="polite">
          {show ? show(value) : value}
        </span>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label={`More: ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Which days of the week. At least one stays chosen. */
export function Days({
  label,
  value,
  onChange,
  weekStart = 0,
}: {
  label: string;
  value: number[];
  onChange: (value: number[]) => void;
  weekStart?: 0 | 1;
}) {
  const order = Array.from({ length: 7 }, (_, index) => (index + weekStart) % 7);
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.segmented} role="group" aria-label={label}>
        {order.map((day) => {
          const on = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              className={styles.segment}
              aria-pressed={on}
              onClick={() => {
                const next = on ? value.filter((other) => other !== day) : [...value, day];
                if (next.length > 0) onChange(next.sort((a, b) => a - b));
              }}
            >
              {DAY_NAMES[day]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Which children. No child chosen means "all of them", and says so. */
export function ChildChips({
  label,
  profiles,
  value,
  onChange,
  everyone = 'Everyone',
}: {
  label: string;
  profiles: Profile[];
  value: string[];
  onChange: (value: string[]) => void;
  everyone?: string;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.chips} role="group" aria-label={label}>
        <button
          type="button"
          className={styles.chip}
          data-plain="true"
          aria-pressed={value.length === 0}
          onClick={() => onChange([])}
        >
          {everyone}
        </button>
        {profiles.map((profile) => {
          const on = value.includes(profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              className={styles.chip}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((id) => id !== profile.id) : [...value, profile.id])}
            >
              <span className={styles.chipPicture}>
                <Avatar id={profile.avatar} />
              </span>
              {profile.nickname}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- pictures --------------------------------------------------------------------------------------------------------

export type PictureKind = 'action' | 'reward' | 'day' | 'avatar' | 'shopping' | 'any';

const SHEETS: Record<
  Exclude<PictureKind, 'any'>,
  { ids: readonly string[]; names: Record<string, { label: string }> }
> = {
  action: { ids: ACTION_PICTURE_IDS, names: ACTION_PICTURES },
  reward: { ids: REWARD_PICTURE_IDS, names: REWARD_PICTURES },
  day: { ids: DAY_PICTURE_IDS, names: DAY_PICTURES },
  avatar: { ids: AVATAR_IDS, names: AVATARS },
  shopping: { ids: SHOPPING_PICTURE_IDS, names: SHOPPING_PICTURES },
};

export function PictureOf({ kind, id }: { kind: PictureKind; id: string }) {
  if (kind === 'avatar') return <Avatar id={id as never} />;
  if (kind === 'shopping') return <ShoppingPicture id={id as never} />;
  return <AnyPicture id={id} />;
}

export function pictureLabel(kind: PictureKind, id: string): string {
  if (kind === 'any') {
    return (
      (ACTION_PICTURES as Record<string, { label: string }>)[id]?.label ??
      (REWARD_PICTURES as Record<string, { label: string }>)[id]?.label ??
      (DAY_PICTURES as Record<string, { label: string }>)[id]?.label ??
      id
    );
  }
  return SHEETS[kind].names[id]?.label ?? id;
}

/** The picture a thing has, as a button that opens every picture it could have. */
export function PicturePicker<T extends string>({
  kind,
  value,
  onChange,
  label,
  testId,
}: {
  kind: PictureKind;
  value: T;
  onChange: (value: T) => void;
  label: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const kinds: Exclude<PictureKind, 'any'>[] = kind === 'any' ? ['action', 'reward', 'day'] : [kind];
  return (
    <>
      <button
        type="button"
        className={styles.pictureButton}
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${pictureLabel(kind, value)}. Change.`}
        data-testid={testId}
      >
        <PictureOf kind={kind} id={value} />
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)} testId="picture-sheet">
          {kinds.map((sheet) => (
            <ul key={sheet} className={styles.pictureGrid}>
              {SHEETS[sheet].ids.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className={styles.pictureChoice}
                    aria-pressed={id === value}
                    onClick={() => {
                      onChange(id as T);
                      setOpen(false);
                    }}
                    data-testid={`picture-${id}`}
                  >
                    <PictureOf kind={sheet} id={id} />
                    {SHEETS[sheet].names[id]?.label}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </Sheet>
      )}
    </>
  );
}

// --- surfaces --------------------------------------------------------------------------------------------------------

export function Card({
  children,
  tone,
  testId,
}: {
  children: ReactNode;
  tone?: 'honey' | 'sage' | 'blue' | 'rose';
  testId?: string;
}) {
  return (
    <div className={styles.card} data-tone={tone} data-testid={testId}>
      {children}
    </div>
  );
}

export function Section({
  title,
  hint,
  action,
  children,
  testId,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className={styles.section} data-testid={testId}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {action}
      </div>
      {hint && <p className={styles.sectionHint}>{hint}</p>}
      {children}
    </section>
  );
}

export function Rows({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <ul className={styles.rows} data-testid={testId}>
      {children}
    </ul>
  );
}

/**
 * One line of a list. With `onClick` the picture and words are one button; `after` is a small thing shown at
 * the end of that button (a badge, a count, an arrow), and `right` is for controls of the row's own (buttons),
 * which sit beside the button, never inside it.
 */
export function Row({
  picture,
  round = false,
  title,
  detail,
  after,
  right,
  onClick,
  testId,
}: {
  picture?: ReactNode;
  round?: boolean;
  title: ReactNode;
  detail?: ReactNode;
  after?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  testId?: string;
}) {
  const inside = (
    <>
      {picture ? (
        <span className={styles.rowPicture} data-round={round}>
          {picture}
        </span>
      ) : (
        <span />
      )}
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {detail && <span className={styles.rowDetail}> {detail}</span>}
      </span>
      <span className={styles.rowAfter}>{after}</span>
    </>
  );
  return (
    <li className={styles.rowWrap}>
      {onClick ? (
        <button type="button" className={styles.row} onClick={onClick} data-testid={testId}>
          {inside}
        </button>
      ) : (
        <div className={styles.row} data-testid={testId}>
          {inside}
        </div>
      )}
      {right && <span className={styles.rowRight}>{right}</span>}
    </li>
  );
}

export function Empty({
  picture,
  title,
  children,
}: {
  picture?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      {picture && <div className={styles.emptyPicture}>{picture}</div>}
      <p className={styles.emptyTitle}>{title}</p>
      {children}
    </div>
  );
}

export function StarCount({ n, label }: { n: number; label?: string }) {
  return (
    <span className={styles.stars} aria-label={label ?? `${n} ${n === 1 ? 'star' : 'stars'}`}>
      <svg viewBox="-12 -12 24 24" aria-hidden="true">
        <path
          d="M0 -10 L2.9 -3.3 L10 -2.7 L4.6 2 L6.2 9 L0 5.3 L-6.2 9 L-4.6 2 L-10 -2.7 L-2.9 -3.3 Z"
          fill={P.honey}
          stroke={P.honeyDeep}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {n}
    </span>
  );
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'honey' | 'sage' | 'blue' | 'terra';
}) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}

export function Stack({ children, gap }: { children: ReactNode; gap?: 's' | 'l' }) {
  return (
    <div className={styles.stack} data-gap={gap}>
      {children}
    </div>
  );
}

export function Line({ children, between = false }: { children: ReactNode; between?: boolean }) {
  return (
    <div className={styles.line} data-between={between}>
      {children}
    </div>
  );
}

// --- sheets ----------------------------------------------------------------------------------------------------------

/** The sheets that are open, bottom first: Escape closes only the one on top. */
const openSheets: symbol[] = [];

/** A panel over the page for one job: editing a mission, choosing a picture. Escape or the cross closes it. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const me = Symbol('sheet');
    openSheets.push(me);
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openSheets[openSheets.length - 1] === me) close.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      openSheets.splice(openSheets.indexOf(me), 1);
      if (openSheets.length === 0) document.body.style.overflow = overflow === 'hidden' ? '' : overflow;
      before?.focus?.();
    };
  }, []);
  // Drawn at the end of the page, so that a sheet opened from inside another lies over it, not inside it.
  return createPortal(
    <div
      className={styles.veil}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
      >
        <div className={styles.sheetHead}>
          <h2 id={titleId} className={styles.sheetTitle}>
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} testId="sheet-x">
            {Glyph.close}
          </IconButton>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        {footer && <div className={styles.sheetFoot}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// --- toasts ----------------------------------------------------------------------------------------------------------

interface ToastItem {
  id: number;
  words: string;
  tone: 'plain' | 'problem';
  action?: { label: string; run: () => void };
}

type Say = (words: string, options?: { tone?: 'plain' | 'problem'; action?: ToastItem['action'] }) => void;

const ToastContext = createContext<Say>(() => undefined);

export function useToast(): Say {
  return useContext(ToastContext);
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const say = useCallback<Say>((words, options = {}) => {
    const id = next.current++;
    setItems((current) => [
      ...current.slice(-2),
      { id, words, tone: options.tone ?? 'plain', action: options.action },
    ]);
    setTimeout(
      () => setItems((current) => current.filter((item) => item.id !== id)),
      options.action ? 7000 : 4200,
    );
  }, []);
  const value = useMemo(() => say, [say]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.toasts} aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={styles.toast} data-tone={item.tone} role="status" data-testid="toast">
            <span>{item.words}</span>
            {item.action && (
              <button
                type="button"
                className={styles.toastAction}
                onClick={() => {
                  item.action?.run();
                  setItems((current) => current.filter((other) => other.id !== item.id));
                }}
              >
                {item.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
