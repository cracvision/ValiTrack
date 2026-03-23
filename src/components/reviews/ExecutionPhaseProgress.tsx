import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useReviewCasePhases } from '@/hooks/useTaskPhaseStatus';
import type { ExecutionPhase } from '@/types';

const PHASE_I18N_KEYS: Record<ExecutionPhase, string> = {
  1: 'tasks.phases.phase1',
  2: 'tasks.phases.phase2',
  3: 'tasks.phases.phase3',
  4: 'tasks.phases.phase4',
};

interface ExecutionPhaseProgressProps {
  reviewCaseId: string;
}

export function ExecutionPhaseProgress({ reviewCaseId }: ExecutionPhaseProgressProps) {
  const { t } = useTranslation();
  const { data: phases = [] } = useReviewCasePhases(reviewCaseId);
  const [expanded, setExpanded] = useState(true);

  if (phases.length === 0) return null;

  // Determine which phases are unlocked
  const getPhaseState = (phase: number): 'complete' | 'active' | 'locked' => {
    const phaseData = phases.find(p => p.phase === phase);
    if (!phaseData) return 'locked';
    if (phaseData.is_complete) return 'complete';

    // Check if all prior phases are complete
    for (let i = 1; i < phase; i++) {
      const prior = phases.find(p => p.phase === i);
      if (prior && !prior.is_complete) return 'locked';
    }
    return 'active';
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-semibold text-foreground">{t('tasks.phases.title')}</span>
      </button>

      {expanded && (
        <div className="space-y-2.5 pt-1">
          {phases.map((phaseData) => {
            const state = getPhaseState(phaseData.phase);
            const pct = phaseData.total > 0 ? Math.round((phaseData.completed / phaseData.total) * 100) : 0;
            const phaseKey = PHASE_I18N_KEYS[phaseData.phase as ExecutionPhase] || `Phase ${phaseData.phase}`;

            return (
              <div key={phaseData.phase} className={`flex items-center gap-3 ${state === 'locked' ? 'opacity-50' : ''}`}>
                {/* Icon */}
                <div className="shrink-0 w-5 flex justify-center">
                  {state === 'complete' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {state === 'active' && <Circle className="h-4 w-4 text-primary fill-primary" />}
                  {state === 'locked' && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>

                {/* Label */}
                <span className={`text-sm font-medium min-w-[180px] shrink-0 ${
                  state === 'complete' ? 'text-emerald-700 dark:text-emerald-400' :
                  state === 'active' ? 'text-foreground' :
                  'text-muted-foreground'
                }`}>
                  {t(phaseKey)}
                </span>

                {/* Progress bar */}
                <div className="flex-1 min-w-0">
                  <Progress
                    value={pct}
                    className={`h-1.5 ${
                      state === 'complete' ? '[&>div]:bg-emerald-500' :
                      state === 'active' ? '' :
                      '[&>div]:bg-muted-foreground/30'
                    }`}
                  />
                </div>

                {/* Counter */}
                <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-[70px] text-right">
                  {phaseData.completed}/{phaseData.total} · {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
