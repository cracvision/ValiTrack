import { useTranslation } from 'react-i18next';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { getRelativeTime } from '@/lib/relativeTime';
import type { ReviewCaseTransition } from '@/types';

interface TransitionHistoryProps {
  transitions: ReviewCaseTransition[];
}

export function TransitionHistory({ transitions }: TransitionHistoryProps) {
  const { t } = useTranslation();

  if (transitions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t('reviews.detail.statusHistory')}</h3>
      <div className="border rounded-lg divide-y divide-border">
        {transitions.map(tr => (
          <div key={tr.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
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
            {tr.reason && (
              <p className="text-xs text-muted-foreground italic pl-1">
                {tr.reason}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
