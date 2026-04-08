import { useState, useEffect } from 'react';
import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Loader2, Lock, Eye, EyeOff, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { isPasswordValid } from '@/lib/passwordValidation';
import { supabase } from '@/integrations/supabase/client';

const LOGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/images/ValiTrack_Logo_Transparent_v2.png?v=1`;

export default function ResetPassword() {
  const { t, i18n } = useTranslation('auth');
  const tCommon = useTranslation().t;
  const { user, profile, loading, updatePassword } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');
  const isTokenFlow = !!(token && emailParam);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // System theme for token flow (unauthenticated)
  useEffect(() => {
    if (!isTokenFlow) return;
    const apply = () => {
      const hour = new Date().getHours();
      const dark = hour < 6 || hour >= 18;
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    const interval = setInterval(apply, 60_000);
    return () => clearInterval(interval);
  }, [isTokenFlow]);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  // ── Token-based flow (unauthenticated) ──
  if (isTokenFlow) {
    const passwordValid = isPasswordValid(newPassword, emailParam ?? undefined);
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

    const handleTokenSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!passwordValid) {
        toast({ title: tCommon('common.error'), description: tCommon('resetPassword.notMeetReqs'), variant: 'destructive' });
        return;
      }
      if (!passwordsMatch) {
        toast({ title: tCommon('common.error'), description: t('passwordsDoNotMatch'), variant: 'destructive' });
        return;
      }

      setSubmitting(true);
      setTokenError(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke('complete-password-reset', {
          body: { token, email: emailParam, new_password: newPassword },
        });

        if (invokeError || !data?.success) {
          const errorCode = data?.error;
          if (errorCode === 'expired_token') {
            setTokenError(t('resetLinkExpired'));
          } else if (errorCode === 'invalid_token') {
            setTokenError(t('resetLinkInvalid'));
          } else if (errorCode === 'password_policy' || errorCode === 'password_history') {
            setTokenError(data?.message || tCommon('resetPassword.notMeetReqs'));
          } else {
            setTokenError(data?.message || t('resetLinkInvalid'));
          }
          setSubmitting(false);
          return;
        }

        toast({ title: t('resetPasswordSuccess') });
        // Redirect to auth
        window.location.href = '/auth';
      } catch {
        setTokenError(t('resetLinkInvalid'));
        setSubmitting(false);
      }
    };

    return (
      <div className="relative flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4 gap-1.5 text-muted-foreground"
          onClick={toggleLanguage}
        >
          <Globe className="h-4 w-4" />
          {i18n.language === 'es' ? 'EN' : 'ES'}
        </Button>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img src={LOGO_URL} alt="ValiTrack" className="h-28 w-28 object-contain" />
            </div>
            <CardTitle className="text-2xl">{t('resetPasswordTitle')}</CardTitle>
            <CardDescription>{t('forgotPasswordSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {tokenError && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-center">
                <p className="text-sm text-destructive">{tokenError}</p>
                <Link
                  to="/forgot-password"
                  className="mt-2 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {t('forgotPasswordTitle')}
                </Link>
              </div>
            )}

            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{tCommon('resetPassword.newPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    placeholder={tCommon('resetPassword.placeholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>

              {newPassword.length > 0 && (
                <PasswordRequirements password={newPassword} email={emailParam ?? undefined} />
              )}

              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder={tCommon('resetPassword.confirmPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">{t('passwordsDoNotMatch')}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting || !passwordValid || !passwordsMatch}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('resetPasswordButton')}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                to="/auth"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {t('backToSignIn')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Authenticated "must change password" flow (existing behavior) ──
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (user && profile && !profile.must_change_password) return <Navigate to="/dashboard" replace />;

  const passwordValid = isPasswordValid(newPassword, user?.email ?? undefined);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast({ title: tCommon('common.error'), description: tCommon('resetPassword.notMeetReqs'), variant: 'destructive' });
      return;
    }
    if (!passwordsMatch) {
      toast({ title: tCommon('common.error'), description: tCommon('resetPassword.mismatch'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { error } = await updatePassword(newPassword);
    setSubmitting(false);

    if (error) {
      toast({ title: tCommon('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: tCommon('resetPassword.updated'), description: tCommon('resetPassword.updatedDesc') });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{tCommon('resetPassword.title')}</CardTitle>
          <CardDescription>{tCommon('resetPassword.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{tCommon('resetPassword.newPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  placeholder={tCommon('resetPassword.placeholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            {newPassword.length > 0 && (
              <PasswordRequirements password={newPassword} email={user?.email ?? undefined} />
            )}

            <div className="space-y-2">
              <Label htmlFor="confirm-password">{tCommon('resetPassword.confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  placeholder={tCommon('resetPassword.confirmPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">{tCommon('resetPassword.mismatch')}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting || !passwordValid || !passwordsMatch}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tCommon('resetPassword.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
