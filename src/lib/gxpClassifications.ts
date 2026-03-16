import type { GxPClassification, RiskLevel } from '@/types';

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
