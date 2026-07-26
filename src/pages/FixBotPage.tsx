import { useState, useEffect, useRef, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles, Send, AlertTriangle, Loader2, Zap, CalendarPlus, UserPlus, Receipt,
  ClipboardList, Boxes, Wrench, FileText, Users2, BarChart3, AlertOctagon,
} from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { trpc } from '../lib/trpc';

const SUGGESTIONS = [
  'Show me overdue payments above ten thousand cedis.',
  'Which vehicles are due for service this week?',
  'Summarise revenue across the last thirty days.',
  'Which parts are at or below their reorder point?',
];

const SLASH_HELP = [
  '/report — today\'s KPIs',
  '/sendreport weekly +233244188446 — WhatsApp the weekly report',
  '/schedule — open tasks + recent VSRs',
  '/stock <part> — inventory lookup by name or code',
  '/parts <make> <model> <year> <engine> — fitment-aware parts lookup',
  '/customer <name-or-phone> — find a customer',
  '/staff <name> — staff + 30-day shifts',
  '/assign <staff> <session-code> -- <title> — assign training',
  '/complaint <name> -- <verbatim words> — log AGL-CCR-001 complaint',
  '/whatsapp <+phone> -- <message> — queue a WhatsApp',
  '/sop <topic> — search operations manual',
  '/help — full list',
];

const SUGGESTIONS_OPS = [
  '/parts Toyota Corolla 2020 2.0T',
  '/sendreport weekly +233244188446',
  '/complaint Yaa -- spark plugs failed in two weeks',
  '/assign Kojo T-07 -- Job Card walkthrough',
];

export function FixBotPage() {
  // WS6-A / WS6-C: `?view=quick` opens the Quick Actions grid directly,
  // otherwise the default assistant chat surfaces first.
  const location = useLocation();
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'quick') return <QuickActionsView/>;

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const status = trpc.fixbot.status.useQuery();
  const conversation = trpc.fixbot.getConversation.useQuery(
    { id: conversationId ?? -1 },
    { enabled: conversationId !== null },
  );
  const createConversation = trpc.fixbot.createConversation.useMutation({
    onSuccess: ({ id }) => { if (id) setConversationId(id); },
  });
  const sendMessage = trpc.fixbot.sendMessage.useMutation({
    onSuccess: () => {
      setInput('');
      conversation.refetch();
    },
  });

  // P23.5 — Slash commands route through the bot router instead of the LLM
  // so deterministic operations (/report, /stock, /vsr) don't burn tokens.
  const [slashOutput, setSlashOutput] = useState<string | null>(null);
  const slashCmd = trpc.bot.runCommand.useMutation({
    onSuccess: (r) => {
      setSlashOutput(r.output);
      setInput('');
    },
  });

  // Auto-scroll the transcript on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.data?.messages?.length, sendMessage.isLoading]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Slash commands bypass the LLM and run deterministic queries.
    if (input.trim().startsWith('/')) {
      setSlashOutput(null);
      slashCmd.mutate({ input: input.trim(), channel: 'web' });
      return;
    }

    let id = conversationId;
    if (id === null) {
      const created = await createConversation.mutateAsync({});
      if (!created.id) return;
      id = created.id;
    }
    sendMessage.mutate({ conversationId: id, message: input });
  };

  const onSuggestion = (s: string) => {
    setInput(s);
  };

  const messages = (conversation.data?.messages ?? []).filter(
    (m: any) => m.role === 'user' || m.role === 'assistant',
  );
  const hasConversation = conversationId !== null;
  const configured = status.data?.configured ?? false;

  return (
    <PageShell
      eyebrow="Intelligence"
      title="FixBot"
      intro="A discreet operations assistant. Ask in plain language; receive precise, audited answers across every part of the business."
    >
      {!configured && status.data && <NotConfiguredBanner />}

      <section
        className="bg-white rounded-2xl flex flex-col"
        style={{ border: '1px solid rgba(26,22,18,0.06)', minHeight: '36rem' }}
      >
        <header
          className="px-4 py-3 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(26,22,18,0.06)' }}
        >
          <span className="w-4 h-4 rounded-xl bg-brand-50 text-brand-500 grid place-items-center">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="font-sans text-sm font-semibold text-ink-900">FixBot Assistant</h3>
            <p className="font-sans text-xs text-ink-700">
              {status.data?.model ? `${status.data.model} · ` : ''}
              Read-only · Every interaction is audited
            </p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 px-4 py-4 overflow-y-auto" style={{ maxHeight: '32rem' }}>
          {!hasConversation && (
            <Welcome onSuggestion={onSuggestion} />
          )}
          {hasConversation && conversation.isLoading && (
            <div className="grid place-items-center py-8 text-ink-700 font-sans text-sm">
              <Loader2 size={18} className="animate-spin" />
            </div>
          )}
          {hasConversation && messages.length === 0 && !conversation.isLoading && (
            <Welcome onSuggestion={onSuggestion} />
          )}
          {messages.map((m: any) => <MessageBubble key={m.id} role={m.role} content={m.content} />)}
          {sendMessage.isLoading && <PendingBubble />}
          {slashCmd.isLoading && <PendingBubble />}
          {slashOutput && (
            <div className="my-2">
              <MessageBubble role="user" content={slashCmd.variables?.input ?? ''} />
              <pre className="bg-canvas rounded-lg p-3 font-mono text-xs whitespace-pre-wrap text-ink-900" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
                {slashOutput}
              </pre>
            </div>
          )}
        </div>

        <footer className="px-3 py-3" style={{ borderTop: '1px solid rgba(26,22,18,0.06)' }}>
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 bg-canvas rounded-xl px-3 py-2"
            style={{ border: '1px solid rgba(26,22,18,0.06)' }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask FixBot, or use a slash command — try /report, /stock <part>, /vsr <no>"
              disabled={sendMessage.isLoading || slashCmd.isLoading}
              className="flex-1 bg-transparent outline-none font-sans text-sm text-ink-900 placeholder:text-ink-700/50 disabled:opacity-60"
            />
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={(sendMessage.isLoading || slashCmd.isLoading) || !input.trim()}
            >
              {(sendMessage.isLoading || slashCmd.isLoading) ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send
            </button>
          </form>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {SLASH_HELP.slice(0, 5).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setInput(h.split(' ')[0] + ' ')}
                className="px-1.5 py-0.5 rounded-md bg-canvas text-2xs font-mono text-ink-700 hover:text-ink-900"
                style={{ border: '1px solid rgba(26,22,18,0.06)' }}
              >
                {h.split(' ')[0]}
              </button>
            ))}
          </div>
          {sendMessage.error && (
            <p className="font-sans text-xs text-brand-500 mt-1.5">{sendMessage.error.message}</p>
          )}
          {slashCmd.error && (
            <p className="font-sans text-xs text-brand-500 mt-1.5">{slashCmd.error.message}</p>
          )}
        </footer>
      </section>
    </PageShell>
  );
}

/* ──────────────────────────  Subcomponents  ───────────────────────────── */

/* ──────────────────────────  Quick Actions  ───────────────────────────── */

const QUICK_ACTIONS = [
  { icon: CalendarPlus,  label: 'New appointment',  hint: 'Book a workshop slot',          href: '/workshop',                 tone: 'red'   },
  { icon: UserPlus,      label: 'Add customer',     hint: 'Create a customer record',      href: '/customers',                tone: 'ink'   },
  { icon: Receipt,       label: 'Record expense',   hint: 'Log a fresh outflow',           href: '/expenses-hub?tab=expenses',tone: 'red'   },
  { icon: Boxes,         label: 'Receive stock',    hint: 'Log a supply receipt',          href: '/expenses-hub?tab=supplies',tone: 'ink'   },
  { icon: Wrench,        label: 'Open job board',   hint: 'Jump to the active queue',      href: '/workshop',                 tone: 'red'   },
  { icon: ClipboardList, label: 'Daily entry',      hint: 'Log opening / closing / cash',  href: '/daily-entry',              tone: 'ink'   },
  { icon: Users2,        label: 'Roster',           hint: 'Manage staff & rotations',      href: '/hr?tab=roster',            tone: 'red'   },
  { icon: FileText,      label: 'Forms library',    hint: 'Submit a managed form',         href: '/reports?tab=forms',        tone: 'ink'   },
  { icon: BarChart3,     label: 'BI dashboard',     hint: 'Manager metrics & drill-down',  href: '/reports?tab=dashboard',    tone: 'red'   },
  { icon: AlertOctagon,  label: 'Recalls',          hint: 'Open recalls + workmanship',    href: '/recalls',                  tone: 'ink'   },
];

function QuickActionsView() {
  return (
    <PageShell eyebrow="Intelligence" title="Quick Actions" intro="One-tap shortcuts to the surfaces you reach for most.">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <a key={a.label} href={a.href}
            className="card-feature flex items-start gap-3 hover:border-brand-300 transition-colors min-w-0">
            <span className={`${a.tone === 'red' ? 'tile-soft' : 'w-9 h-9 rounded-xl bg-black text-white grid place-items-center'} shrink-0`}>
              <a.icon size={16}/>
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-black truncate">{a.label}</div>
              <div className="text-xs text-neutral-500 mt-0.5 truncate">{a.hint}</div>
            </div>
          </a>
        ))}
      </section>
      <p className="mt-6 text-xs text-neutral-500 flex items-center gap-1.5">
        <Zap size={12}/> Tip — these mirror the bell shortcuts. Press <kbd className="px-1 py-0.5 rounded bg-neutral-100 border border-line text-2xs font-mono">⌘K</kbd> for the full palette.
      </p>
    </PageShell>
  );
}

function NotConfiguredBanner() {
  return (
    <div
      className="rounded-2xl p-3 flex items-start gap-2"
      style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
    >
      <span className="w-4 h-4 rounded-xl bg-brand-500 text-neutral-50 grid place-items-center shrink-0">
        <AlertTriangle size={14} />
      </span>
      <div className="min-w-0">
        <h3 className="font-sans text-sm font-semibold text-ink-900">FixBot is not yet connected</h3>
        <p className="font-sans text-sm text-ink-700 mt-0.5 leading-relaxed">
          Set <code className="font-sans" style={{ background: 'rgba(26,22,18,0.06)', padding: '1px 4px', borderRadius: 4 }}>ANTHROPIC_API_KEY</code> on the server and restart. The conversational layer activates immediately afterwards.
        </p>
      </div>
    </div>
  );
}

function Welcome({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="grid place-items-center py-6">
      <div className="flex flex-col items-center text-center gap-3" style={{ maxWidth: '54ch' }}>
        <span className="w-7 h-7 rounded-2xl bg-brand-50 text-brand-500 grid place-items-center">
          <Sparkles size={28} />
        </span>
        <h2 className="font-serif font-medium text-ink-900" style={{ fontSize: '1.953rem', lineHeight: 1.15 }}>
          How may I assist this morning?
        </h2>
        <p className="font-sans text-sm text-ink-700 leading-relaxed">
          Begin with a question or instruction. FixBot consults the relevant ledgers and replies with cited figures.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full mt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestion(s)}
              className="bg-canvas hover:bg-white rounded-xl px-3 py-2 text-left font-sans text-sm text-ink-900 transition-colors"
              style={{ border: '1px solid rgba(26,22,18,0.06)' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }: { role: 'user' | 'assistant' | string; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-2xl px-3 py-2 max-w-[85%] min-w-0 ${
          isUser
            ? 'bg-ink-900 text-neutral-50'
            : 'bg-canvas text-ink-900'
        }`}
        style={{
          border: isUser ? 'none' : '1px solid rgba(26,22,18,0.06)',
        }}
      >
        <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

function PendingBubble() {
  return (
    <div className="flex justify-start mb-2">
      <div
        className="rounded-2xl px-3 py-2 bg-canvas text-ink-700 inline-flex items-center gap-1.5"
        style={{ border: '1px solid rgba(26,22,18,0.06)' }}
      >
        <Loader2 size={14} className="animate-spin" />
        <span className="font-sans text-sm">Consulting the ledgers…</span>
      </div>
    </div>
  );
}
