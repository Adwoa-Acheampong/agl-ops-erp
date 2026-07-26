import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import aglLogo from '/agl-logo.jpeg';

/**
 * Canonical print surface. Every printable artefact in the system —
 * Job Card, Invoice, Sales Report, Business Report, BI dashboard
 * snapshot, Forms — wraps its content in this layout so they share
 * one set of margins, header strip, footer strip, and @media print
 * rules. Eliminates the per-page <style> blocks the Print* pages
 * currently duplicate.
 */
export interface PrintLayoutProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: Record<string, string | number | null | undefined>;
  /** Right-aligned header content (e.g. report reference, generated-on date). */
  headerRight?: ReactNode;
  /** Optional footer block (defaults to a standard AGL line). */
  footer?: ReactNode;
  /** Document body. */
  children: ReactNode;
  /** Whether the print toolbar (toolbar only on screen) is shown. */
  showToolbar?: boolean;
  /** Paper orientation. Table-heavy reports should use landscape. */
  orientation?: 'portrait' | 'landscape';
}

export function PrintLayout({
  eyebrow, title, subtitle, meta, headerRight, footer, children, showToolbar = true, orientation = 'portrait',
}: PrintLayoutProps) {
  const pageSize = orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  const pageWidth = orientation === 'landscape' ? '297mm' : '210mm';
  const pageMinHeight = orientation === 'landscape' ? '210mm' : '297mm';

  return (
    <div
      className="bg-white text-black mx-auto print-root"
      data-print-orientation={orientation}
      style={{ maxWidth: orientation === 'landscape' ? 1120 : 920, padding: 24 }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body, #root { width: 100% !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
          body { margin: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .app-shell { display: block !important; min-height: 0 !important; background: #fff !important; }
          .app-shell > header, .app-shell > footer, .app-shell > [aria-hidden='true'], .app-shell aside { display: none !important; visibility: hidden !important; }
          .app-shell > div, .app-shell main { display: block !important; width: 100% !important; max-width: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          main::before, main::after, .app-shell main::before, .app-shell main::after { content: none !important; display: none !important; }
          .print-root { box-sizing: border-box !important; box-shadow: none !important; padding: 12mm !important; margin: 0 auto !important; width: ${pageWidth} !important; min-height: ${pageMinHeight} !important; max-width: none !important; background: #fff !important; color: #000 !important; }
          .print-root table { page-break-inside: auto; }
          .print-root tr { page-break-inside: avoid; page-break-after: auto; }
          .print-root .pl-table { font-size: ${orientation === 'landscape' ? '10.5px' : '11px'} !important; }
          .print-root .pl-table th { font-size: ${orientation === 'landscape' ? '9.5px' : '10px'} !important; padding: 5px 4px !important; }
          .print-root .pl-table td { padding: 5px 4px !important; }
          .print-root .pl-table td:not(:first-child), .print-root .pl-table th:not(:first-child) { white-space: nowrap; }
          @page { size: ${pageSize}; margin: 0; }
        }
        .pl-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .pl-table th { text-align: left; font-weight: 700; border-bottom: 2px solid #1A1A1A; padding: 8px 6px; font-size: 11.5px; letter-spacing: .03em; text-transform: uppercase; }
        .pl-table td { padding: 8px 6px; border-bottom: 1px solid #ddd; }
        .pl-label { font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #666; font-size: 10.5px; }
        .pl-value { font-size: 13.5px; font-weight: 600; }
      `}</style>

      {showToolbar && (
        <div className="no-print mb-4 flex justify-end gap-2">
          <button type="button" className="btn-primary text-sm" onClick={() => window.print()}>
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>
      )}

      <header className="flex items-start justify-between gap-4 pb-3 mb-4 border-b-2 border-black">
        <div className="flex items-start gap-3">
          <img src={aglLogo} alt="AGL" className="w-12 h-12 rounded-md object-cover ring-1 ring-neutral-300" />
          <div>
            {eyebrow && <div className="pl-label">{eyebrow}</div>}
            <h1 className="text-xl font-bold mt-0.5 leading-tight">{title}</h1>
            {subtitle && <div className="text-sm text-neutral-600 mt-0.5">{subtitle}</div>}
            <div className="text-xs text-neutral-500 mt-1">AUTOMOBILES GHANA LIMITED · AGL OPS Command Center</div>
          </div>
        </div>
        <div className="text-right text-xs text-neutral-600">
          {headerRight ?? <div>Generated {new Date().toLocaleString()}</div>}
        </div>
      </header>

      {meta && Object.keys(meta).length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {Object.entries(meta).map(([k, v]) => (
            <div key={k}>
              <div className="pl-label">{k}</div>
              <div className="pl-value">{v ?? '—'}</div>
            </div>
          ))}
        </section>
      )}

      <main>{children}</main>

      {footer ?? (
        <footer className="mt-8 pt-3 border-t border-neutral-300 text-[10.5px] text-neutral-500 grid grid-cols-2 gap-3">
          <div>AGL — Plot 12, Tema Industrial Area · +233 24 000 0000 · ops@aglops.gh</div>
          <div className="text-right">Document generated by AGL OPS v1.0 · {new Date().toLocaleDateString()}</div>
        </footer>
      )}
    </div>
  );
}
