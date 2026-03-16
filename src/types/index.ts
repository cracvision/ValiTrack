// ValiTrack - Domain Types

export type SystemCategory = 'LIMS' | 'ERP' | 'DCS' | 'MES' | 'QMS' | 'DMS' | 'SCADA' | 'CDS' | 'ELN' | 'Other';
export type GxPClassification = 'GxP Critical' | 'GxP Non-Critical' | 'Non-GxP';
export type RiskLevel = 'High' | 'Medium' | 'Low';
export type SystemStatus = 'Active' | 'Retired' | 'Under Validation';

export type ReviewStatus = 'Draft' | 'Under Review' | 'Pending QA' | 'Completed';
export type FindingSeverity = 'Critical' | 'Major' | 'Minor' | 'Observation';
export type FindingStatus = 'Open' | 'In Progress' | 'Closed';
export type ActionItemStatus = 'Open' | 'In Progress' | 'Completed' | 'Verified';
export type EvidenceCategory = 'SOP' | 'Change Control' | 'Validation Report' | 'Audit Report' | 'Training Record' | 'Other';

export type AppRole = 'super_user' | 'system_owner' | 'system_administrator' | 'business_owner' | 'quality_assurance';

export interface SystemProfile {
  id: string;
  name: string;
  system_identifier: string;
  system_category: SystemCategory;
  description: string;
  intended_use: string;
  gxp_classification: GxPClassification;
  risk_level: RiskLevel;
  status: SystemStatus;
  vendor_name: string;
  vendor_contact: string;
  vendor_contract_ref: string;
  owner_id: string;
  owner_name: string;
  validation_date: string;
  review_period_months: number;
  next_review_date: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewCase {
  id: string;
  system_id: string;
  system_name: string;
  title: string;
  status: ReviewStatus;
  reviewer_id: string;
  reviewer_name: string;
  due_date: string;
  completion_date?: string;
  created_at: string;
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

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string;
  table_name: string;
  record_id: string;
  action: string;
  change_ts: string;
}
