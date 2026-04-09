import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFindings, useConfirmFinding, useDismissFinding, useCloseFinding, useReopenFinding } from '@/hooks/useFindings';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { useAuth } from '@/hooks/useAuth';
import { FindingCard } from './FindingCard';
import { ConfirmFindingDialog } from './ConfirmFindingDialog';
import { DismissFindingDialog } from './DismissFindingDialog';
import { CloseFindingDialog } from './CloseFindingDialog';
import { AddFindingDialog } from './AddFindingDialog';
import { FindingDetailPanel } from './FindingDetailPanel';
import type { Finding } from '@/types/findings';

interface FindingsSectionProps {
  reviewCaseId: string;
  reviewCaseStatus: string;
  systemOwnerId: string;
  qaId: string;
}

export function FindingsSection({ reviewCaseId, reviewCaseStatus, systemOwnerId, qaId }: FindingsSectionProps) {
  const { t } = useTranslation();
  const { user, roles } = useAuth();
  const { data: findings = [], isLoading } = useFindings(reviewCaseId);

  const [showDismissed, setShowDismissed] = useState(false);
  const [confirmDialogFinding, setConfirmDialogFinding] = useState<Finding | null>(null);
  const [dismissDialogFinding, setDismissDialogFinding] = useState<Finding | null>(null);
  const [closeDialogFinding, setCloseDialogFinding] = useState<Finding | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailFinding, setDetailFinding] = useState<Finding | null>(null);

  const confirmMutation = useConfirmFinding();
  const dismissMutation = useDismissFinding();
  const closeMutation = useCloseFinding();
  const reopenMutation = useReopenFinding();

  // Collect user IDs for name resolution
  const userIds = findings.flatMap(f => [f.confirmed_by, f.dismissed_by, f.resolved_by, f.action_responsible, f.created_by].filter(Boolean) as string[]);
  const { data: userNames = {} } = useResolveUserNames([...new Set(userIds)]);

  const isSuperUser = roles.includes('super_user');
  const isSOorQA = user?.id === systemOwnerId || user?.id === qaId;
  const canManage = isSuperUser || isSOorQA;
  const isApproved = reviewCaseStatus === 'approved';
  const isCancelled = reviewCaseStatus === 'cancelled';

  const pendingReview = findings.filter(f => f.status === 'ai_identified');
  const confirmed = findings.filter(f => ['confirmed', 'in_progress', 'closed'].includes(f.status));
  const dismissed = findings.filter(f => f.status === 'dismissed');

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded mb-4" />
        <div className="h-24 bg-muted/50 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t('findings.section.title')}</h3>
          {findings.length > 0 && (
            <Badge variant="secondary" className="text-xs">{findings.length}</Badge>
          )}
          {pendingReview.length > 0 && (
            <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {pendingReview.length} {t('findings.section.pendingReview')}
            </Badge>
          )}
        </div>
        {canManage && !isApproved && !isCancelled && (
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t('findings.actions.addFinding')}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {findings.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-12">
          <div className="text-center space-y-2">
            <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('findings.section.empty')}</p>
          </div>
        </div>
      )}

      {/* Group 1: Pending Human Review */}
      {pendingReview.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            {t('findings.section.pendingHumanReview')} ({pendingReview.length})
          </h4>
          <div className="space-y-2">
            {pendingReview.map(f => (
              <FindingCard
                key={f.id}
                finding={f}
                userNames={userNames}
                variant="pending"
                onConfirm={canManage && !isApproved ? () => setConfirmDialogFinding(f) : undefined}
                onDismiss={canManage && !isApproved ? () => setDismissDialogFinding(f) : undefined}
                onClick={() => setDetailFinding(f)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Group 2: Confirmed Findings */}
      {confirmed.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-foreground">
            {t('findings.section.confirmedFindings')} ({confirmed.length})
          </h4>
          <div className="space-y-2">
            {confirmed.map(f => (
              <FindingCard
                key={f.id}
                finding={f}
                userNames={userNames}
                variant="confirmed"
                onClose={canManage && !isApproved && f.status !== 'closed' ? () => setCloseDialogFinding(f) : undefined}
                onReopen={canManage && !isApproved && f.status === 'closed' ? () => reopenMutation.mutate({ findingId: f.id, reviewCaseId, fromStatus: 'closed' }) : undefined}
                onClick={() => setDetailFinding(f)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Group 3: Dismissed */}
      {dismissed.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            {showDismissed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {t('findings.section.dismissed')} ({dismissed.length})
          </button>
          {showDismissed && (
            <div className="space-y-2 opacity-70">
              {dismissed.map(f => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  userNames={userNames}
                  variant="dismissed"
                  onReopen={canManage && !isApproved ? () => reopenMutation.mutate({ findingId: f.id, reviewCaseId, fromStatus: 'dismissed' }) : undefined}
                  onClick={() => setDetailFinding(f)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      {confirmDialogFinding && (
        <ConfirmFindingDialog
          finding={confirmDialogFinding}
          reviewCaseId={reviewCaseId}
          open={!!confirmDialogFinding}
          onOpenChange={(open) => !open && setConfirmDialogFinding(null)}
          onConfirm={confirmMutation}
        />
      )}
      {dismissDialogFinding && (
        <DismissFindingDialog
          finding={dismissDialogFinding}
          reviewCaseId={reviewCaseId}
          open={!!dismissDialogFinding}
          onOpenChange={(open) => !open && setDismissDialogFinding(null)}
          onDismiss={dismissMutation}
        />
      )}
      {closeDialogFinding && (
        <CloseFindingDialog
          finding={closeDialogFinding}
          reviewCaseId={reviewCaseId}
          open={!!closeDialogFinding}
          onOpenChange={(open) => !open && setCloseDialogFinding(null)}
          onClose={closeMutation}
        />
      )}
      {addDialogOpen && (
        <AddFindingDialog
          reviewCaseId={reviewCaseId}
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
        />
      )}
      {detailFinding && (
        <FindingDetailPanel
          finding={detailFinding}
          reviewCaseId={reviewCaseId}
          userNames={userNames}
          open={!!detailFinding}
          onOpenChange={(open) => !open && setDetailFinding(null)}
          canManage={canManage && !isApproved}
        />
      )}
    </div>
  );
}
