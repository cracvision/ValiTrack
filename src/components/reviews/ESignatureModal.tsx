import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ReviewConclusion } from '@/types';

export interface ESignatureResult {
  reason: string;
  comment: string;
  conclusion?: ReviewConclusion;
}

interface ESignatureModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: ESignatureResult) => void;
  actionTitle: string;
  actionDescription: string;
  transitionLabel: string;
  resourceId: string;
  resourceType: string;
  additionalAuditDetails?: Record<string, unknown>;
  showConclusionSelector?: boolean;
  showReasonField?: boolean;
}

export function ESignatureModal({
  open,
  onClose,
  onSuccess,
  actionTitle,
  actionDescription,
  transitionLabel,
  resourceId,
  resourceType,
  additionalAuditDetails,
  showConclusionSelector = false,
  showReasonField = false,
}: ESignatureModalProps) {
  const { t, i18n } = useTranslation();
  const { user, profile, roles } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [conclusion, setConclusion] = useState<ReviewConclusion | ''>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const reasonValid = !showReasonField || reason.trim().length >= 10;
  const conclusionValid = !showConclusionSelector || !!conclusion;
  const canSubmit = password.length > 0 && reasonValid && conclusionValid && !isVerifying;

  const resetState = useCallback(() => {
    setPassword('');
    setShowPassword(false);
    setReason('');
    setComment('');
    setConclusion('');
    setPasswordError(null);
    setIsVerifying(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const signerRoleLabel = roles.includes('quality_assurance')
    ? t('reviews.detail.roles.qa')
    : roles.includes('super_user')
      ? 'Super User'
      : roles[0] || '';

  const now = new Date();
  const formattedDate = now.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const logAuditEntry = async (action: 'E_SIGNATURE' | 'E_SIGNATURE_FAILED', extraDetails: Record<string, any> = {}) => {
    if (!user) return;
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: {
        transition: transitionLabel,
        signer_name: profile?.full_name || '',
        signer_role: signerRoleLabel,
        signer_email: user.email,
        verified_at: new Date().toISOString(),
        ...additionalAuditDetails,
        ...extraDetails,
      },
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setIsVerifying(true);
    setPasswordError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });

      if (authError) {
        await logAuditEntry('E_SIGNATURE_FAILED', {
          reason: 'Password verification failed',
        });
        setPasswordError(t('esignature.incorrectPassword'));
        setIsVerifying(false);
        return;
      }

      // Log successful signature
      await logAuditEntry('E_SIGNATURE', {
        reason: reason.trim() || null,
        comment: comment.trim() || null,
        conclusion: conclusion || null,
      });

      const result: ESignatureResult = {
        reason: reason.trim(),
        comment: comment.trim(),
        conclusion: conclusion || undefined,
      };

      resetState();
      onSuccess(result);
    } catch (err: any) {
      setPasswordError(t('esignature.verificationError'));
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {t('esignature.title')}
          </DialogTitle>
          <DialogDescription>
            {t('esignature.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {/* Signer info card */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('esignature.signerName')}:</span>
              <span className="font-medium text-foreground">{profile?.full_name || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('esignature.signerRole')}:</span>
              <span className="text-foreground">{signerRoleLabel}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('esignature.signerDate')}:</span>
              <span className="text-foreground">{formattedDate}, {formattedTime}</span>
            </div>
          </div>

          {/* Action description */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('esignature.action')}:</span>
              <span className="font-medium text-foreground">{actionTitle}</span>
            </div>
            {actionDescription && (
              <p className="text-xs text-muted-foreground mt-1">{actionDescription}</p>
            )}
          </div>

          {/* Conclusion selector */}
          {showConclusionSelector && (
            <div className="space-y-2">
              <Label>{t('esignature.conclusionLabel')} *</Label>
              <RadioGroup value={conclusion} onValueChange={v => setConclusion(v as ReviewConclusion)}>
                {(['remains_validated', 'requires_remediation', 'requires_revalidation'] as const).map(c => (
                  <div key={c} className="flex items-center space-x-2">
                    <RadioGroupItem value={c} id={`esig-conclusion-${c}`} />
                    <Label htmlFor={`esig-conclusion-${c}`} className="cursor-pointer font-normal">
                      {t(`esignature.conclusions.${c}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {!conclusion && (
                <p className="text-xs text-destructive">{t('esignature.conclusionRequired')}</p>
              )}
            </div>
          )}

          {/* Reason field */}
          {showReasonField && (
            <div className="space-y-2">
              <Label>{t('esignature.reasonLabel')} *</Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t('esignature.reasonPlaceholder')}
                rows={3}
              />
              <div className="flex justify-between">
                {reason.length > 0 && !reasonValid && (
                  <p className="text-xs text-destructive">{t('esignature.reasonMinLength')}</p>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{reason.length}/10 min</span>
              </div>
            </div>
          )}

          {/* Comment field (always visible) */}
          <div className="space-y-2">
            <Label>{t('esignature.comment')}</Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('esignature.commentPlaceholder')}
              rows={2}
            />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <Label>{t('esignature.password')} *</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(null); }}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordError && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">{passwordError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Amber legal disclaimer */}
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-neutral-800 dark:text-amber-400 dark:border-neutral-700">
            <p className="text-xs text-amber-800 dark:text-amber-400">
              ⚠️ {t('esignature.disclaimer')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
              {t('esignature.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
              <Lock className="h-4 w-4" />
              {isVerifying ? t('esignature.verifying') : t('esignature.signAndSubmit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
