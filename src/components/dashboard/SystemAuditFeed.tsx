import { useTranslation } from 'react-i18next';
import { useSystemAuditLog } from '@/hooks/useSystemAuditLog';
import { Skeleton } from '@/components/ui/skeleton';
import { getRelativeTime } from '@/lib/relativeTime';

interface SystemAuditFeedProps {
  systemId: string;
}

export function SystemAuditFeed({ systemId }: SystemAuditFeedProps) {
  const { t } = useTranslation();
  const { data: entries, isLoading } = useSystemAuditLog(systemId);

  return (
    <div className="border-t border-border mt-4 pt-3">
      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      ) : !entries || entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {t('dashboard.auditFeed.noActivity')}
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <p key={entry.id} className="text-xs text-muted-foreground truncate">
              <span className="font-mono">{getRelativeTime(entry.created_at)}</span>
              {' · '}
              {entry.action}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
