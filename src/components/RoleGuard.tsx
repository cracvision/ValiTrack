import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles: AppRole[];
}

export function RoleGuard({ children, requiredRoles }: RoleGuardProps) {
  const { roles } = useAuth();

  const hasAccess = requiredRoles.some((r) => roles.includes(r));

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
