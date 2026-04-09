import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateFinding } from '@/hooks/useFindings';
import { FINDING_CATEGORIES, calculateRiskLevel } from '@/types/findings';
import type { FindingSeverity, FindingCategory, RiskRating } from '@/types/findings';

interface AddFindingDialogProps {
  reviewCaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFindingDialog({ reviewCaseId, open, onOpenChange }: AddFindingDialogProps) {
  const { t } = useTranslation();
  const createFinding = useCreateFinding();

  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<FindingSeverity>('minor');
  const [category, setCategory] = useState<FindingCategory>('other');
  const [description, setDescription] = useState('');
  const [regulationRef, setRegulationRef] = useState('');
  const [sopRef, setSopRef] = useState('');
  const [riskProbability, setRiskProbability] = useState<RiskRating | ''>('');
  const [riskImpact, setRiskImpact] = useState<RiskRating | ''>('');
  const [actionRequired, setActionRequired] = useState(false);
  const [actionDescription, setActionDescription] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [capaRequired, setCapaRequired] = useState(false);

  const riskLevel = calculateRiskLevel(riskProbability || null, riskImpact || null);

  const handleSubmit = async () => {
    await createFinding.mutateAsync({
      review_case_id: reviewCaseId,
      title: title.trim(),
      description: description.trim(),
      severity,
      category,
      source: 'manual',
      status: actionRequired ? 'in_progress' : 'confirmed',
      regulation_reference: regulationRef || null,
      sop_reference: sopRef || null,
      risk_probability: riskProbability || null,
      risk_impact: riskImpact || null,
      risk_level: riskLevel,
      ...(actionRequired ? {
        action_description: actionDescription || null,
        action_due_date: actionDueDate || null,
      } : {}),
      capa_required: capaRequired,
      capa_status: capaRequired ? 'pending' : 'not_required',
    });
    onOpenChange(false);
  };

  const isValid = title.trim().length > 0 && description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('findings.add.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('findings.labels.title')}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('findings.labels.severity')}</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as FindingSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['critical', 'major', 'minor', 'observation'] as const).map(s => (
                    <SelectItem key={s} value={s}>{t(`findings.severity.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('findings.labels.category')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as FindingCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINDING_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{t(`findings.category.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('findings.labels.description')}</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('findings.labels.regulationReference')}</Label>
              <Input value={regulationRef} onChange={e => setRegulationRef(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('findings.labels.sopReference')}</Label>
              <Input value={sopRef} onChange={e => setSopRef(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('findings.labels.riskProbability')}</Label>
              <Select value={riskProbability} onValueChange={(v) => setRiskProbability(v as RiskRating)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(['high', 'medium', 'low'] as const).map(r => (
                    <SelectItem key={r} value={r}>{t(`findings.risk.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('findings.labels.riskImpact')}</Label>
              <Select value={riskImpact} onValueChange={(v) => setRiskImpact(v as RiskRating)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(['high', 'medium', 'low'] as const).map(r => (
                    <SelectItem key={r} value={r}>{t(`findings.risk.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('findings.labels.riskLevel')}</Label>
              <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-sm">
                {riskLevel ? t(`findings.risk.${riskLevel}`) : '—'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="add-action" checked={actionRequired} onCheckedChange={(v) => setActionRequired(!!v)} />
            <Label htmlFor="add-action">{t('findings.confirm.actionRequired')}</Label>
          </div>
          {actionRequired && (
            <div className="space-y-3 pl-6">
              <div className="space-y-2">
                <Label>{t('findings.labels.actionDescription')}</Label>
                <Textarea value={actionDescription} onChange={e => setActionDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>{t('findings.labels.actionDueDate')}</Label>
                <Input type="date" value={actionDueDate} onChange={e => setActionDueDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="add-capa" checked={capaRequired} onCheckedChange={(v) => setCapaRequired(!!v)} />
            <Label htmlFor="add-capa">{t('findings.confirm.capaRequired')}</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createFinding.isPending}>
            {t('findings.add.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
