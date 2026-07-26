import { ReactNode, useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Wrench, Users, Briefcase, Wallet, Repeat,
  Settings, LogOut, Bell, Menu, X, AlertTriangle, Loader2, AlertOctagon, ScrollText, Building2,
  Car, Package, Receipt, Clock, ShoppingCart, BarChart3, TrendingUp, MessageSquareWarning,
  ClipboardList, CalendarDays, GraduationCap, Sparkles, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Command as CommandIcon, Megaphone, FileText, Zap, Archive, Download,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import aglLogo from '../../assets/agl-logo.jpeg';
import { useAuth } from '../../contexts/AuthContext';
import { CommandPalette } from './CommandPalette';
import { StatusFooter } from './StatusFooter';

const APP_ENV = ((import.meta as any).env?.MODE ?? 'development').toLowerCase();
const COLLAPSED_KEY = 'agl-sidebar-collapsed';
const GROUP_KEY = 'agl-sidebar-groups';

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch {}
    document.body.classList.toggle('sidebar-collapsed', collapsed);
  }, [collapsed]);

  // Cmd/Ctrl + \ collapses or expands the sidebar — standard pattern from
  // VS Code / Linear. Distinct from Cmd+K which opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setCollapsed(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell min-h-screen bg-canvas flex flex-col">
      <TopBar
        onMenu={() => setOpen(v => !v)}
        onToggleCollapse={() => setCollapsed(v => !v)}
        collapsed={collapsed}
      />
      {/* Spacer for the fixed top bar so content starts below it. */}
      <div className="no-print" aria-hidden="true" style={{ height: 56 }} />
      <div
        className="grid grid-cols-1 flex-1"
        style={{ gridTemplateColumns: `${collapsed ? '56px' : '240px'} 1fr`, minHeight: 'calc(100vh - 56px)' }}
      >
        <SideNav
          open={open}
          onClose={() => setOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(v => !v)}
        />
        <main className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto w-full overflow-x-hidden">{children}</main>
      </div>
      <StatusFooter />
      <CommandPalette />
    </div>
  );
}

/* ─────────────────────────────  Top bar  ─────────────────────────────── */

function TopBar({ onMenu, onToggleCollapse, collapsed }: { onMenu: () => void; onToggleCollapse: () => void; collapsed: boolean }) {
  const isProd = APP_ENV === 'production';
  const envLabel = isProd ? 'PROD' : APP_ENV === 'staging' ? 'STAGING' : 'DEV';
  const envDot = isProd ? 'bg-emerald-400' : 'bg-amber-400';
  return (
    <header
      className="no-print fixed top-0 left-0 right-0 z-50 h-14 bg-white/85 backdrop-blur-md text-neutral-900 border-b border-neutral-200/80"
      style={{ width: '100%' }}
    >
      <div className="h-full px-3 md:px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            className="md:hidden w-9 h-9 grid place-items-center rounded-md text-neutral-700 hover:bg-neutral-100"
            onClick={onMenu} aria-label="Menu"
          >
            <Menu size={16} />
          </button>
          <button
            className="hidden md:grid w-9 h-9 place-items-center rounded-md text-neutral-600 hover:bg-neutral-100"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar (Ctrl+\\)' : 'Collapse sidebar (Ctrl+\\)'}
            title={collapsed ? 'Expand sidebar (Ctrl+\\)' : 'Collapse sidebar (Ctrl+\\)'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          {/* Inline lockup */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={aglLogo}
                alt="AGL"
                className="w-9 h-9 rounded-md object-cover ring-1 ring-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              />
              <div className="leading-none">
                <span className="text-[16.5px] font-bold tracking-tight text-neutral-900">AGL</span>
                <span className="text-[16.5px] font-bold tracking-tight text-red-600 ml-0.5">OPS</span>
              </div>
            </div>
            <span className="hidden lg:block h-5 w-px bg-neutral-200" />
            <span className="hidden lg:inline text-[12.5px] font-medium tracking-[0.14em] uppercase text-neutral-500 whitespace-nowrap">
              Enterprise Command Center
            </span>
          </div>
        </div>

        {/* Center search */}
        <div className="hidden md:flex flex-1 max-w-md mx-3">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true } as any));
            }}
            className="group inline-flex items-center w-full h-9 px-2.5 rounded-lg bg-neutral-50 border border-neutral-200 hover:border-neutral-300 transition-colors text-xs text-neutral-500 gap-2 cursor-pointer"
            title="Open command palette (⌘K)"
          >
            <CommandIcon size={13} className="text-neutral-400" />
            <span className="flex-1 text-left">Search pages, actions, or settings…</span>
            <kbd className="font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-500 shadow-[inset_0_-1px_0_rgba(0,0,0,0.04)]">⌘K</kbd>
          </button>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Environment pill */}
          <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-900 text-white font-mono text-[11.5px] tracking-wider ring-1 ring-neutral-800">
            <span className={`w-1.5 h-1.5 rounded-full ${envDot} anim-pulse-dot`} />
            {envLabel}
          </span>
          <NotificationBell />
          {/* User cluster */}
          <button type="button" className="inline-flex items-center gap-1.5 h-9 pl-1 pr-1.5 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer">
            <span className="w-7 h-7 rounded-full bg-neutral-900 text-white grid place-items-center text-[12.5px] font-semibold ring-1 ring-neutral-200">A</span>
            <span className="hidden sm:inline text-sm font-medium text-neutral-700">Admin</span>
            <ChevronDown size={12} className="text-neutral-400" />
          </button>
        </div>
      </div>
      {/* Subliminal red hairline */}
      <div aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-px bg-red-600" />
    </header>
  );
}

/* ────────────────────────────  Side nav  ─────────────────────────────── */

type NavItem = { to: string; icon: any; label: string };
type NavGroup = { id: string; icon: any; label: string; items: NavItem[] };

const NAV_TOP: NavItem[] = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
];

const NAV_GROUPS: NavGroup[] = [
  {
    // WS6-A: FixBot becomes a group so Quick Actions can live as a
    // sub-item directly underneath. Group expands by default so the
    // shortcuts are one tap away without opening any module page.
    id: 'fixbot', icon: Sparkles, label: 'FixBot',
    items: [
      { to: '/fixbot',                icon: Sparkles, label: 'Assistant' },
      { to: '/fixbot?view=quick',     icon: Zap,      label: 'Quick Actions' },
    ],
  },
  {
    id: 'workshop', icon: Wrench, label: 'Workshop',
    items: [
      { to: '/workshop',         icon: Wrench,                label: 'Jobs board' },
      { to: '/vehicles',         icon: Car,                   label: 'Vehicles' },
      { to: '/mechanic-tracker', icon: Wrench,                label: 'Mechanic Tracker' },
      { to: '/recalls',          icon: AlertOctagon,          label: 'Recalls' },
      { to: '/complaints',       icon: MessageSquareWarning,  label: 'Complaints' },
    ],
  },
  {
    id: 'inventory', icon: Package, label: 'Inventory',
    items: [
      { to: '/inventory',      icon: Package,    label: 'Stock ledger' },
      { to: '/inventory-log',  icon: ScrollText, label: 'Movements' },
    ],
  },
  {
    id: 'sales', icon: ShoppingCart, label: 'Sales',
    items: [
      { to: '/sales',          icon: ShoppingCart, label: 'Sales' },
      { to: '/daily-entry',    icon: ClipboardList, label: 'Daily Entry' },
      { to: '/customers',      icon: Users,        label: 'Customers' },
      { to: '/subscriptions',  icon: Repeat,       label: 'Subscriptions' },
    ],
  },
  {
    id: 'marketing', icon: Megaphone, label: 'Marketing',
    items: [
      { to: '/marketing',      icon: Megaphone,    label: 'Campaign Tracker' },
    ],
  },
  {
    // WS3-C: Expenses + Purchase Orders consolidated into the P&L Hub.
    // The standalone /expenses and /purchase-orders routes still resolve
    // for deep-link compatibility, but they no longer appear in the
    // sidebar — the Hub's Expenses / Purchases tabs replaced them.
    id: 'finance', icon: Wallet, label: 'Finance',
    items: [
      { to: '/finance',                     icon: Wallet,          label: 'Sales ledger' },
      { to: '/expenses-hub',                icon: BarChart3,       label: 'P&L Hub' },
      { to: '/expenses-hub?tab=expenses',   icon: Receipt,         label: 'Expenses' },
      { to: '/expenses-hub?tab=purchases',  icon: TrendingUp,      label: 'Purchase Orders' },
      { to: '/creditors',                   icon: TrendingUp,      label: 'Creditors' },
      // WS4 — Reports surfaces. Three sub-tabs (Business / Dashboard / Forms).
      { to: '/reports',                     icon: BarChart3,       label: 'Business Reports' },
      { to: '/reports?tab=dashboard',       icon: LayoutDashboard, label: 'BI Dashboard' },
      { to: '/reports?tab=forms',           icon: FileText,        label: 'Forms' },
    ],
  },
  {
    id: 'hr', icon: Briefcase, label: 'HR',
    items: [
      { to: '/hr?tab=roster',      icon: Users,         label: 'Roster' },
      { to: '/hr?tab=clock',       icon: Clock,         label: 'Attendance' },
      { to: '/hr?tab=payroll',     icon: Wallet,        label: 'Payroll' },
      { to: '/hr?tab=performance', icon: BarChart3,     label: 'Performance' },
      { to: '/hr?tab=documents',   icon: FileText,      label: 'Documents' },
      { to: '/schedules',          icon: CalendarDays,  label: 'Schedules' },
      { to: '/training',           icon: GraduationCap, label: 'Training' },
    ],
  },
  {
    // Historical records imported from the master Excel sheet. The
    // workshop-jobs rows that used to surface inside Daily Entry now
    // live here, leaving Daily Entry for genuine live operational logs.
    id: 'archives', icon: Archive, label: 'Data Archives',
    items: [
      { to: '/data-archives', icon: Archive, label: 'Imported records' },
    ],
  },
  {
    id: 'admin', icon: Settings, label: 'Admin',
    items: [
      { to: '/audit',    icon: ScrollText, label: 'Audit log' },
      { to: '/exports',  icon: Download,   label: 'Exports' },
      { to: '/tenants',  icon: Building2,  label: 'Tenants' },
      { to: '/settings', icon: Settings,   label: 'Settings' },
    ],
  },
];

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUP_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { workshop: true, inventory: true, sales: true, marketing: true, finance: true, hr: true, admin: false };
}

/**
 * Match a nav item against the current URL. Sibling items that share a
 * pathname but differ by a query param (e.g. /hr?tab=roster vs
 * /hr?tab=payroll, /reports vs /reports?tab=dashboard) must NOT all
 * highlight when only one is active.
 *
 * Algorithm:
 *   1. Pathname must match exactly.
 *   2. If the link has query params, every key/value must be present
 *      in the current URL.
 *   3. If the link has NO query params, it only matches when none of
 *      its siblings (passed in via `siblingLinks`) declares a query
 *      param that is currently active. Without this guard, the base
 *      `/reports` link "wins" over `/reports?tab=dashboard` because
 *      its weaker test passes too.
 */
function isItemActive(linkTo: string, currentPath: string, currentSearch: string, siblingLinks: string[] = []): boolean {
  const [pathPart, queryPart] = linkTo.split('?');
  if (pathPart !== currentPath) return false;
  const cur = new URLSearchParams(currentSearch);
  if (queryPart) {
    const linkParams = new URLSearchParams(queryPart);
    let ok = true;
    linkParams.forEach((v, k) => { if (cur.get(k) !== v) ok = false; });
    return ok;
  }
  // No-query link: only active when no sibling's query param matches.
  for (const sib of siblingLinks) {
    if (sib === linkTo) continue;
    const [sibPath, sibQuery] = sib.split('?');
    if (sibPath !== currentPath || !sibQuery) continue;
    const sibParams = new URLSearchParams(sibQuery);
    let sibMatches = true;
    sibParams.forEach((v, k) => { if (cur.get(k) !== v) sibMatches = false; });
    if (sibMatches) return false;
  }
  return true;
}

function SideNav({ open, onClose, collapsed, onToggleCollapse }: {
  open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refetch } = useAuth();
  const [groups, setGroups] = useState<Record<string, boolean>>(loadGroupState);

  const logout = trpc.auth.logout.useMutation({
    onSettled: async () => {
      await refetch();
      try {
        localStorage.removeItem('agl-cmd-palette-recent');
        localStorage.removeItem('agl-sales-last-attendant');
      } catch {}
      navigate('/login', { replace: true });
    },
  });

  // Auto-open the group containing the current route so the user sees
  // their context after navigating in.
  useEffect(() => {
    const cur = location.pathname;
    for (const g of NAV_GROUPS) {
      if (g.items.some(i => cur === i.to.split('?')[0] || (i.to !== '/' && cur.startsWith(i.to.split('?')[0])))) {
        setGroups(p => p[g.id] ? p : { ...p, [g.id]: true });
        break;
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    try { localStorage.setItem(GROUP_KEY, JSON.stringify(groups)); } catch {}
  }, [groups]);

  const toggleGroup = (id: string) => setGroups(p => ({ ...p, [id]: !p[id] }));

  return (
    <aside
      // WS1-A: sidebar collapses INLINE on <1024px (the `sm` breakpoint).
      // No blocking full-screen overlay — it docks into a slim 56px rail
      // so the dashboard remains visible alongside. The previous
      // `fixed inset-0 z-30` overlay produced the blocking-background
      // defect; replaced with an in-flow collapsed rail.
      className={`no-print bg-white border-r border-neutral-200/80 py-3 flex-col gap-0 overflow-y-auto sticky top-14 self-start
                  ${open ? 'flex' : 'hidden md:flex'}`}
      style={{ maxHeight: 'calc(100vh - 56px)' }}
    >
      {/* Mobile-only close button */}
      {open && (
        <div className="md:hidden flex items-center justify-between px-3 mb-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Navigation</span>
          <button
            className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            onClick={onClose} aria-label="Close menu" title="Close menu"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Workspace section */}
      {!collapsed && (
        <div className="px-3 mt-1 mb-1.5 text-[11.5px] font-semibold tracking-[0.16em] uppercase text-neutral-400">Workspace</div>
      )}
      <nav className="px-2 flex flex-col gap-0.5">
        {NAV_TOP.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to} to={to} end={to === '/'}
            // WS1-B: clicking a top-nav icon while collapsed both
            // navigates AND expands the sidebar so the active section
            // is visible immediately. `onClose` (for the mobile-open
            // overlay) and `onToggleCollapse` (rail expansion) are both
            // wired here so the same icon click handles all surfaces.
            onClick={() => { onClose(); if (collapsed) onToggleCollapse(); }}
            title={label}
            className={({ isActive }) =>
              `relative h-9 flex items-center gap-2.5 px-3 rounded-md text-sm font-medium transition-colors min-w-0
               ${collapsed ? 'justify-center' : ''}
               ${isActive
                  ? `bg-red-50 text-red-700 ${collapsed ? '' : "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-red-600 before:rounded-r"}`
                  : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'}`
            }
          >
            <Icon size={16} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="h-px bg-neutral-100 my-3 mx-3" />

      {/* Modules section */}
      {!collapsed && (
        <div className="px-3 mb-1.5 text-[11.5px] font-semibold tracking-[0.16em] uppercase text-neutral-400">Modules</div>
      )}
      <nav className="px-2 flex flex-col gap-0.5">
        {NAV_GROUPS.filter((g) => g.id !== 'admin' || user?.role === 'admin').map((g) => {
          const expanded = groups[g.id] ?? false;
          const Icon = g.icon;
          const siblings = g.items.map((i) => i.to);
          const hasActive = g.items.some(i => isItemActive(i.to, location.pathname, location.search, siblings));

          return (
            <div key={g.id}>
              <button
                type="button"
                onClick={() => {
                  // WS1-B: clicking an icon while collapsed first expands
                  // the sidebar AND opens this group AND navigates to its
                  // first child — single action, no separate toggle hunt.
                  if (collapsed) {
                    onToggleCollapse();
                    setGroups(p => ({ ...p, [g.id]: true }));
                    const first = g.items[0];
                    if (first) navigate(first.to);
                    return;
                  }
                  toggleGroup(g.id);
                }}
                title={g.label}
                className={`relative w-full h-9 flex items-center gap-2.5 px-3 rounded-md text-sm font-medium transition-colors
                  ${collapsed ? 'justify-center' : 'justify-between'}
                  ${hasActive ? 'text-red-700' : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'}`}
              >
                <span className="inline-flex items-center gap-2.5 min-w-0">
                  <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                  {!collapsed && <span className="truncate">{g.label}</span>}
                </span>
                {!collapsed && <ChevronRight size={13} className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />}
              </button>
              {expanded && !collapsed && (
                <div className="pl-8 flex flex-col gap-0.5 mt-0.5 mb-1">
                  {g.items.map((it) => {
                    const active = isItemActive(it.to, location.pathname, location.search, siblings);
                    return (
                      <NavLink
                        key={it.to} to={it.to} onClick={onClose}
                        end
                        className={
                          `relative flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium leading-tight transition-colors min-w-0
                           ${active
                              ? "bg-red-50 text-red-700 before:absolute before:left-[-22px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-red-600 before:rounded-r"
                              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`
                        }
                      >
                        <it.icon size={13} strokeWidth={1.75} className="shrink-0" />
                        <span className="truncate">{it.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer block — signed in user + logout */}
      <div className="mt-auto pt-3 mx-2 border-t border-neutral-100">
        {!collapsed && user && (
          <div className="px-2 pb-2 flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-full bg-neutral-900 text-white grid place-items-center text-[12.5px] font-semibold ring-1 ring-neutral-200 shrink-0">
              {(user.name ?? user.email ?? 'A').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Signed in</div>
              <div className="text-sm font-medium text-neutral-900 truncate" title={user.email ?? undefined}>
                {user.name ?? user.email ?? 'Account'}
              </div>
            </div>
            <span className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded-md ring-1 ring-neutral-200">
              {user.role}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (!user) { navigate('/login'); return; }
            if (window.confirm(`Sign out ${user.name ?? user.email ?? 'this account'}?`)) {
              logout.mutate();
            }
          }}
          disabled={logout.isLoading}
          className={`w-full h-9 inline-flex items-center gap-2 px-3 rounded-md text-sm font-medium
                      text-neutral-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-60 cursor-pointer transition-colors
                      ${collapsed ? 'justify-center' : ''}`}
          title={user ? `Sign out ${user.name ?? user.email ?? ''}` : 'Sign in'}
        >
          <LogOut size={14} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && (logout.isLoading ? 'Signing out…' : user ? 'Sign out' : 'Sign in')}
        </button>
      </div>
    </aside>
  );
}

/* ─────────────────────  Notification bell + dropdown  ────────────────── */

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative w-9 h-9 grid place-items-center rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
      >
        <Bell size={16} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl shadow-pop overflow-hidden text-neutral-900 z-50"
          style={{ background: '#fff', border: '1px solid rgba(26,22,18,0.12)' }}
        >
          <header
            className="flex items-center justify-between px-3 py-2"
            style={{ background: '#FAFAFA', borderBottom: '1px solid rgba(26,22,18,0.08)' }}
          >
            <span className="font-sans text-sm font-semibold">Notifications</span>
          </header>
          <div className="px-3 py-6 text-center font-sans text-sm text-neutral-600">
            Nothing to report.
          </div>
        </div>
      )}
    </div>
  );
  const utils = trpc.useUtils();

  // Poll unread count every 30s so the badge stays roughly fresh.
  //
  // We deliberately do NOT optional-chain (`?.useQuery?.()`) here. Vite/esbuild
  // compiles `proxy?.method?.(...)` to `m.call(proxy, ...)` to preserve `this`,
  // which then trips tRPC's recursive proxy — it sees `.call` as a path
  // segment, falls through to `hooks['call'](...)` which is `undefined`, and
  // throws `t[o] is not a function`, taking the whole React tree down.
  // The proxy is always callable; if the procedure doesn't exist on the
  // server, the query simply resolves to an error state and we treat the
  // count as 0 — same UX, no crash.
  const countQuery = (trpc.notifications as any).unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const unread = countQuery?.data?.success ? countQuery.data.count : 0;

  // Only load the list when the panel opens. 30 rows is plenty for a glance.
  const listQuery = trpc.notifications.list.useQuery(
    { unreadOnly: false },
    { enabled: open, keepPreviousData: true },
  );
  const all: any[] = Array.isArray(listQuery.data) ? listQuery.data : [];

  // WS5-B — merge document-expiry alerts into the bell. The query
  // surfaces docs expiring within 30 days as virtual notification rows
  // (id prefix `doc-exp-`) so the badge count + dropdown both light up
  // without needing the server-side scheduler to have run.
  const expiringQ = (trpc.staffManagement as any).expiringDocuments.useQuery(
    { withinDays: 30 }, { enabled: open, refetchInterval: 60_000 },
  );
  const expRows: any[] = expiringQ?.data?.success ? (expiringQ.data.rows ?? []) : [];
  const expVirtual = expRows.map((r: any) => {
    const exp = r.doc?.expiresAt ? new Date(r.doc.expiresAt) : null;
    const days = exp ? Math.floor((exp.getTime() - Date.now()) / 86_400_000) : null;
    return {
      id: `doc-exp-${r.doc.id}`, _virtual: true,
      title: `Document ${days != null && days < 0 ? 'EXPIRED' : `expiring in ${days}d`}`,
      content: `${r.staffName} — ${String(r.doc.docType).replace(/_/g, ' ')} (${r.doc.filename})`,
      createdAt: r.doc.createdAt,
      isRead: 0,
      type: 'document',
      severity: (days != null && days < 0) ? 'high' : days != null && days <= 7 ? 'medium' : 'low',
    };
  });
  const items = [...expVirtual, ...all].slice(0, 30);

  const markRead = (trpc.notifications as any).markRead.useMutation({
    onSuccess: () => {
      (utils.notifications as any).unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });
  const markAllRead = (trpc.notifications as any).markAllRead.useMutation({
    onSuccess: () => {
      (utils.notifications as any).unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative w-9 h-9 grid place-items-center rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ''}`}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full text-[10.5px] font-bold leading-none ring-2 ring-white"
            style={{ background: '#DC2626', color: '#fff' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl shadow-pop overflow-hidden text-neutral-900 z-50"
          style={{ background: '#fff', border: '1px solid rgba(26,22,18,0.12)' }}
        >
          <header
            className="flex items-center justify-between px-3 py-2"
            style={{ background: '#FAFAFA', borderBottom: '1px solid rgba(26,22,18,0.08)' }}
          >
            <span className="font-sans text-sm font-semibold">
              Notifications {unread > 0 && <span className="text-neutral-500 font-normal">({unread} unread)</span>}
            </span>
            {unread > 0 && markAllRead && (
              <button
                type="button"
                className="font-sans text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isLoading}
              >
                Mark all read
              </button>
            )}
          </header>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {listQuery.isLoading && (
              <div className="px-3 py-4 text-center font-sans text-sm text-neutral-600">
                <Loader2 size={14} className="animate-spin inline" /> Loading…
              </div>
            )}
            {!listQuery.isLoading && items.length === 0 && (
              <div className="px-3 py-6 text-center font-sans text-sm text-neutral-600">
                Nothing to report.
              </div>
            )}
            {!listQuery.isLoading && items.map((n) => (
              <button
                key={n.id}
                type="button"
                className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-canvas transition-colors"
                style={{
                  borderBottom: '1px solid rgba(26,22,18,0.05)',
                  background: n.isRead ? undefined : 'rgba(204,14,26,0.04)',
                }}
                onClick={() => { if (!n.isRead && markRead) markRead.mutate({ id: n.id }); }}
              >
                <AlertTriangle
                  size={14}
                  className={n.type === 'inventory_alert' ? 'text-red-600 shrink-0 mt-0.5' : 'text-neutral-500 shrink-0 mt-0.5'}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-sans text-sm font-semibold truncate">{n.title}</div>
                  <div className="font-sans text-xs text-neutral-600 leading-relaxed">{n.content}</div>
                  <div className="font-sans text-xs text-neutral-500 mt-0.5">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
