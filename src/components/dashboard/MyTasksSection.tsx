import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { DashboardEmptyState } from './DashboardEmptyState';
import { useMyTasks } from '@/hooks/useMyTasks';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-blue-400',
};

export function MyTasksSection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: tasks, isLoading } = useMyTasks();

  return (
    <section>
      <DashboardSectionHeader
        title={t('dashboard.myTasks.title')}
        subtitle={t('dashboard.myTasks.subtitle')}
      />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <DashboardEmptyState
          icon={ClipboardList}
          message={t('dashboard.myTasks.empty')}
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/reviews/${task.review_case_id}`)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {i18n.language === 'es' && task.title_es ? task.title_es : task.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.system_name} — {task.review_case_title}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {task.task_group}
                  </Badge>
                  <Badge className={`text-xs ${STATUS_STYLES[task.status] || ''}`}>
                    {t(`tasks.status.${task.status}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {task.due_date}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
