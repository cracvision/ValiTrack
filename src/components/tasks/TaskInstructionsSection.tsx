import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { TaskStatus } from '@/types';

interface TaskInstructionsSectionProps {
  instructions: string;
  taskStatus: TaskStatus;
}

export function TaskInstructionsSection({ instructions, taskStatus }: TaskInstructionsSectionProps) {
  const { t } = useTranslation();
  const defaultExpanded = taskStatus !== 'completed';
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!instructions || instructions.trim() === '') return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-400 rounded-lg p-4">
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
        </div>
        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
          <span>{expanded ? t('tasks.instructions.collapse') : t('tasks.instructions.expand')}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
          {instructions}
        </div>
      )}
    </div>
  );
}
