import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { REVIEW_STATUS_CONFIG } from '@/lib/reviewWorkflow';

interface ReviewStatusBadgeProps {
  status: string;
  className?: string;
}

export function ReviewStatusBadge({ status, className }: ReviewStatusBadgeProps) {
  const { t } = useTranslation();
  const config = REVIEW_STATUS_CONFIG[status] ?? REVIEW_STATUS_CONFIG.draft;

  return (
    <Badge
      variant="secondary"
      className={cn('text-xs px-2 py-0.5 rounded border', config.className, className)}
    >
      {t(config.labelKey, { defaultValue: config.label })}
    </Badge>
  );
}
