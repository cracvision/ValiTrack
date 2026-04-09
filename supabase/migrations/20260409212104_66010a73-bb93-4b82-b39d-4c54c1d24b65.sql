-- ============================================================
-- FINDINGS TABLE
-- ============================================================
CREATE TABLE public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  review_case_id UUID NOT NULL REFERENCES review_cases(id),
  task_id UUID REFERENCES review_tasks(id),
  evidence_file_id UUID REFERENCES task_evidence_files(id),
  ai_task_result_id UUID REFERENCES ai_task_results(id),

  -- Finding details
  title TEXT NOT NULL,
  title_es TEXT,
  description TEXT NOT NULL,
  description_es TEXT,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual',
  ai_finding_index INTEGER,

  -- Regulatory reference
  regulation_reference TEXT,
  sop_reference TEXT,

  -- Risk assessment (ICH Q9)
  risk_probability TEXT,
  risk_impact TEXT,
  risk_level TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'ai_identified',

  -- Human review
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  dismissal_justification TEXT,
  dismissed_by UUID,
  dismissed_at TIMESTAMPTZ,

  -- Resolution / Actions
  action_description TEXT,
  action_description_es TEXT,
  action_responsible UUID,
  action_due_date DATE,
  resolution_notes TEXT,
  resolution_notes_es TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,

  -- CAPA reference (external system)
  capa_required BOOLEAN DEFAULT false,
  capa_reference TEXT,
  capa_system TEXT,
  capa_status TEXT,

  -- Audit trail
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- ============================================================
-- VALIDATION TRIGGER (instead of CHECK constraints)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_finding()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.severity NOT IN ('critical', 'major', 'minor', 'observation') THEN
    RAISE EXCEPTION 'Invalid severity: %. Must be critical, major, minor, or observation.', NEW.severity;
  END IF;

  IF NEW.category NOT IN (
    'incident_trend', 'change_control', 'access_control', 'audit_trail',
    'backup_restore', 'data_integrity', 'training', 'performance',
    'vendor', 'regulatory', 'documentation', 'configuration', 'other'
  ) THEN
    RAISE EXCEPTION 'Invalid category: %.', NEW.category;
  END IF;

  IF NEW.source NOT IN ('ai_identified', 'manual') THEN
    RAISE EXCEPTION 'Invalid source: %. Must be ai_identified or manual.', NEW.source;
  END IF;

  IF NEW.status NOT IN ('ai_identified', 'confirmed', 'dismissed', 'in_progress', 'closed') THEN
    RAISE EXCEPTION 'Invalid status: %.', NEW.status;
  END IF;

  IF NEW.risk_probability IS NOT NULL AND NEW.risk_probability NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid risk_probability: %.', NEW.risk_probability;
  END IF;

  IF NEW.risk_impact IS NOT NULL AND NEW.risk_impact NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid risk_impact: %.', NEW.risk_impact;
  END IF;

  IF NEW.risk_level IS NOT NULL AND NEW.risk_level NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid risk_level: %.', NEW.risk_level;
  END IF;

  IF NEW.capa_status IS NOT NULL AND NEW.capa_status NOT IN ('not_required', 'pending', 'open', 'closed', 'verified') THEN
    RAISE EXCEPTION 'Invalid capa_status: %.', NEW.capa_status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_finding_trigger
  BEFORE INSERT OR UPDATE ON public.findings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_finding();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE TRIGGER update_findings_updated_at
  BEFORE UPDATE ON public.findings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_findings_review_case ON findings(review_case_id) WHERE is_deleted = false;
CREATE INDEX idx_findings_task ON findings(task_id) WHERE is_deleted = false;
CREATE INDEX idx_findings_severity ON findings(severity) WHERE is_deleted = false;
CREATE INDEX idx_findings_status ON findings(status) WHERE is_deleted = false;
CREATE INDEX idx_findings_ai_result ON findings(ai_task_result_id) WHERE is_deleted = false;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

-- SELECT: Review case participants
CREATE POLICY findings_select ON findings FOR SELECT TO authenticated
USING (
  is_deleted = false AND (
    public.has_role(auth.uid(), 'super_user'::app_role)
    OR EXISTS (
      SELECT 1 FROM review_cases rc
      WHERE rc.id = findings.review_case_id
        AND rc.is_deleted = false
        AND (
          rc.initiated_by = auth.uid()
          OR rc.system_owner_id = auth.uid()
          OR rc.system_admin_id = auth.uid()
          OR rc.qa_id = auth.uid()
          OR rc.business_owner_id = auth.uid()
          OR rc.it_manager_id = auth.uid()
          OR public.user_has_assigned_tasks(auth.uid(), rc.id)
        )
    )
  )
);

-- INSERT: SO, QA, Super User
CREATE POLICY findings_insert ON findings FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    public.has_role(auth.uid(), 'super_user'::app_role)
    OR EXISTS (
      SELECT 1 FROM review_cases rc
      WHERE rc.id = findings.review_case_id
        AND rc.is_deleted = false
        AND (
          rc.system_owner_id = auth.uid()
          OR rc.qa_id = auth.uid()
        )
    )
  )
);

-- UPDATE: SO, QA, Super User — only when review case is not approved
CREATE POLICY findings_update ON findings FOR UPDATE TO authenticated
USING (
  is_deleted = false AND (
    public.has_role(auth.uid(), 'super_user'::app_role)
    OR EXISTS (
      SELECT 1 FROM review_cases rc
      WHERE rc.id = findings.review_case_id
        AND rc.is_deleted = false
        AND rc.status != 'approved'
        AND (
          rc.system_owner_id = auth.uid()
          OR rc.qa_id = auth.uid()
        )
    )
  )
);