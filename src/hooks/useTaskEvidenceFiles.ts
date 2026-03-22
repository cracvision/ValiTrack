import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { toast } from '@/hooks/use-toast';
import type { TaskEvidenceFile } from '@/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Sanitize filename for Supabase Storage keys (no accents, no special chars) */
function sanitizeStoragePath(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Auto-suggest evidence category based on task group and title keywords */
export function suggestEvidenceCategory(taskGroup: string, taskTitle: string): string {
  const title = taskTitle.toLowerCase();

  const KEYWORD_MAP: Record<string, [string, string][]> = {
    ITSM: [
      ['incident', 'incident_report'],
      ['problem', 'problem_report'],
      ['change', 'change_control_report'],
      ['service', 'service_request_report'],
    ],
    QMS: [
      ['change', 'change_control_report'],
      ['deviation', 'deviation_report'],
      ['capa', 'capa_record'],
      ['audit', 'audit_finding'],
    ],
    SEC: [
      ['access list', 'user_access_list'],
      ['terminated', 'access_review'],
      ['privileged', 'privileged_account_doc'],
      ['patch', 'security_patch_report'],
      ['access review', 'access_review'],
    ],
    INFRA: [
      ['backup', 'backup_log'],
      ['restore', 'restore_test'],
      ['dr', 'dr_bcp_plan'],
      ['bcp', 'dr_bcp_plan'],
      ['disaster', 'dr_bcp_plan'],
      ['audit trail', 'audit_trail_export'],
    ],
    DOC: [
      ['specification', 'system_specification'],
      ['interface', 'interface_document'],
      ['sop', 'sop'],
      ['training', 'training_record'],
      ['vendor', 'vendor_assessment'],
      ['sla', 'sla_report'],
      ['validation', 'validation_document'],
      ['config', 'software_config'],
      ['performance', 'performance_report'],
    ],
  };

  const keywords = KEYWORD_MAP[taskGroup];
  if (keywords) {
    for (const [keyword, category] of keywords) {
      if (title.includes(keyword)) return category;
    }
  }

  return 'other';
}

interface UseTaskEvidenceFilesOptions {
  taskId: string | undefined;
  reviewCaseId: string;
}

export function useTaskEvidenceFiles({ taskId, reviewCaseId }: UseTaskEvidenceFilesOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rawFiles = [], isLoading } = useQuery({
    queryKey: ['task-evidence-files', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('task_evidence_files')
        .select('*')
        .eq('task_id', taskId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TaskEvidenceFile[];
    },
    enabled: !!taskId,
  });

  // Resolve uploader names
  const uploaderIds = [...new Set(rawFiles.map(f => f.created_by).filter(Boolean))];
  const { data: userNames = {} } = useResolveUserNames(uploaderIds);

  const files = rawFiles.map(f => ({
    ...f,
    created_by_name: userNames[f.created_by] || '—',
  }));

  const fileCount = files.length;

  const uploadFile = useMutation({
    mutationFn: async ({ file, category, description }: { file: File; category: string; description?: string }) => {
      if (!taskId || !user?.id) throw new Error('Missing task or user');

      // 1. Client-side SHA-256
      const sha256Hash = await calculateSHA256(file);

      // 2. Upload to storage
      const timestamp = Date.now();
      const storagePath = `${reviewCaseId}/${taskId}/${timestamp}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('review-evidence')
        .upload(storagePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      // 3. Insert metadata
      const { error: insertError } = await supabase
        .from('task_evidence_files')
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          sha256_hash: sha256Hash,
          evidence_category: category,
          description: description?.trim() || '',
          created_by: user.id,
        } as any);
      if (insertError) throw insertError;

      // 4. Auto work note
      const sizeFormatted = formatFileSize(file.size);
      const hashShort = sha256Hash.substring(0, 16);

      await supabase.from('task_work_notes').insert({
        task_id: taskId,
        content: `Evidence uploaded: ${file.name} (${sizeFormatted}, SHA-256: ${hashShort}...)`,
        note_type: 'evidence_upload',
        created_by: user.id,
      } as any);

      // 5. Audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'EVIDENCE_UPLOADED',
        resource_type: 'task_evidence_files',
        resource_id: taskId,
        details: {
          review_case_id: reviewCaseId,
          file_name: file.name,
          file_size_bytes: file.size,
          sha256_hash: sha256Hash,
          evidence_category: category,
        },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-evidence-files', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-work-notes', taskId] });
      toast({ title: 'Evidence uploaded' });
    },
    onError: (err: any) => {
      console.error('Failed to upload evidence:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const getDownloadUrl = async (storagePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('review-evidence')
      .createSignedUrl(storagePath, 3600); // 1 hour
    if (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  return {
    files,
    isLoading,
    uploadFile,
    fileCount,
    getDownloadUrl,
  };
}
