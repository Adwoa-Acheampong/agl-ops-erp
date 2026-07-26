import { FormEvent, useState } from 'react';
import { ShieldCheck, Loader2, Search, KeyRound, Trash2 } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { Modal, FormField } from '../components/ui';
import { trpc } from '../lib/trpc';
import { useAuth } from '../contexts/AuthContext';

/**
 * P8.5 — Admin: Access Levels.
 *
 * Lists every user on the platform and lets the principal admin promote /
 * demote roles inline. The dropdown writes through `auth.setRole`, which
 * refuses self-demotion and refuses to demote the last admin.
 */

const ROLES = ['admin', 'owner', 'manager', 'staff', 'user'] as const;
type Role = typeof ROLES[number];

const ROLE_TONE: Record<Role, string> = {
  admin: 'text-brand-500',
  owner: 'text-ink-900',
  manager: 'text-ink-900',
  staff: 'text-ink-900',
  user: 'text-ink-700',
};

interface ResetTarget {
  id: number;
  name: string | null;
  email: string | null;
}

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);

  const utils = trpc.useUtils();
  const usersQuery = trpc.auth.listUsers.useQuery(undefined, { keepPreviousData: true });
  const isLoading = usersQuery.isLoading;
  const errorMessage =
    usersQuery.error?.message ??
    (usersQuery.data?.success === false ? usersQuery.data.error : null);
  const allUsers = usersQuery.data?.success ? usersQuery.data.users ?? [] : [];

  const setRoleMutation = trpc.auth.setRole.useMutation({
    onSuccess: () => utils.auth.listUsers.invalidate(),
  });
  const deleteMutation = trpc.auth.deleteUser.useMutation({
    onSuccess: () => utils.auth.listUsers.invalidate(),
  });

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u: any) =>
      [u.name, u.email, u.role].some((f) => (f ?? '').toLowerCase().includes(q)),
    );
  })();

  const adminCount = allUsers.filter((u: any) => u.role === 'admin').length;

  return (
    <PageShell
      eyebrow="Administration"
      title="Access Levels"
      intro="Promote, demote, audit. Roles drive what each member can see and change. Refusal is built in: you can't change your own role and the system won't let the last admin step down."
      actions={
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white"
          style={{ border: '1px solid rgba(26,22,18,0.10)' }}
        >
          <Search size={14} className="text-ink-700" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or role"
            className="bg-transparent outline-none font-sans text-sm text-ink-900 placeholder:text-ink-700/50"
            style={{ minWidth: 240 }}
          />
        </div>
      }
    >
      {errorMessage && (
        <div
          className="rounded-2xl px-4 py-3 font-sans text-sm text-brand-500 bg-white"
          style={{ border: '1px solid rgba(160,48,64,0.32)' }}
        >
          {errorMessage}
        </div>
      )}

      {setRoleMutation.error && (
        <div
          className="rounded-2xl px-4 py-3 font-sans text-sm text-brand-500 bg-white"
          style={{ border: '1px solid rgba(160,48,64,0.32)' }}
          role="alert"
        >
          {setRoleMutation.error.message}
        </div>
      )}
      {deleteMutation.error && (
        <div
          className="rounded-2xl px-4 py-3 font-sans text-sm text-brand-500 bg-white"
          style={{ border: '1px solid rgba(160,48,64,0.32)' }}
          role="alert"
        >
          {deleteMutation.error.message}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <article
          className="bg-white rounded-2xl p-4 flex flex-col gap-1.5 min-w-0"
          style={{ border: '1px solid rgba(26,22,18,0.06)' }}
        >
          <span className="font-sans text-xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.08em' }}>
            Total accounts
          </span>
          <div className="rule-luxe" />
          <div className="font-sans num leading-none text-ink-900" style={{ fontSize: 32, fontWeight: 600 }}>
            {allUsers.length}
          </div>
          <p className="font-sans text-sm text-ink-700">All users on the platform.</p>
        </article>
        <article
          className="bg-white rounded-2xl p-4 flex flex-col gap-1.5 min-w-0"
          style={{ border: '1px solid rgba(26,22,18,0.06)' }}
        >
          <span className="font-sans text-xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.08em' }}>
            Administrators
          </span>
          <div className="rule-luxe" />
          <div className="font-sans num leading-none text-brand-500" style={{ fontSize: 32, fontWeight: 600 }}>
            {adminCount}
          </div>
          <p className="font-sans text-sm text-ink-700">Demotion of the sole admin is refused.</p>
        </article>
      </section>

      <section className="mt-3">
        <header className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-sans text-2xl font-semibold text-ink-900">Roster</h2>
          {usersQuery.isFetching && (
            <span className="inline-flex items-center gap-1.5 font-sans text-xs text-ink-700">
              <Loader2 size={12} className="animate-spin" /> Refreshing…
            </span>
          )}
        </header>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="t-th">Name</th>
                  <th className="t-th">Email</th>
                  <th className="t-th">Login</th>
                  <th className="t-th">Last seen</th>
                  <th className="t-th">Role</th>
                  <th className="t-th" style={{ width: '4rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin" /> Loading users…
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      {search ? `No users match "${search}".` : 'No users on the platform.'}
                    </td>
                  </tr>
                )}
                {filtered.map((u: any) => {
                  const isMe = currentUser?.id === u.id;
                  const isLastAdmin = u.role === 'admin' && adminCount <= 1;
                  return (
                    <tr key={u.id}>
                      <td className="t-td font-semibold">
                        {u.name ?? '—'}
                        {isMe && (
                          <span className="ml-2 font-sans text-2xs uppercase tracking-luxe text-brand-500">
                            You
                          </span>
                        )}
                      </td>
                      <td className="t-td">{u.email ?? '—'}</td>
                      <td className="t-td capitalize">{u.loginMethod ?? '—'}</td>
                      <td className="t-td num">{u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString() : '—'}</td>
                      <td className="t-td">
                        <select
                          className={`field-input ${ROLE_TONE[u.role as Role] ?? ''}`}
                          value={u.role}
                          disabled={isMe || isLastAdmin || setRoleMutation.isLoading}
                          onChange={(e) =>
                            setRoleMutation.mutate({ userId: u.id, role: e.target.value as Role })
                          }
                          style={{ minWidth: 130 }}
                          title={
                            isMe
                              ? "You can't change your own role"
                              : isLastAdmin
                                ? 'Last remaining admin'
                                : undefined
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="t-td" style={{ width: '5rem' }}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-1 text-ink-700 hover:bg-canvas hover:text-ink-900 transition-colors"
                            onClick={() => setResetTarget({ id: u.id, name: u.name, email: u.email })}
                            aria-label={`Reset password for ${u.name ?? u.email}`}
                            title="Reset password"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1 text-brand-500 hover:bg-brand-50 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                            disabled={isMe || isLastAdmin || deleteMutation.isLoading}
                            onClick={() => {
                              const label = u.email ?? u.name ?? `user #${u.id}`;
                              if (window.confirm(`Delete login account ${label}? This removes their system access.`)) {
                                deleteMutation.mutate({ userId: u.id });
                              }
                            }}
                            aria-label={`Delete account for ${u.name ?? u.email}`}
                            title={isMe ? "You can't delete your own account" : isLastAdmin ? 'Final admin cannot be deleted' : 'Delete account'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <ResetPasswordModal
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={() => setResetTarget(null)}
      />

      <section
        className="rounded-2xl p-4 flex items-start gap-3 mt-3"
        style={{
          background: '#0E0A0A',
          color: '#FAF7F2',
          border: '1px solid rgba(160,48,64,0.32)',
        }}
      >
        <span className="w-5 h-5 rounded-xl bg-brand-500 text-neutral-50 grid place-items-center shrink-0">
          <ShieldCheck size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-base font-semibold">Sensitive operations gated</h3>
          <p className="font-sans text-sm text-neutral-50/80 mt-1 leading-relaxed">
            Tenant creation (after the first), tenant listing, payroll finalize, and this page itself
            are all administrator-only. Promotions are audit-logged with the actor and target.
          </p>
        </div>
      </section>
    </PageShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   Reset password modal
// ───────────────────────────────────────────────────────────────────────────

function ResetPasswordModal({
  target,
  onClose,
  onDone,
}: {
  target: ResetTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const open = target !== null;

  const [syncedId, setSyncedId] = useState<number | null>(null);
  if (target && target.id !== syncedId) {
    setSyncedId(target.id);
    setPwd(''); setConfirm(''); setError(null); setDone(false);
  } else if (!target && syncedId !== null) {
    setSyncedId(null);
  }

  const resetMutation = trpc.auth.adminResetPassword.useMutation({
    onSuccess: (data) => {
      if (data?.success === false) {
        setError(data.error ?? 'Failed to reset password.');
        return;
      }
      setDone(true);
    },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setError(null);
    if (pwd.length < 8) return setError('Password must be at least 8 characters.');
    if (pwd !== confirm) return setError('Passwords do not match.');
    resetMutation.mutate({ userId: target.id, newPassword: pwd });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Sensitive operation"
      title={target ? `Reset password — ${target.name ?? target.email ?? 'user'}` : 'Reset password'}
      footer={
        done ? (
          <button type="button" className="btn-primary text-sm" onClick={onDone}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={resetMutation.isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              form="reset-pwd-form"
              className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={resetMutation.isLoading}
            >
              {resetMutation.isLoading ? 'Resetting…' : 'Reset Password'}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="font-sans text-sm text-ink-900">
          <p>Password reset for <strong>{target?.email ?? target?.name}</strong>.</p>
          <p className="mt-2 text-ink-700">
            They will need to sign in with the new password on their next session. Share it through a
            secure side-channel — this dialog won't show it again.
          </p>
        </div>
      ) : (
        <form id="reset-pwd-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
          <FormField label="New password" required hint="Minimum 8 characters. The user can change it after signing in.">
            <input
              type="password"
              className="field-input"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoFocus
              minLength={8}
              required
            />
          </FormField>
          <FormField label="Confirm new password" required>
            <input
              type="password"
              className="field-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </FormField>
          {error && (
            <div
              className="rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
              style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
              role="alert"
            >
              {error}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
