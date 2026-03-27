import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRoleUsers } from '@/hooks/useRoleUsers';
import { calculateReviewLevel, REVIEW_LEVEL_CONFIG } from '@/lib/reviewWorkflow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import type { ReviewCase, ReviewLevel } from '@/types';

interface EditReviewDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewCase: ReviewCase;
}

export function EditReviewDraftDialog({ open, onOpenChange, reviewCase }: EditReviewDraftDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [reviewPeriodStart, setReviewPeriodStart] = useState(reviewCase.review_period_start);
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState(reviewCase.review_period_end);
  const [reviewLevel, setReviewLevel] = useState(reviewCase.review_level);
  const [systemOwnerId, setSystemOwnerId] = useState(reviewCase.system_owner_id);
  const [systemAdminId, setSystemAdminId] = useState(reviewCase.system_admin_id);
  const [qaId, setQaId] = useState(reviewCase.qa_id);
  const [businessOwnerId, setBusinessOwnerId] = useState(reviewCase.business_owner_id || '');
  const [itManagerId, setItManagerId] = useState(reviewCase.it_manager_id || '');
  const [saving, setSaving] = useState(false);
  const [completionWindowDays, setCompletionWindowDays] = useState<number | null>(null);

  // Role user dropdowns
  const { users: soUsers, loading: soLoading } = useRoleUsers('system_owner');
  const { users: saUsers, loading: saLoading } = useRoleUsers('system_administrator');
  const { users: qaUsers, loading: qaLoading } = useRoleUsers('quality_assurance');
  const { users: boUsers, loading: boLoading } = useRoleUsers('business_owner');
  const { users: itUsers, loading: itLoading } = useRoleUsers('it_manager');

  // Fetch completion_window_days from the system profile
  useEffect(() => {
    async function fetchWindow() {
      const { data, error } = await supabase
        .from('system_profiles')
        .select('completion_window_days')
        .eq('id', reviewCase.system_id)
        .single();
      if (!error && data) {
        setCompletionWindowDays(data.completion_window_days);
      }
    }
    if (open) fetchWindow();
  }, [open, reviewCase.system_id]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setReviewPeriodStart(reviewCase.review_period_start);
      setReviewPeriodEnd(reviewCase.review_period_end);
      setReviewLevel(reviewCase.review_level);
      setSystemOwnerId(reviewCase.system_owner_id);
      setSystemAdminId(reviewCase.system_admin_id);
      setQaId(reviewCase.qa_id);
      setBusinessOwnerId(reviewCase.business_owner_id || '');
      setItManagerId(reviewCase.it_manager_id || '');
    }
  }, [open, reviewCase]);

  // Calculated due date
  const calculatedDueDate = useMemo(() => {
    if (!reviewPeriodEnd || completionWindowDays === null) return null;
    const d = new Date(reviewPeriodEnd + 'T00:00:00');
    d.setDate(d.getDate() + completionWindowDays);
    return d.toISOString().split('T')[0];
  }, [reviewPeriodEnd, completionWindowDays]);

  // Suggested review level from frozen snapshot
  const snapshot = reviewCase.frozen_system_snapshot as Record<string, any>;
  const suggestedLevel = calculateReviewLevel(snapshot.risk_level, snapshot.gamp_category);

  // Validation
  const sodError = systemOwnerId === qaId && systemOwnerId !== '';
  const dateError = reviewPeriodStart && reviewPeriodEnd && reviewPeriodStart >= reviewPeriodEnd;
  const missingRequired = !systemOwnerId || !systemAdminId || !qaId || !reviewPeriodStart || !reviewPeriodEnd;

  const canSave = !sodError && !dateError && !missingRequired && !saving && completionWindowDays !== null;

  const handleSave = async () => {
    if (!canSave || !user || completionWindowDays === null) return;
    setSaving(true);

    try {
      const dueDate = calculatedDueDate;
      if (!dueDate) {
        toast({ title: t('reviews.editModal.editError'), description: 'Could not calculate due date.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      // Build the update payload — only include changed fields
      const updates: Record<string, any> = {};
      const changes: Record<string, { from: any; to: any }> = {};

      const check = (field: string, oldVal: any, newVal: any) => {
        const normalizedOld = oldVal || null;
        const normalizedNew = newVal || null;
        if (normalizedOld !== normalizedNew) {
          updates[field] = normalizedNew;
          changes[field] = { from: normalizedOld, to: normalizedNew };
        }
      };

      check('review_period_start', reviewCase.review_period_start, reviewPeriodStart);
      check('review_period_end', reviewCase.review_period_end, reviewPeriodEnd);
      check('review_level', reviewCase.review_level, reviewLevel);
      check('system_owner_id', reviewCase.system_owner_id, systemOwnerId);
      check('system_admin_id', reviewCase.system_admin_id, systemAdminId);
      check('qa_id', reviewCase.qa_id, qaId);
      check('business_owner_id', reviewCase.business_owner_id || null, businessOwnerId || null);
      check('it_manager_id', reviewCase.it_manager_id || null, itManagerId || null);

      // Always recalculate due_date if period_end changed
      if (changes['review_period_end']) {
        updates['due_date'] = dueDate;
        changes['due_date'] = { from: reviewCase.due_date, to: dueDate };
      }

      if (Object.keys(changes).length === 0) {
        toast({ title: t('reviews.editModal.editSuccess') });
        onOpenChange(false);
        setSaving(false);
        return;
      }

      updates['updated_at'] = new Date().toISOString();
      updates['updated_by'] = user.id;

      // Do NOT update frozen_system_snapshot — it is immutable
      const { error } = await supabase
        .from('review_cases')
        .update(updates)
        .eq('id', reviewCase.id)
        .eq('status', 'draft'); // Backend safety: only allow edits in draft

      if (error) throw error;

      // Audit log
      await supabase.from('audit_log').insert({
        action: 'REVIEW_CASE_EDITED',
        resource_type: 'review_case',
        resource_id: reviewCase.id,
        user_id: user.id,
        details: { changes },
      });

      // Info toast if review level changed
      if (changes['review_level']) {
        toast({
          title: t('reviews.editModal.reviewLevelChanged', { level: reviewLevel }),
        });
      }

      toast({ title: t('reviews.editModal.editSuccess') });
      queryClient.invalidateQueries({ queryKey: ['review-case', reviewCase.id] });
      queryClient.invalidateQueries({ queryKey: ['review-cases'] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t('reviews.editModal.editError'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const renderRoleSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    users: { id: string; full_name: string; username: string | null }[],
    loading: boolean,
    required: boolean = true,
  ) => (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? t('common.loading') : '—'} />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="__none__">—</SelectItem>}
          {users.map(u => (
            <SelectItem key={u.id} value={u.id}>
              {u.full_name}{u.username ? ` (@${u.username})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('reviews.editModal.title')}</DialogTitle>
          <DialogDescription>{reviewCase.system_name} — {new Date(reviewCase.review_period_end).getFullYear()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Section 1: Review Period */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{t('reviews.editModal.reviewPeriodSection')}</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{t('reviews.editModal.periodStartDate')} <span className="text-destructive">*</span></Label>
                <Input type="date" value={reviewPeriodStart} onChange={e => setReviewPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t('reviews.editModal.periodEndDate')} <span className="text-destructive">*</span></Label>
                <Input type="date" value={reviewPeriodEnd} onChange={e => setReviewPeriodEnd(e.target.value)} />
              </div>
            </div>

            {dateError && (
              <p className="text-destructive text-xs">{t('reviews.editModal.periodStartDate')} must be before {t('reviews.editModal.periodEndDate')}.</p>
            )}

            {/* Auto-calculated due date */}
            {calculatedDueDate && completionWindowDays !== null && (
              <div className="bg-muted/50 rounded p-2">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">{t('reviews.detail.completionDue')}:</span> {calculatedDueDate}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('reviews.editModal.completionDueAuto', { days: completionWindowDays })}
                </p>
              </div>
            )}

            {/* Review Level */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t('reviews.editModal.reviewLevel')}</Label>
              <Select value={reviewLevel} onValueChange={v => setReviewLevel(v as ReviewLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['1', '2', '3'] as const).map(l => (
                    <SelectItem key={l} value={l}>
                      {REVIEW_LEVEL_CONFIG[l].label} — {REVIEW_LEVEL_CONFIG[l].description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('reviews.editModal.reviewLevelHelper', { level: suggestedLevel })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Section 2: Role Assignments */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{t('reviews.editModal.roleAssignmentsSection')}</h4>

            {renderRoleSelect(t('reviews.detail.roles.systemOwner'), systemOwnerId, setSystemOwnerId, soUsers, soLoading)}
            {renderRoleSelect(t('reviews.detail.roles.systemAdmin'), systemAdminId, setSystemAdminId, saUsers, saLoading)}
            {renderRoleSelect(t('reviews.detail.roles.qa'), qaId, setQaId, qaUsers, qaLoading)}

            {sodError && (
              <p className="text-destructive text-xs font-medium">{t('reviews.editModal.separationOfDuties')}</p>
            )}

            {renderRoleSelect(t('reviews.detail.roles.businessOwner'), businessOwnerId, v => setBusinessOwnerId(v === '__none__' ? '' : v), boUsers, boLoading, false)}
            {renderRoleSelect(t('reviews.detail.roles.itManager'), itManagerId, v => setItManagerId(v === '__none__' ? '' : v), itUsers, itLoading, false)}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('reviews.editModal.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {saving ? t('common.loading') : t('reviews.editModal.saveChanges')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}