import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, ClipboardCheck, AlertTriangle, CheckCircle2, Lock, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useReviewTasks } from '@/hooks/useReviewTasks';
import { useAuth } from '@/hooks/useAuth';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { ExecutionPhaseProgress } from '@/components/reviews/ExecutionPhaseProgress';
import type { ReviewTask, TaskGroup, ReviewLevel, ExecutionPhase, TASK_GROUP_TO_PHASE } from '@/types';
import { TASK_GROUP_TO_PHASE as PHASE_MAP } from '@/types';

const TASK_GROUP_ORDER: TaskGroup[] = ['INIT', 'ITSM', 'QMS', 'SEC', 'INFRA', 'DOC', 'AI_EVAL', 'APPR'];

interface ReviewTasksPanelProps {
  reviewCaseId: string;
  reviewLevel: ReviewLevel;
  reviewCaseStatus: string;
  systemOwnerId?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-neutral-800 dark:text-blue-400 dark:border-neutral-700',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-neutral-800 dark:text-emerald-400 dark:border-neutral-700',
  not_applicable: 'bg-muted text-muted-foreground border-border',
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

  // Compute phase completion from loaded tasks (client-side for task list lock icons)
  const phaseCompletion: Record<number, { total: number; completed: number; isComplete: boolean }> = {};
  for (const t of tasks) {
    const phase = t.execution_phase || PHASE_MAP[t.task_group] || 1;
    if (!phaseCompletion[phase]) phaseCompletion[phase] = { total: 0, completed: 0, isComplete: false };
    phaseCompletion[phase].total++;
    if (t.status === 'completed' || t.status === 'not_applicable') phaseCompletion[phase].completed++;
  }
  for (const key of Object.keys(phaseCompletion)) {
    const p = phaseCompletion[Number(key)];
    p.isComplete = p.total > 0 && p.completed === p.total;
  }

  const isPhaseBlocked = (taskPhase: number): boolean => {
    if (taskPhase <= 1) return false;
    for (let i = 1; i < taskPhase; i++) {
      const p = phaseCompletion[i];
      if (p && !p.isComplete) return true;
    }
    return false;
  };

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

  const totalCompleted = filteredTasks.filter(t => t.status === 'completed' || t.status === 'not_applicable').length;
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
            <span>{t('tasks.progressResolved', { completed: totalCompleted, total: totalCount })}</span>
            <span>{totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0}%</span>
          </div>
          <Progress value={totalCount > 0 ? (totalCompleted / totalCount) * 100 : 0} className="h-2" />
        </div>

        {/* Execution Phase Progress — always shows GLOBAL counts */}
        <ExecutionPhaseProgress reviewCaseId={reviewCaseId} />

        {/* Grouped accordion — all expanded by default */}
        <Accordion type="multiple" defaultValue={grouped.map(g => g.group)}>
          {grouped.map(({ group, tasks: groupTasks }) => {
            const completedInGroup = groupTasks.filter(t => t.status === 'completed' || t.status === 'not_applicable').length;

            return (
              <AccordionItem key={group} value={group} className="border rounded-md mb-2 last:mb-0">
                <AccordionTrigger className="px-3 py-2 hover:no-underline text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-semibold text-xs font-mono text-muted-foreground">{group === 'AI_EVAL' ? 'ANALYSIS' : group}</span>
                    <span className="font-medium truncate">{t(`reviews.tasks.groups.${group}`)}</span>
                    <span className="ml-auto mr-2 text-xs text-muted-foreground whitespace-nowrap">
                      {completedInGroup}/{groupTasks.length} {t('tasks.resolved')}
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
                        isPhaseBlocked={task.status === 'pending' && isPhaseBlocked(task.execution_phase || PHASE_MAP[task.task_group] || 1)}
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

function TaskRow({ task, onClick, isPhaseBlocked }: { task: ReviewTask; onClick: () => void; isPhaseBlocked: boolean }) {
  const { t, i18n } = useTranslation();
  const isCompleted = task.status === 'completed';
  const isNA = task.status === 'not_applicable';
  const isResolved = isCompleted || isNA;

  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm cursor-pointer transition-colors ${
        isResolved ? 'opacity-60' : ''
      } ${isPhaseBlocked ? 'opacity-50' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Status badge — fixed width container for alignment */}
      <div className="w-[90px] shrink-0 flex items-center">
        {isPhaseBlocked ? (
          <div className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES['pending']}`}>
              {t('tasks.status.pending')}
            </Badge>
          </div>
        ) : isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : isNA ? (
          <Ban className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[task.status] || ''}`}>
            {t(`tasks.status.${task.status}`)}
          </Badge>
        )}
      </div>

      {/* Template code */}
      {task.template_id && (
        <span className="font-mono text-xs text-muted-foreground shrink-0 w-[72px]">
          {task.title.match(/^[A-Z]+-\d+/)?.[0] || ''}
        </span>
      )}

      {/* Title */}
      <span className="truncate flex-1 min-w-0">
        {i18n.language === 'es' && task.title_es ? task.title_es : task.title}
      </span>

      {/* Execution type icon */}
      {task.execution_type === 'ai_assisted' ? (
        <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      ) : (
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}

      {/* Assignee */}
      <span className="text-xs text-muted-foreground truncate max-w-[120px] shrink-0">
        {task.assigned_to_name}
      </span>

      {/* Date */}
      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
        {isCompleted && task.completed_at
          ? new Date(task.completed_at).toLocaleDateString()
          : isNA && task.na_marked_at
            ? new Date(task.na_marked_at).toLocaleDateString()
            : task.due_date}
      </span>
    </div>
  );
}
