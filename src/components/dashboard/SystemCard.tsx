import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, CalendarDays, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReviewStatusIndicator } from './ReviewStatusIndicator';
import { ReviewPhaseStepper } from './ReviewPhaseStepper';
import { SystemAuditFeed } from './SystemAuditFeed';
import { GXP_SHORT_LABELS, ENVIRONMENT_SHORT_LABELS, GAMP_SHORT_LABELS } from '@/lib/gxpClassifications';
import type { DashboardSystem } from '@/hooks/useDashboardSystems';
import type { GxPClassification, SystemEnvironment, GampCategory } from '@/types';

const classificationColor: Record<string, string> = {
  GMP: 'bg-destructive/10 text-destructive border-destructive/20',
  GLP: 'bg-destructive/10 text-destructive border-destructive/20',
  GCP: 'bg-destructive/10 text-destructive border-destructive/20',
  GDP: 'bg-orange-100 text-orange-700 border-orange-200',
  GVP: 'bg-destructive/10 text-destructive border-destructive/20',
  NON_GXP_CRITICAL: 'bg-orange-100 text-orange-700 border-orange-200',
  NON_GXP_STANDARD: 'bg-muted text-muted-foreground border-border',
};

const riskColor: Record<string, string> = {
  High: 'bg-destructive/10 text-destructive border-destructive/20',
  Medium: 'bg-orange-100 text-orange-700 border-orange-200',
  Low: 'bg-green-100 text-green-700 border-green-200',
};

const gampColor: Record<string, string> = {
  '1': 'bg-green-100 text-green-700 border-green-200',
  '3': 'bg-muted text-muted-foreground border-border',
  '4': 'bg-orange-100 text-orange-700 border-orange-200',
  '5': 'bg-destructive/10 text-destructive border-destructive/20',
};

interface SystemCardProps {
  system: DashboardSystem;
}

function NextActionBar({ system }: { system: DashboardSystem }) {
  const { t } = useTranslation();
  const { reviewStatus, actualReviewStatus, daysUntilDue, next_review_date } = system;
  const date = new Date(next_review_date).toLocaleDateString();

  // If there's an active review case, use phase-specific messages
  if (actualReviewStatus && !['approved'].includes(actualReviewStatus)) {
    const phaseConfigs: Record<string, { icon: typeof Clock; bg: string; text: string; msgKey: string }> = {
      draft: {
        icon: Info,
        bg: 'bg-muted/50',
        text: 'text-muted-foreground',
        msgKey: 'dashboard.nextAction.phase.draft',
      },
      in_preparation: {
        icon: Clock,
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        msgKey: 'dashboard.nextAction.phase.in_preparation',
      },
      in_progress: {
        icon: Clock,
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        msgKey: 'dashboard.nextAction.phase.in_progress',
      },
      under_review: {
        icon: Clock,
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        msgKey: 'dashboard.nextAction.phase.under_review',
      },
      rejected: {
        icon: AlertTriangle,
        bg: 'bg-red-50',
        text: 'text-red-800',
        msgKey: 'dashboard.nextAction.phase.rejected',
      },
    };

    const config = phaseConfigs[actualReviewStatus] ?? phaseConfigs.draft;
    const Icon = config.icon;

    return (
      <div className={cn('flex items-center gap-2 rounded px-3 py-2 mt-2', config.bg)}>
        <Icon className={cn('h-4 w-4 shrink-0', config.text)} strokeWidth={1.75} />
        <span className={cn('text-xs', config.text)}>
          {t(config.msgKey, { days: daysUntilDue, date })}
        </span>
      </div>
    );
  }

  // Fallback: no active case or approved — use date-based status
  const configs: Record<string, { icon: typeof Clock; bg: string; text: string; msg: string }> = {
    compliant: {
      icon: Clock,
      bg: 'bg-muted/50',
      text: 'text-muted-foreground',
      msg: t('dashboard.nextAction.compliant', { date, timeaway: system.countdownLabel }),
    },
    approaching: {
      icon: CalendarDays,
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      msg: t('dashboard.nextAction.approaching', { days: daysUntilDue }),
    },
    overdue: {
      icon: AlertTriangle,
      bg: 'bg-red-50',
      text: 'text-red-800',
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

      {/* Status row */}
      <div className="border-t border-b border-border py-1">
        <ReviewStatusIndicator
          status={system.reviewStatus}
          countdownLabel={system.countdownLabel}
          daysUntilDue={system.daysUntilDue}
        />
      </div>

      {/* Phase stepper - only for in_progress/pending_approval */}
      {showStepper && system.activeReviewCaseStatus && (
        <ReviewPhaseStepper currentPhase={system.activeReviewCaseStatus as any} />
      )}

      {/* Next action bar */}
      <NextActionBar system={system} />

      {/* Audit feed */}
      <SystemAuditFeed systemId={system.id} />
    </div>
  );
}
