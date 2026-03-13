import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, ClipboardCheck, AlertTriangle, CalendarClock, Plus } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNavigate } from 'react-router-dom';
import type { SystemProfile } from '@/types';

const classificationColor: Record<string, string> = {
  'GxP Critical': 'bg-destructive/10 text-destructive',
  'GxP Non-Critical': 'bg-orange-100 text-orange-700',
  'Non-GxP': 'bg-muted text-muted-foreground',
};

const statusColor: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Retired: 'bg-muted text-muted-foreground',
  'Under Validation': 'bg-primary/10 text-primary',
};

export default function Dashboard() {
  const [systems] = useLocalStorage<SystemProfile[]>('gxp_systems', []);
  const navigate = useNavigate();

  const activeSystems = systems.filter((s) => s.status === 'Active');
  const gxpCritical = systems.filter((s) => s.gxp_classification === 'GxP Critical');
  const highRisk = systems.filter((s) => s.risk_level === 'High');

  // Systems with reviews due in the next 90 days
  const now = new Date();
  const in90Days = new Date();
  in90Days.setDate(in90Days.getDate() + 90);
  const upcomingReviews = systems
    .filter((s) => {
      const reviewDate = new Date(s.next_review_date);
      return s.status === 'Active' && reviewDate >= now && reviewDate <= in90Days;
    })
    .sort((a, b) => new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime());

  // Systems with overdue reviews
  const overdueReviews = systems.filter((s) => {
    return s.status === 'Active' && new Date(s.next_review_date) < now;
  });

  const stats = [
    {
      title: 'Total Systems',
      value: systems.length,
      icon: Server,
      description: `${activeSystems.length} active`,
    },
    {
      title: 'GxP Critical',
      value: gxpCritical.length,
      icon: AlertTriangle,
      description: 'Requiring periodic review',
    },
    {
      title: 'High Risk',
      value: highRisk.length,
      icon: ClipboardCheck,
      description: 'Enhanced oversight required',
    },
    {
      title: 'Reviews Due (90d)',
      value: upcomingReviews.length + overdueReviews.length,
      icon: CalendarClock,
      description: overdueReviews.length > 0 ? `${overdueReviews.length} overdue` : 'On schedule',
    },
  ];

  if (systems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            GxP Computerized System Periodic Review Management
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Server className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to GxP Periodic Review</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Start by registering your first computerized system. Once registered, you can track
              validation status, schedule periodic reviews, and manage compliance documentation.
            </p>
            <Button onClick={() => navigate('/systems')}>
              <Plus className="mr-2 h-4 w-4" />
              Register First System
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of computerized system periodic review status
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
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
        {/* Overdue Reviews */}
        {overdueReviews.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Overdue Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueReviews.map((system) => (
                  <div key={system.id} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{system.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Was due: {new Date(system.next_review_date).toLocaleDateString()} · {system.owner_name}
                      </p>
                    </div>
                    <Badge variant="secondary" className={classificationColor[system.gxp_classification]}>
                      {system.gxp_classification}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Reviews (Next 90 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No reviews due in the next 90 days.</p>
            ) : (
              <div className="space-y-3">
                {upcomingReviews.map((system) => (
                  <div key={system.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{system.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {new Date(system.next_review_date).toLocaleDateString()} · {system.owner_name}
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

        {/* Registered Systems */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registered Systems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systems.slice(0, 6).map((system) => (
                <div key={system.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{system.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {system.system_identifier} · {system.system_category} · {system.vendor_name}
                    </p>
                  </div>
                  <Badge variant="secondary" className={classificationColor[system.gxp_classification]}>
                    {system.gxp_classification}
                  </Badge>
                </div>
              ))}
              {systems.length > 6 && (
                <Button variant="link" className="w-full text-xs" onClick={() => navigate('/systems')}>
                  View all {systems.length} systems →
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
