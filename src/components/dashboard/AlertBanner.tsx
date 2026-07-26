import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { trpc } from '../../lib/trpc';

/**
 * Self-contained campaign loader so this banner does not depend on the
 * lazy-loaded MarketingPage chunk. Reads the same `agl-marketing-campaigns`
 * localStorage key that MarketingPage writes; subscribes to the cross-tab
 * `storage` event and the in-app `agl-marketing-changed` notifier.
 */
interface LocalCampaign { id: string; platform: string; name: string; status: string; spend: number; conversions: number; }
function loadLocalCampaigns(): LocalCampaign[] {
  try {
    const raw = localStorage.getItem('agl-marketing-campaigns');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function useLocalCampaigns(): LocalCampaign[] {
  const [list, setList] = useState<LocalCampaign[]>(() => {
    if (typeof window === 'undefined') return [];
    return loadLocalCampaigns();
  });
  useEffect(() => {
    const sync = () => setList(loadLocalCampaigns());
    window.addEventListener('agl-marketing-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('agl-marketing-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return list;
}

/**
 * Dashboard alert banner — surfaces the single highest-priority signal
 * the system can derive from real operational data (inventory, credit,
 * workshop, sales, marketing). No hardcoded mock copy.
 *
 * Source ranking, worst-first:
 *   1. Critical low / out-of-stock SKUs (parts running out)
 *   2. Overdue creditors (cash tied up past due date)
 *   3. Stale workshop jobs (started ≥ 5 days ago, still open)
 *   4. Marketing campaigns with zero / poor conversions
 *   5. No issues → quiet "all systems calm" confirmation
 */

type Severity = 'high' | 'medium' | 'low' | 'info';

interface Signal {
  severity: Severity;
  label: string;
  headline: string;
  detail: string;
  cta?: { href: string; label: string };
}

const sevToneLabel: Record<Severity, string> = {
  high:   'HIGH ALERT',
  medium: 'MEDIUM ALERT',
  low:    'NOTICE',
  info:   'STATUS',
};

const ghs = (n: number) =>
  `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AlertBanner() {
  // Pull from every operational data source. All queries are safe to
  // call in parallel; React Query dedupes when other components ask
  // for the same data. `retry: 0` so a transient server error doesn't
  // suppress the whole banner — we fall through to "ALL CLEAR".
  const inventoryQ = trpc.inventory.list.useQuery({}, { keepPreviousData: true, retry: 0 });
  const creditQ    = trpc.creditSales.list.useQuery({}, { keepPreviousData: true, retry: 0 });
  const workshopQ  = trpc.workshop.list.useQuery({}, { keepPreviousData: true, retry: 0 });
  const campaigns  = useLocalCampaigns();

  const signal: Signal | null = useMemo(() => {
    // ── 1. Inventory: items at or below minStockLevel ─────────────
    const inv: any[] = Array.isArray(inventoryQ.data) ? inventoryQ.data : [];
    const lowStock = inv.filter((it: any) => {
      const qty = Number(it.quantity ?? 0);
      const min = Number(it.minStockLevel ?? 0);
      return min > 0 && qty <= min;
    });
    const outOfStock = inv.filter((it: any) => Number(it.quantity ?? 0) === 0);
    if (outOfStock.length > 0) {
      return {
        severity: 'high',
        label: sevToneLabel.high,
        headline: `${outOfStock.length} part${outOfStock.length === 1 ? '' : 's'} out of stock`,
        detail: `Top: ${outOfStock.slice(0, 3).map((i: any) => i.itemName ?? i.itemCode).filter(Boolean).join(', ')}. Reorder before the next service booking lands.`,
        cta: { href: '/inventory', label: 'Open Inventory' },
      };
    }
    if (lowStock.length >= 3) {
      return {
        severity: 'medium',
        label: sevToneLabel.medium,
        headline: `${lowStock.length} SKUs below reorder point`,
        detail: `Plan a purchase order before fulfilment slips.`,
        cta: { href: '/inventory', label: 'Open Inventory' },
      };
    }

    // ── 2. Creditors: overdue receivables ─────────────────────────
    const credit: any[] = Array.isArray(creditQ.data) ? creditQ.data : [];
    const today = new Date().toISOString().slice(0, 10);
    const overdue = credit.filter((c: any) => {
      const paid = c.status === 'Fully Paid';
      const due  = c.dueDate ? String(c.dueDate).slice(0, 10) : '';
      return !paid && due && due < today;
    });
    const overdueAmt = overdue.reduce((s: number, c: any) => s + Number(c.amountDue ?? 0), 0);
    if (overdueAmt >= 1000) {
      return {
        severity: 'high',
        label: sevToneLabel.high,
        headline: `${ghs(overdueAmt)} overdue from ${overdue.length} creditor${overdue.length === 1 ? '' : 's'}`,
        detail: `Cash tied up past the due date. Trigger reminders or call-throughs.`,
        cta: { href: '/creditors', label: 'Open Creditors' },
      };
    }
    if (overdue.length > 0) {
      return {
        severity: 'medium',
        label: sevToneLabel.medium,
        headline: `${overdue.length} overdue creditor${overdue.length === 1 ? '' : 's'} (${ghs(overdueAmt)})`,
        detail: `Past due — review collection sequence.`,
        cta: { href: '/creditors', label: 'Open Creditors' },
      };
    }

    // ── 3. Workshop: jobs started ≥ 5 days ago, still open ────────
    const workshop: any[] = Array.isArray(workshopQ.data) ? workshopQ.data : [];
    const fiveDaysMs = 5 * 86_400_000;
    const stale = workshop.filter((j: any) => {
      const status = String(j.status ?? '').toLowerCase();
      if (status === 'completed' || status === 'delivered' || status === 'cancelled') return false;
      const start = j.jobDate ?? j.job_date ?? j.createdAt;
      if (!start) return false;
      const age = Date.now() - new Date(start).getTime();
      return age >= fiveDaysMs;
    });
    if (stale.length > 0) {
      return {
        severity: 'medium',
        label: sevToneLabel.medium,
        headline: `${stale.length} workshop job${stale.length === 1 ? '' : 's'} stalled past 5 days`,
        detail: `Check parts, customer approval, or mechanic load before they age further.`,
        cta: { href: '/workshop', label: 'Open Job Board' },
      };
    }

    // ── 4. Marketing: bad CPL on active campaigns ─────────────────
    const live = campaigns.filter(c => c.status === 'active');
    const liveCandidates = live
      .map(c => ({ c, spend: Number(c.spend ?? 0), conversions: Number(c.conversions ?? 0) }))
      .filter(x => x.spend >= 100);
    if (liveCandidates.length > 0) {
      const worst = liveCandidates.sort((a, b) => {
        const cpa = (x: typeof a) => x.conversions > 0 ? x.spend / x.conversions : Infinity;
        return cpa(b) - cpa(a);
      })[0];
      const cpa = worst.conversions > 0 ? worst.spend / worst.conversions : Infinity;
      if (worst.conversions === 0 && worst.spend >= 500) {
        return {
          severity: 'medium',
          label: sevToneLabel.medium,
          headline: `${worst.c.platform} — "${worst.c.name}" spent ${ghs(worst.spend)}, 0 conversions`,
          detail: `Pause campaign or reallocate budget to a higher-converting channel.`,
          cta: { href: '/marketing', label: 'Open Marketing' },
        };
      }
      if (cpa > 200 && Number.isFinite(cpa)) {
        return {
          severity: 'low',
          label: sevToneLabel.low,
          headline: `High CPL on ${worst.c.platform} "${worst.c.name}"`,
          detail: `Cost per conversion is ${ghs(cpa)} — review creative or reduce daily cap.`,
          cta: { href: '/marketing', label: 'Open Marketing' },
        };
      }
    }

    // ── 5. All clear — quiet confirmation ─────────────────────────
    return {
      severity: 'info',
      label: 'ALL CLEAR',
      headline: 'No critical signals across operations.',
      detail: 'Inventory, creditors, workshop and marketing are all within thresholds.',
    };
  }, [inventoryQ.data, creditQ.data, workshopQ.data, campaigns]);

  if (!signal) return null;

  const isClear = signal.severity === 'info';
  return (
    <div
      className={`card-feature border-l-4 flex flex-col md:flex-row md:items-center gap-4 ${
        isClear
          ? '!border-l-emerald-500'
          : signal.severity === 'high'
          ? '!border-l-brand-500'
          : signal.severity === 'medium'
          ? '!border-l-amber-500'
          : '!border-l-neutral-300'
      }`}
    >
      <div className="flex items-start gap-3 flex-1">
        <span
          className={`!w-10 !h-10 !rounded-xl grid place-items-center text-white ${
            isClear ? 'bg-emerald-500' : signal.severity === 'medium' ? 'bg-amber-500' : signal.severity === 'low' ? 'bg-neutral-700' : 'bg-brand-500'
          }`}
        >
          {isClear ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        </span>
        <div>
          <div
            className={`text-xs font-bold tracking-[0.14em] ${
              isClear ? 'text-emerald-700' : signal.severity === 'medium' ? 'text-amber-700' : signal.severity === 'low' ? 'text-neutral-700' : 'text-brand-600'
            }`}
          >
            {signal.label}
          </div>
          <div className="font-semibold text-black mt-1">{signal.headline}</div>
          <div className="text-sm text-neutral-500 mt-0.5">{signal.detail}</div>
        </div>
      </div>
      {signal.cta && (
        <div className="flex gap-2 md:ml-4">
          <a href={signal.cta.href} className="btn-primary !py-2.5 !px-5 !rounded-xl text-sm">
            {signal.cta.label}
          </a>
        </div>
      )}
    </div>
  );
}
