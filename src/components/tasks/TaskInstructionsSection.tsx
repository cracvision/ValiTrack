import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { parseSteps } from '@/lib/parseInstructionSteps';
import type { TaskStatus, TaskGroup } from '@/types';
import type { CheckoffDetail } from '@/hooks/useTaskCheckoffs';

interface TaskInstructionsSectionProps {
  instructions: string;
  taskStatus: TaskStatus;
  taskGroup?: TaskGroup;
  canInteract: boolean;
  checkedSteps: Set<number>;
  checkoffDetails: Map<number, CheckoffDetail>;
  onToggleStep: (stepIndex: number) => void;
  isToggling: boolean;
  highlight?: boolean;
}


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function TaskInstructionsSection({
  instructions,
  taskStatus,
  canInteract,
  checkedSteps,
  checkoffDetails,
  onToggleStep,
  isToggling,
  highlight = false,
}: TaskInstructionsSectionProps) {
  const { t } = useTranslation();
  const defaultExpanded = taskStatus !== 'completed';
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!instructions || instructions.trim() === '') return null;

  const steps = parseSteps(instructions);
  const showCheckboxes = taskStatus === 'in_progress' || taskStatus === 'completed';
  const completedCount = checkedSteps.size;
  const totalSteps = steps.length;
  const allComplete = totalSteps > 0 && completedCount >= totalSteps;

  const borderColor = highlight && !allComplete
    ? 'border-destructive'
    : 'border-blue-400';

  return (
    <div className={`bg-blue-50 dark:bg-blue-950/30 border-l-4 ${borderColor} rounded-lg p-4`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
            {t('tasks.instructions.title')}
          </span>
          {showCheckboxes && totalSteps > 0 && (
            <span className={`text-xs ml-1 ${allComplete ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {t('tasks.instructions.progress', { completed: completedCount, total: totalSteps })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
          <span>{expanded ? t('tasks.instructions.collapse') : t('tasks.instructions.expand')}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {showCheckboxes && steps.length > 0 ? (
            steps.map((step) => {
              const isChecked = checkedSteps.has(step.index);
              const detail = checkoffDetails.get(step.index);
              const isDisabled = !canInteract || isToggling;

              return (
                <div key={step.index} className="flex items-start gap-2.5 group">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => onToggleStep(step.index)}
                    disabled={isDisabled}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${
                      isChecked
                        ? 'text-muted-foreground line-through'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {step.index}. {step.text}
                    </p>
                    {isChecked && detail && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('tasks.instructions.checkedBy', {
                          name: detail.checkedByName || '—',
                          date: formatDate(detail.checkedAt),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            // Plain text mode for pending/blocked tasks
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {instructions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
