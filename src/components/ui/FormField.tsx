import { ReactNode, useId } from 'react';

export interface FormFieldProps {
  label: string;
  /** Optional instructional copy below the input (e.g. "At least 8 characters."). */
  hint?: string;
  /** Optional error message; takes precedence over hint when present. */
  error?: string | null;
  /** Mark the field as required (visual indicator only — actual validation goes on the input). */
  required?: boolean;
  /** Span across multiple columns inside a parent grid. Defaults to 1. */
  span?: 1 | 2;
  children?: ReactNode;
  render?: (id: string) => ReactNode;
}

/**
 * Standard label-stacked form field used across all modal forms.
 * Stays consistent with the LoginPage Field pattern: small uppercase label,
 * input slot, optional hint or error.
 */
export function FormField({ label, hint, error, required, span = 1, children, render }: FormFieldProps) {
  const id = useId();
  return (
    <label
      className="grid gap-1 min-w-0"
      style={{ gridColumn: span === 2 ? 'span 2 / span 2' : undefined }}
    >
      <span className="field-label">
        {label}
        {required && <span className="text-brand-500 ml-0.5">*</span>}
      </span>
      {render ? render(id) : children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}
