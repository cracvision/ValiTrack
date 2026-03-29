import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ESignatureModal } from '@/components/reviews/ESignatureModal';
import type { ESignatureResult } from '@/components/reviews/ESignatureModal';
import type { ReviewSignoff } from '@/types';

interface ReviewSignoffPanelProps {
  signoffs: ReviewSignoff[];
  isLoading: boolean;
  canSignOff: boolean;
  mySignoff: ReviewSignoff | undefined;
  completedCount: number;
  totalCount: number;
  hasObjections: boolean;
  onSubmitDecision: (args: { decision: 'approved' | 'objected'; comments: string }) => Promise<void>;
  isPending: boolean;
  reviewCaseId?: string;
  reviewCaseStatus?: string;
  systemName?: string;
}

export function ReviewSignoffPanel({
  signoffs,
  isLoading,
  canSignOff,
  mySignoff,
  completedCount,
  totalCount,
  hasObjections,
  onSubmitDecision,
  isPending,
  reviewCaseId,
  reviewCaseStatus,
  systemName,
}: ReviewSignoffPanelProps) {
  const { t } = useTranslation();
  const [comments, setComments] = useState('');
  const [commentsError, setCommentsError] = useState(false);

  // E-signature state
  const [eSignModal, setESignModal] = useState<{
    open: boolean;
    decision: 'approved' | 'objected' | null;
    comments: string;
  }>({ open: false, decision: null, comments: '' });

  const userIds = signoffs.map(s => s.requested_user_id);
  const { data: userNames = {} } = useResolveUserNames(userIds);

  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleDecision = (decision: 'approved' | 'objected') => {
    if (decision === 'objected' && !comments.trim()) {
      setCommentsError(true);
      return;
    }
    setCommentsError(false);

    // Open e-signature modal instead of direct submit
    setESignModal({
      open: true,
      decision,
      comments: comments,
    });
  };

  const handleESignSuccess = async (_result: ESignatureResult) => {
    const { decision, comments: savedComments } = eSignModal;
    setESignModal({ open: false, decision: null, comments: '' });

    if (!decision) return;

    try {
      await onSubmitDecision({ decision, comments: savedComments });
      setComments('');
      toast({ title: t('reviews.actions.transitionSuccess') });
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleESignClose = () => {
    setESignModal({ open: false, decision: null, comments: '' });
  };

  const phaseLabel = reviewCaseStatus === 'plan_review'
    ? t('reviewCases.status.plan_review', { defaultValue: t('reviews.status.plan_review') })
    : t('reviewCases.status.execution_review', { defaultValue: t('reviews.status.execution_review') });

  if (isLoading) return null;
  if (signoffs.length === 0) return null;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t('reviews.signoffs.title')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('reviews.signoffs.description')}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('reviews.signoffs.progress', { completed: completedCount, total: totalCount })}</span>
          {completedCount === totalCount && !hasObjections && (
            <span className="text-green-700 font-medium">✓ {t('reviews.signoffs.allApproved')}</span>
          )}
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Reviewer cards */}
      <div className="space-y-2">
        {signoffs.map(signoff => {
          const name = userNames[signoff.requested_user_id] || '—';
          const roleLabel = signoff.requested_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const isCurrentUser = signoff.id === mySignoff?.id;

          if (signoff.status === 'approved') {
            return (
              <div key={signoff.id} className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-3">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-800">{name}</span>
                    <span className="text-xs text-green-600">({roleLabel})</span>
                  </div>
                  <p className="text-xs text-green-700 mt-0.5">{t('reviews.signoffs.approved')}</p>
                  {signoff.comments && (
                    <p className="text-xs text-green-600 mt-1 italic">"{signoff.comments}"</p>
                  )}
                  {signoff.completed_at && (
                    <p className="text-xs text-green-500 mt-1">
                      {new Date(signoff.completed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            );
          }

          if (signoff.status === 'objected') {
            return (
              <div key={signoff.id} className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3">
                <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-800">{name}</span>
                    <span className="text-xs text-red-600">({roleLabel})</span>
                  </div>
                  <p className="text-xs text-red-700 mt-0.5">{t('reviews.signoffs.objected')}</p>
                  {signoff.comments && (
                    <p className="text-xs text-red-600 mt-1 italic">"{signoff.comments}"</p>
                  )}
                  {signoff.completed_at && (
                    <p className="text-xs text-red-500 mt-1">
                      {new Date(signoff.completed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            );
          }

          // Pending
          if (isCurrentUser && canSignOff) {
            return (
              <div key={signoff.id} className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-medium text-blue-800">{name}</span>
                  <span className="text-xs text-blue-600">({roleLabel})</span>
                </div>
                <p className="text-xs text-blue-700 font-medium">{t('reviews.signoffs.yourSignoff')}</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('reviews.signoffs.commentsOptional')}</Label>
                  <Textarea
                    value={comments}
                    onChange={e => { setComments(e.target.value); setCommentsError(false); }}
                    placeholder={t('reviews.signoffs.commentsPlaceholder')}
                    rows={2}
                    className={cn('text-sm', commentsError && 'border-destructive')}
                  />
                  {commentsError && (
                    <p className="text-xs text-destructive">{t('reviews.signoffs.objectionCommentsRequired')}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleDecision('approved')}
                    disabled={isPending}
                  >
                    {t('reviews.signoffs.noObjectionsButton')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDecision('objected')}
                    disabled={isPending}
                  >
                    {t('reviews.signoffs.raiseObjectionsButton')}
                  </Button>
                </div>
              </div>
            );
          }

          // Pending — other user
          return (
            <div key={signoff.id} className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground">({roleLabel})</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t('reviews.signoffs.pending')}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Objection alert */}
      {hasObjections && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-800">{t('reviews.signoffs.objectionsRaised')}</AlertTitle>
          <AlertDescription className="text-amber-700">
            {t('reviews.signoffs.objectionsDescription')}
          </AlertDescription>
        </Alert>
      )}

      {/* E-Signature Modal */}
      {mySignoff && reviewCaseId && (
        <ESignatureModal
          open={eSignModal.open}
          onClose={handleESignClose}
          onSuccess={handleESignSuccess}
          actionTitle={
            eSignModal.decision === 'approved'
              ? t('reviews.signoffs.noObjectionsButton')
              : t('reviews.signoffs.raiseObjectionsButton')
          }
          actionDescription={
            eSignModal.decision === 'approved'
              ? t('esignature.descriptions.reviewSignoffApprove', {
                  phase: phaseLabel,
                  systemName: systemName || '',
                })
              : t('esignature.descriptions.reviewSignoffObject', {
                  phase: phaseLabel,
                  systemName: systemName || '',
                })
          }
          transitionLabel={`review_signoff:${reviewCaseStatus}:${eSignModal.decision}`}
          resourceId={mySignoff.id}
          resourceType="review_signoff"
          additionalAuditDetails={{
            review_case_id: reviewCaseId,
            phase: reviewCaseStatus,
            decision: eSignModal.decision,
          }}
          showConclusionSelector={false}
          showReasonField={false}
        />
      )}
    </div>
  );
}
