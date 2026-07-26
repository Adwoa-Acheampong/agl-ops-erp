import { useState } from 'react';
import { Bell, Check, Loader2, AlertTriangle, Package, Wallet, Users as UsersIcon, Calendar, Sparkles } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState } from '../components/ui';
import { trpc } from '../lib/trpc';

/**
 * P10.3 — Notifications inbox.
 *
 * Reads `notifications` table, lets the operator mark single rows or all rows
 * as read. Tab toggle between Unread (default) and All.
 */

const TYPE_ICON: Record<string, any> = {
  inventory_alert: Package,
  payment_alert: Wallet,
  attendance_alert: UsersIcon,
  vehicle_alert: AlertTriangle,
  revenue_alert: Wallet,
  general: Sparkles,
};

const TYPE_TONE: Record<string, string> = {
  inventory_alert: 'text-warning',
  payment_alert: 'text-brand-500',
  attendance_alert: 'text-warning',
  vehicle_alert: 'text-brand-500',
  revenue_alert: 'text-ink-900',
  general: 'text-ink-700',
};

export function NotificationsPage() {
  const [showAll, setShowAll] = useState(false);

  const utils = trpc.useUtils();
  const listQuery = trpc.notifications.list.useQuery(
    { unreadOnly: !showAll },
    { keepPreviousData: true },
  );
  const unreadCount = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const rows = (Array.isArray(listQuery.data) ? listQuery.data : []) as any[];
  const isLoading = listQuery.isLoading;

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const unreadOnRow = rows.filter((r) => !r.isRead).length;

  return (
    <PageShell
      eyebrow="Inbox"
      title="Notifications"
      intro="Low-stock alerts, payment overdues, attendance flags — every signal the system raises lands here, queued for you to dispatch."
      actions={
        <>
          <div
            className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white"
            style={{ border: '1px solid rgba(26,22,18,0.10)' }}
          >
            <button
              type="button"
              className={`px-2 py-1 rounded-lg text-xs font-sans ${
                !showAll ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-ink-700'
              }`}
              onClick={() => setShowAll(false)}
            >
              Unread {unreadCount.data?.count != null ? `· ${unreadCount.data.count}` : ''}
            </button>
            <button
              type="button"
              className={`px-2 py-1 rounded-lg text-xs font-sans ${
                showAll ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-ink-700'
              }`}
              onClick={() => setShowAll(true)}
            >
              All
            </button>
          </div>
          <button
            type="button"
            className="btn-outline text-sm disabled:opacity-50"
            onClick={() => markAll.mutate()}
            disabled={markAll.isLoading || unreadOnRow === 0}
            title={unreadOnRow === 0 ? 'Nothing to mark' : 'Mark every unread row as read'}
          >
            <Check size={14} /> Mark all read
          </button>
        </>
      }
    >
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
        {isLoading ? (
          <div className="px-4 py-8 text-center font-sans text-sm text-ink-700">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" /> Loading notifications…
            </span>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={showAll ? 'No notifications on file' : 'No unread notifications'}
            description={
              showAll
                ? 'When the system raises a signal — low stock, overdue payment, attendance flag — it appears here.'
                : 'Switch to the All tab to view notifications you have already cleared.'
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'rgba(26,22,18,0.06)' }}>
            {rows.map((n) => {
              const Icon = TYPE_ICON[n.type as string] ?? Calendar;
              const tone = TYPE_TONE[n.type as string] ?? 'text-ink-700';
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 ${n.isReadByMe ? 'opacity-70' : 'bg-canvas/40'}`}
                >
                  <span className={`w-9 h-9 rounded-xl bg-brand-50 grid place-items-center shrink-0 ${tone}`}>
                    <Icon size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-sans text-sm font-semibold text-ink-900">
                        {n.title}
                      </h3>
                      <span className="font-sans text-xs text-ink-700 shrink-0 num">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="font-sans text-sm text-ink-700 mt-0.5 leading-relaxed whitespace-pre-line">
                      {n.content}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="font-sans text-2xs uppercase tracking-luxe text-ink-700">
                        {String(n.type ?? '').replace('_', ' ')}
                      </span>
                      {!n.isReadByMe && (
                        <button
                          type="button"
                          className="font-sans text-xs text-brand-500 hover:text-brand-600 disabled:opacity-50"
                          onClick={() => markRead.mutate({ id: n.id })}
                          disabled={markRead.isLoading}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
