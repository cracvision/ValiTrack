import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useReviewCaseTransition } from '@/hooks/useReviewCase';
import { getValidTransitions, TRANSITION_BUTTON_KEYS, CONCLUSION_CONFIG } from '@/lib/reviewWorkflow';
import { toast } from '@/hooks/use-toast';
import type { ReviewStatus, ReviewConclusion } from '@/types';

interface ReviewActionButtonsProps {
  reviewCaseId: string;
  currentStatus: ReviewStatus;
}

export function ReviewActionButtons({ reviewCaseId, currentStatus }: ReviewActionButtonsProps) {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const transitionMutation = useReviewCaseTransition();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [conclusion, setConclusion] = useState<ReviewConclusion | ''>('');
  const [conclusionNotes, setConclusionNotes] = useState('');

  const validTransitions = getValidTransitions(currentStatus, roles);

  const handleTransition = async (toStatus: ReviewStatus) => {
    if (toStatus === 'rejected') {
      setRejectDialogOpen(true);
      return;
    }
    if (toStatus === 'approved') {
      setApproveDialogOpen(true);
      return;
    }

    try {
      await transitionMutation.mutateAsync({
        reviewCaseId,
        fromStatus: currentStatus,
        toStatus,
      });
      toast({ title: t('reviews.actions.transitionSuccess') });
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    try {
      await transitionMutation.mutateAsync({
        reviewCaseId,
        fromStatus: currentStatus,
        toStatus: 'rejected',
        reason: reason.trim(),
      });
      toast({ title: t('reviews.actions.transitionSuccess') });
      setRejectDialogOpen(false);
      setReason('');
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
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  if (validTransitions.length === 0) return null;

  return (
    <>
      <div className="flex gap-2">
        {validTransitions.map(rule => {
          const key = `${currentStatus}->${rule.to}`;
          const labelKey = TRANSITION_BUTTON_KEYS[key] || `reviews.actions.${rule.to}`;
          const isDestructive = rule.to === 'rejected';

          return (
            <Button
              key={rule.to}
              variant={isDestructive ? 'destructive' : rule.to === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTransition(rule.to)}
              disabled={transitionMutation.isPending}
            >
              {t(labelKey)}
            </Button>
          );
        })}
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('reviews.actions.rejectTitle')}</DialogTitle>
            <DialogDescription>{t('reviews.actions.rejectDesc')}</DialogDescription>
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
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                {t('userForm.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!reason.trim() || transitionMutation.isPending}
              >
                {t('reviews.actions.confirmReject')}
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
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
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
