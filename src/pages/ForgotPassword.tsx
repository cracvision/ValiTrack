import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Mail, Globe, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const LOGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/images/ValiTrack_Logo_Transparent_v2.png?v=1`;

export default function ForgotPassword() {
  const { t, i18n } = useTranslation('auth');
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // System theme (same as login page)
  useEffect(() => {
    const apply = () => {
      const hour = new Date().getHours();
      const dark = hour < 6 || hour >= 18;
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    const interval = setInterval(apply, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await supabase.functions.invoke('request-password-reset', {
        body: { email: email.trim() },
      });
    } catch {
      // Ignore errors — always show success
    }

    setSubmitting(false);
    setSent(true);
    setCooldown(60);
    toast({
      title: t('resetEmailSent'),
      description: t('resetEmailSent'),
    });
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
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
          <CardTitle className="text-2xl">{t('forgotPasswordTitle')}</CardTitle>
          <CardDescription>{t('forgotPasswordSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/40 p-4 text-center">
                <p className="text-sm text-foreground">{t('resetEmailSent')}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={cooldown > 0}
                onClick={() => setSent(false)}
              >
                {cooldown > 0
                  ? `${t('sendInstructions')} (${cooldown}s)`
                  : t('sendInstructions')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('emailLabel')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting || cooldown > 0}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {cooldown > 0
                  ? `${t('sendInstructions')} (${cooldown}s)`
                  : t('sendInstructions')}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('backToSignIn')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
