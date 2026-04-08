import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Lock, Eye, EyeOff, Mail, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const LOGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/images/ValiTrack_Logo_Transparent_v2.png?v=1`;

export default function Auth() {
  const { t, i18n } = useTranslation('auth');
  const { user, profile, loading, signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Apply system theme on login page (6am-6pm = light, else dark)
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    if (profile?.must_change_password) {
      return <Navigate to="/reset-password" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);

    if (error) {
      toast({
        title: t('loginFailed'),
        description: error.message,
        variant: 'destructive',
      });
    }
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
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-2">
              <Label htmlFor="password">{t('passwordLabel')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('signIn')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t('contactAdmin')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
