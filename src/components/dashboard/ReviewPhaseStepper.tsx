import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type Phase = 'draft' | 'in_preparation' | 'in_progress' | 'under_review' | 'approved';

interface ReviewPhaseStepperProps {
  currentPhase: Phase | null;
}

const PHASES: Phase[] = ['draft', 'in_preparation', 'in_progress', 'under_review', 'approved'];

export function ReviewPhaseStepper({ currentPhase }: ReviewPhaseStepperProps) {
  const { t } = useTranslation();

  if (!currentPhase) return null;

  const currentIndex = PHASES.indexOf(currentPhase);

  return (
    <div className="py-2">
      <div className="flex gap-[3px]">
        {PHASES.map((phase, idx) => {
          const isCompleted = idx < currentIndex;
          const isActive = idx === currentIndex;
          return (
            <div
              key={phase}
              className={cn(
                'flex-1 rounded-full',
                isActive ? 'h-1.5 bg-blue-600' : 'h-1',
                isCompleted && 'bg-green-600',
                !isCompleted && !isActive && 'bg-muted',
              )}
            />
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1">
        {PHASES.map((phase, idx) => {
          const isActive = idx === currentIndex;
          return (
            <span
              key={phase}
              className={cn(
                'flex-1 text-[10px] text-center',
                isActive ? 'text-blue-600 font-medium' : 'text-muted-foreground',
              )}
            >
              {t(`dashboard.phases.${phase}`)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
