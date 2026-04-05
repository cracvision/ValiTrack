import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import type { TaskWorkNote } from '@/types';

export function useTaskWorkNotes(taskId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['task-work-notes', taskId],
    queryFn: async (): Promise<(TaskWorkNote & { created_by_name?: string })[]> => {
      if (!taskId) return [];

      const { data, error } = await supabase
        .from('task_work_notes')
        .select('*')
        .eq('task_id', taskId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Resolve user names
      const userIds = [...new Set(data.map((n: any) => n.created_by).filter(Boolean))];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .rpc('resolve_user_names', { user_ids: userIds });
        if (users) {
          userMap = Object.fromEntries(
            users.map((u: { id: string; full_name: string }) => [u.id, u.full_name])
          );
        }
      }

      return data.map((row: any) => ({
        id: row.id,
        task_id: row.task_id,
        content: row.content,
        note_type: row.note_type,
        created_at: row.created_at,
        created_by: row.created_by,
        is_deleted: row.is_deleted,
        created_by_name: userMap[row.created_by] || '—',
      }));
    },
    enabled: !!taskId,
  });

  // Count only manual work notes (excludes auto-generated)
  const noteCount = notes.filter(n => n.note_type === 'work_note').length;

  // Count work notes authored by human users (excludes AI Agent Worker notes)
  // A human note is a work_note created by a user who is in the review case roles,
  // identified by not being the triggered_by of an AI result
  const humanNoteCount = notes.filter(n => n.note_type === 'work_note' && n.created_by === user?.id).length;

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      if (!taskId || !user?.id) throw new Error('Missing task or user');
      if (content.trim().length < 10) throw new Error('Work notes must be at least 10 characters');

      const { error } = await supabase.from('task_work_notes').insert({
        task_id: taskId,
        content: content.trim(),
        note_type: 'work_note',
        created_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-work-notes', taskId] });
      toast({ title: 'Note added' });
    },
    onError: (err: any) => {
      console.error('Failed to add note:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    notes,
    isLoading,
    addNote,
    noteCount,
    humanNoteCount,
  };
}
