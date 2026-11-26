import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { layoutFor, type Layout } from './home/layout';
import styles from './Stage.module.css';

/**
 * The sheet everything on the wall is drawn on, fitted to whatever screen there is: as large as it will go,
 * never stretched, never scrolled. Children are placed in the sheet's own percentages, and can size type in
 * `cqw` (a hundredth of the sheet's width), so the whole picture scales as one thing — on a 4K wall, a phone, a
 * tablet turned on its side.
 */
export function useLayout(): Layout {
  const read = () => layoutFor(window.innerWidth, window.innerHeight);
  const [layout, setLayout] = useState<Layout>(read);
  useEffect(() => {
    const update = () => setLayout(read());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return layout;
}

export function Stage({
  layout,
  vars,
  children,
  className,
}: {
  layout: Layout;
  vars?: Record<string, string>;
  children: ReactNode;
  className?: string;
}) {
  const ratio = layout.sheet.w / layout.sheet.h;
  const style = {
    ...vars,
    '--ratio': String(ratio),
    aspectRatio: `${layout.sheet.w} / ${layout.sheet.h}`,
  } as CSSProperties;
  return (
    <div className={styles.viewport} style={vars as CSSProperties}>
      <div
        className={className ? `${styles.stage} ${className}` : styles.stage}
        style={style}
        data-shape={layout.shape}
      >
        {children}
      </div>
    </div>
  );
}
