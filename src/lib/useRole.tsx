/**
 * Role-based access control. The role-string lives on `ctx.user.role`
 * (server-side enforced by `protectedProcedure` + per-router predicates);
 * client-side we mirror the same source via the `auth.me` query so
 * surface gating, sidebar visibility, and CTA disablement match the
 * server's verdict.
 *
 *   useRole()        → { role, isManager, isAdmin, isStaff, loading }
 *   <RoleGate allow={['admin','manager']}> … </RoleGate>
 */
import type { ReactNode } from 'react';
import { trpc } from './trpc';

export type Role = 'admin' | 'owner' | 'manager' | 'staff' | 'user';

const ADMINS:   ReadonlyArray<Role> = ['admin'];
const MANAGERS: ReadonlyArray<Role> = ['admin', 'owner', 'manager'];

export function useRole() {
  const q = trpc.auth.me.useQuery(undefined as any, { staleTime: 30_000 });
  const user = q.data?.user ?? null;
  const role = ((user?.role ?? 'staff') as string).toLowerCase() as Role;
  return {
    user, role,
    isAdmin:   ADMINS.includes(role),
    isManager: MANAGERS.includes(role),
    isStaff:   true, // everyone authenticated is at least staff
    loading: q.isLoading,
  };
}

export function RoleGate({
  allow, fallback = null, children,
}: { allow: ReadonlyArray<Role>; fallback?: ReactNode; children: ReactNode }) {
  const { role, loading } = useRole();
  if (loading) return null;
  return allow.includes(role) ? <>{children}</> : <>{fallback}</>;
}
