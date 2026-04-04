import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, CheckCircle2, RotateCcw, Ban, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  canMarkNA: boolean;
  isInProgress: boolean;
  isPhaseBlocked: boolean;
  onStart: () => void;
  onComplete: () => void;
  onReopen: (reason: string) => void;
  onMarkNA: (justification: string) => void;
  isStarting?: boolean;
  isCompleting?: boolean;
  isReopening?: boolean;
  isMarkingNA?: boolean;
  completionBlocked?: string | null;
  onValidationError?: (blocked: boolean) => void;
}

export function TaskActionButtons({
  task,
  canStart,
  canComplete,
  canReopen,
  canMarkNA,
  isInProgress,
  isPhaseBlocked,
  onStart,
  onComplete,
  onReopen,
  onMarkNA,
  isStarting,
  isCompleting,
  isReopening,
  isMarkingNA,
  completionBlocked,
  onValidationError,
}: TaskActionButtonsProps) {
  const { t, i18n } = useTranslation();
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showValidationError, setShowValidationError] = useState(false);
  const [naDialogOpen, setNaDialogOpen] = useState(false);
  const [naJustification, setNaJustification] = useState('');

  // Clear validation error when requirements are met
  useEffect(() => {
    if (!completionBlocked && showValidationError) {
      setShowValidationError(false);
      onValidationError?.(false);
    }
  }, [completionBlocked, showValidationError, onValidationError]);

  const handleReopen = () => {
    if (reopenReason.trim().length < 10) return;
    onReopen(reopenReason);
    setReopenOpen(false);
    setReopenReason('');
  };

  const handleComplete = () => {
    if (completionBlocked) {
      setShowValidationError(true);
      onValidationError?.(true);
      return;
    }
    setShowValidationError(false);
    onValidationError?.(false);
    onComplete();
  };

  const handleConfirmNA = () => {
    if (naJustification.trim().length < 10) return;
    onMarkNA(naJustification.trim());
    setNaDialogOpen(false);
    setNaJustification('');
  };

  const notInProgressTooltip = !isInProgress
    ? t('tasks.actions.reviewCaseNotInProgress')
    : null;

  const naCharCount = naJustification.trim().length;
  const naRemaining = Math.max(0, 10 - naCharCount);

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mark as N/A — renders regardless of phase lock */}
          {canMarkNA && (task.status === 'pending' || task.status === 'in_progress') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNaDialogOpen(true)}
              disabled={isMarkingNA}
            >
              <Ban className="h-3.5 w-3.5 mr-1" />
              {t('tasks.markNA')}
            </Button>
          )}

          {/* Start Task — hidden when phase blocked */}
          {!isPhaseBlocked && task.status === 'pending' && (
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

          {/* Complete Task — hidden when phase blocked */}
          {!isPhaseBlocked && task.status === 'in_progress' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    onClick={handleComplete}
                    disabled={!canComplete || isCompleting}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {t('tasks.actions.completeTask')}
                  </Button>
                </span>
              </TooltipTrigger>
              {!canComplete && (
                <TooltipContent>
                  {notInProgressTooltip || t('tasks.actions.notAuthorized')}
                </TooltipContent>
              )}
            </Tooltip>
          )}

          {/* Reopen Task — for completed AND not_applicable */}
          {(task.status === 'completed' || task.status === 'not_applicable') && (
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

        {/* Inline validation error */}
        {showValidationError && completionBlocked && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">
              {completionBlocked}
            </AlertDescription>
          </Alert>
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

      {/* N/A confirmation dialog */}
      <AlertDialog open={naDialogOpen} onOpenChange={setNaDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tasks.markNADialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tasks.markNADialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-foreground">
              {i18n.language === 'es' && task.title_es ? task.title_es : task.title}
            </p>
            <Textarea
              value={naJustification}
              onChange={e => setNaJustification(e.target.value)}
              placeholder={t('tasks.markNADialog.placeholder')}
              rows={3}
              className="max-h-[120px]"
            />
            {naCharCount > 0 && naCharCount < 10 && (
              <p className="text-xs text-muted-foreground">
                {t('tasks.markNADialog.minChars', { min: 10, remaining: naRemaining })}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { setNaDialogOpen(false); setNaJustification(''); }}>
              {t('userForm.cancel')}
            </Button>
            <Button
              onClick={handleConfirmNA}
              disabled={naCharCount < 10 || isMarkingNA}
            >
              {t('tasks.markNADialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
