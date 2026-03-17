import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { DashboardEmptyState } from './DashboardEmptyState';

export function MyTasksSection() {
  const { t } = useTranslation();

  return (
    <section>
      <DashboardSectionHeader
        title={t('dashboard.myTasks.title')}
        subtitle={t('dashboard.myTasks.subtitle')}
      />
      <DashboardEmptyState
        icon={ClipboardList}
        message={t('dashboard.myTasks.empty')}
      />
    </section>
  );
}
