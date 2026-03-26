import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { addDays, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { useProfileSignoffs } from '@/hooks/useProfileSignoffs';
import { ProfileSignoffPanel } from '@/components/profiles/ProfileSignoffPanel';
import { ProfileActionButtons } from '@/components/profiles/ProfileActionButtons';
import { ProfileApprovalBadge } from '@/components/profiles/ProfileApprovalBadge';
import {
  GXP_SHORT_LABELS, ENVIRONMENT_SHORT_LABELS, GAMP_SHORT_LABELS,
  SYSTEM_ENVIRONMENT_OPTIONS, GXP_OPTIONS, GAMP_CATEGORY_OPTIONS,
  suggestReviewLevel,
} from '@/lib/gxpClassifications';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { SystemProfile, GxPClassification, SystemEnvironment, GampCategory, RiskLevel, ProfileApprovalStatus, ProfileTransition, ProfileSignoff } from '@/types';

interface Props {
  system: SystemProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (system: SystemProfile) => void;
  onTransition?: (profileId: string, fromStatus: ProfileApprovalStatus, toStatus: ProfileApprovalStatus, reason?: string) => Promise<boolean>;
}

function FieldValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {value ? (
        <p className="text-sm font-medium text-foreground">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground mb-3">{children}</h3>;
}

function UserName({ userId, names }: { userId?: string; names: Record<string, string> }) {
  if (!userId) return <p className="text-sm text-muted-foreground">—</p>;
  const name = names[userId];
  return name
    ? <p className="text-sm font-medium text-foreground">{name}</p>
    : <p className="text-sm text-muted-foreground">—</p>;
}

export function SystemProfileDetailDialog({ system, open, onOpenChange, onEdit, onTransition }: Props) {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const canEdit = (roles.includes('system_owner') || roles.includes('super_user')) && system?.approval_status === 'draft';
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transitionPending, setTransitionPending] = useState(false);

  const { data: userNames = {} } = useResolveUserNames(
    system ? [system.system_owner_id, system.system_admin_id, system.qa_id, system.business_owner_id, system.it_manager_id] : []
  );

  const isInReview = system?.approval_status === 'in_review';

  const {
    signoffs,
    isLoading: signoffsLoading,
    canAdvance,
    hasObjections,
    canSignOff,
    mySignoff,
    completedCount,
    totalCount,
    submitDecision,
  } = useProfileSignoffs({ systemProfileId: isInReview ? system?.id : undefined });

  const { data: transitions = [] } = useQuery({
    queryKey: ['profile-transitions', system?.id],
    queryFn: async (): Promise<ProfileTransition[]> => {
      if (!system?.id) return [];
      const { data, error } = await supabase
        .from('profile_transitions')
        .select('*')
        .eq('system_profile_id', system.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as ProfileTransition[];
    },
    enabled: !!system?.id,
  });

  const { data: completedSignoffs = [] } = useQuery({
    queryKey: ['profile-signoffs-history', system?.id],
    queryFn: async (): Promise<ProfileSignoff[]> => {
      if (!system?.id) return [];
      const { data, error } = await supabase
        .from('profile_signoffs')
        .select('*')
        .eq('system_profile_id', system.id)
        .eq('is_deleted', false)
        .neq('status', 'pending')
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProfileSignoff[];
    },
    enabled: !!system?.id,
  });

  const allHistoryUserIds = [
    ...transitions.map(t => t.transitioned_by),
    ...completedSignoffs.map(s => s.requested_user_id),
  ].filter(Boolean);
  const { data: historyNames = {} } = useResolveUserNames(allHistoryUserIds);

  type TimelineEntry =
    | { type: 'transition'; timestamp: string; data: ProfileTransition }
    | { type: 'signoff'; timestamp: string; data: ProfileSignoff };

  const timelineEntries: TimelineEntry[] = [
    ...transitions.map(tr => ({
      type: 'transition' as const,
      timestamp: tr.created_at,
      data: tr,
    })),
    ...completedSignoffs.map(s => ({
      type: 'signoff' as const,
      timestamp: s.completed_at || s.created_at,
      data: s,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const ROLE_DISPLAY_KEYS: Record<string, string> = {
    system_administrator: 'systemProfiles.detail.systemAdministrator',
    quality_assurance: 'systemProfiles.detail.qualityAssurance',
    business_owner: 'systemProfiles.detail.businessOwner',
    it_manager: 'systemProfiles.detail.itManager',
    system_owner: 'systemProfiles.detail.systemOwner',
  };

  if (!system) return null;

  const envLabel = SYSTEM_ENVIRONMENT_OPTIONS.find((e) => e.value === system.system_environment)?.label
    ?? ENVIRONMENT_SHORT_LABELS[system.system_environment as SystemEnvironment]
    ?? system.system_environment;
  const gxpLabel = GXP_OPTIONS.find((o) => o.value === system.gxp_classification)?.label
    ?? GXP_SHORT_LABELS[system.gxp_classification as GxPClassification]
    ?? system.gxp_classification;
  const gampLabel = GAMP_CATEGORY_OPTIONS.find((o) => o.value === system.gamp_category)?.label
    ?? GAMP_SHORT_LABELS[system.gamp_category as GampCategory]
    ?? system.gamp_category;
  const reviewLevel = suggestReviewLevel(system.risk_level as RiskLevel, system.gamp_category as GampCategory);

  const handleTransition = async (toStatus: ProfileApprovalStatus, reason?: string) => {
    if (!onTransition) return;
    setTransitionPending(true);
    try {
      await onTransition(system.id, system.approval_status as ProfileApprovalStatus, toStatus, reason);
    } finally {
      setTransitionPending(false);
    }
  };

  const approvalStatusLabel = {
    draft: t('systemProfiles.approval.status.draft'),
    in_review: t('systemProfiles.approval.status.inReview'),
    approved: t('systemProfiles.approval.status.approved'),
  };

  const transitionStatusLabel = (status: string) => {
    return approvalStatusLabel[status as ProfileApprovalStatus] ?? status;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pr-10">
          <SheetTitle className="text-lg font-semibold text-foreground">{system.name}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{system.system_identifier}</SheetDescription>
        </SheetHeader>

        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="absolute right-12 top-4"
            onClick={() => {
              onOpenChange(false);
              onEdit(system);
            }}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t('common.edit')}
          </Button>
        )}

        <div className="mt-6 space-y-6">
          {/* Approval Status + Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ProfileApprovalBadge status={system.approval_status as ProfileApprovalStatus} />
            </div>

            {system.approval_status === 'in_review' && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-blue-800 text-xs font-medium">{t('systemProfiles.approval.banners.inReviewReadonly')}</AlertTitle>
              </Alert>
            )}
            {system.approval_status === 'approved' && (
              <Alert className="bg-green-50 border-green-200">
                <AlertTitle className="text-green-800 text-xs font-medium">{t('systemProfiles.approval.banners.approvedReadonly')}</AlertTitle>
              </Alert>
            )}

            {isInReview && hasObjections && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-800">{t('systemProfiles.approval.signoffs.objectionsRaised')}</AlertTitle>
                <AlertDescription className="text-amber-700">
                  {t('systemProfiles.approval.signoffs.objectionsDescription')}
                </AlertDescription>
              </Alert>
            )}

            {onTransition && (
              <ProfileActionButtons
                system={system}
                canAdvance={canAdvance}
                hasObjections={hasObjections}
                onTransition={handleTransition}
                isPending={transitionPending}
              />
            )}
          </div>

          {isInReview && (
            <>
              <ProfileSignoffPanel
                signoffs={signoffs}
                isLoading={signoffsLoading}
                canSignOff={canSignOff}
                mySignoff={mySignoff}
                completedCount={completedCount}
                totalCount={totalCount}
                hasObjections={hasObjections}
                onSubmitDecision={async (args) => {
                  await submitDecision.mutateAsync(args);
                }}
                isPending={submitDecision.isPending}
              />
              <Separator />
            </>
          )}

          {/* System Information */}
          <div>
            <SectionTitle>{t('systemProfiles.detail.systemInfo')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldValue label={t('systemProfiles.detail.systemName')} value={system.name} />
              <FieldValue label={t('systemProfiles.detail.identifier')} value={system.system_identifier} />
              <FieldValue label={t('systemProfiles.detail.environment')} value={envLabel} />
              <FieldValue label={t('systemProfiles.detail.status')} value={system.status} />
            </div>
            <div className="mt-3 space-y-3">
              <FieldValue label={t('systemProfiles.detail.description')} value={system.description} />
              <FieldValue label={t('systemProfiles.detail.intendedUse')} value={system.intended_use} />
            </div>
          </div>

          <Separator />

          {/* Classification & Risk */}
          <div>
            <SectionTitle>{t('systemProfiles.detail.classificationRisk')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldValue label={t('systemProfiles.detail.gxpClassification')} value={gxpLabel} />
              <FieldValue label={t('systemProfiles.detail.riskLevel')} value={system.risk_level} />
              <FieldValue label={t('systemProfiles.detail.gampCategory')} value={gampLabel} />
              <FieldValue label={t('systemProfiles.detail.reviewLevel')} value={reviewLevel ? t('common.level', { level: reviewLevel }) : null} />
            </div>
          </div>

          <Separator />

          {/* Vendor Information */}
          <div>
            <SectionTitle>{t('systemProfiles.detail.vendorInfo')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldValue label={t('systemProfiles.detail.vendorName')} value={system.vendor_name} />
              <FieldValue label={t('systemProfiles.detail.contact')} value={system.vendor_contact} />
              <FieldValue label={t('systemProfiles.detail.contractRef')} value={system.vendor_contract_ref} />
            </div>
          </div>

          <Separator />

          {/* Review Schedule */}
          <div>
            <SectionTitle>{t('systemProfiles.detail.reviewSchedule')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldValue label={t('systemProfiles.detail.initialValidationDate')} value={system.initial_validation_date ? new Date(system.initial_validation_date).toLocaleDateString() : null} />
              <FieldValue label={t('systemProfiles.detail.lastReviewedThrough')} value={system.last_review_period_end ? new Date(system.last_review_period_end).toLocaleDateString() : t('systemProfiles.form.noPreviousReview')} />
              <FieldValue label={t('systemProfiles.detail.reviewPeriod')} value={system.review_period_months ? t('systemProfiles.detail.reviewPeriodValue', { months: system.review_period_months }) : null} />
              <FieldValue label={t('systemProfiles.detail.completionWindow')} value={`${system.completion_window_days ?? 90} ${t('systemProfiles.form.completionWindowDays')}`} />
              <FieldValue label={t('systemProfiles.detail.nextReviewDate')} value={system.next_review_date ? new Date(system.next_review_date).toLocaleDateString() : null} />
              <CompletionDueDateField
                nextReviewDate={system.next_review_date}
                completionWindowDays={system.completion_window_days}
                t={t}
              />
            </div>
          </div>

          <Separator />

          {/* Role Assignments */}
          <div>
            <SectionTitle>{t('systemProfiles.detail.roleAssignments')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-xs text-muted-foreground">{t('systemProfiles.detail.systemOwner')}</p>
                <UserName userId={system.system_owner_id} names={userNames} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('systemProfiles.detail.systemAdministrator')}</p>
                <UserName userId={system.system_admin_id} names={userNames} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('systemProfiles.detail.qualityAssurance')}</p>
                <UserName userId={system.qa_id} names={userNames} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('systemProfiles.detail.businessOwner')}</p>
                <UserName userId={system.business_owner_id} names={userNames} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('systemProfiles.detail.itManager')}</p>
                <UserName userId={system.it_manager_id} names={userNames} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Approval History */}
          {timelineEntries.length > 0 && (
            <>
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground cursor-pointer hover:text-foreground/80">
                  {historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {t('systemProfiles.approval.transitions.title')}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {timelineEntries.map(entry => {
                    if (entry.type === 'transition') {
                      const tr = entry.data;
                      return (
                        <div key={`tr-${tr.id}`} className="flex items-start gap-3 text-xs border rounded-md p-2 bg-muted/20">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground">{historyNames[tr.transitioned_by] || '—'}</span>
                              <span className="text-muted-foreground">
                                {transitionStatusLabel(tr.from_status)} → {transitionStatusLabel(tr.to_status)}
                              </span>
                            </div>
                            {tr.reason && (
                              <p className="text-muted-foreground mt-0.5 italic">
                                {t('systemProfiles.approval.transitions.returnReason')}: {tr.reason}
                              </p>
                            )}
                            <p className="text-muted-foreground/70 mt-0.5">
                              {new Date(tr.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    } else {
                      const s = entry.data;
                      const isApproved = s.status === 'approved';
                      const roleLabel = ROLE_DISPLAY_KEYS[s.requested_role]
                        ? t(ROLE_DISPLAY_KEYS[s.requested_role])
                        : s.requested_role;
                      return (
                        <div key={`so-${s.id}`} className="flex items-start gap-3 text-xs border rounded-md p-2 bg-muted/20">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground">{historyNames[s.requested_user_id] || '—'}</span>
                              <span className="text-muted-foreground">({roleLabel})</span>
                              <span className={isApproved ? 'text-green-700' : 'text-destructive'}>
                                {isApproved
                                  ? t('systemProfiles.approval.signoffs.approved')
                                  : t('systemProfiles.approval.signoffs.objected')}
                              </span>
                            </div>
                            {s.comments && (
                              <p className="text-muted-foreground mt-0.5 italic">
                                "{s.comments}"
                              </p>
                            )}
                            <p className="text-muted-foreground/70 mt-0.5">
                              {s.completed_at ? new Date(s.completed_at).toLocaleString() : new Date(s.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  })}
                </CollapsibleContent>
              </Collapsible>
              <Separator />
            </>
          )}

          {/* Timestamps */}
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>{t('systemProfiles.detail.created')}: {new Date(system.created_at).toLocaleDateString()}</span>
            <span>{t('systemProfiles.detail.lastUpdated')}: {new Date(system.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
