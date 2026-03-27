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
      // 1. Soft-delete the review case (draft-only guard)
      const { data, error } = await supabase
        .from('review_cases')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', reviewCase.id)
        .eq('status', 'draft')
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: t('reviews.deleteModal.deleteError'),
          variant: 'destructive',
        });
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: ['review-case', reviewCase.id] });
        return;
      }

      // 2. Audit log entry
      const snapshot = reviewCase.frozen_system_snapshot as Record<string, any>;
      await supabase.from('audit_log').insert({
        action: 'REVIEW_CASE_DELETED',
        resource_type: 'review_case',
        resource_id: reviewCase.id,
        user_id: user.id,
        details: {
          system_name: reviewCase.system_name,
          system_id: reviewCase.system_id,
          review_period: `${reviewCase.review_period_start} — ${reviewCase.review_period_end}`,
          review_level: reviewCase.review_level,
          reason: reason.trim(),
          initiated_by: userNames[reviewCase.initiated_by] || reviewCase.initiated_by,
          deleted_by: userNames[user.id] || user.id,
        },
      });

      // 3. Success
      toast({ title: t('reviews.deleteModal.deleteSuccess') });
      queryClient.invalidateQueries({ queryKey: ['review-cases'] });
      queryClient.invalidateQueries({ queryKey: ['review-case', reviewCase.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-systems'] });
      navigate('/reviews');
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
