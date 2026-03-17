import { Badge } from '@/components/ui/badge';

interface DashboardSectionHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
}

export function DashboardSectionHeader({ title, subtitle, count }: DashboardSectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {count !== undefined && (
            <Badge variant="secondary" className="text-xs px-2 py-0 h-5">
              {count}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
