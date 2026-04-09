import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Finding, CapaStatus } from '@/types/findings';

interface CloseFindingDialogProps {
  finding: Finding;
  reviewCaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: { mutateAsync: (args: any) => Promise<any>; isPending: boolean };
}

export function CloseFindingDialog({ finding, reviewCaseId, open, onOpenChange, onClose }: CloseFindingDialogProps) {
  const { t } = useTranslation();
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [capaReference, setCapaReference] = useState(finding.capa_reference || '');
  const [capaSystem, setCapaSystem] = useState(finding.capa_system || '');
  const [capaStatus, setCapaStatus] = useState<CapaStatus>(finding.capa_status || 'closed');

  const needsCapa = finding.capa_required && !finding.capa_reference;
  const isValid = resolutionNotes.trim().length >= 20 && (!needsCapa || capaReference.trim().length > 0);

  const handleSubmit = async () => {
    await onClose.mutateAsync({
      findingId: finding.id,
      reviewCaseId,
      resolutionNotes: resolutionNotes.trim(),
      ...(finding.capa_required ? { capaReference, capaSystem, capaStatus } : {}),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('findings.close.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('findings.close.resolutionNotes')}</Label>
            <Textarea
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder={t('findings.close.resolutionPlaceholder')}
            />
            {resolutionNotes.length > 0 && resolutionNotes.trim().length < 20 && (
              <p className="text-xs text-destructive">{t('findings.close.minLength')}</p>
            )}
          </div>

          {finding.capa_required && (
            <div className="space-y-3 rounded-lg border p-3">
              <h4 className="text-sm font-medium">{t('findings.close.capaSection')}</h4>
              <div className="space-y-2">
                <Label>{t('findings.labels.capaReference')}</Label>
                <Input value={capaReference} onChange={e => setCapaReference(e.target.value)} placeholder="e.g. CAPA-2026-0042" />
              </div>
              <div className="space-y-2">
                <Label>{t('findings.labels.capaSystem')}</Label>
                <Input value={capaSystem} onChange={e => setCapaSystem(e.target.value)} placeholder="e.g. TrackWise, Veeva" />
              </div>
              <div className="space-y-2">
                <Label>{t('findings.labels.capaStatus')}</Label>
                <Select value={capaStatus} onValueChange={(v) => setCapaStatus(v as CapaStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['closed', 'verified'] as const).map(s => (
                      <SelectItem key={s} value={s}>{t(`findings.capaStatus.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!isValid || onClose.isPending}>
            {t('findings.actions.closeFinding')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
