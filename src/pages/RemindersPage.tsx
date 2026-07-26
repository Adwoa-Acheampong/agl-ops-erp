import { FormEvent, useState } from 'react';
import { MessageCircle, Plus, Send, Clock, Loader2, Pencil } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import {
  EmptyState,
  Modal,
  FormField,
  Combobox,
  type ComboboxItem,
} from '../components/ui';
import { trpc } from '../lib/trpc';

type TemplateCategory = 'service_due' | 'payment_reminder' | 'renewal' | 'follow_up' | 'general';

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'service_due',      label: 'Service due' },
  { value: 'payment_reminder', label: 'Payment reminder' },
  { value: 'renewal',          label: 'Renewal' },
  { value: 'follow_up',        label: 'Follow-up' },
  { value: 'general',          label: 'General' },
];

const STATUS_TONE: Record<string, string> = {
  sent: 'text-ink-900',
  queued: 'text-warning',
  failed: 'text-brand-500',
  delivered: 'text-ink-900',
  read: 'text-ink-900',
};

interface TemplateRow {
  id: number;
  name: string;
  category: TemplateCategory;
  body: string;
  variables: string[] | null;
  active: boolean;
}

export function RemindersPage() {
  const [composeOpen, setComposeOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);

  const utils = trpc.useUtils();
  const templatesQuery = trpc.reminders.listTemplates.useQuery(undefined, { keepPreviousData: true });
  const deliveriesQuery = trpc.reminders.listDeliveries.useQuery(
    { limit: 50 },
    { keepPreviousData: true },
  );
  const statusQuery = trpc.reminders.status.useQuery();

  const templates = templatesQuery.data?.success ? templatesQuery.data.templates ?? [] : [];
  const deliveries = deliveriesQuery.data?.success ? deliveriesQuery.data.deliveries ?? [] : [];
  const isWhatsappConfigured = statusQuery.data?.configured ?? false;

  const refresh = () => {
    utils.reminders.listTemplates.invalidate();
    utils.reminders.listDeliveries.invalidate();
  };

  return (
    <PageShell
      eyebrow="Outreach"
      title="Reminders"
      intro="Service due notices, payment follow-ups and bespoke communications — delivered on WhatsApp with the calm consistency of a private office."
      actions={
        <>
          <button
            className="btn-outline text-sm disabled:opacity-50"
            onClick={() => setComposeOpen(true)}
            disabled={templates.filter((t: any) => t.active).length === 0}
            title={templates.filter((t: any) => t.active).length === 0 ? 'Create an active template first' : undefined}
          >
            <Send size={14} /> Compose Now
          </button>
          <button className="btn-primary text-sm" onClick={() => setTemplateModalOpen(true)}>
            <Plus size={14} /> New Template
          </button>
        </>
      }
    >
      {!isWhatsappConfigured && (
        <div
          className="rounded-2xl px-4 py-3 font-sans text-sm bg-white"
          style={{ border: '1px solid rgba(160,48,64,0.32)', color: '#A03040' }}
        >
          WhatsApp delivery is not configured. Sends will be queued but won't reach customers
          until <code>WHATSAPP_*</code> env vars are set.
        </div>
      )}

      {/* ── Templates section ─────────────────────────────────────── */}
      <section>
        <header className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-sans text-2xl font-semibold text-ink-900">Templates</h2>
          <span className="font-sans text-xs text-ink-700">
            {templates.length} {templates.length === 1 ? 'template' : 'templates'} on file.
          </span>
        </header>
        {templatesQuery.isLoading ? (
          <div className="bg-white rounded-2xl px-4 py-6 text-center font-sans text-sm text-ink-700"
               style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" /> Loading templates…
            </span>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-2xl px-4 py-6 text-center font-sans text-sm text-ink-700"
               style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
            No templates yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {templates.map((t: any) => (
              <article
                key={t.id}
                className="bg-white rounded-2xl p-4 flex flex-col gap-1.5 min-w-0 relative"
                style={{ border: '1px solid rgba(26,22,18,0.06)' }}
              >
                <button
                  type="button"
                  className="absolute top-3 right-3 rounded-lg p-1 text-ink-700 hover:bg-canvas hover:text-ink-900"
                  onClick={() => setEditingTemplate({
                    id: t.id,
                    name: t.name,
                    category: t.category,
                    body: t.body,
                    variables: t.variables ?? null,
                    active: !!t.active,
                  })}
                  aria-label={`Edit ${t.name}`}
                  title="Edit template"
                >
                  <Pencil size={14} />
                </button>
                <span className="font-sans text-xs font-semibold uppercase text-ink-700"
                      style={{ letterSpacing: '0.08em' }}>
                  {CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}
                </span>
                <h3 className="font-serif font-medium text-ink-900" style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
                  {t.name}
                </h3>
                <p className="font-sans text-sm text-ink-700 leading-relaxed whitespace-pre-line">
                  {t.body}
                </p>
                {!t.active && (
                  <span className="font-sans text-2xs uppercase tracking-luxe text-warning mt-1">
                    Inactive
                  </span>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Deliveries section ────────────────────────────────────── */}
      <section className="mt-4">
        <header className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-sans text-2xl font-semibold text-ink-900">Delivery Log</h2>
          <span className="font-sans text-xs text-ink-700">
            <Clock size={12} className="inline mr-1" />
            {deliveries.length} most recent.
          </span>
        </header>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="t-th">Sent</th>
                  <th className="t-th">To</th>
                  <th className="t-th">Body</th>
                  <th className="t-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveriesQuery.isLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin" /> Loading deliveries…
                      </span>
                    </td>
                  </tr>
                )}
                {!deliveriesQuery.isLoading && deliveries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      No reminders delivered yet.
                    </td>
                  </tr>
                )}
                {deliveries.map((d: any) => (
                  <tr key={d.id}>
                    <td className="t-td num">
                      {d.sentAt
                        ? new Date(d.sentAt).toLocaleString()
                        : d.createdAt
                          ? new Date(d.createdAt).toLocaleString()
                          : '—'}
                    </td>
                    <td className="t-td num">{d.toPhone ?? '—'}</td>
                    <td className="t-td" style={{ maxWidth: 360 }}>
                      <span className="line-clamp-2 block">{d.renderedBody}</span>
                    </td>
                    <td className={`t-td capitalize ${STATUS_TONE[d.status] ?? ''}`}>
                      {d.status ?? '—'}
                      {d.status === 'failed' && d.failureReason && (
                        <span className="block text-xs text-brand-500/80 mt-0.5">
                          {d.failureReason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {templates.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="No templates configured"
          description="Compose your first template — a service due notice, perhaps — and decide which customers should receive it. Variables like {{customer_name}} and {{plate}} are filled at send time."
          action={
            <button className="btn-primary text-sm" onClick={() => setTemplateModalOpen(true)}>
              <Plus size={14} /> Create Your First Template
            </button>
          }
        />
      )}

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        templates={templates as TemplateRow[]}
        onSent={() => {
          setComposeOpen(false);
          refresh();
        }}
      />

      <TemplateModal
        open={templateModalOpen}
        editing={null}
        onClose={() => setTemplateModalOpen(false)}
        onSaved={() => {
          setTemplateModalOpen(false);
          refresh();
        }}
      />

      <TemplateModal
        open={editingTemplate !== null}
        editing={editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSaved={() => {
          setEditingTemplate(null);
          refresh();
        }}
      />
    </PageShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   Compose modal — pick template + customer, send immediately
// ───────────────────────────────────────────────────────────────────────────

function ComposeModal({
  open,
  onClose,
  templates,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateRow[];
  onSent: () => void;
}) {
  const customersQuery = trpc.customers.list.useQuery(undefined, { keepPreviousData: true });
  const customers = customersQuery.data?.success ? customersQuery.data.customers ?? [] : [];

  const activeTemplates = templates.filter((t) => t.active);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customerVehicles = (() => {
    if (customerId == null) return [];
    const c = customers.find((x: any) => x.id === customerId) as any;
    return (c?.vehicles ?? []) as Array<{ id: number; registrationNo: string; make: string | null; model: string | null }>;
  })();

  const customerItems: ComboboxItem[] = customers.map((c: any) => ({
    id: c.id, label: c.name, sublabel: c.phone,
  }));
  const vehicleItems: ComboboxItem[] = customerVehicles.map((v) => ({
    id: v.id,
    label: v.registrationNo,
    sublabel: [v.make, v.model].filter(Boolean).join(' ') || undefined,
  }));

  const sendMutation = trpc.reminders.sendNow.useMutation({
    onSuccess: () => {
      setTemplateId(null);
      setCustomerId(null);
      setVehicleId(null);
      setError(null);
      onSent();
    },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (templateId == null) return setError('Pick a template.');
    if (customerId == null) return setError('Pick a customer.');
    sendMutation.mutate({
      templateId,
      customerId,
      vehicleId: vehicleId ?? undefined,
    });
  };

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="WhatsApp"
      title="Compose Now"
      footer={
        <>
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={sendMutation.isLoading}>
            Cancel
          </button>
          <button
            type="submit"
            form="compose-form"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={sendMutation.isLoading}
          >
            {sendMutation.isLoading ? 'Sending…' : 'Send Now'}
          </button>
        </>
      }
    >
      <form id="compose-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Template" required span={2}>
          <select
            className="field-input"
            value={templateId ?? ''}
            onChange={(e) => setTemplateId(e.target.value ? parseInt(e.target.value, 10) : null)}
            required
          >
            <option value="">Select an active template…</option>
            {activeTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}
              </option>
            ))}
          </select>
          {selectedTemplate && (
            <div
              className="mt-2 px-3 py-2 rounded-xl font-sans text-sm text-ink-900 whitespace-pre-line"
              style={{ background: '#FAFAFA', border: '1px solid rgba(26,22,18,0.10)' }}
            >
              {selectedTemplate.body}
            </div>
          )}
        </FormField>

        <FormField label="Customer" required span={2}>
          <Combobox
            items={customerItems}
            value={customerId}
            onChange={(item) => {
              setCustomerId(item ? Number(item.id) : null);
              setVehicleId(null);
            }}
            placeholder="Search the ledger by name or phone…"
          />
        </FormField>

        {customerVehicles.length > 0 && (
          <FormField label="Vehicle (optional)" span={2} hint="Used by templates that reference {{plate}} or {{vehicle}}.">
            <Combobox
              items={vehicleItems}
              value={vehicleId}
              onChange={(item) => setVehicleId(item ? Number(item.id) : null)}
              placeholder="Pick a vehicle for this customer…"
            />
          </FormField>
        )}

        {error && (
          <div
            className="col-span-2 rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
            style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
            role="alert"
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   Template modal — create or edit a template
// ───────────────────────────────────────────────────────────────────────────

function TemplateModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: TemplateRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('service_due');
  const [body, setBody] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [syncedId, setSyncedId] = useState<number | null>(null);
  if (editing && editing.id !== syncedId) {
    setSyncedId(editing.id);
    setName(editing.name);
    setCategory(editing.category);
    setBody(editing.body);
    setActive(editing.active);
    setError(null);
  } else if (!editing && syncedId !== null && open) {
    setSyncedId(null);
    setName('');
    setCategory('service_due');
    setBody('');
    setActive(true);
    setError(null);
  }

  const createMutation = trpc.reminders.createTemplate.useMutation({
    onSuccess: () => {
      setName(''); setCategory('service_due'); setBody(''); setActive(true); setError(null);
      onSaved();
    },
    onError: (e) => setError(e.message),
  });
  const updateMutation = trpc.reminders.updateTemplate.useMutation({
    onSuccess: () => onSaved(),
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required.');
    if (!body.trim()) return setError('Body is required.');

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        name: name.trim(),
        category,
        body: body.trim(),
        active,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        category,
        body: body.trim(),
        active,
      });
    }
  };

  const isPending = createMutation.isLoading || updateMutation.isLoading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={editing ? 'Edit Template' : 'New Template'}
      title={editing ? editing.name : 'New WhatsApp Template'}
      footer={
        <>
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            type="submit"
            form="template-form"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isPending}
          >
            {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Save Template'}
          </button>
        </>
      }
    >
      <form id="template-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Name" required>
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="6-month service due"
            required
            autoFocus
          />
        </FormField>

        <FormField label="Category" required>
          <select
            className="field-input"
            value={category}
            onChange={(e) => setCategory(e.target.value as TemplateCategory)}
            required
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Body"
          required
          span={2}
          hint="Use {{customer_name}}, {{phone}}, {{vehicle}}, {{plate}} for substitution at send time."
        >
          <textarea
            className="field-input"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              'Hi {{customer_name}},\n\n' +
              "Your {{vehicle}} ({{plate}}) is due for its service this month. " +
              "Reply YES to book, or call us to schedule a time that suits you.\n\n— AGL Auto"
            }
            required
          />
        </FormField>

        <FormField label="Status" span={2}>
          <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer"
                 style={{ background: '#FAFAFA', border: '1px solid rgba(26,22,18,0.10)' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-brand-500"
            />
            <span className="font-sans text-sm text-ink-900">
              Active — available in the Compose dialog.
            </span>
          </label>
        </FormField>

        {error && (
          <div
            className="col-span-2 rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
            style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
            role="alert"
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
