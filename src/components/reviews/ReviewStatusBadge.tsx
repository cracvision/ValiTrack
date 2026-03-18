import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { REVIEW_STATUS_CONFIG } from '@/lib/reviewWorkflow';
import type { ReviewStatus } from '@/types';

interface ReviewStatusBadgeProps {
  status: ReviewStatus;
  className?: string;
}

export function ReviewStatusBadge({ status, className }: ReviewStatusBadgeProps) {
  const { t } = useTranslation();
  const config = REVIEW_STATUS_CONFIG[status];

  return (
    <Badge
      variant="secondary"
      className={cn('text-xs px-2 py-0.5 rounded border', config.className, className)}
    >
      {t(`reviews.status.${status}`)}
    </Badge>
  );
}
