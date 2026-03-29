import { useTranslation } from 'react-i18next';
import { useSystemRecentActivity } from '@/hooks/useSystemRecentActivity';
import { Skeleton } from '@/components/ui/skeleton';

interface SystemAuditFeedProps {
  systemId: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function humanizeAction(action: string, t: (key: string) => string): string {
  const key = `dashboard.auditFeed.actions.${action}`;
  const translated = t(key);
  if (translated === key) {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return translated;
}

function formatRelativeTime(dateString: string, t: (key: string, opts?: Record<string, any>) => string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t('dashboard.auditFeed.time.justNow');
  if (diffMin < 60) return t('dashboard.auditFeed.time.minutesAgo', { count: diffMin });
  if (diffHours < 24) return t('dashboard.auditFeed.time.hoursAgo', { count: diffHours });
  if (diffDays < 30) return t('dashboard.auditFeed.time.daysAgo', { count: diffDays });
  return date.toLocaleDateString();
}

export function SystemAuditFeed({ systemId }: SystemAuditFeedProps) {
  const { t } = useTranslation();
  const { data: activities, isLoading } = useSystemRecentActivity(systemId);

  return (
    <div className="border-t border-border mt-4 pt-3">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ) : !activities || activities.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {t('dashboard.auditFeed.noActivity')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {activities.map((activity) => {
            const initials = getInitials(activity.user_name);
            return (
              <div key={activity.id} className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {initials}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">
                    {activity.user_name}
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground">
                      {humanizeAction(activity.action, t)}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {formatRelativeTime(activity.created_at, t)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
