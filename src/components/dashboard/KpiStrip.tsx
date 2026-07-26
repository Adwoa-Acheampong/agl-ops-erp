import { Wallet, ClipboardList, Users, Repeat, TrendingUp, TrendingDown, LucideIcon, Package, AlertOctagon } from 'lucide-react';
import { trpc } from '../../lib/trpc';

type Kpi = {
  label: string; value: string; caption: string;
  delta?: { dir: 'up' | 'down'; text: string };
  icon: LucideIcon;
  tone: 'red' | 'ink';
};

function ghs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function KpiStrip() {
  const inventoryQuery = trpc.inventory.list.useQuery({}, { keepPreviousData: true });
  const recallsQuery = trpc.recalls.list.useQuery(undefined, { keepPreviousData: true });
  const apptsQuery = trpc.appointments.list.useQuery(undefined, { keepPreviousData: true });
  const customersQuery = trpc.customers.list.useQuery(undefined, { keepPreviousData: true });
  const txQuery = trpc.transactions.summary.useQuery(undefined, { keepPreviousData: true });
  const subsQuery = trpc.subscriptions.listSubscriptions.useQuery(undefined, { keepPreviousData: true });

  const items: any[] = Array.isArray(inventoryQuery.data) ? inventoryQuery.data : [];
  const lowStock = items.filter(i => {
    const q = Number(i.quantity ?? 0);
    const m = Number(i.minStockLevel ?? 0);
    return q > 0 && q <= m;
  }).length;
  const outOfStock = items.filter(i => Number(i.quantity ?? 0) <= 0).length;

  const recalls = recallsQuery.data?.success ? recallsQuery.data.recalls ?? [] : [];
  const openRecalls = recalls.filter((r: any) => r.status === 'open').length;

  const appts = apptsQuery.data?.success ? apptsQuery.data.appointments ?? [] : [];
  const openJobs = appts.filter((r: any) => {
    const s = r.appointment?.status;
    return s && s !== 'Completed' && s !== 'Cancelled';
  }).length;

  const customers = customersQuery.data?.success ? customersQuery.data.customers ?? [] : [];
  const customerCount = customers.length;

  const breakdown = txQuery.data?.success ? txQuery.data.breakdown ?? [] : [];
  const grossRevenue = breakdown
    .filter((b: any) => b.type === 'sale')
    .reduce((s, b: any) => s + Number(b.total ?? 0), 0);
  const txMethods = breakdown
    .filter((b: any) => b.type === 'sale' && b.paymentMethod)
    .length;

  const subs = subsQuery.data?.success ? subsQuery.data.subscriptions ?? [] : [];
  const activeSubs = subs.filter((r: any) => r.subscription?.status === 'active');
  const mrr = activeSubs.reduce((s, r: any) => s + Number(r.plan?.monthlyPrice ?? 0), 0);

  const kpis: Kpi[] = [
    { label: 'GROSS REVENUE',    value: ghs(grossRevenue),         caption: `${txMethods || 0} payment channel${txMethods === 1 ? '' : 's'}`, icon: Wallet,        tone: 'red' },
    { label: 'OPEN JOBS',        value: String(openJobs),          caption: 'Across all bays',                                                  icon: ClipboardList, tone: 'ink' },
    { label: 'TOTAL CUSTOMERS',  value: String(customerCount),     caption: 'On the relationship ledger',                                       icon: Users,         tone: 'red' },
    { label: 'SUBSCRIPTION MRR', value: ghs(mrr),                  caption: `${activeSubs.length} active subscriber${activeSubs.length === 1 ? '' : 's'}`, icon: Repeat,        tone: 'ink' },
    {
      label: 'LOW STOCK',
      value: String(lowStock + outOfStock),
      caption: `${outOfStock} out of stock · ${lowStock} at reorder`,
      icon: Package,
      tone: outOfStock > 0 ? 'red' : 'ink',
    },
    {
      label: 'OPEN RECALLS',
      value: String(openRecalls),
      caption: openRecalls === 0 ? 'Nothing returned' : 'Awaiting resolution',
      icon: AlertOctagon,
      tone: openRecalls > 0 ? 'red' : 'ink',
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {kpis.map(k => (
        <article key={k.label} className="group card-feature flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500">{k.label}</span>
            <span className={k.tone === 'red' ? 'tile-red !w-10 !h-10 !rounded-xl' : 'tile-ink !w-10 !h-10 !rounded-xl'}>
              <k.icon size={16} />
            </span>
          </header>
          <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-black">{k.value}</div>
          <footer className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">{k.caption}</span>
            {k.delta && (
              <span className={`chip ${k.delta.dir === 'up'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-brand-50 text-brand-600'}`}>
                {k.delta.dir === 'up' ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                {k.delta.text}
              </span>
            )}
          </footer>
        </article>
      ))}
    </section>
  );
}
