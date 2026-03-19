import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { STEPPER_PHASES } from '@/lib/reviewWorkflow';

interface ReviewPhaseStepperProps {
  currentPhase: string | null;
}

export function ReviewPhaseStepper({ currentPhase }: ReviewPhaseStepperProps) {
  const { t } = useTranslation();

  if (!currentPhase) return null;

  // Map old state names for backwards compat
  const mappedPhase = currentPhase === 'in_preparation' ? 'plan_review' : currentPhase === 'under_review' ? 'execution_review' : currentPhase;

  const currentPhaseIndex = STEPPER_PHASES.findIndex(p => p.states.includes(mappedPhase));

  return (
    <div className="py-2">
      <div className="flex gap-[3px]">
        {STEPPER_PHASES.map((phase, idx) => {
          const isCompleted = mappedPhase === 'approved' ? true : idx < currentPhaseIndex;
          const isActive = mappedPhase !== 'approved' && idx === currentPhaseIndex;
          return (
            <div
              key={phase.key}
              className={cn(
                'flex-1 rounded-full',
                isActive ? 'h-1.5 bg-primary' : 'h-1',
                isCompleted && 'bg-green-600',
                !isCompleted && !isActive && 'bg-muted',
              )}
            />
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1">
        {STEPPER_PHASES.map((phase, idx) => {
          const isActive = mappedPhase !== 'approved' && idx === currentPhaseIndex;
          return (
            <span
              key={phase.key}
              className={cn(
                'flex-1 text-[10px] text-center',
                isActive ? 'text-primary font-medium' : 'text-muted-foreground',
              )}
            >
              {t(phase.labelKey)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
