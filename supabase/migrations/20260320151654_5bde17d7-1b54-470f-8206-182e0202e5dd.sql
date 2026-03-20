
-- Add approval_status column to system_profiles
ALTER TABLE public.system_profiles
  ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (approval_status IN ('draft', 'in_review', 'approved'));

-- Migrate existing profiles to 'approved' (they were already used for Review Cases)
UPDATE public.system_profiles
  SET approval_status = 'approved'
  WHERE is_deleted = false;

-- Create profile_signoffs table
CREATE TABLE public.profile_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_profile_id UUID NOT NULL REFERENCES public.system_profiles(id),
  requested_role TEXT NOT NULL,
  requested_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'objected')),
  comments TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE(system_profile_id, requested_user_id)
);

CREATE INDEX idx_profile_signoffs_profile ON public.profile_signoffs(system_profile_id);
CREATE INDEX idx_profile_signoffs_user ON public.profile_signoffs(requested_user_id, status);

CREATE TRIGGER set_profile_signoffs_updated_at
  BEFORE UPDATE ON public.profile_signoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profile_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signoffs for profiles they are involved with"
  ON public.profile_signoffs FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      requested_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.system_profiles sp
        WHERE sp.id = profile_signoffs.system_profile_id
        AND sp.is_deleted = false
        AND (
          sp.created_by = auth.uid() OR
          sp.system_owner_id = (auth.uid())::text OR
          sp.system_admin_id = (auth.uid())::text OR
          sp.qa_id = (auth.uid())::text OR
          sp.business_owner_id = (auth.uid())::text OR
          sp.it_manager_id = (auth.uid())::text OR
          public.has_role(auth.uid(), 'super_user')
        )
      )
    )
  );

CREATE POLICY "Requested users can update their own signoffs"
  ON public.profile_signoffs FOR UPDATE TO authenticated
  USING (is_deleted = false AND requested_user_id = auth.uid())
  WITH CHECK (is_deleted = false AND requested_user_id = auth.uid());

CREATE POLICY "SO and super_user can insert signoffs"
  ON public.profile_signoffs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_role(auth.uid(), 'system_owner') OR
      public.has_role(auth.uid(), 'super_user')
    )
  );

-- Create profile_transitions table
CREATE TABLE public.profile_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_profile_id UUID NOT NULL REFERENCES public.system_profiles(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT DEFAULT '',
  transitioned_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE INDEX idx_profile_transitions_profile ON public.profile_transitions(system_profile_id);

CREATE TRIGGER set_profile_transitions_updated_at
  BEFORE UPDATE ON public.profile_transitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profile_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transitions for profiles they can see"
  ON public.profile_transitions FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      EXISTS (
        SELECT 1 FROM public.system_profiles sp
        WHERE sp.id = profile_transitions.system_profile_id
        AND sp.is_deleted = false
        AND (
          sp.created_by = auth.uid() OR
          sp.system_owner_id = (auth.uid())::text OR
          sp.system_admin_id = (auth.uid())::text OR
          sp.qa_id = (auth.uid())::text OR
          sp.business_owner_id = (auth.uid())::text OR
          sp.it_manager_id = (auth.uid())::text OR
          public.has_role(auth.uid(), 'super_user')
        )
      )
    )
  );

CREATE POLICY "Authenticated users can insert transitions"
  ON public.profile_transitions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- SECURITY DEFINER justification: provides controlled read-only summary
-- of sign-off progress without exposing individual sign-off details.
-- Follows the same pattern as get_signoff_summary for review_signoffs.
CREATE OR REPLACE FUNCTION public.get_profile_signoff_summary(p_system_profile_id UUID)
RETURNS TABLE(total_required INTEGER, total_completed INTEGER, has_objections BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER AS total_required,
    COUNT(*) FILTER (WHERE status IN ('approved', 'objected'))::INTEGER AS total_completed,
    COALESCE(BOOL_OR(status = 'objected'), false) AS has_objections
  FROM public.profile_signoffs
  WHERE system_profile_id = p_system_profile_id
    AND is_deleted = false;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_signoff_summary(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profile_signoff_summary(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profile_signoff_summary(UUID) TO authenticated;
