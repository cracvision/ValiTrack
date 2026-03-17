import { useTranslation } from 'react-i18next';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import type { DashboardSystem } from '@/hooks/useDashboardSystems';

interface ComplianceSnapshotSectionProps {
  systems: DashboardSystem[];
}

export function ComplianceSnapshotSection({ systems }: ComplianceSnapshotSectionProps) {
  const { t } = useTranslation();

  const total = systems.length;
  const compliant = systems.filter((s) => s.reviewStatus === 'compliant').length;
  const onTimeRate = total > 0 ? Math.round((compliant / total) * 100) : 0;
  const approaching = systems.filter((s) => s.reviewStatus === 'approaching' || s.reviewStatus === 'overdue').length;
  const underReview = systems.filter((s) => s.reviewStatus === 'in_progress' || s.reviewStatus === 'pending_approval').length;

  const metrics = [
    { value: `${onTimeRate}%`, label: t('dashboard.compliance.onTimeRate') },
    { value: approaching, label: t('dashboard.compliance.approachingReview') },
    { value: underReview, label: t('dashboard.compliance.underReview') },
  ];

  return (
    <section>
      <DashboardSectionHeader title={t('dashboard.compliance.title')} />
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{m.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
