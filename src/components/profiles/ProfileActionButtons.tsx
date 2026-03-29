import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { getProfileTransitions, type ProfileTransitionRule } from '@/lib/profileApprovalWorkflow';
import { ESignatureModal } from '@/components/reviews/ESignatureModal';
import type { ESignatureResult } from '@/components/reviews/ESignatureModal';
import { toast } from '@/hooks/use-toast';
import type { ProfileApprovalStatus, SystemProfile } from '@/types';

interface ProfileActionButtonsProps {
  system: SystemProfile;
  canAdvance?: boolean;
  hasObjections?: boolean;
  onTransition: (toStatus: ProfileApprovalStatus, reason?: string) => Promise<void>;
  isPending?: boolean;
}

export function ProfileActionButtons({
  system,
  canAdvance,
  hasObjections,
  onTransition,
  isPending,
}: ProfileActionButtonsProps) {
  const { t } = useTranslation();
  const { roles } = useAuth();

  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [pendingRule, setPendingRule] = useState<ProfileTransitionRule | null>(null);
  const [reason, setReason] = useState('');

  // E-signature state
  const [eSignOpen, setESignOpen] = useState(false);
  const [eSignRule, setESignRule] = useState<ProfileTransitionRule | null>(null);

  const approvalStatus = system.approval_status ?? 'draft';
  const transitions = getProfileTransitions(approvalStatus as ProfileApprovalStatus, roles);

  // Validation gate: block "Submit for review" if required reviewers are not assigned
  const missingReviewers = !system.system_admin_id || !system.qa_id || !system.business_owner_id;

  const handleTransition = async (rule: ProfileTransitionRule) => {
    // If requires e-signature, open modal
    if (rule.requiresESignature) {
      setESignRule(rule);
      setESignOpen(true);
      return;
    }

    if (rule.requiresReason) {
      setPendingRule(rule);
      setReasonDialogOpen(true);
      return;
    }
    try {
      await onTransition(rule.to);
      toast({ title: t('reviews.actions.transitionSuccess') });
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleESignSuccess = async (_result: ESignatureResult) => {
    if (!eSignRule) return;
    setESignOpen(false);
    try {
      await onTransition(eSignRule.to);
      toast({ title: t('reviews.actions.transitionSuccess') });
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
    setESignRule(null);
  };

  const handleReasonSubmit = async () => {
    if (!reason.trim() || !pendingRule) return;
    try {
      await onTransition(pendingRule.to, reason.trim());
      toast({ title: t('reviews.actions.transitionSuccess') });
      setReasonDialogOpen(false);
      setReason('');
      setPendingRule(null);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  if (transitions.length === 0) return null;

  return (
    <>
      <div className="flex gap-2">
        {transitions.map(rule => {
          // Block forward from in_review → approved unless canAdvance
          const isForwardBlocked =
            approvalStatus === 'in_review' && rule.to === 'approved' && !canAdvance;

          // Block submit for review if required reviewers missing
          const isMissingReviewers =
            approvalStatus === 'draft' && rule.to === 'in_review' && missingReviewers;

          const isDisabled = isPending || isForwardBlocked || isMissingReviewers;

          let tooltipText: string | undefined;
          if (isMissingReviewers) {
            tooltipText = t('systemProfiles.approval.signoffs.missingReviewers');
          } else if (isForwardBlocked) {
            tooltipText = hasObjections
              ? t('systemProfiles.approval.signoffs.blockedObjections')
              : t('systemProfiles.approval.signoffs.blockedPending');
          }

          const variant = rule.requiresReason ? 'outline' as const : 'default' as const;

          return (
            <Button
              key={rule.to + rule.labelKey}
              variant={variant}
              size="sm"
              onClick={() => handleTransition(rule)}
              disabled={isDisabled}
              title={tooltipText}
            >
              {t(rule.labelKey, { defaultValue: rule.label })}
            </Button>
          );
        })}
      </div>

      {/* E-Signature Modal for profile approval */}
      <ESignatureModal
        open={eSignOpen}
        onClose={() => { setESignOpen(false); setESignRule(null); }}
        onSuccess={handleESignSuccess}
        actionTitle={eSignRule ? t(eSignRule.labelKey, { defaultValue: eSignRule.label }) : ''}
        actionDescription={t('esignature.descriptions.approveProfile', {
          systemName: system.name,
          systemId: system.system_identifier,
        })}
        transitionLabel="system_profile:in_review→approved"
        resourceId={system.id}
        resourceType="system_profile"
        showConclusionSelector={false}
        showReasonField={false}
      />

      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingRule ? t(pendingRule.labelKey, { defaultValue: pendingRule.label }) : ''}</DialogTitle>
            <DialogDescription>{t('reviews.actions.reasonRequiredDesc')}</DialogDescription>
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
              <Button onClick={handleReasonSubmit} disabled={!reason.trim() || isPending}>
                {pendingRule ? t(pendingRule.labelKey, { defaultValue: pendingRule.label }) : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
