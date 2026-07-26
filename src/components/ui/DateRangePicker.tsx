/**
 * Shared date range picker. Renders a preset segmented control
 * (Today / Week / Month / Quarter / Year / All / Custom) and
 * optional two date inputs when Custom is active.
 *
 * Used by Schedule (WS6-B), Business Reporting (WS4-A), BI Dashboard
 * (WS4-B), Performance tab, Sales filter.
 */
import { useMemo } from 'react';

export type RangePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export interface DateRange { from: Date; to: Date; label: string; }

export function rangeFor(preset: RangePreset, customFrom?: string, customTo?: string, now = new Date()): DateRange {
  const eod = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  const sod = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  if (preset === 'today')   return { from: sod(now), to: eod(now), label: 'Today' };
  if (preset === 'week')    { const s = sod(now); s.setDate(now.getDate() - now.getDay()); return { from: s, to: eod(now), label: 'This week' }; }
  if (preset === 'month')   return { from: sod(new Date(now.getFullYear(), now.getMonth(), 1)), to: eod(now), label: 'This month' };
  if (preset === 'quarter') { const q = Math.floor(now.getMonth() / 3); return { from: sod(new Date(now.getFullYear(), q * 3, 1)), to: eod(now), label: 'This quarter' }; }
  if (preset === 'year')    return { from: sod(new Date(now.getFullYear(), 0, 1)), to: eod(now), label: 'This year' };
  if (preset === 'all')     return { from: new Date(2000, 0, 1), to: eod(now), label: 'All time' };
  // custom
  const from = customFrom ? sod(new Date(customFrom)) : sod(new Date(2000, 0, 1));
  const to   = customTo   ? eod(new Date(customTo))   : eod(now);
  return { from, to, label: `${customFrom || '…'} → ${customTo || '…'}` };
}

export function DateRangePicker({
  preset, onPresetChange, customFrom, customTo, onCustomFromChange, onCustomToChange,
  presets = ['today', 'week', 'month', 'quarter', 'year', 'all', 'custom'],
}: {
  preset: RangePreset;
  onPresetChange: (p: RangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  presets?: RangePreset[];
}) {
  const labels = useMemo<Record<RangePreset, string>>(() => ({
    today: 'Today', week: 'This week', month: 'This month',
    quarter: 'This quarter', year: 'This year', all: 'All time', custom: 'Custom',
  }), []);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPresetChange(p)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            preset === p ? 'bg-brand-500 text-white' : 'bg-white border border-line text-neutral-600 hover:bg-canvas'
          }`}
        >
          {labels[p]}
        </button>
      ))}
      {preset === 'custom' && (
        <span className="inline-flex items-center gap-1 text-xs">
          <input type="date" className="field-input text-xs" value={customFrom} onChange={(e) => onCustomFromChange(e.target.value)} />
          <span className="text-neutral-500">→</span>
          <input type="date" className="field-input text-xs" value={customTo} onChange={(e) => onCustomToChange(e.target.value)} />
        </span>
      )}
    </div>
  );
}
