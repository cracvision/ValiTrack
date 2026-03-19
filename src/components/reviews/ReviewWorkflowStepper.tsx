import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import type { ReviewStatus } from '@/types';

const STEPS: ReviewStatus[] = ['draft', 'in_preparation', 'in_progress', 'under_review', 'approved'];

interface ReviewWorkflowStepperProps {
  currentStatus: ReviewStatus;
}

export function ReviewWorkflowStepper({ currentStatus }: ReviewWorkflowStepperProps) {
  const { t } = useTranslation();
  const isRejected = currentStatus === 'rejected';

  // When rejected, current step goes back to draft visually
  const effectiveStatus = isRejected ? 'draft' : currentStatus;
  const currentIndex = effectiveStatus === 'approved' ? STEPS.length : STEPS.indexOf(effectiveStatus);

  return (
    <div className="py-4">
      {/* Step bar */}
      <div className="flex gap-1">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isActive = idx === currentIndex;
          const isRejectedStep = isRejected && step === 'under_review';

          return (
            <div
              key={step}
              className={cn(
                'flex-1 rounded-full transition-colors',
                isActive ? 'h-2 bg-primary' : 'h-1.5',
                isCompleted && 'bg-green-600',
                isRejectedStep && 'bg-destructive',
                !isCompleted && !isActive && !isRejectedStep && 'bg-muted',
              )}
            />
          );
        })}
      </div>

      {/* Step labels */}
      <div className="flex gap-1 mt-1.5">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isActive = idx === currentIndex;
          const isRejectedStep = isRejected && step === 'under_review';

          return (
            <div key={step} className="flex-1 flex flex-col items-center gap-0.5">
              {isCompleted && (
                <Check className="h-3 w-3 text-green-600" strokeWidth={2.5} />
              )}
              {isRejectedStep && (
                <X className="h-3 w-3 text-destructive" strokeWidth={2.5} />
              )}
              <span
                className={cn(
                  'text-[10px] text-center leading-tight',
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground',
                  isRejectedStep && 'text-destructive font-medium',
                )}
              >
                {isRejectedStep ? t('reviews.status.rejected') : t(`reviews.status.${step}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
