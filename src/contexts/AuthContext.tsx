import { createContext, useContext, useMemo, ReactNode } from 'react';
import { trpc } from '../lib/trpc';

export type AuthRole =
  | 'user'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'operations_manager'
  | 'sales_supervisor'
  | 'workshop_supervisor'
  | 'sales_rep'
  | 'mechanic'
  | 'cashier'
  | 'owner'
  | 'principal';

export interface AuthUser {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: AuthRole;
  canEditLedgers?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // `auth.me` is a public procedure; returns { user: null } when anonymous.
  const meQuery = trpc.auth.me.useQuery(undefined, {
    staleTime: 60_000,
  });

  const value = useMemo<AuthContextValue>(() => {
    const user = (meQuery.data?.user ?? null) as AuthUser | null;
    return {
      user,
      isLoading: meQuery.isLoading,
      isAuthenticated: !!user,
      refetch: meQuery.refetch,
    };
  }, [meQuery.data, meQuery.isLoading, meQuery.refetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
