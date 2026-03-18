
-- ======================================================
-- Iteration 3A: Review Cases Foundation — 4 tables
-- ======================================================

-- 1. review_cases
CREATE TABLE public.review_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES public.system_profiles(id),
  title TEXT NOT NULL,
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  review_level TEXT NOT NULL CHECK (review_level IN ('1', '2', '3')),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_preparation', 'in_progress', 'under_review', 'approved', 'rejected')),
  conclusion TEXT CHECK (conclusion IN ('remains_validated', 'requires_remediation', 'requires_revalidation')),
  conclusion_notes TEXT,
  frozen_system_snapshot JSONB NOT NULL,
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  system_owner_id UUID NOT NULL REFERENCES auth.users(id),
  system_admin_id UUID NOT NULL REFERENCES auth.users(id),
  qa_id UUID NOT NULL REFERENCES auth.users(id),
  business_owner_id UUID NOT NULL REFERENCES auth.users(id),
  it_manager_id UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  CONSTRAINT separation_of_duties CHECK (system_owner_id != qa_id)
);

CREATE TRIGGER update_review_cases_updated_at
  BEFORE UPDATE ON public.review_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_review_cases_system_id ON public.review_cases(system_id) WHERE is_deleted = false;
CREATE INDEX idx_review_cases_status ON public.review_cases(status) WHERE is_deleted = false;
CREATE INDEX idx_review_cases_due_date ON public.review_cases(due_date) WHERE is_deleted = false;

-- 2. review_case_transitions (APPEND-ONLY — NO updated_at, NO soft delete)
CREATE TABLE public.review_case_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_case_id UUID NOT NULL REFERENCES public.review_cases(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  transitioned_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transitions_case_id ON public.review_case_transitions(review_case_id);

-- 3. task_templates
CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  task_group TEXT NOT NULL CHECK (task_group IN ('INIT', 'ITSM', 'QMS', 'SEC', 'INFRA', 'DOC', 'AI_EVAL', 'APPR')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  default_assignee_role TEXT NOT NULL,
  default_approver_role TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('initiation', 'evidence_gathering', 'ai_evaluation', 'approval')),
  execution_type TEXT NOT NULL DEFAULT 'manual' CHECK (execution_type IN ('manual', 'ai_assisted', 'auto_generated')),
  review_level_min INTEGER NOT NULL DEFAULT 1 CHECK (review_level_min IN (1, 2, 3)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id)
);

CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. review_tasks
CREATE TABLE public.review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_case_id UUID NOT NULL REFERENCES public.review_cases(id),
  template_id UUID REFERENCES public.task_templates(id),
  task_group TEXT NOT NULL CHECK (task_group IN ('INIT', 'ITSM', 'QMS', 'SEC', 'INFRA', 'DOC', 'AI_EVAL', 'APPR')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  approved_by_user UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'skipped')),
  phase TEXT NOT NULL CHECK (phase IN ('initiation', 'evidence_gathering', 'ai_evaluation', 'approval')),
  execution_type TEXT NOT NULL DEFAULT 'manual' CHECK (execution_type IN ('manual', 'ai_assisted', 'auto_generated')),
  due_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id)
);

CREATE TRIGGER update_review_tasks_updated_at
  BEFORE UPDATE ON public.review_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_review_tasks_case_id ON public.review_tasks(review_case_id) WHERE is_deleted = false;
CREATE INDEX idx_review_tasks_assigned ON public.review_tasks(assigned_to) WHERE is_deleted = false;
CREATE INDEX idx_review_tasks_status ON public.review_tasks(status) WHERE is_deleted = false;

-- ======================================================
-- RLS Policies
-- ======================================================

-- review_cases RLS
ALTER TABLE public.review_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assigned review cases"
  ON public.review_cases FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      system_owner_id = auth.uid() OR
      system_admin_id = auth.uid() OR
      qa_id = auth.uid() OR
      business_owner_id = auth.uid() OR
      it_manager_id = auth.uid() OR
      initiated_by = auth.uid() OR
      public.has_role(auth.uid(), 'super_user')
    )
  );

CREATE POLICY "SO and SU can create review cases"
  ON public.review_cases FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_role(auth.uid(), 'system_owner') OR
      public.has_role(auth.uid(), 'super_user')
    )
  );

CREATE POLICY "Assigned users can update review cases"
  ON public.review_cases FOR UPDATE TO authenticated
  USING (
    is_deleted = false AND (
      system_owner_id = auth.uid() OR
      qa_id = auth.uid() OR
      public.has_role(auth.uid(), 'super_user')
    )
  );

-- review_case_transitions RLS
ALTER TABLE public.review_case_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transitions for their cases"
  ON public.review_case_transitions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.review_cases rc
      WHERE rc.id = review_case_id
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
  );

CREATE POLICY "Authenticated users can insert transitions"
  ON public.review_case_transitions FOR INSERT TO authenticated
  WITH CHECK (transitioned_by = auth.uid());

-- task_templates RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view active task templates"
  ON public.task_templates FOR SELECT TO authenticated
  USING (is_deleted = false AND is_active = true);

CREATE POLICY "Super users can manage task templates"
  ON public.task_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_user'))
  WITH CHECK (public.has_role(auth.uid(), 'super_user'));

-- review_tasks RLS
ALTER TABLE public.review_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks for their review cases"
  ON public.review_tasks FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      assigned_to = auth.uid() OR
      approved_by_user = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.review_cases rc
        WHERE rc.id = review_case_id
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

CREATE POLICY "Assigned users can update their tasks"
  ON public.review_tasks FOR UPDATE TO authenticated
  USING (
    is_deleted = false AND (
      assigned_to = auth.uid() OR
      public.has_role(auth.uid(), 'super_user')
    )
  );

CREATE POLICY "Authenticated users can create tasks"
  ON public.review_tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ======================================================
-- Seed 36 task templates
-- ======================================================
INSERT INTO public.task_templates (code, task_group, title, description, default_assignee_role, default_approver_role, phase, execution_type, review_level_min, sort_order, created_by)
SELECT v.code, v.task_group, v.title, v.description, v.default_assignee_role, v.default_approver_role, v.phase, v.execution_type, v.review_level_min, v.sort_order,
  (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'super_user' LIMIT 1)
FROM (VALUES
  -- INIT group
  ('INIT-001', 'INIT', 'Create ITSM service request for review', 'Open a service request in your ITSM system to document and track the periodic review exercise.', 'system_owner', 'quality_assurance', 'initiation', 'manual', 1, 10),
  ('INIT-002', 'INIT', 'Confirm system profile is current and accurate', 'Verify that the system name, description, intended use, interfaces, vendor info, hosting model, and role assignments in ValiTrack still reflect the actual system.', 'system_owner', 'system_administrator', 'initiation', 'manual', 1, 20),
  ('INIT-003', 'INIT', 'Verify review period and scope', 'Confirm the review period start/end dates, review level, and applicable evidence streams for this review cycle.', 'system_owner', 'quality_assurance', 'initiation', 'manual', 1, 30),
  ('INIT-004', 'INIT', 'Verify closure of previous review action items', 'Check that ALL corrective and preventive actions from the previous periodic review have been closed.', 'system_owner', 'quality_assurance', 'initiation', 'manual', 1, 40),
  -- ITSM group
  ('ITSM-001', 'ITSM', 'Generate incident report for review period', 'Extract all incident tickets related to this system from ITSM for the review period.', 'system_administrator', 'system_owner', 'evidence_gathering', 'manual', 1, 100),
  ('ITSM-002', 'ITSM', 'Generate problem report for review period', 'Extract all problem records related to this system from ITSM for the review period.', 'system_administrator', 'system_owner', 'evidence_gathering', 'manual', 1, 110),
  ('ITSM-003', 'ITSM', 'Generate change control report (ITSM)', 'Extract all change requests related to this system from ITSM for the review period.', 'system_administrator', 'system_owner', 'evidence_gathering', 'manual', 1, 120),
  ('ITSM-004', 'ITSM', 'Generate service request report for period', 'Extract all service requests related to this system from ITSM for the review period.', 'system_administrator', 'system_owner', 'evidence_gathering', 'manual', 1, 130),
  -- QMS group
  ('QMS-001', 'QMS', 'Generate change control report (QMS)', 'Extract all quality change controls related to this system from the QMS for the review period.', 'quality_assurance', 'system_owner', 'evidence_gathering', 'manual', 1, 200),
  ('QMS-002', 'QMS', 'Collect deviation and CAPA records', 'Gather all deviations and CAPA records related to this system from the QMS for the review period.', 'quality_assurance', 'system_owner', 'evidence_gathering', 'manual', 1, 210),
  ('QMS-003', 'QMS', 'Collect audit findings related to system', 'Gather any internal or external audit findings that reference this system during the review period.', 'quality_assurance', 'system_owner', 'evidence_gathering', 'manual', 2, 220),
  -- SEC group
  ('SEC-001', 'SEC', 'Extract current user access list', 'Export the current user access list directly from the system showing ALL active accounts, their roles, last login date, and creation date.', 'system_administrator', 'it_manager', 'evidence_gathering', 'manual', 1, 300),
  ('SEC-002', 'SEC', 'Cross-check terminated employees vs active access', 'Compare the HR termination/transfer list for the review period against the system user access list.', 'system_administrator', 'it_manager', 'evidence_gathering', 'manual', 1, 310),
  ('SEC-003', 'SEC', 'Document privileged account justification', 'List ALL admin/privileged/elevated accounts in the system. For each account, provide documented business justification.', 'it_manager', 'quality_assurance', 'evidence_gathering', 'manual', 2, 320),
  ('SEC-004', 'SEC', 'Verify security patches and antivirus status', 'Confirm that the system OS, application, database, and infrastructure components are current on security patches.', 'it_manager', 'system_administrator', 'evidence_gathering', 'manual', 2, 330),
  ('SEC-005', 'SEC', 'Review segregation of duties enforcement', 'Verify that role assignments in the system enforce proper segregation of duties as required by GxP.', 'system_administrator', 'quality_assurance', 'evidence_gathering', 'manual', 3, 340),
  -- INFRA group
  ('INFRA-001', 'INFRA', 'Collect backup execution logs for period', 'Gather backup job execution logs for the entire review period.', 'system_administrator', 'it_manager', 'evidence_gathering', 'manual', 1, 400),
  ('INFRA-002', 'INFRA', 'Provide restore test results', 'Provide evidence of restore testing performed during the review period.', 'system_administrator', 'it_manager', 'evidence_gathering', 'manual', 1, 410),
  ('INFRA-003', 'INFRA', 'Confirm DR/BCP plan is current and tested', 'Verify that the disaster recovery and business continuity plans for this system are current and tested.', 'it_manager', 'quality_assurance', 'evidence_gathering', 'manual', 2, 420),
  ('INFRA-004', 'INFRA', 'Extract audit trail sample for review', 'Export a representative sample of audit trail entries from the system covering the review period.', 'system_administrator', 'quality_assurance', 'evidence_gathering', 'manual', 1, 430),
  ('INFRA-005', 'INFRA', 'Verify NTP time synchronization', 'Confirm that the system clock is synchronized via NTP to an authoritative time source.', 'system_administrator', 'it_manager', 'evidence_gathering', 'manual', 3, 440),
  -- DOC group
  ('DOC-001', 'DOC', 'Upload system specifications and interface documents', 'Upload current system specifications, architecture diagrams, and interface/data flow documentation to the evidence vault.', 'system_owner', 'quality_assurance', 'evidence_gathering', 'manual', 1, 500),
  ('DOC-002', 'DOC', 'Verify SOPs are current and approved', 'Confirm that ALL operational SOPs for this system are current, approved, and accessible in the controlled DMS.', 'system_owner', 'quality_assurance', 'evidence_gathering', 'manual', 1, 510),
  ('DOC-003', 'DOC', 'Collect training records for current users', 'Gather training records for ALL current system users. Verify training was completed before system access.', 'system_owner', 'quality_assurance', 'evidence_gathering', 'manual', 1, 520),
  ('DOC-004', 'DOC', 'Confirm vendor support status and SLA compliance', 'Verify vendor contract is active, support coverage meets requirements, SLA is being measured and met.', 'system_owner', 'it_manager', 'evidence_gathering', 'manual', 1, 530),
  ('DOC-005', 'DOC', 'Verify validation documentation in DMS', 'Confirm that all validation documentation is stored in the controlled DMS and is retrievable.', 'quality_assurance', 'system_owner', 'evidence_gathering', 'manual', 2, 540),
  ('DOC-006', 'DOC', 'Document current software version and configuration', 'Record the current software version, patch level, and key configuration parameters.', 'system_administrator', 'system_owner', 'evidence_gathering', 'manual', 1, 550),
  -- AI_EVAL group
  ('AI-EVAL-001', 'AI_EVAL', 'Analyze incident and problem trends', 'AI analysis of all incident and problem data for the review period.', 'system_owner', 'system_owner', 'ai_evaluation', 'ai_assisted', 1, 600),
  ('AI-EVAL-002', 'AI_EVAL', 'Analyze change control cumulative impact', 'AI assessment of all changes during the review period.', 'system_owner', 'system_owner', 'ai_evaluation', 'ai_assisted', 1, 610),
  ('AI-EVAL-003', 'AI_EVAL', 'Evaluate user access compliance', 'AI review of user access list against HR records, role definitions, and SoD requirements.', 'system_owner', 'quality_assurance', 'ai_evaluation', 'ai_assisted', 1, 620),
  ('AI-EVAL-004', 'AI_EVAL', 'Assess audit trail integrity', 'AI sample-based review of audit trail entries for completeness and immutability.', 'system_owner', 'quality_assurance', 'ai_evaluation', 'ai_assisted', 1, 630),
  ('AI-EVAL-005', 'AI_EVAL', 'Evaluate backup and restore compliance', 'AI assessment of backup logs, restore test results, and DR/BCP documentation.', 'system_owner', 'it_manager', 'ai_evaluation', 'ai_assisted', 1, 640),
  ('AI-EVAL-006', 'AI_EVAL', 'Assess data integrity (ALCOA+ check)', 'AI evaluation of data integrity controls against ALCOA+ principles.', 'system_owner', 'quality_assurance', 'ai_evaluation', 'ai_assisted', 2, 650),
  ('AI-EVAL-007', 'AI_EVAL', 'Review training gap analysis', 'AI analysis of training records to identify gaps and expired certifications.', 'system_owner', 'business_owner', 'ai_evaluation', 'ai_assisted', 1, 660),
  ('AI-EVAL-008', 'AI_EVAL', 'Assess system performance and reliability', 'AI evaluation of performance metrics, uptime data, and system logs.', 'system_owner', 'system_administrator', 'ai_evaluation', 'ai_assisted', 2, 670),
  ('AI-EVAL-009', 'AI_EVAL', 'Evaluate vendor and supplier risk', 'AI assessment of vendor status, SLA compliance, and supply chain risk.', 'system_owner', 'it_manager', 'ai_evaluation', 'ai_assisted', 2, 680),
  ('AI-EVAL-010', 'AI_EVAL', 'Assess regulatory compliance impact', 'AI review of new or changed regulations since last periodic review.', 'system_owner', 'quality_assurance', 'ai_evaluation', 'ai_assisted', 2, 690),
  ('AI-EVAL-011', 'AI_EVAL', 'Verify previous review action closure', 'AI verification that all corrective actions from the previous periodic review have been closed.', 'system_owner', 'quality_assurance', 'ai_evaluation', 'ai_assisted', 1, 695),
  ('AI-EVAL-012', 'AI_EVAL', 'Perform risk reassessment and generate draft report', 'AI generates an updated risk assessment and complete draft periodic review report.', 'system_owner', 'system_owner', 'ai_evaluation', 'ai_assisted', 1, 700),
  -- APPR group
  ('APPR-001', 'APPR', 'System owner review and approval', 'System Owner reviews the complete periodic review package and approves or rejects.', 'system_owner', 'system_owner', 'approval', 'manual', 1, 800),
  ('APPR-002', 'APPR', 'Business process fitness assessment', 'Business Owner assesses whether the system continues to meet business process requirements.', 'business_owner', 'system_owner', 'approval', 'manual', 2, 810),
  ('APPR-003', 'APPR', 'IT infrastructure review and approval', 'IT Manager reviews infrastructure assessment, backup/DR status, security findings, and NTP compliance.', 'it_manager', 'system_owner', 'approval', 'manual', 2, 820),
  ('APPR-004', 'APPR', 'QA final approval', 'Quality Assurance performs independent review of the entire periodic review package. This is the FINAL approval.', 'quality_assurance', 'quality_assurance', 'approval', 'manual', 1, 900)
) AS v(code, task_group, title, description, default_assignee_role, default_approver_role, phase, execution_type, review_level_min, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates tt WHERE tt.code = v.code);
