import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
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

  // Fetch transition history
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

  const transitionUserIds = transitions.map(t => t.transitioned_by).filter(Boolean);
  const { data: transitionNames = {} } = useResolveUserNames(transitionUserIds);

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
            Edit
          </Button>
        )}

        <div className="mt-6 space-y-6">
          {/* Approval Status + Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ProfileApprovalBadge status={system.approval_status as ProfileApprovalStatus} />
            </div>

            {/* Read-only banners */}
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

            {/* Objection banner */}
            {isInReview && hasObjections && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-800">{t('systemProfiles.approval.signoffs.objectionsRaised')}</AlertTitle>
                <AlertDescription className="text-amber-700">
                  {t('systemProfiles.approval.signoffs.objectionsDescription')}
                </AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
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

          {/* Sign-off panel (only in_review) */}
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
            <SectionTitle>System Information</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldValue label="System Name" value={system.name} />
              <FieldValue label="Identifier" value={system.system_identifier} />
              <FieldValue label="Environment" value={envLabel} />
              <FieldValue label="Status" value={system.status} />
            </div>
            <div className="mt-3 space-y-3">
              <FieldValue label="Intended Use" value={system.intended_use} />
              <FieldValue label="Description" value={system.description} />
            </div>
          </div>

          <Separator />

          {/* Classification & Risk */}
          <div>
            <SectionTitle>Classification &amp; Risk</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldValue label="GxP Classification" value={gxpLabel} />
              <FieldValue label="Risk Level" value={system.risk_level} />
              <FieldValue label="GAMP Category" value={gampLabel} />
              <FieldValue label="Review Level" value={reviewLevel ? `Level ${reviewLevel}` : null} />
            </div>
          </div>

          <Separator />

          {/* Vendor Information */}
          <div>
            <SectionTitle>Vendor Information</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldValue label="Vendor Name" value={system.vendor_name} />
              <FieldValue label="Contact" value={system.vendor_contact} />
              <FieldValue label="Contract Reference" value={system.vendor_contract_ref} />
            </div>
          </div>

          <Separator />

          {/* Review Schedule */}
          <div>
            <SectionTitle>Review Schedule</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldValue label="Last Validation Date" value={system.validation_date ? new Date(system.validation_date).toLocaleDateString() : null} />
              <FieldValue label="Review Period" value={system.review_period_months ? `${system.review_period_months} months` : null} />
              <FieldValue label="Next Review Date" value={system.next_review_date ? new Date(system.next_review_date).toLocaleDateString() : null} />
            </div>
          </div>

          <Separator />

          {/* Role Assignments */}
          <div>
            <SectionTitle>Role Assignments</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-xs text-muted-foreground">System Owner</p>
                <UserName userId={system.system_owner_id} names={userNames} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">System Administrator</p>
                <UserName userId={system.system_admin_id} names={userNames} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quality Assurance</p>
                <UserName userId={system.qa_id} names={userNames} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Business Owner</p>
                <UserName userId={system.business_owner_id} names={userNames} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IT Manager</p>
                <UserName userId={system.it_manager_id} names={userNames} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Approval History */}
          {transitions.length > 0 && (
            <>
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground cursor-pointer hover:text-foreground/80">
                  {historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {t('systemProfiles.approval.transitions.title')}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {transitions.map(tr => (
                    <div key={tr.id} className="flex items-start gap-3 text-xs border rounded-md p-2 bg-muted/20">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-foreground">{transitionNames[tr.transitioned_by] || '—'}</span>
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
                  ))}
                </CollapsibleContent>
              </Collapsible>
              <Separator />
            </>
          )}

          {/* Timestamps */}
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>Created: {new Date(system.created_at).toLocaleDateString()}</span>
            <span>Last updated: {new Date(system.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
