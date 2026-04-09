import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Bot } from 'lucide-react';
import { FINDING_CATEGORIES, calculateRiskLevel } from '@/types/findings';
import type { Finding, FindingSeverity, FindingCategory, RiskRating } from '@/types/findings';

interface ConfirmFindingDialogProps {
  finding: Finding;
  reviewCaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: { mutateAsync: (args: any) => Promise<any>; isPending: boolean };
}

export function ConfirmFindingDialog({ finding, reviewCaseId, open, onOpenChange, onConfirm }: ConfirmFindingDialogProps) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(finding.title);
  const [severity, setSeverity] = useState<FindingSeverity>(finding.severity);
  const [category, setCategory] = useState<FindingCategory>(finding.category);
  const [description, setDescription] = useState(finding.description);
  const [regulationRef, setRegulationRef] = useState(finding.regulation_reference || '');
  const [sopRef, setSopRef] = useState(finding.sop_reference || '');
  const [riskProbability, setRiskProbability] = useState<RiskRating | ''>(finding.risk_probability || '');
  const [riskImpact, setRiskImpact] = useState<RiskRating | ''>(finding.risk_impact || '');
  const [actionRequired, setActionRequired] = useState(false);
  const [actionDescription, setActionDescription] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [capaRequired, setCapaRequired] = useState(false);

  const riskLevel = calculateRiskLevel(
    riskProbability || null,
    riskImpact || null
  );

  const handleSubmit = async () => {
    await onConfirm.mutateAsync({
      findingId: finding.id,
      reviewCaseId,
      updates: {
        title,
        severity,
        category,
        description,
        regulation_reference: regulationRef || null,
        sop_reference: sopRef || null,
        risk_probability: riskProbability || null,
        risk_impact: riskImpact || null,
        risk_level: riskLevel,
        ...(actionRequired ? {
          action_description: actionDescription,
          action_due_date: actionDueDate || null,
        } : {}),
        capa_required: capaRequired,
        capa_status: capaRequired ? 'pending' : 'not_required',
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('findings.confirm.title')}</DialogTitle>
        </DialogHeader>

        {/* AI reference */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{t('findings.confirm.aiReference')}</span>
          </div>
          <p className="text-xs text-muted-foreground">{finding.description}</p>
          {finding.regulation_reference && (
            <Badge variant="outline" className="text-[10px]">{finding.regulation_reference}</Badge>
          )}
        </div>

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
              <Input value={regulationRef} onChange={e => setRegulationRef(e.target.value)} placeholder="e.g. 21 CFR Part 11.10(a)" />
            </div>
            <div className="space-y-2">
              <Label>{t('findings.labels.sopReference')}</Label>
              <Input value={sopRef} onChange={e => setSopRef(e.target.value)} placeholder="e.g. SOP-001" />
            </div>
          </div>

          {/* Risk assessment */}
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

          {/* Action required */}
          <div className="flex items-center gap-2">
            <Checkbox id="action-required" checked={actionRequired} onCheckedChange={(v) => setActionRequired(!!v)} />
            <Label htmlFor="action-required">{t('findings.confirm.actionRequired')}</Label>
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

          {/* CAPA required */}
          <div className="flex items-center gap-2">
            <Checkbox id="capa-required" checked={capaRequired} onCheckedChange={(v) => setCapaRequired(!!v)} />
            <Label htmlFor="capa-required">{t('findings.confirm.capaRequired')}</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !description.trim() || onConfirm.isPending}>
            {t('findings.actions.confirmFinding')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
