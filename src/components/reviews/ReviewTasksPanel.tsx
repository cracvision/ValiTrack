import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useReviewTasks } from '@/hooks/useReviewTasks';
import { useAuth } from '@/hooks/useAuth';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import type { ReviewTask, TaskGroup, ReviewLevel } from '@/types';

const TASK_GROUP_ORDER: TaskGroup[] = ['INIT', 'ITSM', 'QMS', 'SEC', 'INFRA', 'DOC', 'AI_EVAL', 'APPR'];

interface ReviewTasksPanelProps {
  reviewCaseId: string;
  reviewLevel: ReviewLevel;
  reviewCaseStatus: string;
  systemOwnerId?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

type TaskFilter = 'all' | 'mine';

export function ReviewTasksPanel({ reviewCaseId, reviewLevel, reviewCaseStatus, systemOwnerId }: ReviewTasksPanelProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: tasks, isLoading } = useReviewTasks(reviewCaseId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('all');

  const selectedTask = tasks?.find(t => t.id === selectedTaskId) || null;

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Error state: tasks should exist but don't
  if (!tasks || tasks.length === 0) {
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('reviews.tasks.title')}</h3>
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('reviews.tasks.tasksFailed')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Apply filter
  const filteredTasks = filter === 'mine' && user
    ? tasks.filter(t => t.assigned_to === user.id)
    : tasks;

  // Group filtered tasks
  const grouped = TASK_GROUP_ORDER
    .map(group => ({
      group,
      tasks: filteredTasks.filter(t => t.task_group === group),
    }))
    .filter(g => g.tasks.length > 0);

  const totalCompleted = filteredTasks.filter(t => t.status === 'completed').length;
  const totalCount = filteredTasks.length;

  return (
    <>
      <div className="border rounded-lg p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">{t('reviews.tasks.title')}</h3>
            {/* Filter toggle */}
            <div className="flex items-center rounded-full border bg-muted/50 p-0.5">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filter === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('tasks.filter.allTasks')}
              </button>
              <button
                onClick={() => setFilter('mine')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filter === 'mine'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('tasks.filter.myTasks')}
              </button>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {t('reviews.tasks.taskCount', { count: totalCount, level: reviewLevel })}
          </Badge>
        </div>

        {/* Overall progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('reviews.tasks.progressOverall', { completed: totalCompleted, total: totalCount })}</span>
            <span>{totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0}%</span>
          </div>
          <Progress value={totalCount > 0 ? (totalCompleted / totalCount) * 100 : 0} className="h-2" />
        </div>

        {/* Grouped accordion — all expanded by default */}
        <Accordion type="multiple" defaultValue={grouped.map(g => g.group)}>
          {grouped.map(({ group, tasks: groupTasks }) => {
            const completedInGroup = groupTasks.filter(t => t.status === 'completed').length;

            return (
              <AccordionItem key={group} value={group} className="border rounded-md mb-2 last:mb-0">
                <AccordionTrigger className="px-3 py-2 hover:no-underline text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-semibold text-xs font-mono text-muted-foreground">{group}</span>
                    <span className="font-medium truncate">{t(`reviews.tasks.groups.${group}`)}</span>
                    <span className="ml-auto mr-2 text-xs text-muted-foreground whitespace-nowrap">
                      {completedInGroup}/{groupTasks.length} {t('reviews.tasks.completed')}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-2">
                  <div className="space-y-1">
                    {groupTasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onClick={() => setSelectedTaskId(task.id)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        reviewCaseId={reviewCaseId}
        reviewCaseStatus={reviewCaseStatus}
        systemOwnerId={systemOwnerId}
      />
    </>
  );
}

function TaskRow({ task, onClick }: { task: ReviewTask; onClick: () => void }) {
  const { t } = useTranslation();
  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm cursor-pointer transition-colors ${isCompleted ? 'opacity-70' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Status badge */}
      {isCompleted ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      ) : (
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_STYLES[task.status] || ''}`}>
          {t(`tasks.status.${task.status}`)}
        </Badge>
      )}

      {/* Template code */}
      {task.template_id && (
        <span className="font-mono text-xs text-muted-foreground shrink-0 w-[72px]">
          {task.title.match(/^[A-Z]+-\d+/)?.[0] || ''}
        </span>
      )}

      {/* Title */}
      <span className="truncate flex-1 min-w-0">{task.title}</span>

      {/* Execution type icon */}
      {task.execution_type === 'ai_assisted' ? (
        <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      ) : (
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}

      {/* Assignee */}
      <span className="text-xs text-muted-foreground truncate max-w-[120px] shrink-0">
        {task.assigned_to_name}
      </span>

      {/* Date — show completed date for completed tasks, due date otherwise */}
      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
        {isCompleted && task.completed_at
          ? new Date(task.completed_at).toLocaleDateString()
          : task.due_date}
      </span>
    </div>
  );
}
