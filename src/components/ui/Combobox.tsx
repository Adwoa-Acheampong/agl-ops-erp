import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, ChevronDown, X } from 'lucide-react';

export interface ComboboxItem {
  id: number | string;
  label: string;
  sublabel?: string;
}

export interface ComboboxProps {
  items: ComboboxItem[];
  /** Currently-selected item id, or null when nothing is picked / a "new" item is being entered. */
  value: number | string | null;
  onChange: (item: ComboboxItem | null) => void;
  /** When provided, an "Add new" entry appears at the bottom of the dropdown
   *  whenever the user has typed text that doesn't exactly match an existing
   *  item. Receives the typed text. */
  onCreateNew?: (typed: string) => void;
  placeholder?: string;
  emptyHint?: string;
  /** When true, render in a disabled/empty state (e.g. waiting on parent data). */
  disabled?: boolean;
  /** Force a specific input value (controlled). When omitted the combobox
   *  manages its own draft text. */
  inputValue?: string;
  onInputChange?: (text: string) => void;
}

/**
 * P8.2 — Filter-and-create combobox.
 *
 * Replaces the plain `<select>` for customer and vehicle pickers. The user
 * can type to filter, click an existing match, or click "Add new" to fall
 * through into an inline-create form (the parent decides what that form
 * looks like — Combobox just emits the `onCreateNew` event).
 */
export function Combobox({
  items,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Search…',
  emptyHint = 'Nothing matches.',
  disabled = false,
  inputValue,
  onInputChange,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // When a value is set externally, reflect its label in the input on close.
  useEffect(() => {
    if (value == null) return;
    const match = items.find((i) => i.id === value);
    if (match && inputValue === undefined) setDraft(match.label);
  }, [value, items, inputValue]);

  // Close on outside-click.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      window.addEventListener('mousedown', handleClickOutside);
      return () => window.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const text = inputValue ?? draft;
  const setText = (t: string) => {
    if (onInputChange) onInputChange(t);
    else setDraft(t);
  };

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items
      .filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          (i.sublabel?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 50);
  }, [items, text]);

  const exactMatch = filtered.find((i) => i.label.toLowerCase() === text.trim().toLowerCase());
  const showCreate = !!onCreateNew && text.trim().length > 0 && !exactMatch;

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white"
        style={{ background: '#FAFAFA', border: '1px solid rgba(26,22,18,0.10)' }}
      >
        <Search size={14} className="text-ink-700 shrink-0" />
        <input
          type="text"
          className="bg-transparent outline-none text-sm font-sans text-ink-900 placeholder:text-ink-700/60 flex-1 min-w-0"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value != null) onChange(null); // clear the bound id when the user starts typing
          }}
        />
        {value != null && (
          <button
            type="button"
            className="text-ink-700 hover:text-ink-900"
            onClick={() => {
              setText('');
              onChange(null);
            }}
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          className="text-ink-700 hover:text-ink-900"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle list"
          tabIndex={-1}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {open && !disabled && (
        <div
          className="absolute z-30 mt-1 w-full bg-white rounded-xl shadow-lg overflow-hidden"
          style={{ border: '1px solid rgba(26,22,18,0.10)', maxHeight: 280, overflowY: 'auto' }}
        >
          {filtered.length === 0 && !showCreate && (
            <div className="px-3 py-2 font-sans text-xs text-ink-700">{emptyHint}</div>
          )}
          {filtered.map((it) => (
            <button
              key={it.id}
              type="button"
              className="w-full text-left px-3 py-2 font-sans text-sm text-ink-900 hover:bg-canvas flex flex-col"
              onClick={() => {
                setText(it.label);
                onChange(it);
                setOpen(false);
              }}
            >
              <span className="font-semibold">{it.label}</span>
              {it.sublabel && (
                <span className="text-xs text-ink-700">{it.sublabel}</span>
              )}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 font-sans text-sm text-brand-500 hover:bg-canvas border-t flex items-center gap-1.5"
              style={{ borderColor: 'rgba(26,22,18,0.10)' }}
              onClick={() => {
                onCreateNew!(text.trim());
                setOpen(false);
              }}
            >
              <Plus size={12} /> Add new: <span className="font-semibold">"{text.trim()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
