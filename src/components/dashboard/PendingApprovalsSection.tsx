import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldCheck, ChevronRight } from 'lucide-react';
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
      <Link to="/intray?tab=signoffs" className="flex items-center gap-1 text-sm text-primary hover:underline mb-2">
        {t('intray.dashboard.viewAllSignoffs')} <ChevronRight className="h-3.5 w-3.5" />
      </Link>
      <DashboardEmptyState
        icon={ShieldCheck}
        message={t('dashboard.pendingApprovals.empty')}
      />
    </section>
  );
}
