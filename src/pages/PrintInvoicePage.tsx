import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { computeGhanaTax, ghs } from '../lib/ghanaTax';

/**
 * Proforma / Invoice page for a single service appointment.
 *
 * URL: /print/invoice/:id  where :id is service_appointments.id
 *
 * Layout adapted from the Unsullied Autos invoice the user shared — clean
 * left-aligned header, customer / vehicle block, single-table line items,
 * Ghana tax breakdown, total. Print to PDF via the browser.
 */
export function PrintInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const appointmentId = Number(id);
  const enabled = !Number.isNaN(appointmentId);

  const apptQ  = trpc.appointments.getById.useQuery({ id: appointmentId }, { enabled });
  const partsQ = trpc.appointments.listParts.useQuery({ appointmentId }, { enabled });

  useEffect(() => {
    if (!apptQ.isLoading && apptQ.data?.success) {
      const t = setTimeout(() => { try { window.print(); } catch {} }, 350);
      return () => clearTimeout(t);
    }
  }, [apptQ.isLoading, apptQ.data]);

  if (apptQ.isLoading) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin inline" /> Loading invoice…</div>;
  }
  if (!apptQ.data?.success) {
    return <div className="p-8 text-center text-brand-500">Appointment not found.</div>;
  }

  const data: any = (apptQ.data as any).appointment;
  const a = data?.appointment ?? data ?? {};
  const customer = data?.customer ?? {};
  const vehicle = data?.vehicle ?? {};
  const parts: any[] = (partsQ.data as any)?.success ? (partsQ.data as any).parts ?? [] : [];

  const labour = Number(a.serviceFee ?? a.labourTotalGhs ?? 0);
  const lineItems = [
    ...parts.map(p => ({
      qty: Number(p.quantity ?? 0),
      description: p.partName,
      unit: Number(p.sellPrice ?? 0),
    })),
    ...(labour > 0 ? [{ qty: 1, description: 'LABOUR', unit: labour }] : []),
  ];
  const subtotal = lineItems.reduce((s, l) => s + l.qty * l.unit, 0);
  const tax = computeGhanaTax({ netBeforeDiscount: subtotal });

  const invoiceNo = a.receiptNo ?? a.vsrNo ?? `INV-${a.id}`;
  const invoiceDate = a.dateIn ? new Date(a.dateIn) : new Date(a.createdAt ?? Date.now());
  const dueDate = a.expectedCollection ? new Date(a.expectedCollection) : new Date(invoiceDate.getTime() + 30 * 86_400_000);

  return (
    <div className="print-root max-w-3xl mx-auto bg-white text-ink-900 print:p-0 p-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-root { box-shadow: none !important; padding: 12mm !important; }
          @page { size: A4; margin: 0; }
        }
        .inv-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .inv-table th { text-align: left; font-weight: 700; border-bottom: 2px solid #1A1A1A; padding: 8px 6px; font-size: 12.5px; letter-spacing: .03em; text-transform: uppercase; }
        .inv-table td { padding: 8px 6px; border-bottom: 1px solid #ddd; }
        .inv-meta { font-size: 12.5px; }
        .inv-meta .label { font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #666; font-size: 10.5px; }
        .inv-meta .value { font-size: 14.5px; font-weight: 600; }
      `}</style>

      <div className="no-print mb-4 flex justify-end gap-2">
        <button type="button" className="btn-primary text-sm" onClick={() => window.print()}>
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <header className="mb-6">
        <div className="text-2xl font-extrabold tracking-tight text-brand-500">AUTOMOBILES GHANA LIMITED</div>
        <div className="text-xs text-neutral-500 mt-0.5">Quality Parts · Trusted Service · Professional Standards</div>
        <h1 className="text-3xl font-bold mt-3 tracking-tight">PROFORMA INVOICE</h1>
      </header>

      <section className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <div className="inv-meta">
            <div className="label mb-1">Sent To</div>
            <div className="value">{customer.name ?? '—'}</div>
            <div className="text-xs text-neutral-600">{customer.phone ?? ''}</div>
            <div className="text-xs text-neutral-600">{customer.email ?? ''}</div>
            <div className="text-sm mt-2">{vehicle.make ?? ''} {vehicle.model ?? ''} {vehicle.year ?? ''}</div>
            <div className="text-xs num text-neutral-600">{vehicle.registrationNo ?? ''}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="inv-meta mb-2">
            <span className="label">Invoice #</span><br />
            <span className="value num">{invoiceNo}</span>
          </div>
          <div className="inv-meta mb-2">
            <span className="label">Invoice Date</span><br />
            <span className="value num">{invoiceDate.toLocaleDateString()}</span>
          </div>
          <div className="inv-meta">
            <span className="label">Due Date</span><br />
            <span className="value num">{dueDate.toLocaleDateString()}</span>
          </div>
        </div>
      </section>

      <table className="inv-table mb-6">
        <thead>
          <tr>
            <th style={{ width: 50 }}>QTY</th>
            <th>DESCRIPTION</th>
            <th style={{ width: 120, textAlign: 'right' }}>UNIT PRICE</th>
            <th style={{ width: 120, textAlign: 'right' }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 && (
            <tr><td colSpan={4} className="text-center text-neutral-500 py-4">No line items yet.</td></tr>
          )}
          {lineItems.map((l, i) => (
            <tr key={i}>
              <td className="num">{l.qty}</td>
              <td>{l.description}</td>
              <td className="num text-right">{l.unit.toFixed(2)}</td>
              <td className="num text-right">{(l.qty * l.unit).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex justify-end mb-8">
        <table className="text-sm" style={{ width: 320 }}>
          <tbody>
            <tr><td className="text-neutral-600 py-1">Subtotal</td><td className="num text-right py-1">{ghs(subtotal)}</td></tr>
            <tr><td className="text-neutral-600 py-1">NHIL 2.5%</td><td className="num text-right py-1">{ghs(tax.nhil)}</td></tr>
            <tr><td className="text-neutral-600 py-1">GETFund 2.5%</td><td className="num text-right py-1">{ghs(tax.getfund)}</td></tr>
            <tr><td className="text-neutral-600 py-1">COVID 1%</td><td className="num text-right py-1">{ghs(tax.covid)}</td></tr>
            <tr><td className="text-neutral-600 py-1">VAT 15%</td><td className="num text-right py-1">{ghs(tax.vat)}</td></tr>
            <tr style={{ borderTop: '2px solid #1A1A1A' }}>
              <td className="font-bold py-2">TOTAL</td>
              <td className="num text-right py-2 text-lg font-extrabold text-brand-500">GH¢ {tax.gross.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="border-t pt-3 text-[11.5px] text-neutral-500 grid grid-cols-2 gap-3">
        <div>
          <div className="font-bold text-ink-900 mb-1">Terms &amp; Conditions</div>
          <div>Payment due by the date stated above. Late payments may attract 5% per month.</div>
          <div>Parts under manufacturer warranty only — please retain this invoice.</div>
          <div className="mt-2 italic">Thank you for choosing Automobiles Ghana Limited.</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-ink-900 mb-1">Contact</div>
          <div>Accra, Ghana</div>
          <div>WhatsApp: configurable in tenant settings</div>
          <div>Email: configurable in tenant settings</div>
        </div>
      </footer>
    </div>
  );
}
