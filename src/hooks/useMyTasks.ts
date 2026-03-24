import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MyTask {
  id: string;
  title: string;
  title_es?: string | null;
  task_group: string;
  status: string;
  due_date: string;
  review_case_id: string;
  review_case_title: string;
  system_name: string;
}

export function useMyTasks() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['my-tasks', userId],
    queryFn: async (): Promise<MyTask[]> => {
      if (!userId) return [];

      // Get tasks assigned to current user
      const { data: tasks, error } = await supabase
        .from('review_tasks')
        .select('id, title, title_es, task_group, status, due_date, review_case_id')
        .eq('assigned_to', userId)
        .eq('is_deleted', false)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true });

      if (error) throw error;
      if (!tasks || tasks.length === 0) return [];

      // Get review case info for these tasks
      const caseIds = [...new Set(tasks.map((t: any) => t.review_case_id))];
      const { data: cases } = await supabase
        .from('review_cases')
        .select('id, title, system_id')
        .eq('is_deleted', false)
        .in('id', caseIds);

      const caseMap: Record<string, { title: string; system_id: string }> = {};
      const systemIds: string[] = [];
      if (cases) {
        for (const c of cases as any[]) {
          caseMap[c.id] = { title: c.title, system_id: c.system_id };
          if (!systemIds.includes(c.system_id)) systemIds.push(c.system_id);
        }
      }

      // Get system names
      let systemMap: Record<string, string> = {};
      if (systemIds.length > 0) {
        const { data: systems } = await supabase
          .from('system_profiles')
          .select('id, name')
          .eq('is_deleted', false)
          .in('id', systemIds);
        if (systems) {
          systemMap = Object.fromEntries(systems.map((s: any) => [s.id, s.name]));
        }
      }

      return tasks.map((t: any) => {
        const rc = caseMap[t.review_case_id];
        return {
          id: t.id,
          title: t.title,
          task_group: t.task_group,
          status: t.status,
          due_date: t.due_date,
          review_case_id: t.review_case_id,
          review_case_title: rc?.title || '—',
          system_name: rc ? (systemMap[rc.system_id] || '—') : '—',
        };
      });
    },
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}
