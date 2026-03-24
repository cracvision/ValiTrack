import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { getRelativeTime } from '@/lib/relativeTime';
import type { ReviewCaseTransition } from '@/types';

interface TransitionHistoryProps {
  transitions: ReviewCaseTransition[];
}

// Transitions that require e-signatures
const E_SIG_TRANSITIONS = [
  'plan_approval_to_approved_for_execution',
  'execution_review_to_approved',
  'execution_review_to_rejected',
];

export function TransitionHistory({ transitions }: TransitionHistoryProps) {
  const { t } = useTranslation();

  const reviewCaseId = transitions[0]?.review_case_id;

  // Fetch e-signature audit entries for this review case
  const { data: eSignatures = [] } = useQuery({
    queryKey: ['e-signatures', reviewCaseId],
    queryFn: async () => {
      if (!reviewCaseId) return [];
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('resource_type', 'review_cases')
        .eq('resource_id', reviewCaseId)
        .eq('action', 'E_SIGNATURE')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!reviewCaseId,
  });

  if (transitions.length === 0) return null;

  // Build a map of transition keys to e-signature details
  const eSignMap = new Map<string, any>();
  for (const sig of eSignatures) {
    const details = sig.details as Record<string, any> | null;
    if (details?.transition) {
      eSignMap.set(details.transition, details);
    }
  }

  const getESignForTransition = (tr: ReviewCaseTransition) => {
    const key = `${tr.from_status}_to_${tr.to_status}`;
    return eSignMap.get(key);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t('reviews.detail.statusHistory')}</h3>
      <div className="border rounded-lg divide-y divide-border">
        {transitions.map(tr => {
          const eSig = getESignForTransition(tr);
          return (
            <div key={tr.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {eSig && <Lock className="h-3.5 w-3.5 text-primary" />}
                  <span className="text-sm font-medium text-foreground">
                    {tr.transitioned_by_name || 'System'}
                  </span>
                  {tr.from_status && (
                    <>
                      <ReviewStatusBadge status={tr.from_status} />
                      <span className="text-muted-foreground text-xs">→</span>
                    </>
                  )}
                  <ReviewStatusBadge status={tr.to_status} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {getRelativeTime(tr.created_at)}
                </span>
              </div>
              {eSig && (
                <p className="text-xs text-primary/80 pl-5">
                  🔐 {t('esignature.signed')} · "{eSig.reason}"
                </p>
              )}
              {!eSig && tr.reason && (
                <p className="text-xs text-muted-foreground italic pl-1">
                  {tr.reason}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
