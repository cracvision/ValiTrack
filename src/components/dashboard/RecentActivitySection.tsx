import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { useRecentAuditLog } from '@/hooks/useSystemAuditLog';
import { getRelativeTime } from '@/lib/relativeTime';

export function RecentActivitySection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: entries, isLoading } = useRecentAuditLog(10);

  return (
    <section>
      <DashboardSectionHeader
        title={t('dashboard.recentActivity.title')}
        subtitle={t('dashboard.recentActivity.subtitle')}
      />
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t('dashboard.noRecentActivity')}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 py-2.5">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-muted-foreground">
                  {(entry.user_id ?? '?').substring(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-foreground flex-1 truncate">{entry.action}</span>
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {getRelativeTime(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/audit-log')}>
          {t('dashboard.recentActivity.viewAuditLog')} →
        </Button>
      </div>
    </section>
  );
}
