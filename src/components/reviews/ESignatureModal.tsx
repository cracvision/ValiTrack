import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ReviewConclusion } from '@/types';

interface ESignatureModalProps {
  open: boolean;
  onClose: () => void;
  onSign: (password: string, reason: string, conclusion?: ReviewConclusion) => Promise<void>;
  actionLabel: string;
  reviewTitle: string;
  signerName: string;
  signerRole: string;
  showConclusion: boolean;
  isLoading: boolean;
  error: string | null;
}

export function ESignatureModal({
  open,
  onClose,
  onSign,
  actionLabel,
  reviewTitle,
  signerName,
  signerRole,
  showConclusion,
  isLoading,
  error,
}: ESignatureModalProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [conclusion, setConclusion] = useState<ReviewConclusion | ''>('');

  const reasonValid = reason.trim().length >= 10;
  const conclusionValid = !showConclusion || !!conclusion;
  const canSubmit = password.length > 0 && reasonValid && conclusionValid && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSign(password, reason.trim(), conclusion || undefined);
  };

  const handleClose = () => {
    setPassword('');
    setReason('');
    setConclusion('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {t('esignature.title')}
          </DialogTitle>
          <DialogDescription>
            {t('esignature.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('esignature.action')}:</span>
              <span className="font-medium text-foreground">{actionLabel}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('esignature.review')}:</span>
              <span className="text-foreground">{reviewTitle}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('esignature.signedBy')}:</span>
              <span className="text-foreground">{signerName} ({signerRole})</span>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label>{t('esignature.password')}</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {/* Conclusion (only for final approval) */}
          {showConclusion && (
            <div className="space-y-2">
              <Label>{t('esignature.conclusion')} *</Label>
              <RadioGroup value={conclusion} onValueChange={v => setConclusion(v as ReviewConclusion)}>
                {(['remains_validated', 'requires_remediation', 'requires_revalidation'] as const).map(c => (
                  <div key={c} className="flex items-center space-x-2">
                    <RadioGroupItem value={c} id={`conclusion-${c}`} />
                    <Label htmlFor={`conclusion-${c}`} className="cursor-pointer font-normal">
                      {t(`esignature.${c === 'remains_validated' ? 'remainsValidated' : c === 'requires_remediation' ? 'requiresRemediation' : 'requiresRevalidation'}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {!conclusion && (
                <p className="text-xs text-destructive">{t('esignature.conclusionRequired')}</p>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>{t('esignature.reason')} *</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('esignature.reasonPlaceholder')}
              rows={3}
            />
            {reason.length > 0 && !reasonValid && (
              <p className="text-xs text-destructive">{t('esignature.reasonMinLength')}</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground italic">
            ⚠️ {t('esignature.disclaimer')}
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('esignature.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isLoading ? t('esignature.verifying') : t('esignature.signAndSubmit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
