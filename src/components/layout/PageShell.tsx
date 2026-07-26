import { ReactNode } from 'react';

export interface PageShellProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * P22 — Tighter page shell.
 *
 * Previously the title was clamp(1.75rem → 2.75rem) and the intro paragraph
 * sat at text-base; together they ate ~140px of vertical space before the
 * page's own data even started rendering. Operators flagged this as wasteful
 * — list pages like Inventory only got ~5 rows visible before scrolling on
 * a 13" laptop. New defaults shrink the title roughly 30% and the intro to
 * a one-liner, freeing up vertical real estate for the actual ledger.
 */
export function PageShell({ eyebrow, title, intro, actions, children }: PageShellProps) {
  return (
    <div className="grid gap-3 md:gap-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <span
              className="font-sans text-2xs font-semibold uppercase text-brand-500 block"
              style={{ letterSpacing: '0.18em' }}
            >
              {eyebrow}
            </span>
          )}
          <h1
            className="font-serif font-medium text-ink-900"
            style={{
              fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h1>
          {intro && (
            <p
              className="font-sans text-sm text-ink-700 mt-1 leading-snug"
              style={{ maxWidth: '72ch' }}
            >
              {intro}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </header>
      <div className="rule" />
      {children}
    </div>
  );
}
