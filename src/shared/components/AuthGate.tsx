import { ReactNode } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';

/**
 * AuthGate prevents data-dependent providers from rendering before the
 * initial auth check completes. This is NOT an auth wall -- once the
 * auth state is known (logged in OR logged out), children render normally.
 */
export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { isLoading } = useAuth();

  if (isLoading) return null;

  return <>{children}</>;
};
