import { Activity, Command, ShieldCheck, GitBranch, Server } from 'lucide-react';
import { trpc } from '../../lib/trpc';

/**
 * Enterprise status footer pinned to the bottom of every authenticated
 * page. Surfaces: build version, environment (dev/staging/prod), tenant
 * name, FixBot connection status, and the ⌘K hint. Visual rhythm via
 * subtle vertical dividers.
 */

const BUILD_VERSION = (import.meta as any).env?.VITE_BUILD_VERSION ?? 'v1.0.0';
const ENV = ((import.meta as any).env?.MODE ?? 'development').toLowerCase() as
  | 'development' | 'production' | 'staging' | string;

function envMeta() {
  if (ENV === 'production') return { label: 'Production', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' };
  if (ENV === 'staging')    return { label: 'Staging',    tone: 'bg-amber-50 text-amber-700 ring-amber-200',       dot: 'bg-amber-500' };
  return { label: 'Development', tone: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' };
}

export function StatusFooter() {
  const e = envMeta();
  const meQ = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  const tenantQ = trpc.auth.myTenant.useQuery(undefined, {
    enabled: !!meQ.data?.user, staleTime: 60_000,
  });
  const tenantsQ = trpc.tenants.list.useQuery(undefined, {
    enabled: tenantQ.data?.tenantId != null, staleTime: 60_000,
  });
  const all = tenantsQ.data?.success ? tenantsQ.data.tenants ?? [] : [];
  const mine = all.find((t: any) => t.id === tenantQ.data?.tenantId) as any;
  const tenantName = mine?.businessName ?? 'Unassigned tenant';

  // Live FixBot state — polls every 20s so the footer reflects offline /
  // online transitions without a page reload. While a slash-command or
  // chat mutation is in flight we transition into a "thinking" state via
  // the global flag the bot router sets on its mutation hooks.
  const fixbotQ = trpc.fixbot.status.useQuery(undefined, { staleTime: 20_000, refetchInterval: 20_000 });
  const configured = !!fixbotQ.data?.configured;
  const thinking = (fixbotQ.data as any)?.thinking === true;
  const fbState: 'online' | 'offline' | 'thinking' =
    !configured ? 'offline' : thinking ? 'thinking' : 'online';
  const fbTone =
    fbState === 'online'   ? 'text-emerald-700' :
    fbState === 'thinking' ? 'text-amber-700'   : 'text-neutral-500';

  return (
    <footer className="no-print sticky bottom-0 z-30 w-full h-9 border-t border-neutral-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto h-full px-4 md:px-8 flex items-center justify-between gap-3 text-[12.5px] text-neutral-600">
        {/* Left cluster */}
        <div className="flex items-stretch divide-x divide-neutral-200 min-w-0">
          <span className="inline-flex items-center gap-1.5 pr-3 font-semibold">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ring-1 ${e.tone}`}>
              <Server size={10} strokeWidth={1.75} />
              <span className="font-mono tracking-wider">{e.label}</span>
            </span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 text-neutral-600">
            <GitBranch size={10} strokeWidth={1.75} />
            <span className="font-mono tabular-nums">{BUILD_VERSION}</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 pl-3 text-neutral-700 truncate min-w-0">
            <ShieldCheck size={10} strokeWidth={1.75} />
            <span className="truncate max-w-[28rem]" title={tenantName}>{tenantName}</span>
          </span>
        </div>

        {/* Right cluster */}
        <div className="flex items-stretch divide-x divide-neutral-200 shrink-0">
          <a
            href="/fixbot"
            className={`hidden sm:inline-flex items-center gap-1.5 pr-3 ${fbTone}`}
            title={fbState === 'online' ? 'FixBot connected' : fbState === 'thinking' ? 'FixBot is processing…' : 'FixBot not configured'}
          >
            <Activity size={10} strokeWidth={1.75} className={fbState !== 'offline' ? 'anim-pulse-dot' : ''} />
            FixBot <span className="font-mono">{fbState}</span>
          </a>
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 text-neutral-600">
            <Command size={10} strokeWidth={1.75} />
            <kbd className="font-mono px-1 py-0.5 rounded bg-neutral-50 border border-neutral-200 text-[11.5px]">⌘K</kbd>
            <span>to search</span>
          </span>
          <span className="pl-3 text-neutral-400 font-mono">© AGL Ops</span>
        </div>
      </div>
    </footer>
  );
}
