import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { DashboardEmptyState } from './DashboardEmptyState';

export function FindingsAlertSection() {
  const { t } = useTranslation();

  return (
    <section>
      <DashboardSectionHeader
        title={t('dashboard.findings.title')}
        subtitle={t('dashboard.findings.subtitle')}
      />
      <DashboardEmptyState
        icon={AlertTriangle}
        message={t('dashboard.findings.empty')}
      />
    </section>
  );
}
