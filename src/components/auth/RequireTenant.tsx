import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { trpc } from '../../lib/trpc';

/**
 * Gate that requires the signed-in user to be associated with a tenant.
 * If `auth.myTenant` returns `tenantId: null`, redirect to /onboarding so
 * the user can self-create their first workspace. Pairs with `RequireAuth`
 * which guarantees ctx.user is non-null before this query fires.
 */
export function RequireTenant({ children }: { children: ReactNode }) {
  const tenantQuery = trpc.auth.myTenant.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const location = useLocation();

  if (tenantQuery.isLoading) return <Splash label="Resolving workspace…" />;

  // Network/permission errors fall through to the dashboard (RequireAuth
  // already verified the session). The tenant middleware will surface a
  // FORBIDDEN error inline if the user genuinely has no tenant.
  if (tenantQuery.data?.tenantId == null && !tenantQuery.error) {
    return <Navigate to="/onboarding" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

function Splash({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-canvas grid place-items-center">
      <div className="flex flex-col items-center gap-2">
        <span className="font-serif text-xs font-medium tracking-luxe uppercase text-ink-700">
          AGL · Ops
        </span>
        <span className="font-sans text-sm text-ink-700">{label}</span>
      </div>
    </div>
  );
}
