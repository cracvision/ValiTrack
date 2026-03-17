import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  user_id: string | null;
  details: Record<string, any> | null;
}

export function useSystemAuditLog(systemId: string | undefined) {
  return useQuery({
    queryKey: ['system-audit-log', systemId],
    queryFn: async (): Promise<AuditEntry[]> => {
      if (!systemId) return [];

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, created_at, user_id, details')
        .eq('resource_type', 'system_profile')
        .eq('resource_id', systemId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return (data as AuditEntry[]) ?? [];
    },
    enabled: !!systemId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentAuditLog(limit: number = 10) {
  return useQuery({
    queryKey: ['recent-audit-log', limit],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, created_at, user_id, details')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as AuditEntry[]) ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
}
