// build v3
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, User, Sparkles, Calendar, Info, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { useTaskExecution } from '@/hooks/useTaskExecution';
import { useTaskWorkNotes } from '@/hooks/useTaskWorkNotes';
import { useTaskEvidenceFiles } from '@/hooks/useTaskEvidenceFiles';
import { useTaskPhaseUnlocked } from '@/hooks/useTaskPhaseStatus';
import { useTaskCheckoffs } from '@/hooks/useTaskCheckoffs';
import { TaskActionButtons } from '@/components/tasks/TaskActionButtons';
import { TaskReassignDialog } from '@/components/tasks/TaskReassignDialog';
import { TaskWorkLog } from '@/components/tasks/TaskWorkLog';
import { TaskEvidenceSection } from '@/components/tasks/TaskEvidenceSection';
import { TaskInstructionsSection } from '@/components/tasks/TaskInstructionsSection';
import type { ReviewTask, TaskGroup } from '@/types';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const GROUP_COLORS: Record<string, string> = {
  INIT: 'bg-slate-100 text-slate-700',
  ITSM: 'bg-orange-100 text-orange-700',
  QMS: 'bg-purple-100 text-purple-700',
  SEC: 'bg-red-100 text-red-700',
  INFRA: 'bg-cyan-100 text-cyan-700',
  DOC: 'bg-indigo-100 text-indigo-700',
  AI_EVAL: 'bg-amber-100 text-amber-700',
  APPR: 'bg-green-100 text-green-700',
};

const EVIDENCE_GROUPS: TaskGroup[] = ['INIT', 'ITSM', 'QMS', 'SEC', 'INFRA', 'DOC'];

const PHASE_SHORT_KEYS: Record<number, string> = {
  1: 'tasks.phases.phase1Short',
  2: 'tasks.phases.phase2Short',
  3: 'tasks.phases.phase3Short',
  4: 'tasks.phases.phase4Short',
};

interface TaskDetailPanelProps {
  task: ReviewTask | null;
  open: boolean;
  onClose: () => void;
  reviewCaseId: string;
  reviewCaseStatus: string;
  systemOwnerId?: string;
}

export function TaskDetailPanel({ task, open, onClose, reviewCaseId, reviewCaseStatus, systemOwnerId }: TaskDetailPanelProps) {
  const { t } = useTranslation();
  const [highlightSections, setHighlightSections] = useState(false);

  const { data: userNames = {} } = useResolveUserNames(
    task ? [task.assigned_to, task.approved_by_user, task.completed_by] : []
  );

  const execution = useTaskExecution({
    task: task || undefined,
    reviewCaseId,
    reviewCaseStatus,
    systemOwnerId,
  });

  const workNotes = useTaskWorkNotes(task?.id);
  const evidenceFiles = useTaskEvidenceFiles({ taskId: task?.id, reviewCaseId });

  // Phase lock check via RPC (backend source of truth)
  const { data: phaseStatus } = useTaskPhaseUnlocked(
    task?.status === 'pending' ? task?.id : undefined
  );
  const isPhaseBlocked = task?.status === 'pending' && phaseStatus && !phaseStatus.unlocked;

  const handleValidationError = useCallback((blocked: boolean) => {
    setHighlightSections(blocked);
  }, []);

  if (!task) return null;

  const isOverdue = task.status !== 'completed' && new Date(task.due_date) < new Date();
  const assigneeName = userNames[task.assigned_to] || task.assigned_to_name || '—';

  const getCompletionBlockedReason = (): string | null => {
    if (task.status !== 'in_progress') return null;
    const isEvidenceGroup = EVIDENCE_GROUPS.includes(task.task_group as TaskGroup);

    if (isEvidenceGroup) {
      if (evidenceFiles.fileCount < 1 || workNotes.noteCount < 1) {
        return t('tasks.validation.evidenceAndNoteRequired');
      }
    } else if (task.task_group === 'AI_EVAL') {
      if (workNotes.noteCount < 1) return t('tasks.validation.noteRequired');
    } else if (task.task_group === 'APPR') {
      if (workNotes.noteCount < 1) return t('tasks.validation.approvalNoteRequired');
    }
    return null;
  };

  const completionBlocked = getCompletionBlockedReason();

  const handleComplete = () => {
    if (completionBlocked) return;
    execution.completeTask.mutate();
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] ${GROUP_COLORS[task.task_group] || ''}`}>
              {task.task_group}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[task.status] || ''}`}>
              {t(`tasks.status.${task.status}`)}
            </Badge>
          </div>
          <SheetTitle className="text-lg">{task.title}</SheetTitle>
          <SheetDescription className="sr-only">{t('tasks.detail.title')}</SheetDescription>
        </SheetHeader>

        {/* Read-only info banner for non-authorized users */}
        {execution.isReadOnly && (
          <Alert className="mb-4 bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-700" />
            <AlertDescription className="text-blue-700 text-xs">
              {t('tasks.actions.readOnlyMessage', { assignee: assigneeName })}
            </AlertDescription>
          </Alert>
        )}

        {/* Meta info */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div>
            <span className="text-muted-foreground text-xs">{t('tasks.detail.assignedTo')}</span>
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{assigneeName}</span>
              {execution.canReassign && (
                <TaskReassignDialog
                  task={task}
                  reviewCaseId={reviewCaseId}
                  onReassign={(newId, newName, reason) =>
                    execution.reassignTask.mutate({ newAssigneeId: newId, newAssigneeName: newName, reason })
                  }
                  isReassigning={execution.reassignTask.isPending}
                />
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{t('tasks.detail.dueDate')}</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                {task.due_date}
                {isOverdue && (
                  <span className="ml-1 text-xs">
                    <AlertTriangle className="inline h-3 w-3" /> {t('tasks.detail.overdue')}
                  </span>
                )}
              </span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{t('tasks.detail.executionType')}</span>
            <div className="flex items-center gap-1">
              {task.execution_type === 'ai_assisted' ? (
                <><Sparkles className="h-3.5 w-3.5 text-amber-500" /> <span>{t('tasks.detail.aiAssisted')}</span></>
              ) : (
                <><User className="h-3.5 w-3.5 text-muted-foreground" /> <span>{t('tasks.detail.manual')}</span></>
              )}
            </div>
          </div>
          {task.completed_at && (
            <div>
              <span className="text-muted-foreground text-xs">{t('tasks.status.completed')}</span>
              <div className="text-xs">{new Date(task.completed_at).toLocaleString()}</div>
            </div>
          )}
        </div>

        {/* Instructions section */}
        {task.execution_instructions && task.execution_instructions.trim() !== '' && (
          <TaskInstructionsSection
            instructions={task.execution_instructions}
            taskStatus={task.status}
          />
        )}

        {/* Phase blocked message */}
        {isPhaseBlocked && phaseStatus && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                  {t('tasks.phases.blocked.title')}
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
                  {t('tasks.phases.blocked.message', {
                    phaseName: t(PHASE_SHORT_KEYS[phaseStatus.blocking_phase || 1] || 'tasks.phases.phase1Short'),
                    completed: phaseStatus.blocking_phase_completed || 0,
                    total: phaseStatus.blocking_phase_total || 0,
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons — hidden for read-only users and phase-blocked tasks */}
        {!execution.isReadOnly && !isPhaseBlocked && (
           <div className="mt-4">
            <TaskActionButtons
              task={task}
              canStart={execution.canStart}
              canComplete={execution.canComplete}
              canReopen={execution.canReopen}
              isInProgress={execution.isInProgress}
              onStart={() => execution.startTask.mutate()}
              onComplete={handleComplete}
              onReopen={(reason) => execution.reopenTask.mutate(reason)}
              isStarting={execution.startTask.isPending}
              isCompleting={execution.completeTask.isPending}
              isReopening={execution.reopenTask.isPending}
              completionBlocked={completionBlocked}
              onValidationError={handleValidationError}
            />
          </div>
        )}

        {/* Evidence Files */}
        {EVIDENCE_GROUPS.includes(task.task_group as TaskGroup) && (
          <>
            <Separator className="my-4" />
            <TaskEvidenceSection
              taskId={task.id}
              taskGroup={task.task_group}
              taskTitle={task.title}
              reviewCaseId={reviewCaseId}
              canUpload={!execution.isReadOnly && task.status === 'in_progress' && execution.canAddNotes}
              isReadOnly={execution.isReadOnly || task.status !== 'in_progress'}
              highlight={highlightSections && evidenceFiles.fileCount < 1}
              isPending={task.status === 'pending'}
            />
          </>
        )}

        <Separator className="my-4" />

        {/* Work Log */}
        <TaskWorkLog
          notes={workNotes.notes}
          isLoading={workNotes.isLoading}
          taskStatus={task.status}
          onAddNote={(content) => workNotes.addNote.mutate(content)}
          isAdding={workNotes.addNote.isPending}
          canAddNotes={execution.canAddNotes && task.status === 'in_progress'}
          isReadOnly={execution.isReadOnly || task.status !== 'in_progress'}
          highlight={highlightSections && workNotes.noteCount < 1}
          isPending={task.status === 'pending'}
        />

        <Separator className="my-4" />

        {/* Task Details (collapsible) */}
        <Collapsible>
          <CollapsibleTrigger className="text-sm font-semibold text-foreground hover:underline">
            {t('tasks.detail.description')}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <dl className="text-xs space-y-2">
              <div>
                <dt className="text-muted-foreground">{t('tasks.detail.description')}</dt>
                <dd className="mt-0.5">{task.description || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('tasks.detail.taskGroup')}</dt>
                <dd>{t(`reviews.tasks.groups.${task.task_group}`)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('tasks.detail.executionType')}</dt>
                <dd>{task.execution_type}</dd>
              </div>
              {task.template_id && (
                <div>
                  <dt className="text-muted-foreground">{t('tasks.detail.templateId')}</dt>
                  <dd className="font-mono">{task.template_id}</dd>
                </div>
              )}
            </dl>
          </CollapsibleContent>
        </Collapsible>
      </SheetContent>
    </Sheet>
  );
}
