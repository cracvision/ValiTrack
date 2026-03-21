import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { ReviewTask } from '@/types';

interface TaskActionButtonsProps {
  task: ReviewTask;
  canStart: boolean;
  canComplete: boolean;
  canReopen: boolean;
  isInProgress: boolean;
  onStart: () => void;
  onComplete: () => void;
  onReopen: (reason: string) => void;
  isStarting?: boolean;
  isCompleting?: boolean;
  isReopening?: boolean;
  completionBlocked?: string | null;
}

export function TaskActionButtons({
  task,
  canStart,
  canComplete,
  canReopen,
  isInProgress,
  onStart,
  onComplete,
  onReopen,
  isStarting,
  isCompleting,
  isReopening,
  completionBlocked,
}: TaskActionButtonsProps) {
  const { t } = useTranslation();
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const handleReopen = () => {
    if (reopenReason.trim().length < 10) return;
    onReopen(reopenReason);
    setReopenOpen(false);
    setReopenReason('');
  };

  const notInProgressTooltip = !isInProgress
    ? t('tasks.actions.reviewCaseNotInProgress')
    : null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Start Task */}
        {task.status === 'pending' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  onClick={onStart}
                  disabled={!canStart || isStarting}
                >
                  <Play className="h-3.5 w-3.5 mr-1" />
                  {t('tasks.actions.startTask')}
                </Button>
              </span>
            </TooltipTrigger>
            {(!canStart) && (
              <TooltipContent>
                {notInProgressTooltip || t('tasks.actions.notAuthorized')}
              </TooltipContent>
            )}
          </Tooltip>
        )}

        {/* Complete Task */}
        {task.status === 'in_progress' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  onClick={onComplete}
                  disabled={!canComplete || isCompleting || !!completionBlocked}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  {t('tasks.actions.completeTask')}
                </Button>
              </span>
            </TooltipTrigger>
            {(!canComplete || !!completionBlocked) && (
              <TooltipContent>
                {completionBlocked || notInProgressTooltip || t('tasks.actions.notAuthorized')}
              </TooltipContent>
            )}
          </Tooltip>
        )}

        {/* Reopen Task */}
        {task.status === 'completed' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReopenOpen(true)}
                  disabled={!canReopen || isReopening}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  {t('tasks.actions.reopenTask')}
                </Button>
              </span>
            </TooltipTrigger>
            {!canReopen && (
              <TooltipContent>
                {notInProgressTooltip || t('tasks.actions.notAuthorized')}
              </TooltipContent>
            )}
          </Tooltip>
        )}
      </div>

      {/* Reopen reason dialog */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tasks.actions.reopenTask')}</DialogTitle>
            <DialogDescription>{t('tasks.actions.reopenReason')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reopenReason}
            onChange={e => setReopenReason(e.target.value)}
            placeholder={t('reviews.actions.reasonPlaceholder')}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOpen(false)}>
              {t('userForm.cancel')}
            </Button>
            <Button
              onClick={handleReopen}
              disabled={reopenReason.trim().length < 10 || isReopening}
            >
              {t('tasks.actions.reopenTask')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
