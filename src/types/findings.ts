// ValiTrack — Findings & CAPA Types

export type FindingSeverity = 'critical' | 'major' | 'minor' | 'observation';
export type FindingStatus = 'ai_identified' | 'confirmed' | 'dismissed' | 'in_progress' | 'closed';
export type FindingSource = 'ai_identified' | 'manual';
export type FindingCategory =
  | 'incident_trend' | 'change_control' | 'access_control' | 'audit_trail'
  | 'backup_restore' | 'data_integrity' | 'training' | 'performance'
  | 'vendor' | 'regulatory' | 'documentation' | 'configuration' | 'other';
export type RiskRating = 'high' | 'medium' | 'low';
export type CapaStatus = 'not_required' | 'pending' | 'open' | 'closed' | 'verified';

export interface Finding {
  id: string;
  review_case_id: string;
  task_id: string | null;
  evidence_file_id: string | null;
  ai_task_result_id: string | null;

  title: string;
  title_es: string | null;
  description: string;
  description_es: string | null;
  severity: FindingSeverity;
  category: FindingCategory;

  source: FindingSource;
  ai_finding_index: number | null;
  ai_severity_raw: string | null;

  regulation_reference: string | null;
  sop_reference: string | null;

  risk_probability: RiskRating | null;
  risk_impact: RiskRating | null;
  risk_level: RiskRating | null;

  status: FindingStatus;

  confirmed_by: string | null;
  confirmed_at: string | null;
  dismissal_justification: string | null;
  dismissed_by: string | null;
  dismissed_at: string | null;

  action_description: string | null;
  action_description_es: string | null;
  action_responsible: string | null;
  action_due_date: string | null;
  resolution_notes: string | null;
  resolution_notes_es: string | null;
  resolved_by: string | null;
  resolved_at: string | null;

  capa_required: boolean;
  capa_reference: string | null;
  capa_system: string | null;
  capa_status: CapaStatus | null;

  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;

  // Joined fields
  confirmed_by_name?: string;
  dismissed_by_name?: string;
  resolved_by_name?: string;
  action_responsible_name?: string;
  task_title?: string;
}

export const FINDING_SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  observation: 3,
};

export const FINDING_CATEGORIES: FindingCategory[] = [
  'incident_trend', 'change_control', 'access_control', 'audit_trail',
  'backup_restore', 'data_integrity', 'training', 'performance',
  'vendor', 'regulatory', 'documentation', 'configuration', 'other',
];

export function calculateRiskLevel(probability: RiskRating | null, impact: RiskRating | null): RiskRating | null {
  if (!probability || !impact) return null;
  const matrix: Record<string, RiskRating> = {
    'high-high': 'high', 'high-medium': 'high', 'high-low': 'medium',
    'medium-high': 'high', 'medium-medium': 'medium', 'medium-low': 'low',
    'low-high': 'medium', 'low-medium': 'low', 'low-low': 'low',
  };
  return matrix[`${probability}-${impact}`] || null;
}
