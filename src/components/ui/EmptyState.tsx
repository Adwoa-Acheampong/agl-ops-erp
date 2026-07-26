import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="bg-white rounded-2xl px-4 py-8 flex flex-col items-center text-center gap-2"
      style={{ border: '1px solid rgba(26,22,18,0.06)' }}
    >
      {Icon && (
        <span className="w-7 h-7 rounded-2xl bg-brand-50 text-brand-500 grid place-items-center mb-1">
          <Icon size={28} />
        </span>
      )}
      <h3
        className="font-serif font-medium text-ink-900"
        style={{ fontSize: '1.5rem', lineHeight: 1.2 }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="font-sans text-sm text-ink-700 leading-relaxed"
          style={{ maxWidth: '52ch' }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
