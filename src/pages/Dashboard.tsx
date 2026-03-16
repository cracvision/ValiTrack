import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, ClipboardCheck, AlertTriangle, CalendarClock, Plus } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNavigate } from 'react-router-dom';
import { GXP_SHORT_LABELS } from '@/lib/gxpClassifications';
import type { SystemProfile, GxPClassification } from '@/types';

const classificationColor: Record<string, string> = {
  GMP: 'bg-destructive/10 text-destructive',
  GLP: 'bg-destructive/10 text-destructive',
  GCP: 'bg-destructive/10 text-destructive',
  GDP: 'bg-orange-100 text-orange-700',
  GVP: 'bg-destructive/10 text-destructive',
  NON_GXP_CRITICAL: 'bg-orange-100 text-orange-700',
  NON_GXP_STANDARD: 'bg-muted text-muted-foreground',
};

const statusColor: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Retired: 'bg-muted text-muted-foreground',
  'Under Validation': 'bg-primary/10 text-primary',
};

// GxP-regulated classifications for the "GxP Critical" stat card
const GXP_REGULATED: GxPClassification[] = ['GMP', 'GLP', 'GCP', 'GDP', 'GVP'];

export default function Dashboard() {
  const { t } = useTranslation();
  const [systems] = useLocalStorage<SystemProfile[]>('gxp_systems', []);
  const navigate = useNavigate();

  const activeSystems = systems.filter((s) => s.status === 'Active');
  const gxpRegulated = systems.filter((s) => GXP_REGULATED.includes(s.gxp_classification as GxPClassification));
  const highRisk = systems.filter((s) => s.risk_level === 'High');

  const now = new Date();
  const in90Days = new Date();
  in90Days.setDate(in90Days.getDate() + 90);
  const upcomingReviews = systems
    .filter((s) => {
      const reviewDate = new Date(s.next_review_date);
      return s.status === 'Active' && reviewDate >= now && reviewDate <= in90Days;
    })
    .sort((a, b) => new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime());

  const overdueReviews = systems.filter((s) => {
    return s.status === 'Active' && new Date(s.next_review_date) < now;
  });

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
      value: upcomingReviews.length + overdueReviews.length,
      icon: CalendarClock,
      description: overdueReviews.length > 0
        ? t('dashboard.overdue', { count: overdueReviews.length })
        : t('dashboard.onSchedule'),
    },
  ];

  if (systems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Server className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">{t('dashboard.welcome')}</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              {t('dashboard.welcomeDesc')}
            </p>
            <Button onClick={() => navigate('/systems')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('dashboard.registerFirst')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.overviewSubtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {overdueReviews.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t('dashboard.overdueReviews')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueReviews.map((system) => (
                  <div key={system.id} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{system.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('dashboard.wasDue', { date: new Date(system.next_review_date).toLocaleDateString(), owner: system.system_owner_id })}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.upcomingReviews')}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.noReviewsDue')}</p>
            ) : (
              <div className="space-y-3">
                {upcomingReviews.map((system) => (
                  <div key={system.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{system.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('dashboard.due', { date: new Date(system.next_review_date).toLocaleDateString(), owner: system.system_owner_id })}
                      </p>
                    </div>
                    <Badge variant="secondary" className={statusColor[system.status]}>
                      {system.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.registeredSystems')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systems.slice(0, 6).map((system) => (
                <div key={system.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{system.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {system.system_identifier} · {system.vendor_name}
                    </p>
                  </div>
                  <Badge variant="secondary" className={classificationColor[system.gxp_classification] ?? 'bg-muted text-muted-foreground'}>
                    {GXP_SHORT_LABELS[system.gxp_classification as GxPClassification] ?? system.gxp_classification}
                  </Badge>
                </div>
              ))}
              {systems.length > 6 && (
                <Button variant="link" className="w-full text-xs" onClick={() => navigate('/systems')}>
                  {t('dashboard.viewAll', { count: systems.length })}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
