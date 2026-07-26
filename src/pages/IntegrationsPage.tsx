import { Plug, Calendar, Mail, MessageCircle, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';

interface Integration {
  name: string;
  description: string;
  status: 'connected' | 'available';
  icon: typeof Calendar;
}

const integrations: Integration[] = [
  { name: 'WhatsApp Business',  description: 'Outbound reminders, voice notes and customer conversations.', status: 'available', icon: MessageCircle },
  { name: 'Google Calendar',    description: 'Two-way sync of appointments, bays and technician schedules.',  status: 'available', icon: Calendar },
  { name: 'Gmail and Outlook',  description: 'Send statements, quotes and reports directly from each ledger.', status: 'available', icon: Mail },
  { name: 'Excel and CSV',      description: 'Import customer ledgers; export every report on demand.',         status: 'available', icon: FileSpreadsheet },
];

export function IntegrationsPage() {
  return (
    <PageShell
      eyebrow="Connections"
      title="Integrations"
      intro="The platform speaks fluently with the tools the operation already trusts. Connect deliberately, audit continuously."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {integrations.map(i => (
          <article
            key={i.name}
            className="bg-white rounded-2xl p-4 flex items-start gap-3 min-w-0"
            style={{ border: '1px solid rgba(26,22,18,0.06)' }}
          >
            <span className="w-5 h-5 rounded-xl bg-brand-50 text-brand-500 grid place-items-center shrink-0">
              <i.icon size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-sans text-base font-semibold text-ink-900">{i.name}</h3>
                {i.status === 'connected' ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-sans font-semibold bg-success/10 text-success">
                    <CheckCircle2 size={12} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-sans font-semibold bg-canvas text-ink-700" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
                    Available
                  </span>
                )}
              </div>
              <p className="font-sans text-sm text-ink-700 mt-1 leading-relaxed">{i.description}</p>
              <button className="btn-outline text-sm mt-2"><Plug size={14} /> Connect</button>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
