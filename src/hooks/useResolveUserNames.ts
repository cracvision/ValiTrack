import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves user IDs to full names using a SECURITY DEFINER RPC function.
 * Safe for non-super_user roles — bypasses RLS but only returns id + full_name.
 */
export function useResolveUserNames(userIds: (string | undefined | null)[]) {
  const validIds = userIds.filter(Boolean) as string[];

  return useQuery({
    queryKey: ['resolve-user-names', ...validIds.sort()],
    queryFn: async () => {
      if (validIds.length === 0) return {};
      const { data, error } = await supabase
        .rpc('resolve_user_names', { user_ids: validIds });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((row: { id: string; full_name: string }) => {
        map[row.id] = row.full_name;
      });
      return map;
    },
    enabled: validIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
