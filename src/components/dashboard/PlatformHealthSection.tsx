import { useTranslation } from 'react-i18next';
import { Server, AlertTriangle, ClipboardCheck, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GXP_SHORT_LABELS } from '@/lib/gxpClassifications';
import type { DashboardSystem } from '@/hooks/useDashboardSystems';
import type { GxPClassification } from '@/types';

const GXP_REGULATED: GxPClassification[] = ['GMP', 'GLP', 'GCP', 'GDP', 'GVP'];

const classificationColor: Record<string, string> = {
  GMP: 'bg-destructive/10 text-destructive',
  GLP: 'bg-destructive/10 text-destructive',
  GCP: 'bg-destructive/10 text-destructive',
  GDP: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  GVP: 'bg-destructive/10 text-destructive',
  NON_GXP_CRITICAL: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  NON_GXP_STANDARD: 'bg-muted text-muted-foreground',
};

interface PlatformHealthSectionProps {
  systems: DashboardSystem[];
}

export function PlatformHealthSection({ systems }: PlatformHealthSectionProps) {
  const { t } = useTranslation();

  const activeSystems = systems.filter((s) => s.status === 'Active');
  const gxpRegulated = systems.filter((s) => GXP_REGULATED.includes(s.gxp_classification as GxPClassification));
  const highRisk = systems.filter((s) => s.risk_level === 'High');
  const overdueSystems = systems.filter((s) => s.reviewStatus === 'overdue');
  const approachingSystems = systems.filter((s) => s.reviewStatus === 'approaching');

  const stats = [
    {
      title: t('dashboard.totalSystems'),
      value: systems.length,
      icon: Server,
      description: t('dashboard.active', { count: activeSystems.length }),
    },
    {
      title: t('dashboard.gxpCritical'),
      value: gxpRegulated.length,
      icon: AlertTriangle,
      description: t('dashboard.requireReview'),
    },
    {
      title: t('dashboard.highRisk'),
      value: highRisk.length,
      icon: ClipboardCheck,
      description: t('dashboard.enhancedOversight'),
    },
    {
      title: t('dashboard.reviewsDue90'),
      value: overdueSystems.length + approachingSystems.length,
      icon: CalendarClock,
      description: overdueSystems.length > 0
        ? t('dashboard.overdue', { count: overdueSystems.length })
        : t('dashboard.onSchedule'),
      descClass: overdueSystems.length > 0 ? 'text-destructive' : 'text-green-600',
    },
  ];

  return (
    <section>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <p className={`text-xs mt-1 ${(stat as any).descClass ?? 'text-muted-foreground'}`}>
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {overdueSystems.length > 0 && (
        <Card className="border-destructive/30 mt-4">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              {t('dashboard.overdueReviews')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueSystems.map((system) => (
                <div key={system.id} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{system.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.wasDue', { date: new Date(system.next_review_date).toLocaleDateString(), owner: '' })}
                    </p>
                  </div>
                  <Badge variant="secondary" className={classificationColor[system.gxp_classification] ?? 'bg-muted text-muted-foreground'}>
                    {GXP_SHORT_LABELS[system.gxp_classification as GxPClassification] ?? system.gxp_classification}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
