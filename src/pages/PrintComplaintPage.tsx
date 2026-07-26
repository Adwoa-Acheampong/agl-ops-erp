import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { PrintLayout } from '../components/print/PrintLayout';

/**
 * WS4-C — Print-out for the customer-complaint record (AGL-CCR-001).
 * Mirrors the on-file paper template; opens with the print toolbar
 * showing so the user can hit Print / Save-as-PDF immediately.
 */
export function PrintComplaintPage() {
  const { id } = useParams<{ id: string }>();
  const q = trpc.complaints.list.useQuery({ status: 'all' as any }, { keepPreviousData: true });
  const rows: any[] = q.data?.success ? q.data.complaints ?? [] : [];
  const c = useMemo(() => rows.find((r: any) => String(r.id) === String(id)) ?? null, [rows, id]);

  // Auto-fire the print dialog once the layout settles.
  useEffect(() => {
    if (!c) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [c]);

  if (q.isLoading) return <div className="grid place-items-center py-16 text-neutral-500"><Loader2 size={18} className="animate-spin"/></div>;
  if (!c) return <div className="grid place-items-center py-16 text-neutral-500">Complaint not found.</div>;

  return (
    <PrintLayout
      eyebrow="AGL-CCR-001"
      title={`Complaint #${c.id}`}
      subtitle={c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
      meta={{
        Customer: c.customerName ?? '—',
        Contact:  c.customerContact ?? '—',
        Vehicle:  c.vehicleLabel ?? c.vehicle ?? '—',
        Channel:  c.channel ?? '—',
        Status:   c.status ?? '—',
        Deadline: c.resolutionDeadline ? new Date(c.resolutionDeadline).toLocaleDateString() : '—',
      }}
    >
      <Section title="Complaint">
        <p style={{ whiteSpace: 'pre-wrap' }}>{c.description ?? c.complaint ?? '—'}</p>
      </Section>
      {c.categories && Array.isArray(c.categories) && c.categories.length > 0 && (
        <Section title="Categories">
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {c.categories.map((k: string) => <li key={k}>{String(k).replace(/_/g, ' ')}</li>)}
          </ul>
        </Section>
      )}
      {c.actionsTaken && (
        <Section title="Actions taken"><p style={{ whiteSpace: 'pre-wrap' }}>{c.actionsTaken}</p></Section>
      )}
      {c.resolutionNotes && (
        <Section title="Resolution notes"><p style={{ whiteSpace: 'pre-wrap' }}>{c.resolutionNotes}</p></Section>
      )}
      <section style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <SignBlock label="Received by"/>
        <SignBlock label="Customer signature"/>
      </section>
    </PrintLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#666', marginBottom: 6 }}>{title}</h3>
      {children}
    </section>
  );
}
function SignBlock({ label }: { label: string }) {
  return (
    <div>
      <div style={{ borderTop: '1px solid #999', paddingTop: 4, color: '#666', fontSize: 11 }}>{label}</div>
      <div style={{ height: 56 }}/>
    </div>
  );
}
