import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useReviewCaseTransition } from '@/hooks/useReviewCase';
import { getValidTransitions, CONCLUSION_CONFIG } from '@/lib/reviewWorkflow';
import { toast } from '@/hooks/use-toast';
import type { ReviewStatus, ReviewConclusion } from '@/types';
import type { TransitionRule } from '@/lib/reviewWorkflow';

interface ReviewActionButtonsProps {
  reviewCaseId: string;
  currentStatus: ReviewStatus;
}

export function ReviewActionButtons({ reviewCaseId, currentStatus }: ReviewActionButtonsProps) {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const transitionMutation = useReviewCaseTransition();

  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [pendingRule, setPendingRule] = useState<TransitionRule | null>(null);
  const [reason, setReason] = useState('');
  const [conclusion, setConclusion] = useState<ReviewConclusion | ''>('');
  const [conclusionNotes, setConclusionNotes] = useState('');

  const validTransitions = getValidTransitions(currentStatus, roles);

  const handleTransition = async (rule: TransitionRule) => {
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

  if (validTransitions.length === 0) return null;

  const getButtonVariant = (rule: TransitionRule) => {
    if (rule.to === 'rejected') return 'destructive' as const;
    if (rule.to === 'approved') return 'default' as const;
    if (rule.requiresReason) return 'outline' as const;
    return 'default' as const;
  };

  // Determine dialog title based on the pending transition
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
      <div className="flex gap-2">
        {validTransitions.map(rule => (
          <Button
            key={rule.to}
            variant={getButtonVariant(rule)}
            size="sm"
            onClick={() => handleTransition(rule)}
            disabled={transitionMutation.isPending}
          >
            {t(rule.labelKey, { defaultValue: rule.label })}
          </Button>
        ))}
      </div>

      {/* Reason dialog — reused for rejections AND return/step-back transitions */}
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

      {/* Approve dialog */}
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
