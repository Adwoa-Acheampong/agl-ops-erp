import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Gate that redirects anonymous users to /login while preserving the
 * intended destination so we can return them after auth.
 *
 * While the auth state is hydrating, render a calm parchment splash —
 * never a flash of the login screen for already-signed-in users.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthSplash />;

  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith('/staff') ? '/staff/login' : '/login';
    return <Navigate to={loginPath} state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
}

function AuthSplash() {
  return (
    <div className="min-h-screen bg-canvas grid place-items-center">
      <div className="flex flex-col items-center gap-2">
        <span
          className="font-serif text-xs font-medium tracking-luxe uppercase text-ink-700"
        >
          AGL · Ops
        </span>
        <span className="font-sans text-sm text-ink-700">Verifying credentials…</span>
      </div>
    </div>
  );
}
