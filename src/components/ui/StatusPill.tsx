import { LucideIcon } from 'lucide-react';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'ink';

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  icon?: LucideIcon;
  dot?: boolean;
  /** Animate the dot (pulsing ring) — reserved for *currently live* states. */
  pulse?: boolean;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Single canonical status pill — every status indicator in the app flows
 * through here so tone semantics stay consistent.
 */
export function StatusPill({
  label, tone = 'neutral', icon: Icon, dot, pulse, title, size = 'md', className = '',
}: StatusPillProps) {
  const tones: Record<StatusTone, { bg: string; text: string; ring: string; dot: string }> = {
    success: { bg: 'bg-emerald-50',  text: 'text-emerald-700', ring: 'ring-emerald-300', dot: 'bg-emerald-500' },
    warning: { bg: 'bg-amber-50',    text: 'text-amber-700',   ring: 'ring-amber-300',   dot: 'bg-amber-500'   },
    danger:  { bg: 'bg-red-50',      text: 'text-red-700',     ring: 'ring-red-300',     dot: 'bg-red-500'     },
    info:    { bg: 'bg-blue-50',     text: 'text-blue-700',    ring: 'ring-blue-300',    dot: 'bg-blue-500'    },
    neutral: { bg: 'bg-neutral-100', text: 'text-neutral-600', ring: 'ring-neutral-300', dot: 'bg-neutral-400' },
    ink:     { bg: 'bg-brand-50',    text: 'text-brand-700',   ring: 'ring-brand-200',   dot: 'bg-brand-500'   },
  };
  const t = tones[tone];
  const sizeCls = size === 'sm'
    ? 'px-1.5 py-0.5 text-[11.5px] gap-1'
    : 'px-2   py-0.5 text-2xs   gap-1';

  return (
    <span
      role="status"
      title={title ?? label}
      className={`inline-flex items-center font-semibold rounded-full ring-1 whitespace-nowrap ${t.bg} ${t.text} ${t.ring} ${sizeCls} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot} ${pulse ? 'anim-pulse-dot' : ''}`} />}
      {Icon && <Icon size={size === 'sm' ? 9 : 10} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
