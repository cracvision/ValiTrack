import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AiTaskResult {
  id: string;
  task_id: string;
  review_case_id: string;
  model_name: string;
  model_digest: string;
  prompt_template_id: string;
  triggered_by: string;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  processing_duration_sec: number | null;
  evidence_files_used: Array<{
    file_id: string;
    file_name: string;
    storage_path: string;
    sha256_hash: string;
  }>;
  analysis_result: {
    overall_verdict: 'ACCEPTABLE' | 'ACCEPTABLE_WITH_CONDITIONS' | 'REQUIRES_ACTION';
    summary: string;
    metrics: {
      total_incidents: number;
      p1_critical: number;
      p2_high: number;
      p3_medium: number;
      p4_low: number;
      gxp_critical: number;
      gxp_relevant: number;
      operational_it: number;
      sla_compliance_pct: number;
      trend_direction: string;
    };
    critical_findings: Array<{
      finding_id: string;
      severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';
      description: string;
      regulatory_reference: string;
      affected_incidents: string[];
    }>;
    recommendations: Array<{
      priority: 'IMMEDIATE' | 'SHORT_TERM' | 'LONG_TERM';
      action: string;
      rationale: string;
    }>;
    sme_review_notes: string;
  } | null;
  execution_status: 'queued' | 'processing' | 'complete' | 'failed';
  error_message: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
}

export function useAiTaskResult(taskId: string | null, taskStatus: string, taskGroup?: string) {
  const isPolling = taskStatus === 'ai_queued' || taskStatus === 'ai_processing';
  const isAiEval = taskGroup === 'AI_EVAL';
  const shouldFetch = isPolling || taskStatus === 'ai_complete' || taskStatus === 'completed' || (isAiEval && taskStatus === 'in_progress');

  return useQuery({
    queryKey: ['ai-task-result', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from('ai_task_results' as any)
        .select('*')
        .eq('task_id', taskId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AiTaskResult | null;
    },
    enabled: !!taskId && shouldFetch,
    refetchInterval: isPolling ? 5000 : false,
    staleTime: isPolling ? 0 : 60000,
  });
}
