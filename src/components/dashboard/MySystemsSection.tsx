import { useTranslation } from 'react-i18next';
import { Server } from 'lucide-react';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { DashboardEmptyState } from './DashboardEmptyState';
import { SystemCard } from './SystemCard';
import type { DashboardSystem } from '@/hooks/useDashboardSystems';

interface MySystemsSectionProps {
  systems: DashboardSystem[];
  userRoles: string[];
  title?: string;
}

export function MySystemsSection({ systems, userRoles, title }: MySystemsSectionProps) {
  const { t } = useTranslation();
  const isSuperUser = userRoles.includes('super_user');
  const sectionTitle = title ?? (isSuperUser ? t('dashboard.mySystems.allSystems') : t('dashboard.mySystems.title'));

  return (
    <section>
      <DashboardSectionHeader
        title={sectionTitle}
        subtitle={t('dashboard.mySystems.subtitle')}
        count={systems.length}
      />
      {systems.length === 0 ? (
        <DashboardEmptyState
          icon={Server}
          message={t('dashboard.mySystems.empty')}
          actionLabel={t('dashboard.mySystems.viewAll')}
          actionHref="/systems"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {systems.map((system) => (
            <SystemCard key={system.id} system={system} />
          ))}
        </div>
      )}
    </section>
  );
}
