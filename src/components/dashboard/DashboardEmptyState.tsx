import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface DashboardEmptyStateProps {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export function DashboardEmptyState({ icon: Icon, message, actionLabel, actionHref }: DashboardEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon className="h-12 w-12 text-muted-foreground/30 mb-4" strokeWidth={1.75} />
      <p className="text-sm text-muted-foreground text-center max-w-md">{message}</p>
      {actionLabel && actionHref && (
        <Button variant="ghost" className="mt-4 text-sm" onClick={() => navigate(actionHref)}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
