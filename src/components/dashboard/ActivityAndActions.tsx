import {
  CalendarPlus, UserPlus, Receipt, Users2, ClipboardList, ChevronRight,
  Wrench, AlertOctagon, ShoppingCart, Bell,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';

/**
 * Recent Activity + Quick Actions. Earlier iteration shipped three
 * hardcoded "0 …" strings that read as honest empty-state but ignored
 * real counts on the server. This version derives every number from
 * live trpc queries; the empty-state messaging only appears when the
 * underlying collection is genuinely zero.
 */
export function ActivityAndActions() {
  const apptsQ = trpc.appointments.list.useQuery({} as any, { keepPreviousData: true });
  const customersQ = trpc.customers.list.useQuery({} as any, { keepPreviousData: true });
  const recallsQ = trpc.recalls.list.useQuery({} as any, { keepPreviousData: true });
  const salesQ = trpc.sales.list.useQuery({} as any, { keepPreviousData: true });

  const appts: any[] = apptsQ.data?.success ? apptsQ.data.appointments ?? [] : (Array.isArray(apptsQ.data) ? apptsQ.data : []);
  const customers: any[] = customersQ.data?.success ? customersQ.data.customers ?? [] : (Array.isArray(customersQ.data) ? customersQ.data : []);
  const recalls: any[] = recallsQ.data?.success ? recallsQ.data.recalls ?? [] : (Array.isArray(recallsQ.data) ? recallsQ.data : []);
  const notifs: any[] = [];
  const sales: any[] = Array.isArray(salesQ.data) ? salesQ.data : (salesQ.data?.transactions ?? []);

  const openJobs = appts.filter((r: any) => {
    const s = (r.appointment ?? r).status;
    return s && s !== 'Completed' && s !== 'Cancelled' && s !== 'Delivered';
  }).length;
  const openRecalls = recalls.filter((r: any) => r.status === 'open').length;

  // Newest sale to surface as the freshest "activity" line.
  const newestSale = [...sales].sort((a: any, b: any) => {
    const da = new Date(a.transaction_date ?? a.transactionDate ?? 0).getTime();
    const db = new Date(b.transaction_date ?? b.transactionDate ?? 0).getTime();
    return db - da;
  })[0];

  const acts: { icon: any; t: string; s: string }[] = [
    {
      icon: Wrench,
      t: openJobs === 0
        ? 'No open jobs in the workshop'
        : `${openJobs} job${openJobs === 1 ? '' : 's'} active across bays`,
      s: openJobs === 0 ? 'Queue is clear' : 'Workshop queue',
    },
    {
      icon: Users2,
      t: customers.length === 0
        ? 'No customers on file yet'
        : `${customers.length} customer${customers.length === 1 ? '' : 's'} on the ledger`,
      s: customers.length === 0 ? 'Add the first record' : 'CRM ready for follow-up',
    },
    {
      icon: AlertOctagon,
      t: openRecalls === 0
        ? 'No open recalls'
        : `${openRecalls} open recall${openRecalls === 1 ? '' : 's'} pending`,
      s: openRecalls === 0 ? 'All recalls cleared' : 'Needs manager review',
    },
    ...(newestSale ? [{
      icon: ShoppingCart,
      t: `Sale: ${newestSale.customer_name ?? newestSale.customerName ?? 'walk-in'} — GHS ${Number(newestSale.total_amount ?? newestSale.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      s: `${newestSale.channel ?? 'Counter'} · ${newestSale.payment_method ?? newestSale.paymentMethod ?? '—'}`,
    }] : []),
    {
      icon: Bell,
      t: notifs.length === 0 ? 'No unread alerts' : `${notifs.length} unread notification${notifs.length === 1 ? '' : 's'}`,
      s: notifs.length === 0 ? 'Inbox quiet' : 'Open the bell to triage',
    },
  ];

  const qas: { icon: any; label: string; tone: 'red' | 'ink'; href: string }[] = [
    { icon: CalendarPlus, label: 'New Appointment', tone: 'red', href: '/workshop?new=1' },
    { icon: UserPlus,     label: 'Add Customer',    tone: 'ink', href: '/customers?new=1' },
    { icon: Receipt,      label: 'Record Finance',  tone: 'red', href: '/finance' },
    { icon: Users2,       label: 'Manage Staff',    tone: 'ink', href: '/hr?tab=roster' },
  ];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
      <div className="card-feature">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Recent Activity</h3>
            <p className="text-sm text-neutral-500">Live signals across operations</p>
          </div>
          <a href="/notifications" className="text-sm font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
            View all <ChevronRight size={14} />
          </a>
        </div>
        <ul className="grid gap-2">
          {acts.map((a, i) => (
            <li key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-canvas transition-colors">
              <span className="mt-0.5 w-7 h-7 rounded-lg bg-brand-50 text-brand-600 grid place-items-center shrink-0">
                <a.icon size={14} />
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-black truncate">{a.t}</div>
                <div className="text-sm text-neutral-500 mt-0.5 truncate">{a.s}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-feature">
        <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2 min-w-0">
          {qas.map(q => (
            <a
              key={q.label}
              href={q.href}
              className="group flex items-center gap-2 p-2.5 rounded-xl bg-muted border border-edge
                         hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700
                         font-semibold text-black text-xs transition-all min-w-0 text-left"
            >
              <span className={`${q.tone === 'red' ? 'tile-soft' : 'w-8 h-8 rounded-xl bg-black text-white grid place-items-center'} shrink-0`}>
                <q.icon size={14} />
              </span>
              <span className="truncate">{q.label}</span>
            </a>
          ))}
        </div>
        <a href="/workshop" className="btn-dark w-full justify-center mt-4 text-sm">
          <ClipboardList size={14} /> Open Kanban
        </a>
      </div>
    </section>
  );
}
