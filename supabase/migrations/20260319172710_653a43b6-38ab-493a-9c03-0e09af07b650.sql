
-- Table: review_signoffs
CREATE TABLE public.review_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_case_id UUID NOT NULL REFERENCES public.review_cases(id),
  phase TEXT NOT NULL CHECK (phase IN ('plan_review', 'execution_review')),
  requested_role TEXT NOT NULL,
  requested_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'objected')),
  comments TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(review_case_id, phase, requested_user_id)
);

-- Indexes
CREATE INDEX idx_review_signoffs_review_case ON public.review_signoffs(review_case_id, phase);
CREATE INDEX idx_review_signoffs_user ON public.review_signoffs(requested_user_id, status);

-- Updated_at trigger
CREATE TRIGGER set_review_signoffs_updated_at
  BEFORE UPDATE ON public.review_signoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.review_signoffs ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT
CREATE POLICY "Users can view signoffs for their assigned review cases"
  ON public.review_signoffs FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      requested_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.review_cases rc
        WHERE rc.id = review_signoffs.review_case_id
        AND rc.is_deleted = false
        AND (
          rc.system_owner_id = auth.uid() OR
          rc.system_admin_id = auth.uid() OR
          rc.qa_id = auth.uid() OR
          rc.business_owner_id = auth.uid() OR
          rc.it_manager_id = auth.uid() OR
          rc.initiated_by = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        )
      )
    )
  );

-- RLS: UPDATE (own signoffs only)
CREATE POLICY "Requested users can update their own signoffs"
  ON public.review_signoffs FOR UPDATE TO authenticated
  USING (is_deleted = false AND requested_user_id = auth.uid())
  WITH CHECK (is_deleted = false AND requested_user_id = auth.uid());

-- RLS: INSERT (SO or super_user)
CREATE POLICY "System can insert signoffs"
  ON public.review_signoffs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_role(auth.uid(), 'system_owner') OR
      public.has_role(auth.uid(), 'super_user')
    )
  );

-- RPC: get_signoff_summary
CREATE OR REPLACE FUNCTION public.get_signoff_summary(p_review_case_id UUID, p_phase TEXT)
RETURNS TABLE(total_required INTEGER, total_completed INTEGER, has_objections BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER as total_required,
    COUNT(*) FILTER (WHERE status IN ('approved', 'objected'))::INTEGER as total_completed,
    COALESCE(BOOL_OR(status = 'objected'), false) as has_objections
  FROM public.review_signoffs
  WHERE review_case_id = p_review_case_id
    AND phase = p_phase
    AND is_deleted = false;
$$;

-- Allow authenticated users to insert into audit_log (for signoff audit entries)
CREATE POLICY "Authenticated users can insert audit log entries"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
