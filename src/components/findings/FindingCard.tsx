import { useTranslation } from 'react-i18next';
import { Bot, CheckCircle2, XCircle, Clock, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Finding, FindingSeverity } from '@/types/findings';

const SEVERITY_STYLES: Record<FindingSeverity, { border: string; badge: string }> = {
  critical: { border: 'border-l-4 border-l-red-500', badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  major: { border: 'border-l-4 border-l-orange-500', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  minor: { border: 'border-l-4 border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  observation: { border: 'border-l-4 border-l-blue-500', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
};

interface FindingCardProps {
  finding: Finding;
  userNames: Record<string, string>;
  variant: 'pending' | 'confirmed' | 'dismissed';
  onConfirm?: () => void;
  onDismiss?: () => void;
  onClose?: () => void;
  onReopen?: () => void;
  onClick?: () => void;
}

export function FindingCard({ finding, userNames, variant, onConfirm, onDismiss, onClose, onReopen, onClick }: FindingCardProps) {
  const { t } = useTranslation();
  const styles = SEVERITY_STYLES[finding.severity];

  const bgClass = variant === 'pending'
    ? 'bg-amber-50/50 dark:bg-amber-950/10'
    : variant === 'dismissed'
    ? 'bg-muted/30'
    : 'bg-card';

  const canCloseWithCapa = finding.capa_required
    ? ['closed', 'verified', 'not_required'].includes(finding.capa_status || '')
    : true;

  return (
    <div
      className={`rounded-lg border ${styles.border} ${bgClass} p-3 cursor-pointer hover:shadow-sm transition-shadow`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] ${styles.badge}`}>
              {t(`findings.severity.${finding.severity}`).toUpperCase()}
            </Badge>
            {finding.source === 'ai_identified' && (
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-sm font-medium text-foreground truncate">{finding.title}</span>
            {finding.status === 'closed' && (
              <Badge variant="secondary" className="text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-0.5" />
                {t('findings.status.closed')}
              </Badge>
            )}
            {finding.status === 'in_progress' && (
              <Badge variant="secondary" className="text-[10px]">
                <Clock className="h-3 w-3 mr-0.5" />
                {t('findings.status.in_progress')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>{t(`findings.category.${finding.category}`)}</span>
            {finding.regulation_reference && (
              <>
                <span>·</span>
                <span>{finding.regulation_reference}</span>
              </>
            )}
            {finding.capa_required && finding.capa_reference && (
              <>
                <span>·</span>
                <span className="font-medium">CAPA: {finding.capa_reference}</span>
                {finding.capa_system && <span>({finding.capa_system})</span>}
                <span>— {t(`findings.capaStatus.${finding.capa_status || 'pending'}`)}</span>
              </>
            )}
          </div>
          {variant === 'dismissed' && finding.dismissal_justification && (
            <p className="text-xs text-muted-foreground italic mt-1">
              {t('findings.labels.justification')}: {finding.dismissal_justification}
            </p>
          )}
          {finding.confirmed_by && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('findings.labels.confirmedBy')}: {userNames[finding.confirmed_by] || '—'} · {finding.confirmed_at ? new Date(finding.confirmed_at).toLocaleDateString() : ''}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {onConfirm && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onConfirm}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('findings.actions.confirm')}
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={onDismiss}>
              <XCircle className="h-3 w-3 mr-1" />
              {t('findings.actions.dismiss')}
            </Button>
          )}
          {onClose && (
            canCloseWithCapa ? (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={onClose}>
                {t('findings.actions.close')}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" size="sm" className="text-xs h-7" disabled>
                      <Lock className="h-3 w-3 mr-1" />
                      {t('findings.actions.close')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('findings.actions.closeBlockedCapa')}</TooltipContent>
              </Tooltip>
            )
          )}
          {onReopen && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={onReopen}>
              {t('findings.actions.reopen')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
