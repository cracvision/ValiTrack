import type { GxPClassification, RiskLevel, SystemEnvironment, GampCategory } from '@/types';

export interface GxPOption {
  value: GxPClassification;
  label: string;
  description: string;
}

export const GXP_OPTIONS: GxPOption[] = [
  { value: 'GMP', label: 'GMP — Good Manufacturing Practice', description: 'Manufacturing and production systems' },
  { value: 'GLP', label: 'GLP — Good Laboratory Practice', description: 'Laboratory and analytical systems' },
  { value: 'GCP', label: 'GCP — Good Clinical Practice', description: 'Clinical trial and research systems' },
  { value: 'GDP', label: 'GDP — Good Distribution Practice', description: 'Distribution and supply chain systems' },
  { value: 'GVP', label: 'GVP — Good Pharmacovigilance Practice', description: 'Safety and pharmacovigilance systems' },
  { value: 'NON_GXP_CRITICAL', label: 'Non-GxP (Business Critical)', description: 'Business-critical but not GxP regulated' },
  { value: 'NON_GXP_STANDARD', label: 'Non-GxP (Standard)', description: 'Standard business systems' },
];

export const GXP_SHORT_LABELS: Record<GxPClassification, string> = {
  GMP: 'GMP',
  GLP: 'GLP',
  GCP: 'GCP',
  GDP: 'GDP',
  GVP: 'GVP',
  NON_GXP_CRITICAL: 'Non-GxP Critical',
  NON_GXP_STANDARD: 'Non-GxP Standard',
};

const REVIEW_PERIOD_MATRIX: Record<string, number> = {
  'GMP_High': 12,
  'GMP_Medium': 24,
  'GMP_Low': 36,
  'GLP_High': 12,
  'GLP_Medium': 24,
  'GLP_Low': 36,
  'GCP_High': 12,
  'GCP_Medium': 24,
  'GCP_Low': 36,
  'GDP_High': 18,
  'GDP_Medium': 36,
  'GDP_Low': 36,
  'GVP_High': 12,
  'GVP_Medium': 24,
  'GVP_Low': 24,
  'NON_GXP_CRITICAL_High': 36,
  'NON_GXP_CRITICAL_Medium': 48,
  'NON_GXP_CRITICAL_Low': 48,
  'NON_GXP_STANDARD_High': 48,
  'NON_GXP_STANDARD_Medium': 60,
  'NON_GXP_STANDARD_Low': 60,
};

export function getReviewPeriod(classification: GxPClassification, risk: RiskLevel): number | null {
  const key = `${classification}_${risk}`;
  return REVIEW_PERIOD_MATRIX[key] ?? null;
}

// --- System Environment ---

export interface SystemEnvironmentOption {
  value: SystemEnvironment;
  label: string;
  description: string;
}

export const SYSTEM_ENVIRONMENT_OPTIONS: SystemEnvironmentOption[] = [
  { value: 'manufacturing', label: 'Manufacturing System', description: 'MES, DCS, SCADA, Historian, BMS — OT/manufacturing network' },
  { value: 'laboratory', label: 'Laboratory System', description: 'LIMS, CDS, ELN — laboratory instruments and data' },
  { value: 'quality', label: 'Quality System', description: 'QMS, DMS, LMS — quality and document management' },
  { value: 'enterprise', label: 'Enterprise/Business System', description: 'ERP, PLM, CRM — corporate IT network' },
  { value: 'clinical', label: 'Clinical System', description: 'CTMS, EDC, ePRO — clinical trials and research' },
  { value: 'infrastructure', label: 'Infrastructure System', description: 'AD, virtualization, backup, network — IT/OT infrastructure' },
];

export const ENVIRONMENT_SHORT_LABELS: Record<SystemEnvironment, string> = {
  manufacturing: 'Mfg',
  laboratory: 'Lab',
  quality: 'Quality',
  enterprise: 'Enterprise',
  clinical: 'Clinical',
  infrastructure: 'Infra',
};

// --- GAMP Category ---

export interface GampCategoryOption {
  value: GampCategory;
  label: string;
  description: string;
}

export const GAMP_CATEGORY_OPTIONS: GampCategoryOption[] = [
  { value: '1', label: 'Category 1 — Infrastructure Software', description: 'OS, databases, network tools. Low validation effort.' },
  { value: '3', label: 'Category 3 — Non-Configured (COTS)', description: 'Standard off-the-shelf software, used as-is. Medium validation effort.' },
  { value: '4', label: 'Category 4 — Configured Product', description: 'Configurable software (LIMS, ERP, MES). High validation effort.' },
  { value: '5', label: 'Category 5 — Custom/Bespoke', description: 'Custom-developed software. Very high validation effort.' },
];

export const GAMP_SHORT_LABELS: Record<GampCategory, string> = {
  '1': 'Cat 1',
  '3': 'Cat 3',
  '4': 'Cat 4',
  '5': 'Cat 5',
};

// --- Review Level suggestion based on Risk + GAMP ---

export function suggestReviewLevel(riskLevel: RiskLevel, gampCategory: GampCategory): string | null {
  if (!riskLevel || !gampCategory) return null;

  if (gampCategory === '5') {
    return riskLevel === 'Low' ? '2' : '3';
  }
  if (gampCategory === '4') {
    if (riskLevel === 'High') return '3';
    if (riskLevel === 'Medium') return '2';
    return '1';
  }
  // Cat 3 and Cat 1
  if (riskLevel === 'High') return '2';
  return '1';
}
