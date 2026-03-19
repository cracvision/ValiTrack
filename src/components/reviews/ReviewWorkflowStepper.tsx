import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { STEPPER_PHASES } from '@/lib/reviewWorkflow';
import type { ReviewStatus } from '@/types';

interface ReviewWorkflowStepperProps {
  currentStatus: ReviewStatus;
}

type PhaseState = 'completed' | 'active' | 'upcoming' | 'rejected';

function getPhaseState(phaseIndex: number, currentStatus: ReviewStatus): PhaseState {
  if (currentStatus === 'approved') return 'completed';

  if (currentStatus === 'rejected') {
    // Rejection happens from execution_review (phase index 3)
    if (phaseIndex < 3) return 'completed';
    if (phaseIndex === 3) return 'rejected';
    return 'upcoming';
  }

  const currentPhaseIndex = STEPPER_PHASES.findIndex(p => p.states.includes(currentStatus));
  if (phaseIndex < currentPhaseIndex) return 'completed';
  if (phaseIndex === currentPhaseIndex) return 'active';
  return 'upcoming';
}

export function ReviewWorkflowStepper({ currentStatus }: ReviewWorkflowStepperProps) {
  const { t } = useTranslation();

  return (
    <div className="py-4">
      {/* Phase bars */}
      <div className="flex gap-1">
        {STEPPER_PHASES.map((phase, idx) => {
          const state = getPhaseState(idx, currentStatus);
          return (
            <div
              key={phase.key}
              className={cn(
                'flex-1 rounded-full transition-colors',
                state === 'active' ? 'h-2 bg-primary' : 'h-1.5',
                state === 'completed' && 'bg-green-600',
                state === 'rejected' && 'bg-destructive',
                state === 'upcoming' && 'bg-muted',
              )}
            />
          );
        })}
      </div>

      {/* Phase labels */}
      <div className="flex gap-1 mt-1.5">
        {STEPPER_PHASES.map((phase, idx) => {
          const state = getPhaseState(idx, currentStatus);
          return (
            <div key={phase.key} className="flex-1 flex flex-col items-center gap-0.5">
              {state === 'completed' && (
                <Check className="h-3 w-3 text-green-600" strokeWidth={2.5} />
              )}
              {state === 'rejected' && (
                <X className="h-3 w-3 text-destructive" strokeWidth={2.5} />
              )}
              <span
                className={cn(
                  'text-[10px] text-center leading-tight',
                  state === 'active' ? 'text-primary font-medium' : 'text-muted-foreground',
                  state === 'rejected' && 'text-destructive font-medium',
                )}
              >
                {state === 'rejected' ? t('reviews.status.rejected') : t(phase.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
