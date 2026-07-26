import { useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  icon?: React.ComponentType<{ size?: string | number }>;
  /** Modal width. Defaults to a comfortable form width. */
  width?: number | string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Accessible modal dialog with backdrop dismiss, Escape close, body-scroll
 * lock, and a focus-on-mount on the first focusable child. Renders into a
 * portal at document.body so it stacks above the AppShell layout.
 */
export function Modal({ open, onClose, title, eyebrow, icon, width = 520, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape key dismiss + body scroll lock
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first input/button after paint.
    const t = window.setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button:not([data-modal-close])',
      );
      focusable?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  const Icon = icon;

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(14,10,10,0.42)',
        backdropFilter: 'blur(2px)',
        padding: '16px',
      }}
      onMouseDown={(e) => {
        // Only close on backdrop click, not on bubbled clicks from inside the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl shadow-pop"
        style={{
          width: '100%',
          maxWidth: typeof width === 'number' ? `${width}px` : width,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(26,22,18,0.10)',
          overflow: 'hidden',
        }}
      >
        <header
          className="flex items-start justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(26,22,18,0.06)' }}
        >
          <div className="min-w-0">
            {eyebrow && (
              <span
                className="font-sans text-2xs font-semibold uppercase text-brand-500 block"
                style={{ letterSpacing: '0.16em' }}
              >
                {eyebrow}
              </span>
            )}
            <div className="flex items-center gap-2">
              {Icon && (
                <span className="text-ink-700">
                  <Icon size={18} />
                </span>
              )}
              <h2 id="modal-title" className="font-serif font-medium text-ink-900" style={{ fontSize: '1.5rem', lineHeight: 1.15 }}>
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-modal-close
            aria-label="Close"
            className="shrink-0 rounded-xl p-1 text-ink-700 hover:bg-canvas transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-4 py-3">
          {children}
        </div>

        {footer && (
          <footer
            className="px-4 py-3 flex items-center justify-end gap-2"
            style={{ borderTop: '1px solid rgba(26,22,18,0.06)' }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
