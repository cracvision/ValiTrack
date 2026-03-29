import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, CalendarDays, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLocalizedCountdown } from './ReviewStatusIndicator';
import { ReviewPhaseStepper } from './ReviewPhaseStepper';
import { SystemAuditFeed } from './SystemAuditFeed';
import { TimelineMessageBlock, useTimelineNextAction } from './TimelineMessageBlock';
import { GXP_SHORT_LABELS, ENVIRONMENT_SHORT_LABELS, GAMP_SHORT_LABELS } from '@/lib/gxpClassifications';
import type { DashboardSystem } from '@/hooks/useDashboardSystems';
import type { GxPClassification, SystemEnvironment, GampCategory } from '@/types';

const classificationColor: Record<string, string> = {
  GMP: 'bg-destructive/10 text-destructive border-destructive/20',
  GLP: 'bg-destructive/10 text-destructive border-destructive/20',
  GCP: 'bg-destructive/10 text-destructive border-destructive/20',
  GDP: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  GVP: 'bg-destructive/10 text-destructive border-destructive/20',
  NON_GXP_CRITICAL: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  NON_GXP_STANDARD: 'bg-muted text-muted-foreground border-border',
};

const riskColor: Record<string, string> = {
  High: 'bg-destructive/10 text-destructive border-destructive/20',
  Medium: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  Low: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
};

const gampColor: Record<string, string> = {
  '1': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  '3': 'bg-muted text-muted-foreground border-border',
  '4': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  '5': 'bg-destructive/10 text-destructive border-destructive/20',
};

interface SystemCardProps {
  system: DashboardSystem;
}

function NextActionBar({ system }: { system: DashboardSystem }) {
  const { t } = useTranslation();
  const { reviewStatus, actualReviewStatus, daysUntilDue, next_review_date } = system;
  const date = new Date(next_review_date).toLocaleDateString();
  const localizedCountdown = useLocalizedCountdown(reviewStatus, daysUntilDue);

  // Active review case — phase-specific messages
  if (actualReviewStatus && !['approved'].includes(actualReviewStatus)) {
    const phaseConfigs: Record<string, { icon: typeof Clock; bg: string; text: string; msgKey: string; msgParams?: Record<string, any> }> = {
      draft: {
        icon: Info,
        bg: 'bg-muted/50',
        text: 'text-muted-foreground',
        msgKey: 'dashboard.nextAction.phase.draft',
      },
      plan_review: (() => {
        const ss = system.signoffSummary;
        if (ss && ss.has_objections) {
          return { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-300', msgKey: 'dashboard.nextAction.phase.plan_review_objections' };
        }
        if (ss && ss.total_completed === ss.total_required && ss.total_required > 0) {
          return { icon: ShieldCheck, bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-800 dark:text-green-300', msgKey: 'dashboard.nextAction.phase.plan_review_ready' };
        }
        if (ss && ss.total_required > 0) {
          return { icon: Clock, bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-800 dark:text-blue-300', msgKey: 'dashboard.nextAction.phase.plan_review_pending', msgParams: { completed: ss.total_completed, total: ss.total_required } };
        }
        return { icon: Clock, bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-800 dark:text-blue-300', msgKey: 'dashboard.nextAction.phase.plan_review' };
      })(),
      plan_approval: {
        icon: ShieldCheck,
        bg: 'bg-purple-50 dark:bg-purple-950',
        text: 'text-purple-800 dark:text-purple-300',
        msgKey: 'dashboard.nextAction.phase.plan_approval',
      },
      approved_for_execution: {
        icon: ShieldCheck,
        bg: 'bg-teal-50 dark:bg-teal-950',
        text: 'text-teal-800 dark:text-teal-300',
        msgKey: 'dashboard.nextAction.phase.approved_for_execution',
      },
      in_progress: {
        icon: Clock,
        bg: 'bg-amber-50 dark:bg-amber-950',
        text: 'text-amber-800 dark:text-amber-300',
        msgKey: 'dashboard.nextAction.phase.in_progress',
      },
      execution_review: (() => {
        const ss = system.signoffSummary;
        if (ss && ss.has_objections) {
          return { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-300', msgKey: 'dashboard.nextAction.phase.execution_review_objections' };
        }
        if (ss && ss.total_completed === ss.total_required && ss.total_required > 0) {
          return { icon: ShieldCheck, bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-800 dark:text-green-300', msgKey: 'dashboard.nextAction.phase.execution_review_ready' };
        }
        if (ss && ss.total_required > 0) {
          return { icon: Clock, bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-800 dark:text-orange-300', msgKey: 'dashboard.nextAction.phase.execution_review_pending', msgParams: { completed: ss.total_completed, total: ss.total_required } };
        }
        return { icon: Clock, bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-800 dark:text-orange-300', msgKey: 'dashboard.nextAction.phase.execution_review' };
      })(),
      rejected: {
        icon: AlertTriangle,
        bg: 'bg-red-50 dark:bg-red-950',
        text: 'text-red-800 dark:text-red-300',
        msgKey: 'dashboard.nextAction.phase.rejected',
      },
      // Backwards compat for old states
      in_preparation: {
        icon: Clock,
        bg: 'bg-blue-50 dark:bg-blue-950',
        text: 'text-blue-800 dark:text-blue-300',
        msgKey: 'dashboard.nextAction.phase.plan_review',
      },
      under_review: {
        icon: Clock,
        bg: 'bg-amber-50 dark:bg-amber-950',
        text: 'text-amber-800 dark:text-amber-300',
        msgKey: 'dashboard.nextAction.phase.execution_review',
      },
    };

    const config = phaseConfigs[actualReviewStatus] ?? phaseConfigs.draft;
    const Icon = config.icon;
    const msgParams = { days: daysUntilDue, date, ...(config as any).msgParams };

    return (
      <div className={cn('flex items-center gap-2 rounded px-3 py-2 mt-2', config.bg)}>
        <Icon className={cn('h-4 w-4 shrink-0', config.text)} strokeWidth={1.75} />
        <span className={cn('text-xs', config.text)}>
          {String(t(config.msgKey, msgParams))}
        </span>
      </div>
    );
  }

  // Fallback: no active case or approved — use scenario-based action
  const timelineAction = useTimelineNextAction(system);

  if (timelineAction) {
    // Determine icon and styling based on scenario
    const scenarioKey = timelineAction.key;
    let Icon = Clock;
    let bg = 'bg-muted/50';
    let textClass = 'text-muted-foreground';

    if (scenarioKey.includes('scenarioD')) {
      Icon = AlertTriangle;
      bg = 'bg-red-50 dark:bg-red-950';
      textClass = 'text-destructive font-semibold';
    } else if (scenarioKey.includes('scenarioC')) {
      Icon = AlertTriangle;
      bg = 'bg-red-50 dark:bg-red-950';
      textClass = 'text-destructive';
    } else if (scenarioKey.includes('scenarioB')) {
      Icon = CalendarDays;
      bg = 'bg-orange-50 dark:bg-orange-950';
      textClass = 'text-orange-800 dark:text-orange-300';
    } else if (scenarioKey.includes('scenarioA')) {
      const daysUntilPeriodEnd = timelineAction.params.daysUntilPeriodEnd ?? 999;
      if (daysUntilPeriodEnd <= 90) {
        Icon = CalendarDays;
        bg = 'bg-orange-50 dark:bg-orange-950';
        textClass = 'text-orange-800 dark:text-orange-300';
      } else {
        Icon = Clock;
        bg = 'bg-muted/50';
        textClass = 'text-muted-foreground';
      }
    }

    return (
      <div className={cn('flex items-center gap-2 rounded px-3 py-2 mt-2', bg)}>
        <Icon className={cn('h-4 w-4 shrink-0', textClass)} strokeWidth={1.75} />
        <span className={cn('text-xs', textClass)}>
          {String(t(timelineAction.key, timelineAction.params))}
        </span>
      </div>
    );
  }

  // Ultimate fallback (no_review, or scenario E — distant dates)
  const configs: Record<string, { icon: typeof Clock; bg: string; text: string; msg: string }> = {
    compliant: {
      icon: Clock,
      bg: 'bg-muted/50',
      text: 'text-muted-foreground',
      msg: t('dashboard.nextAction.compliant', { date, timeaway: localizedCountdown }),
    },
    approaching: {
      icon: CalendarDays,
      bg: 'bg-amber-50 dark:bg-amber-950',
      text: 'text-amber-800 dark:text-amber-300',
      msg: t('dashboard.nextAction.approaching', { days: daysUntilDue }),
    },
    overdue: {
      icon: AlertTriangle,
      bg: 'bg-red-50 dark:bg-red-950',
      text: 'text-red-800 dark:text-red-300',
      msg: t('dashboard.nextAction.overdue'),
    },
    no_review: {
      icon: Info,
      bg: 'bg-muted/50',
      text: 'text-muted-foreground',
      msg: t('dashboard.nextAction.no_review'),
    },
  };

  const config = configs[reviewStatus] ?? configs.no_review;
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2 rounded px-3 py-2 mt-2', config.bg)}>
      <Icon className={cn('h-4 w-4 shrink-0', config.text)} strokeWidth={1.75} />
      <span className={cn('text-xs', config.text)}>{config.msg}</span>
    </div>
  );
}

export function SystemCard({ system }: SystemCardProps) {
  const navigate = useNavigate();
  const isOverdue = system.reviewStatus === 'overdue';
  const showStepper = system.actualReviewStatus && !['approved', 'rejected'].includes(system.actualReviewStatus);

  return (
    <div
      onClick={() => navigate('/systems')}
      className={cn(
        'bg-card border rounded-lg shadow-sm p-6 cursor-pointer transition-colors hover:border-border/80',
        isOverdue ? 'border-destructive/30' : 'border-border',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground truncate">{system.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{system.system_identifier}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" strokeWidth={1.75} />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge variant="secondary" className={cn('text-xs px-2 py-0.5 rounded border', classificationColor[system.gxp_classification] ?? 'bg-muted text-muted-foreground border-border')}>
          {GXP_SHORT_LABELS[system.gxp_classification as GxPClassification] ?? system.gxp_classification}
        </Badge>
        <Badge variant="secondary" className={cn('text-xs px-2 py-0.5 rounded border', riskColor[system.risk_level] ?? 'bg-muted text-muted-foreground border-border')}>
          {system.risk_level}
        </Badge>
        <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
          {ENVIRONMENT_SHORT_LABELS[system.system_environment as SystemEnvironment] ?? system.system_environment}
        </Badge>
        <Badge variant="secondary" className={cn('text-xs px-2 py-0.5 rounded border', gampColor[system.gamp_category] ?? 'bg-muted text-muted-foreground border-border')}>
          {GAMP_SHORT_LABELS[system.gamp_category as GampCategory] ?? `Cat ${system.gamp_category}`}
        </Badge>
      </div>


      {/* Phase stepper */}
      {showStepper && system.actualReviewStatus && (
        <ReviewPhaseStepper currentPhase={system.actualReviewStatus} />
      )}

      {/* Timeline message block — only for cards without active review cases */}
      <TimelineMessageBlock system={system} />

      {/* Next action bar */}
      <NextActionBar system={system} />

      {/* Audit feed */}
      <SystemAuditFeed systemId={system.id} />
    </div>
  );
}
