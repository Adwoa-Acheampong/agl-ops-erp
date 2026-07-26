import { useEffect, useState, useMemo } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { ghs } from '../lib/ghanaTax';

/**
 * Daily / multi-day Sales Report matching the AGL Sales Report format
 * the team uses on paper.
 *
 * Query params:
 *   /print/sales-report?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * If params are omitted, defaults to "today only".
 *
 * Sections mirror the paper template:
 *   1. Sales Log (per-day, numbered, payment method short code)
 *   2. Outstanding Credit Sales (excluded from totals)
 *   3. Expenses (Petty Cash vs Sales Cash, "Deducted" Yes/No)
 *   4. Summary table per day: Gross / Sales-cash expenses / Petty-cash
 *      expenses / Net revenue, plus N-day net total.
 */

const PAY_SHORTHAND: Record<string, string> = {
  Cash: 'Cash', cash: 'Cash',
  MoMo: 'MoMo', momo: 'MoMo', mobile_money: 'MoMo',
  Credit: 'Credit', credit: 'Credit',
  'Bank Transfer': 'Bank', bank: 'Bank', bank_transfer: 'Bank',
  POS: 'POS', card: 'Card',
};

export function PrintSalesReportPage() {
  const params = new URLSearchParams(window.location.search);
  const today = new Date().toISOString().slice(0, 10);
  const start = params.get('start') ?? today;
  const end = params.get('end') ?? start;

  const [startDate, setStartDate] = useState(start);
  const [endDate, setEndDate] = useState(end);

  const startDt = new Date(startDate); startDt.setHours(0, 0, 0, 0);
  const endDt = new Date(endDate); endDt.setHours(23, 59, 59, 999);

  const salesQ = trpc.sales.list.useQuery({ startDate: startDt, endDate: endDt } as any, { keepPreviousData: true });
  const expensesQ = trpc.expenses.list.useQuery({ startDate: startDt, endDate: endDt } as any, { keepPreviousData: true });

  const sales: any[] = Array.isArray(salesQ.data) ? salesQ.data : ((salesQ.data as any)?.transactions ?? []);
  const expenses: any[] = Array.isArray(expensesQ.data) ? expensesQ.data : ((expensesQ.data as any)?.expenses ?? []);

  // Group by day. Date format YYYY-MM-DD as the key.
  const byDay = useMemo(() => {
    const map = new Map<string, { sales: any[]; expenses: any[] }>();
    for (let d = new Date(startDt); d <= endDt; d.setDate(d.getDate() + 1)) {
      map.set(d.toISOString().slice(0, 10), { sales: [], expenses: [] });
    }
    for (const s of sales) {
      const k = (s.transactionDate ?? s.transaction_date ?? '').slice(0, 10);
      if (map.has(k)) map.get(k)!.sales.push(s);
    }
    for (const e of expenses) {
      const k = (e.expenseDate ?? e.expense_date ?? '').slice(0, 10);
      if (map.has(k)) map.get(k)!.expenses.push(e);
    }
    return Array.from(map.entries()).map(([day, v]) => ({ day, ...v }));
  }, [sales, expenses, startDate, endDate]);

  const totals = useMemo(() => {
    return byDay.map(({ day, sales, expenses }) => {
      const credit = sales.filter((s: any) => (s.paymentMethod ?? s.payment_method) === 'Credit' || s.status === 'Pending Payment');
      const nonCredit = sales.filter((s: any) => !credit.includes(s));
      const gross = nonCredit.reduce((sum, s: any) => sum + Number(s.totalAmount ?? s.total_amount ?? 0), 0);
      const outstanding = credit.reduce((sum, s: any) => sum + Number(s.totalAmount ?? s.total_amount ?? 0), 0);
      const salesCashExp = expenses.filter((e: any) => e.deductedFromSales).reduce((sum, e: any) => sum + Number(e.amount ?? 0), 0);
      const pettyCashExp = expenses.filter((e: any) => !e.deductedFromSales).reduce((sum, e: any) => sum + Number(e.amount ?? 0), 0);
      const net = gross - salesCashExp;
      return { day, gross, outstanding, salesCashExp, pettyCashExp, net, salesCount: sales.length, creditCount: credit.length };
    });
  }, [byDay]);

  const grandNet = totals.reduce((s, t) => s + t.net, 0);

  useEffect(() => {
    if (!salesQ.isLoading && !expensesQ.isLoading) {
      const t = setTimeout(() => { try { window.print(); } catch {} }, 400);
      return () => clearTimeout(t);
    }
  }, [salesQ.isLoading, expensesQ.isLoading]);

  return (
    <div className="print-root max-w-4xl mx-auto bg-white text-ink-900 print:p-0 p-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-root { box-shadow: none !important; padding: 12mm !important; }
          @page { size: A4; margin: 0; }
        }
        .sr-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .sr-table th, .sr-table td { border-bottom: 1px solid #ddd; padding: 5px 8px; vertical-align: top; }
        .sr-table th { background: #f5f5f5; text-align: left; font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; }
        .day-header { background: #1A1A1A; color: white; padding: 6px 10px; margin-top: 16px; font-weight: 700; }
      `}</style>

      <div className="no-print mb-3 flex items-end gap-2 justify-between">
        <div className="flex items-end gap-2">
          <label className="text-xs">
            <span className="block text-neutral-500 mb-0.5">From</span>
            <input type="date" className="field-input text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="text-xs">
            <span className="block text-neutral-500 mb-0.5">To</span>
            <input type="date" className="field-input text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => window.print()}>
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <header className="border-b-2 border-black pb-2 mb-3">
        <div className="text-[11.5px] font-bold tracking-wider text-neutral-500">AUTOMOBILES GHANA LIMITED</div>
        <h1 className="text-xl font-bold tracking-tight">Sales Report — {new Date(startDate).toLocaleDateString()} {startDate !== endDate ? `to ${new Date(endDate).toLocaleDateString()}` : ''}</h1>
        <div className="text-[11.5px] text-neutral-500 mt-0.5">
          Payment shorthand: <b>M</b> = MoMo · <b>C</b> = Cash · <b>Bank</b> = Bank Transfer · <b>Credit</b> = Credit Sale
        </div>
      </header>

      {(salesQ.isLoading || expensesQ.isLoading) && (
        <div className="text-center text-sm text-neutral-500 py-4"><Loader2 className="animate-spin inline" /> Loading…</div>
      )}

      <h2 className="font-bold text-sm uppercase tracking-wider mb-1 mt-4">Sales Log</h2>
      {byDay.map(({ day, sales }) => (
        <div key={day}>
          <div className="day-header">{new Date(day).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short' })}</div>
          <table className="sr-table mb-3">
            <thead>
              <tr><th style={{ width: 30 }}>#</th><th>Description</th><th style={{ width: 50 }}>Pay</th><th style={{ width: 100, textAlign: 'right' }}>Amount (GHS)</th></tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={4} className="text-center text-neutral-500 italic py-2">No sales recorded.</td></tr>
              )}
              {sales.map((s: any, i: number) => (
                <tr key={s.id ?? i}>
                  <td className="num">{i + 1}</td>
                  <td>{s.partService ?? s.part_service ?? '—'}{s.customerName ? ` (${s.customerName})` : ''}</td>
                  <td>{PAY_SHORTHAND[s.paymentMethod ?? s.payment_method] ?? (s.paymentMethod ?? '—')}</td>
                  <td className="num text-right">{Number(s.totalAmount ?? s.total_amount ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Outstanding credit sales */}
      <h2 className="font-bold text-sm uppercase tracking-wider mt-4 mb-1">▣ Outstanding Credit Sales (excluded from totals)</h2>
      <table className="sr-table mb-3">
        <thead>
          <tr><th>Date</th><th>Customer</th><th>Description</th><th style={{ width: 100, textAlign: 'right' }}>GHS</th></tr>
        </thead>
        <tbody>
          {sales.filter((s: any) => (s.paymentMethod ?? s.payment_method) === 'Credit' || s.status === 'Pending Payment').length === 0 && (
            <tr><td colSpan={4} className="text-center text-neutral-500 italic py-2">No outstanding credit sales.</td></tr>
          )}
          {sales.filter((s: any) => (s.paymentMethod ?? s.payment_method) === 'Credit' || s.status === 'Pending Payment').map((s: any, i) => (
            <tr key={s.id ?? i}>
              <td className="num">{new Date(s.transactionDate ?? s.transaction_date).toLocaleDateString()}</td>
              <td>{s.customerName ?? '—'}</td>
              <td>{s.partService ?? s.part_service}</td>
              <td className="num text-right">{Number(s.totalAmount ?? s.total_amount ?? 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Expenses */}
      <h2 className="font-bold text-sm uppercase tracking-wider mt-4 mb-1">Expenses</h2>
      <table className="sr-table mb-3">
        <thead>
          <tr><th>Date</th><th>Item</th><th style={{ width: 100, textAlign: 'right' }}>Amount (GHS)</th><th style={{ width: 100 }}>Source</th><th style={{ width: 80 }}>Deducted?</th></tr>
        </thead>
        <tbody>
          {expenses.length === 0 && (
            <tr><td colSpan={5} className="text-center text-neutral-500 italic py-2">No expenses recorded.</td></tr>
          )}
          {expenses.map((e: any, i: number) => (
            <tr key={e.id ?? i}>
              <td className="num">{new Date(e.expenseDate ?? e.expense_date).toLocaleDateString()}</td>
              <td>{e.description}</td>
              <td className="num text-right">{Number(e.amount ?? 0).toFixed(2)}</td>
              <td className="capitalize">{(e.cashSource ?? '').replace('_', ' ') || (e.paymentMethod ?? '—')}</td>
              <td>{e.deductedFromSales ? 'Yes' : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <h2 className="font-bold text-sm uppercase tracking-wider mt-6 mb-1">Summary</h2>
      <table className="sr-table">
        <thead>
          <tr><th>Day</th><th style={{ textAlign: 'right' }}>Gross Revenue</th><th style={{ textAlign: 'right' }}>Sales-cash Expenses (deducted)</th><th style={{ textAlign: 'right' }}>Petty-cash Expenses (not deducted)</th><th style={{ textAlign: 'right' }}>Net Revenue</th></tr>
        </thead>
        <tbody>
          {totals.map((t) => (
            <tr key={t.day}>
              <td>{new Date(t.day).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}</td>
              <td className="num text-right">{ghs(t.gross)}</td>
              <td className="num text-right text-brand-500">({ghs(t.salesCashExp)})</td>
              <td className="num text-right text-neutral-500">({ghs(t.pettyCashExp)})</td>
              <td className="num text-right font-bold">{ghs(t.net)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #1A1A1A' }}>
            <td className="font-bold py-2">{totals.length}-day Net Total</td>
            <td colSpan={3}></td>
            <td className="num text-right font-extrabold text-brand-500 text-lg">{ghs(grandNet)}</td>
          </tr>
        </tbody>
      </table>

      <footer className="text-[11.5px] text-neutral-500 text-center mt-6">
        Generated {new Date().toLocaleString()} · Automobiles Ghana Limited · Accra, Ghana
      </footer>
    </div>
  );
}
