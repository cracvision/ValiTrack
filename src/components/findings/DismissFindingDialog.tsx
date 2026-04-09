import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bot } from 'lucide-react';
import type { Finding } from '@/types/findings';

interface DismissFindingDialogProps {
  finding: Finding;
  reviewCaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: { mutateAsync: (args: any) => Promise<any>; isPending: boolean };
}

export function DismissFindingDialog({ finding, reviewCaseId, open, onOpenChange, onDismiss }: DismissFindingDialogProps) {
  const { t } = useTranslation();
  const [justification, setJustification] = useState('');

  const handleSubmit = async () => {
    await onDismiss.mutateAsync({ findingId: finding.id, reviewCaseId, justification: justification.trim() });
    onOpenChange(false);
  };

  const isValid = justification.trim().length >= 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('findings.dismiss.title')}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            <Badge variant="outline" className="text-[10px]">
              {t(`findings.severity.${finding.severity}`).toUpperCase()}
            </Badge>
          </div>
          <p className="font-medium text-foreground text-sm">{finding.title}</p>
          <p className="text-xs text-muted-foreground">{finding.description}</p>
        </div>

        <div className="space-y-2">
          <Label>{t('findings.dismiss.justificationLabel')}</Label>
          <Textarea
            value={justification}
            onChange={e => setJustification(e.target.value)}
            rows={4}
            placeholder={t('findings.dismiss.justificationPlaceholder')}
          />
          {justification.length > 0 && justification.trim().length < 20 && (
            <p className="text-xs text-destructive">{t('findings.dismiss.minLength')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!isValid || onDismiss.isPending}>
            {t('findings.actions.dismissFinding')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
