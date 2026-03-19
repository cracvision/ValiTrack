import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useReviewCase } from '@/hooks/useReviewCase';
import { useReviewTransitions } from '@/hooks/useReviewTransitions';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { ReviewStatusBadge } from '@/components/reviews/ReviewStatusBadge';
import { ReviewWorkflowStepper } from '@/components/reviews/ReviewWorkflowStepper';
import { ReviewActionButtons } from '@/components/reviews/ReviewActionButtons';
import { TransitionHistory } from '@/components/reviews/TransitionHistory';
import { REVIEW_LEVEL_CONFIG, CONCLUSION_CONFIG } from '@/lib/reviewWorkflow';
import { GXP_SHORT_LABELS, GAMP_SHORT_LABELS } from '@/lib/gxpClassifications';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReviewLevel, ReviewConclusion, GxPClassification, GampCategory } from '@/types';

export default function ReviewCaseDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: reviewCase, isLoading } = useReviewCase(id);
  const { data: transitions = [] } = useReviewTransitions(id);

  const { data: userNames = {} } = useResolveUserNames(
    reviewCase
      ? [reviewCase.system_owner_id, reviewCase.system_admin_id, reviewCase.qa_id, reviewCase.business_owner_id, reviewCase.it_manager_id, reviewCase.initiated_by]
      : []
  );

  const { data: templateCount = 0 } = useQuery({
    queryKey: ['template-count', reviewCase?.review_level],
    queryFn: async () => {
      if (!reviewCase) return 0;
      const { count, error } = await supabase
        .from('task_templates')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('is_active', true)
        .lte('review_level_min', parseInt(reviewCase.review_level));
      if (error) throw error;
      return count || 0;
    },
    enabled: !!reviewCase,
  });

  const { data: groupCount = 0 } = useQuery({
    queryKey: ['template-groups', reviewCase?.review_level],
    queryFn: async () => {
      if (!reviewCase) return 0;
      const { data, error } = await supabase
        .from('task_templates')
        .select('task_group')
        .eq('is_deleted', false)
        .eq('is_active', true)
        .lte('review_level_min', parseInt(reviewCase.review_level));
      if (error) throw error;
      const groups = new Set((data || []).map((d: any) => d.task_group));
      return groups.size;
    },
    enabled: !!reviewCase,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!reviewCase) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t('reviews.detail.notFound')}</p>
        <Button variant="link" onClick={() => navigate('/reviews')}>
          {t('reviews.detail.backToList')}
        </Button>
      </div>
    );
  }

  const levelConfig = REVIEW_LEVEL_CONFIG[reviewCase.review_level as ReviewLevel];
  const conclusionConfig = reviewCase.conclusion ? CONCLUSION_CONFIG[reviewCase.conclusion as ReviewConclusion] : null;
  const snapshot = reviewCase.frozen_system_snapshot as Record<string, any>;
  const resolveName = (id: string | undefined) => (id ? userNames[id] || '—' : '—');

  // Task placeholder message based on current status
  const getTaskMessage = () => {
    const s = reviewCase.status;
    if (s === 'draft' || s === 'plan_review' || s === 'plan_approval') {
      return t('reviews.detail.tasksBeforeApproval');
    }
    if (s === 'approved_for_execution') {
      return t('reviews.detail.tasksApprovedWaiting');
    }
    return t('reviews.detail.tasksFutureUpdate');
  };

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div>
        <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate('/reviews')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          {t('reviews.detail.backToList')}
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{reviewCase.title}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{reviewCase.system_name}</Badge>
            <ReviewStatusBadge status={reviewCase.status} />
            {conclusionConfig && (
              <Badge className={`text-xs ${conclusionConfig.className}`}>
                {t(`reviews.conclusion.${reviewCase.conclusion}`)}
              </Badge>
            )}
          </div>
        </div>
        <ReviewActionButtons reviewCaseId={reviewCase.id} currentStatus={reviewCase.status} />
      </div>

      {/* Rejection alert banner */}
      {reviewCase.status === 'rejected' && (() => {
        const rejectionTransition = transitions.find(t => t.to_status === 'rejected');
        const rejectorName = rejectionTransition?.transitioned_by_name || 'System';
        const reason = rejectionTransition?.reason || '';
        return (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {rejectorName} {t('reviews.detail.rejectedThis')}{reason ? `: '${reason}'` : ''}
            </AlertTitle>
            <AlertDescription className="text-destructive/80">
              {t('reviews.detail.returnToDraft')}
            </AlertDescription>
          </Alert>
        );
      })()}

      {/* Plan approval banner */}
      {reviewCase.status === 'plan_approval' && (
        <Alert className="bg-blue-50 border-blue-200">
          <ShieldCheck className="h-4 w-4 text-blue-700" />
          <AlertTitle className="text-blue-800">{t('reviews.banners.planApprovalTitle')}</AlertTitle>
          <AlertDescription className="text-blue-700">
            {t('reviews.banners.planApproval')}
          </AlertDescription>
        </Alert>
      )}

      {/* Approved for execution banner */}
      {reviewCase.status === 'approved_for_execution' && (
        <Alert className="bg-teal-50 border-teal-200">
          <ShieldCheck className="h-4 w-4 text-teal-700" />
          <AlertTitle className="text-teal-800">{t('reviews.banners.approvedForExecutionTitle')}</AlertTitle>
          <AlertDescription className="text-teal-700">
            {t('reviews.banners.approvedForExecution')}
          </AlertDescription>
        </Alert>
      )}

      {/* Workflow stepper */}
      <ReviewWorkflowStepper currentStatus={reviewCase.status} />

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Review details */}
        <div className="space-y-6">
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('reviews.detail.reviewDetails')}</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">{t('reviews.detail.period')}</dt>
              <dd>{reviewCase.review_period_start} — {reviewCase.review_period_end}</dd>
              <dt className="text-muted-foreground">{t('reviews.detail.level')}</dt>
              <dd>
                <span className="font-medium">{levelConfig?.label}</span>
                <span className="text-muted-foreground text-xs ml-1">({levelConfig?.description})</span>
              </dd>
              <dt className="text-muted-foreground">{t('reviews.detail.dueDate')}</dt>
              <dd>{reviewCase.due_date}</dd>
              <dt className="text-muted-foreground">{t('reviews.detail.initiatedBy')}</dt>
              <dd>{resolveName(reviewCase.initiated_by)}</dd>
              <dt className="text-muted-foreground">{t('reviews.detail.created')}</dt>
              <dd>{new Date(reviewCase.created_at).toLocaleDateString()}</dd>
            </dl>
          </div>

          {/* Role assignments */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('reviews.detail.roleAssignments')}</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">{t('reviews.detail.roles.systemOwner')}</dt>
              <dd>{resolveName(reviewCase.system_owner_id)}</dd>
              <dt className="text-muted-foreground">{t('reviews.detail.roles.systemAdmin')}</dt>
              <dd>{resolveName(reviewCase.system_admin_id)}</dd>
              <dt className="text-muted-foreground">{t('reviews.detail.roles.qa')}</dt>
              <dd>{resolveName(reviewCase.qa_id)}</dd>
              <dt className="text-muted-foreground">{t('reviews.detail.roles.businessOwner')}</dt>
              <dd>{resolveName(reviewCase.business_owner_id)}</dd>
              {reviewCase.it_manager_id && (
                <>
                  <dt className="text-muted-foreground">{t('reviews.detail.roles.itManager')}</dt>
                  <dd>{resolveName(reviewCase.it_manager_id)}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Right: Frozen snapshot */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t('reviews.detail.frozenSnapshot')}</h3>
          <p className="text-xs text-muted-foreground">{t('reviews.detail.frozenSnapshotDesc')}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">{t('reviews.detail.snapshot.name')}</dt>
            <dd>{snapshot.name}</dd>
            <dt className="text-muted-foreground">{t('reviews.detail.snapshot.gxp')}</dt>
            <dd>{GXP_SHORT_LABELS[snapshot.gxp_classification as GxPClassification] ?? snapshot.gxp_classification}</dd>
            <dt className="text-muted-foreground">{t('reviews.detail.snapshot.gamp')}</dt>
            <dd>{GAMP_SHORT_LABELS[snapshot.gamp_category as GampCategory] ?? snapshot.gamp_category}</dd>
            <dt className="text-muted-foreground">{t('reviews.detail.snapshot.risk')}</dt>
            <dd>{snapshot.risk_level}</dd>
            <dt className="text-muted-foreground">{t('reviews.detail.snapshot.vendor')}</dt>
            <dd>{snapshot.vendor_name || '—'}</dd>
            <dt className="text-muted-foreground">{t('reviews.detail.snapshot.validationDate')}</dt>
            <dd>{snapshot.validation_date}</dd>
            <dt className="text-muted-foreground col-span-2">{t('reviews.detail.snapshot.intendedUse')}</dt>
            <dd className="col-span-2 text-xs">{snapshot.intended_use || '—'}</dd>
          </dl>
        </div>
      </div>

      {/* Tasks placeholder */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('reviews.detail.tasksTitle')}</h3>
        <div className="flex items-start gap-2 bg-muted/50 rounded p-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{getTaskMessage()}</p>
            <p className="font-medium">
              {t('reviews.detail.tasksPreview', {
                level: levelConfig?.label,
                count: templateCount,
                groups: groupCount,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Transition history */}
      <TransitionHistory transitions={transitions} />
    </div>
  );
}
