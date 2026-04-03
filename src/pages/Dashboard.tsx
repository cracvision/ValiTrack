import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardSystems } from '@/hooks/useDashboardSystems';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { MySystemsSection } from '@/components/dashboard/MySystemsSection';
import { MyTasksSection } from '@/components/dashboard/MyTasksSection';
import { PendingApprovalsSection } from '@/components/dashboard/PendingApprovalsSection';
import { FindingsAlertSection } from '@/components/dashboard/FindingsAlertSection';
import { PlatformHealthSection } from '@/components/dashboard/PlatformHealthSection';
import { ComplianceSnapshotSection } from '@/components/dashboard/ComplianceSnapshotSection';
import { RecentActivitySection } from '@/components/dashboard/RecentActivitySection';
import { Button } from '@/components/ui/button';
import { sendNotification } from '@/lib/notifications';
import { toast } from 'sonner';
import { useState } from 'react';

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 18) return 'dashboard.greeting.afternoon';
  return 'dashboard.greeting.evening';
}

function getRoleSubtitleKey(roles: string[]): string {
  if (roles.includes('super_user')) return 'dashboard.subtitle.super_user';
  if (roles.includes('quality_assurance')) return 'dashboard.subtitle.quality_assurance';
  if (roles.includes('system_owner')) return 'dashboard.subtitle.system_owner';
  if (roles.includes('system_administrator')) return 'dashboard.subtitle.system_administrator';
  if (roles.includes('business_owner')) return 'dashboard.subtitle.business_owner';
  if (roles.includes('it_manager')) return 'dashboard.subtitle.it_manager';
  return 'dashboard.subtitle.system_owner';
}

function DashboardSkeleton({ isSuperUser }: { isSuperUser: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-72 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      {isSuperUser && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-8 w-12 mb-2" />
              <Skeleton className="h-3 w-32" />
            </Card>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-3 w-24 mb-4" />
            <div className="flex gap-1.5 mb-3">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-10" />
            </div>
            <Skeleton className="h-8 w-full mb-3" />
            <Skeleton className="h-6 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { profile, roles } = useAuth();
  const { data: systems, isLoading } = useDashboardSystems();

  const isSuperUser = roles.includes('super_user');
  const isQA = roles.includes('quality_assurance');
  const isSystemOwner = roles.includes('system_owner');

  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const greetingKey = getGreetingKey();
  const subtitleKey = getRoleSubtitleKey(roles);

  if (isLoading) {
    return <DashboardSkeleton isSuperUser={isSuperUser} />;
  }

  const allSystems = systems ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t(greetingKey, { name: firstName })}
        </h1>
        <p className="text-sm text-muted-foreground">{t(subtitleKey)}</p>
      </div>

      {/* Super User: Platform Health KPIs */}
      {isSuperUser && <PlatformHealthSection systems={allSystems} />}

      {/* My Systems — for non-super users */}
      {!isSuperUser && (
        <MySystemsSection systems={allSystems} userRoles={roles} />
      )}

      {/* Super User sees all systems below KPIs */}
      {isSuperUser && (
        <MySystemsSection
          systems={allSystems}
          userRoles={roles}
          title={t('dashboard.mySystems.allSystems')}
        />
      )}

      {/* QA: Compliance Snapshot */}
      {isQA && <ComplianceSnapshotSection systems={allSystems} />}

      {/* Phase B empty states */}
      <MyTasksSection />
      <PendingApprovalsSection />

      {/* Findings — only for SO and QA */}
      {(isSuperUser || isSystemOwner || isQA) && <FindingsAlertSection />}

      {/* Super User: Recent Activity */}
      {isSuperUser && <RecentActivitySection />}
    </div>
  );
}
