import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useReviewCaseTransition } from '@/hooks/useReviewCase';
import { useReviewTasks } from '@/hooks/useReviewTasks';
import { getValidTransitions, CONCLUSION_CONFIG } from '@/lib/reviewWorkflow';
import { ESignatureModal } from './ESignatureModal';
import { toast } from '@/hooks/use-toast';
import type { ReviewStatus, ReviewConclusion } from '@/types';
import type { TransitionRule } from '@/lib/reviewWorkflow';
import type { ESignatureResult } from './ESignatureModal';

interface ReviewActionButtonsProps {
  reviewCaseId: string;
  currentStatus: ReviewStatus;
  canAdvanceSignoff?: boolean;
  hasObjections?: boolean;
  reviewTitle?: string;
  systemName?: string;
  systemIdentifier?: string;
}

export function ReviewActionButtons({
  reviewCaseId,
  currentStatus,
  canAdvanceSignoff,
  hasObjections,
  reviewTitle,
  systemName,
  systemIdentifier,
}: ReviewActionButtonsProps) {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const transitionMutation = useReviewCaseTransition();

  // Fetch tasks to check completion for in_progress → execution_review gate
  const { data: tasks } = useReviewTasks(currentStatus === 'in_progress' ? reviewCaseId : undefined);

  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [pendingRule, setPendingRule] = useState<TransitionRule | null>(null);
  const [reason, setReason] = useState('');
  const [conclusion, setConclusion] = useState<ReviewConclusion | ''>('');
  const [conclusionNotes, setConclusionNotes] = useState('');

  // E-signature state
  const [eSignOpen, setESignOpen] = useState(false);

  const allTransitions = getValidTransitions(currentStatus, roles);

  // Separate cancel from normal transitions
  const normalTransitions = allTransitions.filter(r => r.to !== 'cancelled');
  const cancelTransition = allTransitions.find(r => r.to === 'cancelled');

  const getESignatureDescription = (rule: TransitionRule): string => {
    const sysLabel = systemName || '';
    const sysId = systemIdentifier || '';

    if (rule.to === 'cancelled') {
      return t('esignature.descriptions.cancelReview', { systemName: sysLabel, systemId: sysId });
    }
    if (rule.to === 'approved_for_execution') {
      return t('esignature.descriptions.approvePlan', { systemName: sysLabel, systemId: sysId });
    }
    if (rule.to === 'approved') {
      return t('esignature.descriptions.approveReview', { systemName: sysLabel, systemId: sysId });
    }
    if (rule.to === 'rejected') {
      return t('esignature.descriptions.rejectReview', { systemName: sysLabel, systemId: sysId });
    }
    return '';
  };

  const handleTransition = async (rule: TransitionRule) => {
    // If requires e-signature, open the modal instead
    if (rule.requiresESignature) {
      setPendingRule(rule);
      setESignOpen(true);
      return;
    }

    if (rule.requiresConclusion) {
      setPendingRule(rule);
      setApproveDialogOpen(true);
      return;
    }
    if (rule.requiresReason) {
      setPendingRule(rule);
      setReasonDialogOpen(true);
      return;
    }

    try {
      await transitionMutation.mutateAsync({
        reviewCaseId,
        fromStatus: currentStatus,
        toStatus: rule.to,
      });
      toast({ title: t('reviews.actions.transitionSuccess') });
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleESignatureSuccess = async (result: ESignatureResult) => {
    if (!pendingRule) return;

    try {
      await transitionMutation.mutateAsync({
        reviewCaseId,
        fromStatus: currentStatus,
        toStatus: pendingRule.to,
        reason: result.reason || undefined,
        conclusion: result.conclusion as ReviewConclusion | undefined,
      });

      toast({ title: t('reviews.actions.transitionSuccess') });
      setESignOpen(false);
      setPendingRule(null);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      setESignOpen(false);
      setPendingRule(null);
    }
  };

  const handleReasonSubmit = async () => {
    if (!reason.trim() || !pendingRule) return;
    try {
      await transitionMutation.mutateAsync({
        reviewCaseId,
        fromStatus: currentStatus,
        toStatus: pendingRule.to,
        reason: reason.trim(),
      });
      toast({ title: t('reviews.actions.transitionSuccess') });
      setReasonDialogOpen(false);
      setReason('');
      setPendingRule(null);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleApprove = async () => {
    if (!conclusion) return;
    try {
      await transitionMutation.mutateAsync({
        reviewCaseId,
        fromStatus: currentStatus,
        toStatus: 'approved',
        conclusion: conclusion as ReviewConclusion,
        conclusionNotes: conclusionNotes.trim() || undefined,
      });
      toast({ title: t('reviews.actions.transitionSuccess') });
      setApproveDialogOpen(false);
      setConclusion('');
      setConclusionNotes('');
      setPendingRule(null);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  if (normalTransitions.length === 0 && !cancelTransition) return null;

  const getButtonVariant = (rule: TransitionRule) => {
    if (rule.to === 'rejected') return 'destructive' as const;
    if (rule.to === 'approved') return 'default' as const;
    if (rule.requiresReason) return 'outline' as const;
    return 'default' as const;
  };

  const getReasonDialogTitle = () => {
    if (!pendingRule) return '';
    if (pendingRule.to === 'rejected') return t('reviews.actions.rejectTitle');
    return t(pendingRule.labelKey);
  };

  const getReasonDialogDesc = () => {
    if (!pendingRule) return '';
    if (pendingRule.to === 'rejected') return t('reviews.actions.rejectDesc');
    return t('reviews.actions.reasonRequiredDesc');
  };

  return (
    <>
      <TooltipProvider>
        <div className="flex gap-2">
          {normalTransitions.map(rule => {
            const isForwardBlocked =
              canAdvanceSignoff === false && (
                (currentStatus === 'plan_review' && rule.to === 'plan_approval') ||
                (currentStatus === 'execution_review' && (rule.to === 'approved' || rule.to === 'rejected'))
              );

            const isTasksIncomplete =
              currentStatus === 'in_progress' && rule.to === 'execution_review' && tasks &&
              tasks.some(t => t.status !== 'completed');

            const totalTasks = tasks?.length || 0;
            const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;

            const isBlocked = isForwardBlocked || !!isTasksIncomplete;

            const tooltipText = isTasksIncomplete
              ? t('reviews.actions.tasksIncomplete', { completed: completedTasks, total: totalTasks })
              : isForwardBlocked
                ? (hasObjections
                  ? t('reviews.signoffs.blockedObjections')
                  : t('reviews.signoffs.blockedPending'))
                : undefined;

            return (
              <Tooltip key={rule.to}>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant={getButtonVariant(rule)}
                      size="sm"
                      onClick={() => handleTransition(rule)}
                      disabled={transitionMutation.isPending || isBlocked}
                    >
                      {t(rule.labelKey, { defaultValue: rule.label })}
                    </Button>
                  </span>
                </TooltipTrigger>
                {tooltipText && (
                  <TooltipContent className="max-w-xs">{tooltipText}</TooltipContent>
                )}
              </Tooltip>
            );
          })}
          {cancelTransition && <div className="flex-1" />}
          {cancelTransition && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
              onClick={() => handleTransition(cancelTransition)}
              disabled={transitionMutation.isPending}
            >
              <Ban className="h-4 w-4 mr-1.5" />
              {t(cancelTransition.labelKey, { defaultValue: cancelTransition.label })}
            </Button>
          )}
        </div>
      </TooltipProvider>

      {/* E-Signature Modal */}
      <ESignatureModal
        open={eSignOpen}
        onClose={() => { setESignOpen(false); setPendingRule(null); }}
        onSuccess={handleESignatureSuccess}
        actionTitle={pendingRule ? t(pendingRule.labelKey, { defaultValue: pendingRule.label }) : ''}
        actionDescription={pendingRule ? getESignatureDescription(pendingRule) : ''}
        transitionLabel={pendingRule ? `${currentStatus}_to_${pendingRule.to}` : ''}
        resourceId={reviewCaseId}
        resourceType="review_case"
        additionalAuditDetails={{ review_case_id: reviewCaseId }}
        showConclusionSelector={pendingRule?.requiresConclusion === true}
        showReasonField={pendingRule?.to === 'rejected' || pendingRule?.to === 'cancelled'}
      />

      {/* Reason dialog (non-e-sig transitions) */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getReasonDialogTitle()}</DialogTitle>
            <DialogDescription>{getReasonDialogDesc()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('reviews.actions.reason')}</Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t('reviews.actions.reasonPlaceholder')}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setReasonDialogOpen(false); setReason(''); setPendingRule(null); }}>
                {t('userForm.cancel')}
              </Button>
              <Button
                variant={pendingRule?.to === 'rejected' ? 'destructive' : 'default'}
                onClick={handleReasonSubmit}
                disabled={!reason.trim() || transitionMutation.isPending}
              >
                {pendingRule ? t(pendingRule.labelKey, { defaultValue: pendingRule.label }) : t('reviews.actions.confirmReject')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve dialog (non-e-sig path — kept for backwards compat) */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('reviews.actions.approveTitle')}</DialogTitle>
            <DialogDescription>{t('reviews.actions.approveDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('reviews.actions.conclusion')}</Label>
              <Select value={conclusion} onValueChange={v => setConclusion(v as ReviewConclusion)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('reviews.actions.selectConclusion')} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONCLUSION_CONFIG) as ReviewConclusion[]).map(c => (
                    <SelectItem key={c} value={c}>
                      {t(`reviews.conclusion.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('reviews.actions.conclusionNotes')}</Label>
              <Textarea
                value={conclusionNotes}
                onChange={e => setConclusionNotes(e.target.value)}
                placeholder={t('reviews.actions.conclusionNotesPlaceholder')}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setApproveDialogOpen(false); setConclusion(''); setConclusionNotes(''); setPendingRule(null); }}>
                {t('userForm.cancel')}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={!conclusion || transitionMutation.isPending}
              >
                {t('reviews.actions.confirmApprove')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
