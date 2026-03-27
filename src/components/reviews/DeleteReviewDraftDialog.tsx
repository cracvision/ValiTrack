import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import type { ReviewCase } from '@/types';

interface DeleteReviewDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewCase: ReviewCase;
}

export function DeleteReviewDraftDialog({ open, onOpenChange, reviewCase }: DeleteReviewDraftDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: userNames = {} } = useResolveUserNames(
    [reviewCase.initiated_by, user?.id].filter(Boolean) as string[]
  );

  const reviewYear = new Date(reviewCase.review_period_end).getFullYear();
  const reviewName = `${reviewCase.title} — ${reviewCase.system_name} — ${reviewYear}`;
  const isReasonValid = reason.trim().length >= 10;

  const handleDelete = async () => {
    if (!user || !isReasonValid) return;
    setIsDeleting(true);

    try {
      const { data, error } = await supabase.rpc('soft_delete_review_case', {
        p_review_case_id: reviewCase.id,
        p_reason: reason.trim(),
      });

      if (error) throw error;

      if (data === 'deleted') {
        toast({ title: t('reviews.deleteModal.deleteSuccess') });
        queryClient.invalidateQueries({ queryKey: ['review-cases'] });
        queryClient.invalidateQueries({ queryKey: ['review-case', reviewCase.id] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-systems'] });
        navigate('/reviews');
      } else {
        // not_found, not_draft, forbidden, already_deleted
        toast({
          title: t('reviews.deleteModal.deleteError'),
          variant: 'destructive',
        });
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: ['review-case', reviewCase.id] });
      }
    } catch (err) {
      console.error('Delete review case error:', err);
      toast({
        title: t('reviews.deleteModal.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('reviews.deleteModal.title')}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span>{t('reviews.deleteModal.description')}</span>
            <span className="block font-semibold text-foreground mt-2">
              {t('reviews.deleteModal.confirmTarget', { reviewName })}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="delete-reason">{t('reviews.deleteModal.reasonLabel')}</Label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reviews.deleteModal.reasonPlaceholder')}
            className="min-h-[80px]"
          />
          {reason.length > 0 && !isReasonValid && (
            <p className="text-xs text-destructive">{t('reviews.deleteModal.reasonMinLength')}</p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {t('reviews.deleteModal.cancel')}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!isReasonValid || isDeleting}
            onClick={handleDelete}
          >
            {t('reviews.deleteModal.delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
