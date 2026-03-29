import { useTranslation } from 'react-i18next';
import { addDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DashboardSystem } from '@/hooks/useDashboardSystems';

type Scenario = 'A' | 'B' | 'C' | 'D' | 'E' | null;

interface TimelineData {
  scenario: Scenario;
  daysUntilPeriodEnd: number;
  daysUntilDueDate: number;
  daysOverdue: number;
  completionDueDate: Date;
  periodLabel: string;
  formattedNextReviewDate: string;
  formattedCompletionDueDate: string;
}

function useTimelineData(system: DashboardSystem, t: (key: string, opts?: any) => string): TimelineData | null {
  const { next_review_date, completion_window_days, review_period_months } = system;

  if (!next_review_date || completion_window_days == null) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextReview = new Date(next_review_date);
  nextReview.setHours(0, 0, 0, 0);
  const completionDueDate = addDays(nextReview, completion_window_days);

  const daysUntilPeriodEnd = differenceInDays(nextReview, today);
  const daysUntilDueDate = differenceInDays(completionDueDate, today);
  const daysOverdue = differenceInDays(today, completionDueDate);

  // Scenario E: distant — don't show
  if (daysUntilPeriodEnd > 90 && daysUntilDueDate > 180) {
    return null;
  }

  let scenario: Scenario;
  if (daysUntilDueDate <= 0) {
    scenario = 'D';
  } else if (daysUntilPeriodEnd > 0) {
    scenario = 'A';
  } else if (daysUntilDueDate <= 30) {
    scenario = 'C';
  } else {
    scenario = 'B';
  }

  const periodLabel = t('dashboard.systemCard.timeline.periodLabel', { count: review_period_months });
  const formattedNextReviewDate = nextReview.toLocaleDateString();
  const formattedCompletionDueDate = completionDueDate.toLocaleDateString();

  return {
    scenario,
    daysUntilPeriodEnd,
    daysUntilDueDate,
    daysOverdue,
    completionDueDate,
    periodLabel,
    formattedNextReviewDate,
    formattedCompletionDueDate,
  };
}

const scenarioStyles: Record<string, { bg: string; text: string; border: string }> = {
  A_normal: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: '' },
  A_warn: { bg: 'bg-orange-50 dark:bg-neutral-800', text: 'text-orange-800 dark:text-orange-400', border: 'border-l-4 border-orange-400 dark:border-neutral-600' },
  B: { bg: 'bg-orange-50 dark:bg-neutral-800', text: 'text-orange-800 dark:text-orange-400', border: 'border-l-4 border-orange-400 dark:border-neutral-600' },
  C: { bg: 'bg-red-50 dark:bg-neutral-800', text: 'text-red-700 dark:text-red-400', border: 'border-l-4 border-red-400 dark:border-neutral-600' },
  D: { bg: 'bg-red-50 dark:bg-neutral-800', text: 'text-red-700 dark:text-red-400 font-semibold', border: 'border-l-4 border-red-400 dark:border-neutral-600' },
};

function getStyles(scenario: Scenario, daysUntilDueDate: number) {
  if (scenario === 'A') {
    return daysUntilDueDate <= 90 ? scenarioStyles.A_warn : scenarioStyles.A_normal;
  }
  if (scenario === 'B') return scenarioStyles.B;
  if (scenario === 'C') return scenarioStyles.C;
  return scenarioStyles.D;
}

function getTimelineMessage(data: TimelineData, t: (key: string, opts?: any) => string): string {
  const { scenario, daysUntilPeriodEnd, daysUntilDueDate, daysOverdue, periodLabel, formattedNextReviewDate, formattedCompletionDueDate } = data;
  const system = data as any; // we pass completion_window_days through the parent

  const baseParams = {
    periodLabel,
    nextReviewDate: formattedNextReviewDate,
    completionDueDate: formattedCompletionDueDate,
  };

  if (scenario === 'A') {
    return t('dashboard.systemCard.timeline.scenarioA', {
      ...baseParams,
      count: daysUntilPeriodEnd,
      daysUntilPeriodEnd,
      completionWindowDays: (data as any).completionWindowDays,
    });
  }

  if (scenario === 'B' || scenario === 'C') {
    // Zero remaining — last day
    if (daysUntilDueDate === 0) {
      const key = daysUntilPeriodEnd === 0
        ? 'dashboard.systemCard.timeline.scenarioBCD_zero_today'
        : 'dashboard.systemCard.timeline.scenarioBCD_zero';
      return t(key, baseParams);
    }
    // Period reached today
    if (daysUntilPeriodEnd === 0) {
      return t('dashboard.systemCard.timeline.scenarioBCD_today', {
        ...baseParams,
        daysRemaining: daysUntilDueDate,
      });
    }
    return t('dashboard.systemCard.timeline.scenarioBCD', {
      ...baseParams,
      count: daysUntilDueDate,
      daysRemaining: daysUntilDueDate,
    });
  }

  if (scenario === 'D') {
    if (daysUntilPeriodEnd === 0) {
      return t('dashboard.systemCard.timeline.scenarioD_today', {
        ...baseParams,
        daysOverdue,
      });
    }
    return t('dashboard.systemCard.timeline.scenarioD', {
      ...baseParams,
      count: daysOverdue,
      daysOverdue,
    });
  }

  return '';
}

export interface TimelineMessageBlockProps {
  system: DashboardSystem;
}

export function TimelineMessageBlock({ system }: TimelineMessageBlockProps) {
  const { t } = useTranslation();

  // Don't show for cards with active non-approved review cases
  if (system.actualReviewStatus && !['approved'].includes(system.actualReviewStatus)) {
    return null;
  }

  const data = useTimelineData(system, t);
  if (!data || !data.scenario) return null;

  // Attach completionWindowDays for scenario A message
  (data as any).completionWindowDays = system.completion_window_days;

  const styles = getStyles(data.scenario, data.daysUntilDueDate);
  const message = getTimelineMessage(data, t);

  return (
    <div className={cn('rounded-md p-3 text-sm mt-3', styles.bg, styles.text, styles.border)}>
      {message}
    </div>
  );
}

/** Returns the scenario-based next action key and params for cards without active review cases */
export function useTimelineNextAction(system: DashboardSystem): { key: string; params: Record<string, any> } | null {
  const { t } = useTranslation();
  const data = useTimelineData(system, t);
  if (!data || !data.scenario) return null;

  const { scenario, daysUntilPeriodEnd, daysUntilDueDate, daysOverdue } = data;

  if (scenario === 'A') {
    return { key: 'dashboard.nextAction.scenarioA', params: { count: daysUntilPeriodEnd, daysUntilPeriodEnd } };
  }
  if (scenario === 'B') {
    return { key: 'dashboard.nextAction.scenarioB', params: { count: daysUntilDueDate, daysUntilDueDate } };
  }
  if (scenario === 'C') {
    return { key: 'dashboard.nextAction.scenarioC', params: { count: daysUntilDueDate, daysUntilDueDate } };
  }
  if (scenario === 'D') {
    return { key: 'dashboard.nextAction.scenarioD', params: { count: daysOverdue, daysOverdue } };
  }
  return null;
}
