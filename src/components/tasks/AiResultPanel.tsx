// build v2 — standardized schema support with backward compatibility
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, FileText, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { AiTaskResult } from '@/hooks/useAiTaskResult';

const VERDICT_STYLES: Record<string, string> = {
  ACCEPTABLE: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
  ACCEPTABLE_WITH_CONDITIONS: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
  REQUIRES_ACTION: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  MAJOR: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  MINOR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  OBSERVATION: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  IMMEDIATE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  SHORT_TERM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  LONG_TERM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  LOW: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const TREND_STYLES: Record<string, string> = {
  IMPROVING: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  STABLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  DEGRADING: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  INSUFFICIENT_DATA: 'bg-muted text-muted-foreground',
};

const ASSESSMENT_STYLES: Record<string, string> = {
  VALIDATED_CONFIRMED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  REQUIRES_INVESTIGATION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  REQUIRES_REVALIDATION: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const RISK_STYLES: Record<string, string> = {
  UNCHANGED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  INCREASED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  DECREASED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  INSUFFICIENT_DATA: 'bg-muted text-muted-foreground',
};

const METRIC_STATUS_STYLES: Record<string, string> = {
  MET: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  NOT_MET: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  N_A: 'bg-muted text-muted-foreground',
};

const GXP_CONCERN_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  LOW: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
};

interface AiResultPanelProps {
  result: AiTaskResult;
}

export function AiResultPanel({ result }: AiResultPanelProps) {
  const { t } = useTranslation();

  const rawAnalysis = typeof result.analysis_result === 'string'
    ? JSON.parse(result.analysis_result)
    : result.analysis_result ?? null;

  if (!rawAnalysis) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          AI analysis result not found. Please contact the System Administrator.
        </AlertDescription>
      </Alert>
    );
  }

  // --- Normalize with backward compatibility ---
  const verdict = rawAnalysis.conclusions?.overall_verdict
    ?? rawAnalysis.phase5_conclusions?.overall_verdict
    ?? null;

  const overallVerdictStatus = verdict?.status ?? rawAnalysis.overall_verdict ?? null;
  const summary = verdict?.summary ?? rawAnalysis.summary ?? null;

  const smeReviewNotes = rawAnalysis.conclusions?.sme_review_notes
    ?? rawAnalysis.phase5_conclusions?.smr_review_notes
    ?? rawAnalysis.sme_review_notes
    ?? null;

  const recommendations: any[] = rawAnalysis.conclusions?.recommendations
    ?? rawAnalysis.phase5_conclusions?.recommendations
    ?? rawAnalysis.recommendations
    ?? [];

  const findings: any[] = rawAnalysis.detailed_findings
    ?? rawAnalysis.phase4_validated_state?.critical_findings
    ?? rawAnalysis.critical_findings
    ?? [];

  const dataQuality = rawAnalysis.data_quality ?? null;
  const analysisSummary = rawAnalysis.analysis_summary ?? null;
  const trendAnalysis = rawAnalysis.trend_analysis ?? null;
  const validatedState = rawAnalysis.validated_state_impact ?? null;

  // Legacy metrics fallback
  const legacyMetrics = rawAnalysis.phase2_metrics ? {
    total_incidents: rawAnalysis.phase2_metrics.total_incidents,
    p1_critical: rawAnalysis.phase2_metrics.by_priority?.p1_critical,
    p2_high: rawAnalysis.phase2_metrics.by_priority?.p2_high,
    p3_medium: rawAnalysis.phase2_metrics.by_priority?.p3_medium,
    p4_low: rawAnalysis.phase2_metrics.by_priority?.p4_low,
    sla_compliance_pct: rawAnalysis.phase2_metrics.sla_compliance?.compliance_rate_percent,
  } : rawAnalysis.metrics ?? null;

  const evidenceFiles: Array<Record<string, any>> =
    typeof result.evidence_files_used === 'string'
      ? JSON.parse(result.evidence_files_used)
      : result.evidence_files_used ?? [];

  const verdictKey = overallVerdictStatus === 'ACCEPTABLE'
    ? 'verdictAcceptable'
    : overallVerdictStatus === 'ACCEPTABLE_WITH_CONDITIONS'
      ? 'verdictConditions'
      : 'verdictAction';

  return (
    <div className="space-y-4 my-4">
      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground">{t('tasks.aiResultTitle')}</h3>

      {/* Disclaimer */}
      <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
        <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
          {t('tasks.aiDisclaimer')}
        </AlertDescription>
      </Alert>

      {/* Metadata */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground font-mono bg-muted/50 rounded-md px-3 py-2">
        <span>{result.model_name}</span>
        <span>{result.model_digest?.substring(0, 8)}</span>
        <span>{result.prompt_template_id}</span>
        {result.processing_duration_sec && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {result.processing_duration_sec}s
          </span>
        )}
        {result.processing_completed_at && (
          <span>{new Date(result.processing_completed_at).toLocaleString()}</span>
        )}
      </div>

      {/* Overall Verdict */}
      {overallVerdictStatus && (
        <div className="rounded-md border p-3 space-y-2">
          <Badge className={`text-xs font-bold ${VERDICT_STYLES[overallVerdictStatus] || ''}`}>
            {t(`tasks.${verdictKey}`)}
          </Badge>
          {summary && <p className="text-sm text-foreground">{summary}</p>}
        </div>
      )}

      {/* Data Quality */}
      {dataQuality && (
        <div className="rounded-md border p-2.5 space-y-1.5">
          <h4 className="text-xs font-semibold text-foreground mb-1">{t('tasks.aiDataQuality', 'Data Quality')}</h4>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {dataQuality.source_document && (
              <span>Source: <span className="font-mono text-foreground">{dataQuality.source_document}</span></span>
            )}
            {dataQuality.total_records_found != null && (
              <span>Records: <span className="font-semibold text-foreground">{dataQuality.total_records_found}</span></span>
            )}
            {dataQuality.records_with_complete_data != null && (
              <span>Complete: <span className="font-semibold text-foreground">{dataQuality.records_with_complete_data}</span></span>
            )}
          </div>
          {dataQuality.confidence_level && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{t('tasks.aiConfidenceLevel')}:</span>
              <Badge className={`text-[9px] ${CONFIDENCE_STYLES[dataQuality.confidence_level] || ''}`}>
                {dataQuality.confidence_level}
              </Badge>
            </div>
          )}
          {dataQuality.confidence_rationale && (
            <p className="text-xs text-muted-foreground mt-1">{dataQuality.confidence_rationale}</p>
          )}
          {dataQuality.data_gaps_identified?.length > 0 && (
            <div className="mt-1">
              <span className="text-[10px] text-muted-foreground">Data gaps:</span>
              <ul className="list-disc list-inside text-[10px] text-muted-foreground ml-1">
                {dataQuality.data_gaps_identified.map((gap: string, i: number) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Analysis Summary (new) OR Legacy Incident Metrics */}
      {analysisSummary ? (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiAnalysisSummary')}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {[
              { label: t('tasks.aiTotalItemsReviewed'), value: analysisSummary.total_items_reviewed },
              { label: t('tasks.aiCompliant'), value: analysisSummary.compliant_count },
              { label: t('tasks.aiNonCompliant'), value: analysisSummary.non_compliant_count },
              { label: t('tasks.aiNotAssessed'), value: analysisSummary.not_assessed_count },
              { label: t('tasks.aiComplianceRate'), value: analysisSummary.compliance_rate_percent != null ? `${analysisSummary.compliance_rate_percent}%` : '—' },
            ].filter(m => m.value != null).map((m) => (
              <div key={m.label} className="text-center rounded-md bg-muted/50 px-2 py-1.5">
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                <div className="text-sm font-semibold text-foreground">{m.value}</div>
              </div>
            ))}
          </div>

          {/* Key Metrics table */}
          {analysisSummary.key_metrics?.length > 0 && (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">{t('tasks.aiMetricName')}</th>
                    <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">{t('tasks.aiMetricValue')}</th>
                    <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">{t('tasks.aiMetricTarget')}</th>
                    <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">{t('tasks.aiMetricStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisSummary.key_metrics.map((km: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5 text-foreground">{km.metric_name}</td>
                      <td className="px-2 py-1.5 font-mono text-foreground">{km.value}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{km.target || '—'}</td>
                      <td className="px-2 py-1.5">
                        <Badge className={`text-[9px] ${METRIC_STATUS_STYLES[km.status] || ''}`}>
                          {km.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : legacyMetrics ? (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiMetrics')}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Total', value: legacyMetrics.total_incidents },
              { label: 'P1', value: legacyMetrics.p1_critical },
              { label: 'P2', value: legacyMetrics.p2_high },
              { label: 'P3', value: legacyMetrics.p3_medium },
              { label: 'P4', value: legacyMetrics.p4_low },
              { label: 'SLA %', value: legacyMetrics.sla_compliance_pct != null ? `${legacyMetrics.sla_compliance_pct}%` : '—' },
            ].filter((m) => m.value != null).map((m) => (
              <div key={m.label} className="text-center rounded-md bg-muted/50 px-2 py-1.5">
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                <div className="text-sm font-semibold text-foreground">{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Trend Analysis (NEW) */}
      <div>
        <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiTrendAnalysis')}</h4>
        {trendAnalysis ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('tasks.aiOverallTrend')}:</span>
              <Badge className={`text-[9px] ${TREND_STYLES[trendAnalysis.overall_trend] || ''}`}>
                {String(t(`tasks.trend${trendAnalysis.overall_trend?.charAt(0)}${trendAnalysis.overall_trend?.slice(1).toLowerCase()}`, trendAnalysis.overall_trend))}
              </Badge>
            </div>
            {trendAnalysis.trend_rationale && (
              <p className="text-xs text-muted-foreground">{trendAnalysis.trend_rationale}</p>
            )}
            {trendAnalysis.patterns_identified?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-muted-foreground">{t('tasks.aiPatterns')}:</span>
                {trendAnalysis.patterns_identified.map((p: any, i: number) => (
                  <div key={i} className="rounded-md border p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{p.pattern}</span>
                      {p.frequency != null && (
                        <span className="text-[10px] text-muted-foreground">×{p.frequency}</span>
                      )}
                      {p.gxp_concern_level && (
                        <Badge className={`text-[9px] ${GXP_CONCERN_STYLES[p.gxp_concern_level] || ''}`}>
                          {p.gxp_concern_level}
                        </Badge>
                      )}
                    </div>
                    {p.description && <p className="text-[10px] text-muted-foreground">{p.description}</p>}
                  </div>
                ))}
              </div>
            )}
            {trendAnalysis.comparison_with_previous && (
              <div className="mt-1">
                <span className="text-[10px] text-muted-foreground">{t('tasks.aiComparisonPrevious')}: </span>
                <span className="text-xs text-foreground">{trendAnalysis.comparison_with_previous}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t('tasks.aiSectionNotIncluded')}</p>
        )}
      </div>

      {/* Validated State Impact (NEW) */}
      <div>
        <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiValidatedStateAssessment')}</h4>
        {validatedState ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={`text-[9px] ${ASSESSMENT_STYLES[validatedState.assessment] || ''}`}>
                {t(`tasks.assess${validatedState.assessment?.split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join('')}`, validatedState.assessment)}
              </Badge>
            </div>
            {validatedState.assessment_rationale && (
              <p className="text-xs text-muted-foreground">{validatedState.assessment_rationale}</p>
            )}
            {validatedState.risk_profile_change && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{t('tasks.aiRiskProfileChange')}:</span>
                <Badge className={`text-[9px] ${RISK_STYLES[validatedState.risk_profile_change] || ''}`}>
                  {t(`tasks.risk${validatedState.risk_profile_change?.charAt(0)}${validatedState.risk_profile_change?.slice(1).toLowerCase()}`, validatedState.risk_profile_change)}
                </Badge>
              </div>
            )}
            {validatedState.risk_rationale && (
              <p className="text-xs text-muted-foreground">{validatedState.risk_rationale}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t('tasks.aiSectionNotIncluded')}</p>
        )}
      </div>

      {/* Findings */}
      {findings.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiFindings')}</h4>
          <div className="space-y-2">
            {findings.map((f: any, i: number) => (
              <div key={f.finding_id ?? i} className="rounded-md border p-2.5 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {f.finding_id && (
                    <span className="text-[10px] font-mono text-muted-foreground">{f.finding_id}</span>
                  )}
                  <Badge className={`text-[9px] ${SEVERITY_STYLES[f.severity] || ''}`}>
                    {f.severity}
                  </Badge>
                  {f.category && (
                    <span className="text-[10px] text-muted-foreground">{f.category}</span>
                  )}
                </div>
                {f.title && <p className="text-xs font-medium text-foreground">{f.title}</p>}
                <p className="text-xs text-foreground">{f.description}</p>
                {f.evidence_reference && (
                  <p className="text-[10px] text-muted-foreground">{t('tasks.aiEvidenceReference')}: {f.evidence_reference}</p>
                )}
                {f.regulatory_reference && (
                  <p className="text-[10px] text-muted-foreground italic">{f.regulatory_reference}</p>
                )}
                {f.remediation_suggestion && (
                  <p className="text-[10px] text-blue-700 dark:text-blue-400">{t('tasks.aiRemediationSuggestion')}: {f.remediation_suggestion}</p>
                )}
                {f.affected_incidents?.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Incidents: {f.affected_incidents.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-1">{t('tasks.aiFindings')}</h4>
          <p className="text-xs text-muted-foreground italic">{t('tasks.aiNoFindings')}</p>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiRecommendations')}</h4>
          <ol className="space-y-2 list-decimal list-inside">
            {recommendations.map((r: any, i: number) => (
              <li key={i} className="text-xs text-foreground">
                <Badge className={`text-[9px] mr-1.5 ${PRIORITY_STYLES[r.priority] || ''}`}>
                  {r.priority}
                </Badge>
                {r.action}
                {r.rationale && (
                  <span className="text-muted-foreground ml-1">— {r.rationale}</span>
                )}
                {(r.responsible_role || r.regulatory_basis) && (
                  <div className="ml-5 mt-0.5 text-[10px] text-muted-foreground">
                    {r.responsible_role && <span>{t('tasks.aiResponsibleRole')}: {r.responsible_role}</span>}
                    {r.responsible_role && r.regulatory_basis && <span className="mx-1">·</span>}
                    {r.regulatory_basis && <span>{t('tasks.aiRegulatoryBasis')}: {r.regulatory_basis}</span>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-1">{t('tasks.aiRecommendations')}</h4>
          <p className="text-xs text-muted-foreground italic">{t('tasks.aiSectionNotIncluded')}</p>
        </div>
      )}

      {/* SME Review Notes */}
      {smeReviewNotes && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
          <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
            {t('tasks.aiSmeNotes')}
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-400">{smeReviewNotes}</p>
        </div>
      )}

      {/* Evidence Processed */}
      {evidenceFiles.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-foreground hover:underline">
            <FileText className="h-3.5 w-3.5" />
            {t('tasks.aiEvidenceProcessed')} ({evidenceFiles.length})
            <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ul className="space-y-1">
              {evidenceFiles.map((ef, i) => (
                <li key={ef.file_id ?? ef.source ?? i} className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                  <FileText className="h-3 w-3 shrink-0" />
                  {ef.source ?? ef.file_name ?? ef.name ?? 'Unknown file'}
                  {ef.sha256_hash && (
                    <span className="text-[9px]">({ef.sha256_hash.substring(0, 8)})</span>
                  )}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Separator />
    </div>
  );
}
