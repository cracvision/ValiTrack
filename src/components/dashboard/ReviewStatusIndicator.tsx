import { useTranslation } from 'react-i18next';
import { CircleDashed, CircleCheck, Clock, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewStatusType } from '@/hooks/useDashboardSystems';

interface ReviewStatusIndicatorProps {
  status: ReviewStatusType;
  countdownLabel: string;
  daysUntilDue: number;
}

const statusConfig: Record<ReviewStatusType, {
  dotClass: string;
  icon: typeof CircleDashed;
  iconClass: string;
  countdownClass: string;
  dotStyle?: string;
}> = {
  no_review: {
    dotClass: 'border border-dashed border-muted-foreground bg-transparent',
    icon: CircleDashed,
    iconClass: 'text-muted-foreground',
    countdownClass: 'text-muted-foreground',
  },
  compliant: {
    dotClass: 'bg-green-600',
    icon: CircleCheck,
    iconClass: 'text-green-600',
    countdownClass: 'text-muted-foreground',
  },
  approaching: {
    dotClass: 'bg-amber-600',
    icon: Clock,
    iconClass: 'text-amber-600',
    countdownClass: 'text-amber-700',
  },
  in_progress: {
    dotClass: 'bg-blue-600 animate-[pulse-subtle_2s_ease-in-out_infinite]',
    icon: Loader2,
    iconClass: 'text-blue-600 animate-spin',
    countdownClass: 'text-blue-700',
  },
  pending_approval: {
    dotClass: 'bg-blue-700',
    icon: ShieldCheck,
    iconClass: 'text-blue-700',
    countdownClass: 'text-blue-700',
  },
  overdue: {
    dotClass: 'bg-red-700 ring-2 ring-red-200',
    icon: AlertTriangle,
    iconClass: 'text-red-700',
    countdownClass: 'text-red-700',
  },
};

function useLocalizedCountdown(status: ReviewStatusType, daysUntilDue: number): string {
  const { t } = useTranslation();
  if (status === 'no_review') return '';
  if (status === 'overdue') {
    return t('dashboard.countdown.overdueByDays', { count: Math.abs(daysUntilDue) });
  }
  if (status === 'approaching') {
    return t('dashboard.countdown.dueInDays', { count: daysUntilDue });
  }
  if (status === 'compliant') {
    const months = Math.floor(daysUntilDue / 30);
    if (months > 0) return t('dashboard.countdown.monthsAway', { count: months });
    return t('dashboard.countdown.daysAway', { count: daysUntilDue });
  }
  return '';
}

export { useLocalizedCountdown };

export function ReviewStatusIndicator({ status, daysUntilDue }: ReviewStatusIndicatorProps) {
  const { t } = useTranslation();
  const config = statusConfig[status];
  const Icon = config.icon;
  const localizedCountdown = useLocalizedCountdown(status, daysUntilDue);

  return (
    <div
      className="flex items-center gap-2 py-2"
      aria-label={t(`dashboard.reviewStatus.${status}`)}
    >
      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', config.dotClass)} />
      <Icon className={cn('h-4 w-4 shrink-0', config.iconClass)} strokeWidth={1.75} />
      <span className="text-sm font-medium text-foreground">
        {t(`dashboard.reviewStatus.${status}`)}
      </span>
      <span className="flex-1" />
      {localizedCountdown && (
        <span className={cn('text-xs', config.countdownClass)}>{localizedCountdown}</span>
      )}
    </div>
  );
}
