import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCreateReviewCase } from '@/hooks/useReviewCases';
import { calculateReviewLevel, REVIEW_LEVEL_CONFIG } from '@/lib/reviewWorkflow';
import { GAMP_SHORT_LABELS } from '@/lib/gxpClassifications';
import { GXP_SHORT_LABELS } from '@/lib/gxpClassifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import type { SystemProfile, GxPClassification, GampCategory } from '@/types';

interface CreateReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateReviewDialog({ open, onOpenChange }: CreateReviewDialogProps) {
  const { t } = useTranslation();
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const createMutation = useCreateReviewCase();
  const isSuperUser = roles.includes('super_user');

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSystemId, setSelectedSystemId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reviewPeriodStart, setReviewPeriodStart] = useState('');
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState('');
  const [reviewLevel, setReviewLevel] = useState('');

  // Fetch systems the user can create reviews for
  const { data: systems = [] } = useQuery({
    queryKey: ['systems-for-review', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_profiles')
        .select('*')
        .eq('is_deleted', false)
        .eq('status', 'Active')
        .order('name');

      if (error) throw error;
      return (data || []) as unknown as SystemProfile[];
    },
    enabled: open && !!user,
  });

  // Filter systems: SO sees only their systems, SU sees all
  const availableSystems = isSuperUser
    ? systems
    : systems.filter(s => s.system_owner_id === user?.id);

  const selectedSystem = availableSystems.find(s => s.id === selectedSystemId);

  const handleSystemSelect = (systemId: string) => {
    setSelectedSystemId(systemId);
    const system = availableSystems.find(s => s.id === systemId);
    if (!system) return;

    const year = new Date().getFullYear();
    setTitle(`${t('reviews.create.defaultTitle')} — ${system.name} — ${year}`);
    setReviewPeriodStart(system.validation_date || '');
    setReviewPeriodEnd(new Date().toISOString().split('T')[0]);
    setDueDate(system.next_review_date || '');
    setReviewLevel(calculateReviewLevel(system.risk_level, system.gamp_category));
  };

  const separationOfDutiesError = selectedSystem
    ? selectedSystem.system_owner_id === selectedSystem.qa_id
    : false;

  const handleNext = () => {
    if (!selectedSystem || separationOfDutiesError) return;
    setStep(2);
  };

  const handleCreate = async () => {
    if (!selectedSystem) return;
    try {
      const id = await createMutation.mutateAsync({
        system: selectedSystem,
        title,
        review_period_start: reviewPeriodStart,
        review_period_end: reviewPeriodEnd,
        review_level: reviewLevel,
        due_date: dueDate,
      });
      toast({ title: t('reviews.create.success') });
      onOpenChange(false);
      resetForm();
      navigate(`/reviews/${id}`);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedSystemId('');
    setTitle('');
    setDueDate('');
    setReviewPeriodStart('');
    setReviewPeriodEnd('');
    setReviewLevel('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const levelConfig = reviewLevel ? REVIEW_LEVEL_CONFIG[reviewLevel as '1' | '2' | '3'] : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('reviews.create.title')}</DialogTitle>
          <DialogDescription>
            {step === 1 ? t('reviews.create.step1Desc') : t('reviews.create.step2Desc')}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('reviews.create.selectSystem')}</Label>
              <Select value={selectedSystemId} onValueChange={handleSystemSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={t('reviews.create.selectSystemPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {availableSystems.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.system_identifier})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSystem && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {GXP_SHORT_LABELS[selectedSystem.gxp_classification as GxPClassification] ?? selectedSystem.gxp_classification}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">{selectedSystem.risk_level}</Badge>
                  <Badge variant="secondary" className="text-xs">{GAMP_SHORT_LABELS[selectedSystem.gamp_category as GampCategory]}</Badge>
                </div>
                {levelConfig && (
                  <p className="text-muted-foreground">
                    {levelConfig.label}: {levelConfig.description}
                  </p>
                )}
                {separationOfDutiesError && (
                  <p className="text-destructive text-xs font-medium">
                    {t('reviews.create.sodError')}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t('userForm.cancel')}
              </Button>
              <Button onClick={handleNext} disabled={!selectedSystem || separationOfDutiesError}>
                {t('reviews.create.next')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('reviews.create.reviewTitle')}</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('reviews.create.periodStart')}</Label>
                <Input type="date" value={reviewPeriodStart} onChange={e => setReviewPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('reviews.create.periodEnd')}</Label>
                <Input type="date" value={reviewPeriodEnd} onChange={e => setReviewPeriodEnd(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('reviews.create.level')}</Label>
                <Input value={levelConfig?.label || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>{t('reviews.create.dueDate')}</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                {t('reviews.create.back')}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !title || !dueDate || !reviewPeriodStart || !reviewPeriodEnd}
              >
                {createMutation.isPending ? t('common.loading') : t('reviews.create.submit')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
