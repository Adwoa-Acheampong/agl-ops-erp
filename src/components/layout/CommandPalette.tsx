import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Search, Command as CommandIcon, ArrowRight, LayoutDashboard, Wrench, Users,
  Briefcase, Wallet, Receipt, Package, ShoppingCart, BarChart3, Settings,
  Sparkles, Plug, Bell, Car, ClipboardList, AlertOctagon, MessageSquareWarning,
  ScrollText, CalendarDays, GraduationCap, Building2, TrendingUp, Repeat, Megaphone,
} from 'lucide-react';

/**
 * Enterprise command palette. Press Cmd/Ctrl+K (or `/`) from anywhere to open.
 * Fuzzy search across all routes + quick actions + settings tabs. Keyboard nav,
 * recent picks persisted in localStorage.
 */

type Cmd = {
  id: string;
  label: string;
  group: 'Pages' | 'Quick actions' | 'Settings';
  icon: any;
  to?: string;
  keywords?: string;
};

const COMMANDS: Cmd[] = [
  // Pages
  { id: 'dash',       label: 'Dashboard',             group: 'Pages', icon: LayoutDashboard,       to: '/' },
  { id: 'fixbot',     label: 'FixBot',                group: 'Pages', icon: Sparkles,              to: '/fixbot' },
  { id: 'workshop',   label: 'Workshop · Jobs',       group: 'Pages', icon: Wrench,                to: '/workshop' },
  { id: 'vehicles',   label: 'Vehicles',              group: 'Pages', icon: Car,                   to: '/vehicles' },
  { id: 'mechtrk',    label: 'Mechanic Tracker',      group: 'Pages', icon: Wrench,                to: '/mechanic-tracker' },
  { id: 'recalls',    label: 'Recalls',               group: 'Pages', icon: AlertOctagon,          to: '/recalls' },
  { id: 'complaints', label: 'Complaints',            group: 'Pages', icon: MessageSquareWarning,  to: '/complaints' },
  { id: 'inv',        label: 'Inventory · Stock',     group: 'Pages', icon: Package,               to: '/inventory' },
  { id: 'invlog',     label: 'Inventory movements',   group: 'Pages', icon: ScrollText,            to: '/inventory-log' },
  { id: 'sales',      label: 'Sales',                 group: 'Pages', icon: ShoppingCart,          to: '/sales' },
  { id: 'daily',      label: 'Sales - Daily Entry',   group: 'Pages', icon: ClipboardList,         to: '/daily-entry', keywords: 'daily entry sales cash opening closing' },
  { id: 'customers',  label: 'Customers',             group: 'Pages', icon: Users,                 to: '/customers' },
  { id: 'subs',       label: 'Subscriptions',         group: 'Pages', icon: Repeat,                to: '/subscriptions' },
  { id: 'marketing',  label: 'Marketing · Campaigns', group: 'Pages', icon: Megaphone,             to: '/marketing',  keywords: 'ads facebook tiktok instagram google whatsapp roas spend' },
  { id: 'finance',    label: 'Finance · Sales ledger', group: 'Pages', icon: Wallet,               to: '/finance' },
  { id: 'expenses',   label: 'Expenses',              group: 'Pages', icon: Receipt,               to: '/expenses' },
  { id: 'po',         label: 'Purchase Orders',       group: 'Pages', icon: TrendingUp,            to: '/purchase-orders' },
  { id: 'creditors',  label: 'Creditors',             group: 'Pages', icon: TrendingUp,            to: '/creditors' },
  { id: 'pnl',        label: 'P&L Hub',               group: 'Pages', icon: BarChart3,             to: '/expenses-hub' },
  { id: 'reports',    label: 'Reports',               group: 'Pages', icon: BarChart3,             to: '/reports' },
  { id: 'hr',         label: 'HR · Roster',           group: 'Pages', icon: Briefcase,             to: '/hr' },
  { id: 'schedules',  label: 'Schedules',             group: 'Pages', icon: CalendarDays,          to: '/schedules' },
  { id: 'training',   label: 'Training',              group: 'Pages', icon: GraduationCap,         to: '/training' },
  { id: 'audit',      label: 'Audit log',             group: 'Pages', icon: ScrollText,            to: '/audit' },
  { id: 'tenants',    label: 'Tenants',               group: 'Pages', icon: Building2,             to: '/tenants' },
  { id: 'notif',      label: 'Notifications',         group: 'Pages', icon: Bell,                  to: '/notifications' },

  // Settings deep-links
  { id: 'set-gen',    label: 'Settings · General',    group: 'Settings', icon: Settings,  to: '/settings?tab=general' },
  { id: 'set-fix',    label: 'Settings · FixBot AI',  group: 'Settings', icon: Sparkles,  to: '/settings?tab=fixbot',   keywords: 'anthropic api key claude' },
  { id: 'set-wa',     label: 'Settings · WhatsApp',   group: 'Settings', icon: Plug,      to: '/settings?tab=whatsapp', keywords: 'meta cloud api' },
  { id: 'set-mail',   label: 'Settings · Email',      group: 'Settings', icon: Plug,      to: '/settings?tab=email',    keywords: 'smtp gmail outlook' },
  { id: 'set-cal',    label: 'Settings · Calendar',   group: 'Settings', icon: Plug,      to: '/settings?tab=calendar' },
  { id: 'set-exp',    label: 'Settings · Exports',    group: 'Settings', icon: Plug,      to: '/settings?tab=exports' },
  { id: 'integ',      label: 'Integrations',          group: 'Settings', icon: Plug,      to: '/integrations' },

  // Quick actions
  { id: 'new-po',     label: 'New Purchase Order',    group: 'Quick actions', icon: TrendingUp, to: '/purchase-orders' },
  { id: 'new-part',   label: 'Add Inventory Part',    group: 'Quick actions', icon: Package,    to: '/inventory' },
  { id: 'new-job',    label: 'New Workshop Job',      group: 'Quick actions', icon: Wrench,     to: '/workshop' },
  { id: 'new-cust',   label: 'Add Customer',          group: 'Quick actions', icon: Users,      to: '/customers' },
  { id: 'new-staff',  label: 'Add Staff Member',      group: 'Quick actions', icon: Briefcase,  to: '/hr' },
  { id: 'new-exp',    label: 'Log Expense',           group: 'Quick actions', icon: Receipt,    to: '/expenses' },
];

const RECENT_KEY = 'agl-cmd-palette-recent';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
function pushRecent(id: string) {
  try {
    const list = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

function score(cmd: Cmd, q: string): number {
  if (!q) return 0;
  const hay = `${cmd.label} ${cmd.keywords ?? ''} ${cmd.group}`.toLowerCase();
  const ql = q.toLowerCase();
  if (hay.startsWith(ql)) return 100;
  if (cmd.label.toLowerCase().includes(ql)) return 50;
  if (hay.includes(ql)) return 25;
  // sub-sequence match
  let i = 0;
  for (const c of hay) {
    if (c === ql[i]) i++;
    if (i === ql.length) return 10;
  }
  return 0;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Cmd/Ctrl+K opens anywhere. `/` also opens unless typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const slash = e.key === '/' && !(e.target as HTMLElement | null)?.matches?.('input,textarea,select');
      if (isToggle || slash) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const ranked = useMemo(() => {
    if (!q.trim()) {
      const recent = loadRecent();
      const r = recent
        .map((id) => COMMANDS.find((c) => c.id === id))
        .filter(Boolean) as Cmd[];
      const rest = COMMANDS.filter((c) => !recent.includes(c.id));
      return [...r, ...rest];
    }
    return COMMANDS
      .map((c) => ({ c, s: score(c, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [q]);

  const run = (cmd: Cmd) => {
    pushRecent(cmd.id);
    setOpen(false);
    if (cmd.to) navigate(cmd.to);
  };

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        display: 'grid', placeItems: 'flex-start center',
        background: 'rgba(14,10,10,0.45)', backdropFilter: 'blur(2px)',
        padding: '12vh 16px 16px',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div
        className="bg-white rounded-2xl shadow-pop overflow-hidden flex flex-col"
        style={{ width: '100%', maxWidth: 620, maxHeight: '70vh', border: '1px solid rgba(26,22,18,0.10)' }}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-line">
          <Search size={16} className="text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(ranked.length - 1, c + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); const cmd = ranked[cursor]; if (cmd) run(cmd); }
            }}
            className="flex-1 bg-transparent outline-none text-sm font-sans placeholder:text-neutral-400"
            placeholder="Type to search pages, actions, or settings…"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-canvas border border-line text-2xs font-mono text-neutral-500">
            esc
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          {ranked.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-neutral-500">No results for "{q}".</div>
          )}
          {(() => {
            // Group by their `group` key but preserve ranked order.
            const groups: { name: string; rows: { cmd: Cmd; index: number }[] }[] = [];
            ranked.forEach((cmd, index) => {
              const g = q.trim() ? 'Results' : cmd.group;
              let bucket = groups.find((b) => b.name === g);
              if (!bucket) { bucket = { name: g, rows: [] }; groups.push(bucket); }
              bucket.rows.push({ cmd, index });
            });
            return groups.map((g) => (
              <section key={g.name} className="mb-1.5 last:mb-0">
                <div className="px-3 pt-2 pb-1 text-[11.5px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                  {g.name}
                </div>
                {g.rows.map(({ cmd, index }) => {
                  const Icon = cmd.icon;
                  const active = index === cursor;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => run(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        active ? 'bg-brand-50 text-brand-700' : 'hover:bg-canvas text-neutral-800'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-lg grid place-items-center ${active ? 'bg-brand-100 text-brand-600' : 'bg-canvas text-neutral-600'}`}>
                        <Icon size={14} />
                      </span>
                      <span className="flex-1 font-medium truncate">{cmd.label}</span>
                      <ArrowRight size={12} className="text-neutral-400" />
                    </button>
                  );
                })}
              </section>
            ));
          })()}
        </div>

        <footer className="px-3 py-2 border-t border-line flex items-center justify-between text-2xs text-neutral-500 bg-canvas">
          <span className="inline-flex items-center gap-1.5">
            <CommandIcon size={10} />
            Command palette
          </span>
          <span className="inline-flex items-center gap-2">
            <span><kbd className="px-1 py-0.5 rounded bg-white border border-line font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white border border-line font-mono">↵</kbd> open</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white border border-line font-mono">esc</kbd> close</span>
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
