import { useState, type ReactNode } from 'react';
import styles from './charts.module.css';

/**
 * The few kinds of chart the look-back needs, drawn plainly.
 *
 *   WeekColumns   a count out of its whole, week by week (missions done out of those handed out)
 *   InOutColumns  two amounts either side of a line, week by week (stars in, stars out)
 *   SplitBar      one whole in a few parts, beside its figures
 *   MeterList     a named ratio on each row, each against its own whole
 *
 * Every chart says its numbers on hover and on keyboard focus, and has them as a table underneath: nothing is
 * shown only by colour or only by pointing. One axis each; no chart compares one child with another.
 */

export const CHART = {
  done: '#3f8a55',
  doneTrack: '#cfe6c0',
  earned: '#d18a12',
  spent: '#6b5bb5',
  morning: '#d18a12',
  afternoon: '#3f8a55',
  evening: '#6b5bb5',
  alone: '#3f8a55',
  together: '#2f78c4',
  quiet: '#e6dcc8',
} as const;

export interface WeekTick {
  /** "2 Mar" */
  label: string;
  /** "Week of 2 March" */
  name: string;
  current: boolean;
}

function niceTop(max: number): number {
  if (max <= 4) return 4;
  const steps = [5, 10, 20, 30, 40, 50, 80, 100, 150, 200, 300, 500, 1000];
  return steps.find((step) => step >= max) ?? Math.ceil(max / 500) * 500;
}

const W = 320;
const LEFT = 26;
const RIGHT = 4;

function geometry(count: number) {
  const slot = (W - LEFT - RIGHT) / Math.max(1, count);
  const bar = Math.max(4, Math.min(24, slot - 6));
  const every = Math.max(1, Math.ceil(count / 6));
  return { slot, bar, every, x: (index: number) => LEFT + slot * index + (slot - bar) / 2 };
}

/** A column with a rounded top and a square foot, as a path. */
function column(x: number, top: number, width: number, bottom: number): string {
  const height = bottom - top;
  if (height <= 0) return '';
  const r = Math.min(4, width / 2, height);
  return `M${x} ${bottom} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + width - r} Q${x + width} ${top} ${x + width} ${top + r} V${bottom} Z`;
}

/** The same, hanging down from a line. */
function hanging(x: number, top: number, width: number, bottom: number): string {
  const height = bottom - top;
  if (height <= 0) return '';
  const r = Math.min(4, width / 2, height);
  return `M${x} ${top} V${bottom - r} Q${x} ${bottom} ${x + r} ${bottom} H${x + width - r} Q${x + width} ${bottom} ${x + width} ${bottom - r} V${top} Z`;
}

function Legend({ items }: { items: { name: string; colour: string }[] }) {
  return (
    <div className={styles.legend}>
      {items.map((item) => (
        <span key={item.name}>
          <span className={styles.key} style={{ background: item.colour }} />
          {item.name}
        </span>
      ))}
    </div>
  );
}

function Tip({ at, children }: { at: number; children: ReactNode }) {
  // Kept inside the plot at the edges.
  const left = Math.min(82, Math.max(18, (at / W) * 100));
  return (
    <div className={styles.tip} style={{ left: `${left}%` }} role="status">
      {children}
    </div>
  );
}

export interface PartCell {
  /** The whole (missions handed out). */
  total: number;
  /** The part of it (missions done). */
  part: number;
  /** False when nothing was kept for the week: drawn as a gap, never as a zero. */
  known: boolean;
  /** One more line for the tooltip and the table. */
  note?: string;
}

export function WeekColumns({
  title,
  weeks,
  cells,
  partName,
  restName,
  wholeName,
}: {
  title: string;
  weeks: WeekTick[];
  cells: PartCell[];
  partName: string;
  restName: string;
  wholeName: string;
}) {
  const [on, setOn] = useState<number | null>(null);
  const H = 132;
  const base = H - 20;
  const top = niceTop(Math.max(...cells.map((cell) => cell.total), 0));
  const y = (value: number) => base - (value / top) * (base - 8);
  const { slot, bar, every, x } = geometry(weeks.length);
  const active = on === null ? null : { week: weeks[on], cell: cells[on] };
  return (
    <figure className={styles.chart} style={{ margin: 0 }}>
      <figcaption className={styles.title}>{title}</figcaption>
      <Legend
        items={[
          { name: partName, colour: CHART.done },
          { name: restName, colour: CHART.doneTrack },
        ]}
      />
      <div className={styles.plot} onPointerLeave={() => setOn(null)}>
        {active?.week && active.cell && on !== null && (
          <Tip at={x(on) + bar / 2}>
            <strong>
              {active.cell.known
                ? `${active.cell.part} of ${active.cell.total} ${wholeName}`
                : 'Nothing kept'}
            </strong>
            {active.week.name}
            {active.week.current ? ' (so far)' : ''}
            {active.cell.note ? ` · ${active.cell.note}` : ''}
          </Tip>
        )}
        <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title}>
          {[0, top / 2, top].map((tick) => (
            <g key={tick}>
              <line className={styles.rule} x1={LEFT} x2={W - RIGHT} y1={y(tick)} y2={y(tick)} />
              <text className={styles.axis} x={LEFT - 5} y={y(tick) + 4} textAnchor="end">
                {tick}
              </text>
            </g>
          ))}
          {weeks.map((week, index) => {
            const cell = cells[index];
            if (!cell) return null;
            const left = x(index);
            const partTop = y(cell.part);
            const wholeTop = y(cell.total);
            return (
              <g key={week.name}>
                {cell.known ? (
                  <>
                    {/* the rest of the whole, with a 2px gap of the surface between it and the part */}
                    {cell.total > cell.part && (
                      <path
                        d={column(left, wholeTop, bar, cell.part > 0 ? partTop - 2 : base)}
                        fill={CHART.doneTrack}
                      />
                    )}
                    {cell.part > 0 && (
                      <path
                        d={
                          cell.total > cell.part
                            ? `M${left} ${base} V${partTop} H${left + bar} V${base} Z`
                            : column(left, partTop, bar, base)
                        }
                        fill={CHART.done}
                      />
                    )}
                  </>
                ) : (
                  <rect
                    className={styles.none}
                    x={left + bar / 2 - 3}
                    y={base - 5}
                    width="6"
                    height="2"
                    rx="1"
                  />
                )}
                {(index % every === 0 || index === weeks.length - 1) && (
                  <text className={styles.axis} x={left + bar / 2} y={H - 5} textAnchor="middle">
                    {week.label}
                  </text>
                )}
                <rect
                  className={styles.slot}
                  data-on={on === index}
                  x={LEFT + slot * index}
                  y={0}
                  width={slot}
                  height={base}
                  tabIndex={0}
                  role="img"
                  aria-label={`${week.name}${week.current ? ' (so far)' : ''}: ${
                    cell.known ? `${cell.part} of ${cell.total} ${wholeName}` : 'nothing kept'
                  }${cell.note ? `, ${cell.note}` : ''}`}
                  onPointerEnter={() => setOn(index)}
                  onPointerDown={() => setOn(index)}
                  onFocus={() => setOn(index)}
                  onBlur={() => setOn(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <details className={styles.details}>
        <summary>The numbers</summary>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Week of</th>
              <th scope="col">{partName}</th>
              <th scope="col">Out of</th>
              <th scope="col">Also</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => {
              const cell = cells[index];
              return (
                <tr key={week.name}>
                  <td>
                    {week.label}
                    {week.current ? ' (so far)' : ''}
                  </td>
                  <td>{cell?.known ? cell.part : '—'}</td>
                  <td>{cell?.known ? cell.total : '—'}</td>
                  <td>{cell?.known ? (cell.note ?? '') : 'nothing kept'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function InOutColumns({
  title,
  weeks,
  cells,
  upName,
  downName,
}: {
  title: string;
  weeks: WeekTick[];
  cells: { up: number; down: number }[];
  upName: string;
  downName: string;
}) {
  const [on, setOn] = useState<number | null>(null);
  const H = 150;
  const top = niceTop(Math.max(...cells.map((cell) => Math.max(cell.up, cell.down)), 0));
  const zero = 70;
  const reach = 58;
  const { slot, bar, every, x } = geometry(weeks.length);
  const active = on === null ? null : { week: weeks[on], cell: cells[on] };
  return (
    <figure className={styles.chart} style={{ margin: 0 }}>
      <figcaption className={styles.title}>{title}</figcaption>
      <Legend
        items={[
          { name: upName, colour: CHART.earned },
          { name: downName, colour: CHART.spent },
        ]}
      />
      <div className={styles.plot} onPointerLeave={() => setOn(null)}>
        {active?.week && active.cell && on !== null && (
          <Tip at={x(on) + bar / 2}>
            <strong>
              {active.cell.up} in · {active.cell.down} out
            </strong>
            {active.week.name}
            {active.week.current ? ' (so far)' : ''}
          </Tip>
        )}
        <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title}>
          {[top, 0, -top].map((tick) => (
            <g key={tick}>
              <line
                className={styles.rule}
                x1={LEFT}
                x2={W - RIGHT}
                y1={zero - (tick / top) * reach}
                y2={zero - (tick / top) * reach}
              />
              <text className={styles.axis} x={LEFT - 5} y={zero - (tick / top) * reach + 4} textAnchor="end">
                {Math.abs(tick)}
              </text>
            </g>
          ))}
          {weeks.map((week, index) => {
            const cell = cells[index];
            if (!cell) return null;
            const left = x(index);
            return (
              <g key={week.name}>
                <path
                  d={column(left, zero - 1 - (cell.up / top) * reach, bar, zero - 1)}
                  fill={CHART.earned}
                />
                <path
                  d={hanging(left, zero + 1, bar, zero + 1 + (cell.down / top) * reach)}
                  fill={CHART.spent}
                />
                {(index % every === 0 || index === weeks.length - 1) && (
                  <text className={styles.axis} x={left + bar / 2} y={H - 5} textAnchor="middle">
                    {week.label}
                  </text>
                )}
                <rect
                  className={styles.slot}
                  data-on={on === index}
                  x={LEFT + slot * index}
                  y={0}
                  width={slot}
                  height={H - 18}
                  tabIndex={0}
                  role="img"
                  aria-label={`${week.name}${week.current ? ' (so far)' : ''}: ${cell.up} ${upName.toLowerCase()}, ${cell.down} ${downName.toLowerCase()}`}
                  onPointerEnter={() => setOn(index)}
                  onPointerDown={() => setOn(index)}
                  onFocus={() => setOn(index)}
                  onBlur={() => setOn(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <details className={styles.details}>
        <summary>The numbers</summary>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Week of</th>
              <th scope="col">{upName}</th>
              <th scope="col">{downName}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => (
              <tr key={week.name}>
                <td>
                  {week.label}
                  {week.current ? ' (so far)' : ''}
                </td>
                <td>{cells[index]?.up ?? 0}</td>
                <td>{cells[index]?.down ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** One whole in a few parts, with each part's name and number written beside its colour. */
export function SplitBar({
  label,
  parts,
}: {
  label: string;
  parts: { name: string; value: number; colour: string }[];
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div className={styles.chart}>
      <div
        className={styles.split}
        role="img"
        aria-label={`${label}: ${parts.map((part) => `${part.name} ${part.value}`).join(', ')}`}
      >
        {total > 0 &&
          parts
            .filter((part) => part.value > 0)
            .map((part) => <span key={part.name} style={{ flex: part.value, background: part.colour }} />)}
      </div>
      <div className={styles.legend}>
        {parts.map((part) => (
          <span key={part.name}>
            <span className={styles.key} style={{ background: part.colour }} />
            {part.name} {part.value}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A name, a bar and a figure on each row; each bar is that row's part of that row's own whole. */
export function MeterList({
  rows,
  colour = CHART.done,
  track = CHART.doneTrack,
}: {
  rows: { name: string; value: number; total: number; figure: string }[];
  colour?: string;
  track?: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {rows.map((row) => (
        <div key={row.name} className={styles.meterRow}>
          <span className={styles.meterName}>{row.name}</span>
          <span className={styles.meterFigure}>{row.figure}</span>
          <div className={styles.meter} style={{ background: track }} aria-hidden="true">
            <span
              style={{
                width: `${row.total > 0 ? Math.min(100, (row.value / row.total) * 100) : 0}%`,
                background: colour,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
