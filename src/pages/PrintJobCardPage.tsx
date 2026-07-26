import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { trpc } from '../lib/trpc';

/**
 * AGL-JC-001 — Vehicle Job Card, printable layout.
 *
 * URL: /print/jobcard/:id  where :id is the service_appointments.id
 * Print to PDF via the browser (Ctrl/Cmd-P). Print CSS hides the toolbar.
 */
export function PrintJobCardPage() {
  const { id } = useParams<{ id: string }>();
  const appointmentId = Number(id);
  const enabled = !Number.isNaN(appointmentId);

  const apptQ  = trpc.appointments.getById.useQuery({ id: appointmentId }, { enabled });
  const partsQ = trpc.appointments.listParts.useQuery({ appointmentId }, { enabled });
  const diagsQ = trpc.appointments.listDiagnostics.useQuery({ appointmentId }, { enabled });

  useEffect(() => {
    // Auto-print once data lands. Browsers may rate-limit; user can also
    // click the toolbar button.
    if (!apptQ.isLoading && apptQ.data?.success) {
      const t = setTimeout(() => { try { window.print(); } catch {} }, 350);
      return () => clearTimeout(t);
    }
  }, [apptQ.isLoading, apptQ.data]);

  if (apptQ.isLoading) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin inline" /> Loading job card…</div>;
  }
  if (!apptQ.data?.success) {
    return <div className="p-8 text-center text-brand-500">Job card not found.</div>;
  }

  const data: any = (apptQ.data as any).appointment;
  const a = data?.appointment ?? data ?? {};
  const customer = data?.customer ?? {};
  const vehicle = data?.vehicle ?? {};
  const diagnostics: any[] = (diagsQ.data as any)?.success ? (diagsQ.data as any).diagnostics ?? [] : [];
  const parts: any[] = (partsQ.data as any)?.success ? (partsQ.data as any).parts ?? [] : [];

  const partsTotal = parts.reduce((s, p) => s + Number(p.quantity ?? 0) * Number(p.sellPrice ?? 0), 0);
  const labourTotal = Number(a.serviceFee ?? a.labourTotalGhs ?? 0);
  const jobTotal = partsTotal + labourTotal;

  return (
    <div className="print-root max-w-4xl mx-auto bg-white text-ink-900 print:p-0 p-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-root { box-shadow: none !important; padding: 0 !important; }
          @page { size: A4; margin: 12mm; }
        }
        .jc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .jc-table th, .jc-table td { border: 1px solid #1A1A1A; padding: 6px 8px; vertical-align: top; }
        .jc-table th { background: #f5f5f5; text-align: left; font-weight: 700; }
        .jc-label { font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #555; }
        .jc-value { font-size: 14.5px; font-weight: 600; padding-top: 2px; min-height: 18px; }
        .jc-cell { border: 1px solid #1A1A1A; padding: 6px 8px; }
      `}</style>

      <div className="no-print mb-3 flex justify-end gap-2">
        <button type="button" className="btn-primary text-sm" onClick={() => window.print()}>
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <header className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11.5px] font-bold tracking-wider text-neutral-500">AUTOMOBILES GHANA LIMITED</div>
          <h1 className="text-xl font-bold tracking-tight">Vehicle Job Card</h1>
          <div className="text-[11.5px] text-neutral-500">Form Code: AGL-JC-001 · Version 1.0 · AGL 2026</div>
        </div>
        <div className="text-right text-[11.5px] text-neutral-500">
          CONFIDENTIAL — Internal Use Only<br />© Automobiles Ghana Limited
        </div>
      </header>

      <section className="grid grid-cols-4 gap-2 mb-3">
        <div className="jc-cell"><div className="jc-label">Job Card No.</div><div className="jc-value num">{a.vsrNo ?? `JC-${a.id}`}</div></div>
        <div className="jc-cell"><div className="jc-label">VIF No.</div><div className="jc-value num">{a.vifNo ?? '—'}</div></div>
        <div className="jc-cell"><div className="jc-label">Date Opened</div><div className="jc-value num">{a.dateIn ? new Date(a.dateIn).toLocaleDateString() : (a.scheduledDate ?? '—')}</div></div>
        <div className="jc-cell"><div className="jc-label">Date Closed</div><div className="jc-value num">{a.dateClosed ? new Date(a.dateClosed).toLocaleDateString() : '—'}</div></div>
        <div className="jc-cell col-span-2"><div className="jc-label">Workshop Supervisor</div><div className="jc-value">{a.supervisorSignoff ?? '—'}</div></div>
        <div className="jc-cell col-span-2"><div className="jc-label">Mechanic(s)</div><div className="jc-value">{a.assignedMechanic ?? '—'}</div></div>
      </section>

      <h2 className="font-bold text-sm uppercase tracking-wider mb-1 mt-3">Quick Reference</h2>
      <section className="grid grid-cols-3 gap-2 mb-3">
        <div className="jc-cell"><div className="jc-label">Customer Name</div><div className="jc-value">{customer.name ?? '—'}</div></div>
        <div className="jc-cell"><div className="jc-label">Vehicle Make / Model</div><div className="jc-value">{vehicle.make ?? '—'} {vehicle.model ?? ''} {vehicle.year ?? ''}</div></div>
        <div className="jc-cell"><div className="jc-label">Reg Plate</div><div className="jc-value num">{vehicle.registrationNo ?? '—'}</div></div>
      </section>

      <h2 className="font-bold text-sm uppercase tracking-wider mb-1 mt-3">Diagnostic Findings</h2>
      <p className="text-[11.5px] italic mb-1">⚑ Mechanic completes this after initial diagnosis ONLY. No repair work begins until the customer approves the quote.</p>
      <table className="jc-table mb-3">
        <thead>
          <tr><th style={{ width: 30 }}>#</th><th>System / Component</th><th>Finding / Fault Description</th><th style={{ width: 80 }}>Severity</th><th>Action Required</th></tr>
        </thead>
        <tbody>
          {diagnostics.length === 0
            ? Array.from({ length: 6 }, (_, i) => (
                <tr key={i}><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
              ))
            : diagnostics.map((d, i) => (
                <tr key={d.id ?? i}>
                  <td className="num">{i + 1}</td>
                  <td>{d.systemComponent ?? d.faultCode}</td>
                  <td>{d.workOrder ?? '—'}</td>
                  <td className="capitalize">{d.severity ?? '—'}</td>
                  <td>{d.actionRequired ?? '—'}</td>
                </tr>
              ))}
        </tbody>
      </table>

      <h2 className="font-bold text-sm uppercase tracking-wider mb-1 mt-3">Approved Work Order &amp; Parts</h2>
      <p className="text-[11.5px] italic mb-1">⚑ Populate ONLY after the customer has approved the diagnostic report and quotation in writing.</p>
      <table className="jc-table mb-3">
        <thead>
          <tr><th style={{ width: 30 }}>#</th><th>Part / Work Item</th><th style={{ width: 80 }}>SIR Ref</th><th style={{ width: 50 }}>Qty</th><th style={{ width: 90 }}>Unit (GHS)</th><th style={{ width: 90 }}>Total (GHS)</th></tr>
        </thead>
        <tbody>
          {parts.length === 0
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
              ))
            : parts.map((p, i) => {
                const qty = Number(p.quantity ?? 0);
                const price = Number(p.sellPrice ?? 0);
                return (
                  <tr key={p.id ?? i}>
                    <td className="num">{i + 1}</td>
                    <td>{p.partName}</td>
                    <td className="num">{p.sirRef ?? '—'}</td>
                    <td className="num">{qty}</td>
                    <td className="num">{price.toFixed(2)}</td>
                    <td className="num">{(qty * price).toFixed(2)}</td>
                  </tr>
                );
              })}
        </tbody>
      </table>

      <section className="grid grid-cols-3 gap-2 mb-3">
        <div className="jc-cell"><div className="jc-label">Parts Total</div><div className="jc-value num">GHS {partsTotal.toFixed(2)}</div></div>
        <div className="jc-cell"><div className="jc-label">Labour Total</div><div className="jc-value num">GHS {labourTotal.toFixed(2)}</div></div>
        <div className="jc-cell"><div className="jc-label">Job Total</div><div className="jc-value num">GHS {jobTotal.toFixed(2)}</div></div>
      </section>

      <h2 className="font-bold text-sm uppercase tracking-wider mb-1 mt-3">Job Completion &amp; Handover</h2>
      <section className="grid grid-cols-3 gap-2 mb-3">
        <div className="jc-cell"><div className="jc-label">Date &amp; Time Completed</div><div className="jc-value num">{a.releasedAt ? new Date(a.releasedAt).toLocaleString() : '—'}</div></div>
        <div className="jc-cell"><div className="jc-label">Vehicle Cleaned Before Handover?</div><div className="jc-value">{a.vehicleCleaned ? 'YES' : 'NO'}</div></div>
        <div className="jc-cell"><div className="jc-label">Test Drive Performed?</div><div className="jc-value uppercase">{a.testDriveStatus ?? (a.testDrivePerformed ? 'YES' : 'NO')}</div></div>
      </section>

      <section className="grid grid-cols-3 gap-2 mt-6">
        <div className="border-t border-black pt-2 text-[11.5px] text-neutral-500 text-center">
          <div className="font-semibold text-ink-900">{a.supervisorSignoff ?? '_____________________'}</div>
          Workshop Supervisor — Sign-off
        </div>
        <div className="border-t border-black pt-2 text-[11.5px] text-neutral-500 text-center">
          <div className="font-semibold text-ink-900">{a.salesRepNotified ?? '_____________________'}</div>
          Sales Rep — Customer Notified
        </div>
        <div className="border-t border-black pt-2 text-[11.5px] text-neutral-500 text-center">
          <div className="font-semibold text-ink-900">{a.customerCollected ?? '_____________________'}</div>
          Customer — Collected Vehicle
        </div>
      </section>
    </div>
  );
}
