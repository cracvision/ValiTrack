
-- Create task_evidence_files table
CREATE TABLE public.task_evidence_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.review_tasks(id),
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  evidence_category TEXT NOT NULL CHECK (evidence_category IN (
    'incident_report', 'problem_report', 'change_control_report',
    'service_request_report', 'deviation_report', 'capa_record',
    'audit_finding', 'user_access_list', 'access_review',
    'privileged_account_doc', 'security_patch_report', 'backup_log',
    'restore_test', 'dr_bcp_plan', 'audit_trail_export',
    'system_specification', 'interface_document', 'sop',
    'training_record', 'vendor_assessment', 'sla_report',
    'validation_document', 'software_config', 'performance_report',
    'ai_analysis_output', 'other'
  )),
  description TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  replaces_file_id UUID REFERENCES public.task_evidence_files(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_task_evidence_files_task ON public.task_evidence_files(task_id);

CREATE TRIGGER set_task_evidence_files_updated_at
  BEFORE UPDATE ON public.task_evidence_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.task_evidence_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence for their review case tasks"
  ON public.task_evidence_files FOR SELECT TO authenticated
  USING (
    is_deleted = false AND
    EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_evidence_files.task_id
        AND rt.is_deleted = false
        AND rc.is_deleted = false
        AND (
          rt.assigned_to = auth.uid() OR
          rc.system_owner_id = auth.uid() OR
          rc.system_admin_id = auth.uid() OR
          rc.qa_id = auth.uid() OR
          rc.business_owner_id = auth.uid() OR
          rc.it_manager_id = auth.uid() OR
          rc.initiated_by = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        )
    )
  );

CREATE POLICY "Users can upload evidence to their tasks"
  ON public.task_evidence_files FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_evidence_files.task_id
        AND rt.is_deleted = false
        AND (
          rt.assigned_to = auth.uid() OR
          rc.system_owner_id = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        )
    )
  );

CREATE POLICY "Super users can update evidence records"
  ON public.task_evidence_files FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_user'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-evidence',
  'review-evidence',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/tiff',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv', 'text/plain',
    'application/zip'
  ]
);

CREATE POLICY "Authenticated users can upload evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'review-evidence');

CREATE POLICY "Authenticated users can read evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'review-evidence');
