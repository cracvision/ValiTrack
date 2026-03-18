import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { useRoleUsers } from '@/hooks/useRoleUsers';
import {
  GXP_SHORT_LABELS, ENVIRONMENT_SHORT_LABELS, GAMP_SHORT_LABELS,
  SYSTEM_ENVIRONMENT_OPTIONS, GXP_OPTIONS, GAMP_CATEGORY_OPTIONS,
  suggestReviewLevel,
} from '@/lib/gxpClassifications';
import type { SystemProfile, GxPClassification, SystemEnvironment, GampCategory, RiskLevel } from '@/types';

interface Props {
  system: SystemProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (system: SystemProfile) => void;
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

function UserName({ userId, users }: { userId?: string; users: { id: string; full_name: string }[] }) {
  if (!userId) return <p className="text-sm text-muted-foreground">—</p>;
  const user = users.find((u) => u.id === userId);
  return user
    ? <p className="text-sm font-medium text-foreground">{user.full_name}</p>
    : <p className="text-sm text-muted-foreground">—</p>;
}

export function SystemProfileDetailDialog({ system, open, onOpenChange, onEdit }: Props) {
  const { users: owners } = useRoleUsers('system_owner');
  const { users: admins } = useRoleUsers('system_administrator');
  const { users: qaUsers } = useRoleUsers('quality_assurance');
  const { users: businessOwners } = useRoleUsers('business_owner');
  const { users: itManagers } = useRoleUsers('it_manager');

  if (!system) return null;

  const allUsers = [...owners, ...admins, ...qaUsers, ...businessOwners, ...itManagers];
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pr-10">
          <SheetTitle className="text-lg font-semibold text-foreground">{system.name}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{system.system_identifier}</SheetDescription>
        </SheetHeader>

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

        <div className="mt-6 space-y-6">
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
                <UserName userId={system.system_owner_id} users={allUsers} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">System Administrator</p>
                <UserName userId={system.system_admin_id} users={allUsers} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quality Assurance</p>
                <UserName userId={system.qa_id} users={allUsers} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Business Owner</p>
                <UserName userId={system.business_owner_id} users={allUsers} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IT Manager</p>
                <UserName userId={system.it_manager_id} users={allUsers} />
              </div>
            </div>
          </div>

          <Separator />

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
