import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { DashboardEmptyState } from './DashboardEmptyState';

export function PendingApprovalsSection() {
  const { t } = useTranslation();

  return (
    <section>
      <DashboardSectionHeader
        title={t('dashboard.pendingApprovals.title')}
        subtitle={t('dashboard.pendingApprovals.subtitle')}
      />
      <DashboardEmptyState
        icon={ShieldCheck}
        message={t('dashboard.pendingApprovals.empty')}
      />
    </section>
  );
}
