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
  MINOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  OBSERVATION: 'bg-muted text-muted-foreground',
};

const PRIORITY_STYLES: Record<string, string> = {
  IMMEDIATE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  SHORT_TERM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  LONG_TERM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

interface AiResultPanelProps {
  result: AiTaskResult;
}

export function AiResultPanel({ result }: AiResultPanelProps) {
  const { t } = useTranslation();

  const rawAnalysis = typeof result.analysis_result === 'string'
    ? JSON.parse(result.analysis_result)
    : result.analysis_result ?? null;

  // Normalize: support both flat legacy shape and nested DB shape
  const analysis = rawAnalysis ? {
    overall_verdict: rawAnalysis.phase5_conclusions?.overall_verdict?.status ?? rawAnalysis.overall_verdict ?? null,
    summary: rawAnalysis.phase5_conclusions?.overall_verdict?.summary ?? rawAnalysis.summary ?? null,
    sme_review_notes: rawAnalysis.phase5_conclusions?.smr_review_notes ?? rawAnalysis.sme_review_notes ?? null,
    metrics: rawAnalysis.phase2_metrics ? {
      total_incidents: rawAnalysis.phase2_metrics.total_incidents,
      p1_critical: rawAnalysis.phase2_metrics.by_priority?.p1_critical,
      p2_high: rawAnalysis.phase2_metrics.by_priority?.p2_high,
      p3_medium: rawAnalysis.phase2_metrics.by_priority?.p3_medium,
      p4_low: rawAnalysis.phase2_metrics.by_priority?.p4_low,
      sla_compliance_pct: rawAnalysis.phase2_metrics.sla_compliance?.compliance_rate_percent,
    } : rawAnalysis.metrics ?? null,
    data_quality: rawAnalysis.data_quality ?? null,
    critical_findings: rawAnalysis.critical_findings ?? null,
    recommendations: rawAnalysis.recommendations ?? null,
  } : null;

  const evidenceFiles: Array<{ file_id: string; file_name: string; storage_path: string; sha256_hash: string }> =
    typeof result.evidence_files_used === 'string'
      ? JSON.parse(result.evidence_files_used)
      : result.evidence_files_used ?? [];

  if (!analysis) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          AI analysis result not found. Please contact the System Administrator.
        </AlertDescription>
      </Alert>
    );
  }

  const verdictKey = analysis.overall_verdict === 'ACCEPTABLE'
    ? 'verdictAcceptable'
    : analysis.overall_verdict === 'ACCEPTABLE_WITH_CONDITIONS'
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
      <div className="rounded-md border p-3 space-y-2">
        <Badge className={`text-xs font-bold ${VERDICT_STYLES[analysis.overall_verdict] || ''}`}>
          {t(`tasks.${verdictKey}`)}
        </Badge>
        <p className="text-sm text-foreground">{analysis.summary}</p>
      </div>

      {/* Data Quality */}
      {analysis.data_quality && (
        <div className="rounded-md border p-2.5 space-y-1">
          <h4 className="text-xs font-semibold text-foreground mb-1">{t('tasks.aiDataQuality', 'Data Quality')}</h4>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Source: <span className="font-mono text-foreground">{analysis.data_quality.source_document}</span></span>
            <span>Records: <span className="font-semibold text-foreground">{analysis.data_quality.total_records_found}</span></span>
          </div>
        </div>
      )}

      {/* Metrics Summary */}
      {analysis.metrics ? (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiMetrics')}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Total', value: analysis.metrics.total_incidents },
              { label: 'P1', value: analysis.metrics.p1_critical },
              { label: 'P2', value: analysis.metrics.p2_high },
              { label: 'P3', value: analysis.metrics.p3_medium },
              { label: 'P4', value: analysis.metrics.p4_low },
              { label: 'SLA %', value: analysis.metrics.sla_compliance_pct != null ? `${analysis.metrics.sla_compliance_pct}%` : '—' },
            ].filter((m) => m.value != null).map((m) => (
              <div key={m.label} className="text-center rounded-md bg-muted/50 px-2 py-1.5">
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                <div className="text-sm font-semibold text-foreground">{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Critical Findings */}
      {analysis.critical_findings?.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiFindings')}</h4>
          <div className="space-y-2">
            {analysis.critical_findings.map((f: any) => (
              <div key={f.finding_id} className="rounded-md border p-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[9px] ${SEVERITY_STYLES[f.severity] || ''}`}>
                    {f.severity}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">{f.finding_id}</span>
                </div>
                <p className="text-xs text-foreground">{f.description}</p>
                {f.regulatory_reference && (
                  <p className="text-[10px] text-muted-foreground italic">{f.regulatory_reference}</p>
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
          <p className="text-xs text-muted-foreground italic">{t('tasks.aiSectionNotIncluded', 'Not included in this analysis run.')}</p>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations?.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">{t('tasks.aiRecommendations')}</h4>
          <ol className="space-y-2 list-decimal list-inside">
            {analysis.recommendations.map((r: any, i: number) => (
              <li key={i} className="text-xs text-foreground">
                <Badge className={`text-[9px] mr-1.5 ${PRIORITY_STYLES[r.priority] || ''}`}>
                  {r.priority}
                </Badge>
                {r.action}
                {r.rationale && (
                  <span className="text-muted-foreground ml-1">— {r.rationale}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-1">{t('tasks.aiRecommendations')}</h4>
          <p className="text-xs text-muted-foreground italic">{t('tasks.aiSectionNotIncluded', 'Not included in this analysis run.')}</p>
        </div>
      )}

      {/* SME Review Notes */}
      {analysis.sme_review_notes && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
          <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
            {t('tasks.aiSmeNotes')}
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-400">{analysis.sme_review_notes}</p>
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
              {evidenceFiles.map((ef) => (
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
