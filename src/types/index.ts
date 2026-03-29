// ValiTrack - Domain Types

export type SystemEnvironment = 'manufacturing' | 'laboratory' | 'quality' | 'enterprise' | 'clinical' | 'infrastructure';
export type GampCategory = '1' | '3' | '4' | '5';
export type GxPClassification = 'GMP' | 'GLP' | 'GCP' | 'GDP' | 'GVP' | 'NON_GXP_CRITICAL' | 'NON_GXP_STANDARD';
export type RiskLevel = 'High' | 'Medium' | 'Low';
export type SystemStatus = 'Active' | 'Retired' | 'Under Validation';
export type ProfileApprovalStatus = 'draft' | 'in_review' | 'approved';

export type ReviewStatus = 'draft' | 'plan_review' | 'plan_approval' | 'approved_for_execution' | 'in_progress' | 'execution_review' | 'approved' | 'rejected' | 'cancelled';
export type ReviewLevel = '1' | '2' | '3';
export type ReviewConclusion = 'remains_validated' | 'requires_remediation' | 'requires_revalidation';
export type TaskGroup = 'INIT' | 'ITSM' | 'QMS' | 'SEC' | 'INFRA' | 'DOC' | 'AI_EVAL' | 'APPR';
export type TaskPhase = 'initiation' | 'evidence_gathering' | 'ai_evaluation' | 'approval';
export type ExecutionPhase = 1 | 2 | 3 | 4;

export const EXECUTION_PHASE_LABELS: Record<ExecutionPhase, string> = {
  1: 'tasks.phases.phase1Short',
  2: 'tasks.phases.phase2Short',
  3: 'tasks.phases.phase3Short',
  4: 'tasks.phases.phase4Short',
};

export const TASK_GROUP_TO_PHASE: Record<string, ExecutionPhase> = {
  'INIT': 1,
  'ITSM': 2,
  'QMS': 2,
  'SEC': 2,
  'INFRA': 2,
  'DOC': 2,
  'AI_EVAL': 3,
  'APPR': 4,
};
export type TaskExecutionType = 'manual' | 'ai_assisted' | 'auto_generated';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type WorkNoteType = 'work_note' | 'status_change' | 'evidence_upload' | 'reopen_reason' | 'reassignment';

export type FindingSeverity = 'Critical' | 'Major' | 'Minor' | 'Observation';
export type FindingStatus = 'Open' | 'In Progress' | 'Closed';
export type ActionItemStatus = 'Open' | 'In Progress' | 'Completed' | 'Verified';
export type EvidenceCategory = 'SOP' | 'Change Control' | 'Validation Report' | 'Audit Report' | 'Training Record' | 'Other';

export type AppRole = 'super_user' | 'system_owner' | 'system_administrator' | 'business_owner' | 'quality_assurance' | 'it_manager';

export interface SystemProfile {
  id: string;
  name: string;
  system_identifier: string;
  system_environment: SystemEnvironment;
  gamp_category: GampCategory;
  description: string;
  intended_use: string;
  gxp_classification: GxPClassification;
  risk_level: RiskLevel;
  status: SystemStatus;
  vendor_name: string;
  vendor_contact: string;
  vendor_contract_ref: string;
  owner_id: string;
  system_owner_id: string;
  system_admin_id: string;
  qa_id: string;
  business_owner_id?: string;
  it_manager_id?: string;
  initial_validation_date: string;
  last_review_period_end?: string | null;
  review_period_months: number;
  next_review_date: string;
  completion_window_days: number;
  approval_status: ProfileApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface ProfileSignoff {
  id: string;
  system_profile_id: string;
  requested_role: string;
  requested_user_id: string;
  status: 'pending' | 'approved' | 'objected';
  comments: string;
  completed_at: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string | null;
  is_deleted: boolean;
}

export interface ProfileTransition {
  id: string;
  system_profile_id: string;
  from_status: string;
  to_status: string;
  reason: string;
  transitioned_by: string;
  created_at: string;
}

export interface ReviewCase {
  id: string;
  system_id: string;
  title: string;
  review_period_start: string;
  review_period_end: string;
  review_level: ReviewLevel;
  due_date: string;
  status: ReviewStatus;
  period_end_date?: string;
  conclusion?: ReviewConclusion;
  conclusion_notes?: string;
  frozen_system_snapshot: Record<string, unknown>;
  initiated_by: string;
  system_owner_id: string;
  system_admin_id: string;
  qa_id: string;
  business_owner_id: string;
  it_manager_id?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by?: string;
  is_deleted: boolean;
  // Joined fields for display
  system_name?: string;
  system_identifier?: string;
}

export interface ReviewCaseTransition {
  id: string;
  review_case_id: string;
  from_status: string | null;
  to_status: string;
  reason?: string;
  transitioned_by: string;
  created_at: string;
  // Joined
  transitioned_by_name?: string;
}

export interface ReviewTask {
  id: string;
  review_case_id: string;
  template_id?: string;
  task_group: TaskGroup;
  title: string;
  title_es?: string | null;
  description: string;
  assigned_to: string;
  approved_by_user?: string;
  status: TaskStatus;
  phase: TaskPhase;
  execution_type: TaskExecutionType;
  due_date: string;
  started_at?: string;
  completed_at?: string;
  completion_notes?: string;
  sort_order: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  is_deleted: boolean;
  completed_by?: string;
  reopened_at?: string;
  reopened_by?: string;
  reopened_reason?: string;
  reassigned_at?: string;
  reassigned_by?: string;
  reassigned_from?: string;
  reassignment_reason?: string;
  execution_instructions?: string;
  execution_instructions_es?: string | null;
  execution_phase: number;
  instruction_step_count?: number;
  // Joined
  assigned_to_name?: string;
  approved_by_name?: string;
}

export interface TaskWorkNote {
  id: string;
  task_id: string;
  content: string;
  note_type: WorkNoteType;
  created_at: string;
  created_by: string;
  is_deleted: boolean;
}

export interface TaskEvidenceFile {
  id: string;
  task_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  sha256_hash: string;
  evidence_category: string;
  description: string;
  version: number;
  replaces_file_id: string | null;
  created_at: string;
  created_by: string;
  is_deleted: boolean;
}

export interface TaskTemplate {
  id: string;
  code: string;
  task_group: TaskGroup;
  title: string;
  title_es?: string | null;
  description: string;
  default_assignee_role: string;
  default_approver_role: string;
  phase: TaskPhase;
  execution_type: TaskExecutionType;
  review_level_min: number;
  sort_order: number;
  is_active: boolean;
  execution_instructions?: string;
  execution_instructions_es?: string | null;
  instruction_step_count?: number;
}

export interface TaskInstructionCheckoff {
  id: string;
  task_id: string;
  step_index: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  is_deleted: boolean;
  deleted_at?: string;
  deleted_by?: string;
}

export interface EvidenceItem {
  id: string;
  case_id: string;
  file_name: string;
  file_url: string;
  file_hash_sha256: string;
  category: EvidenceCategory;
  uploaded_by: string;
  uploaded_at: string;
}

export interface Finding {
  id: string;
  case_id: string;
  system_name: string;
  severity: FindingSeverity;
  description: string;
  status: FindingStatus;
  created_at: string;
}

export interface ActionItem {
  id: string;
  finding_id: string;
  description: string;
  assignee: string;
  status: ActionItemStatus;
  due_date: string;
  completed_date?: string;
}

export interface ReviewSignoff {
  id: string;
  review_case_id: string;
  phase: 'plan_review' | 'execution_review';
  requested_role: string;
  requested_user_id: string;
  status: 'pending' | 'approved' | 'objected';
  comments: string;
  completed_at: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface SignoffSummary {
  total_required: number;
  total_completed: number;
  has_objections: boolean;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string;
  table_name: string;
  record_id: string;
  action: string;
  change_ts: string;
}
