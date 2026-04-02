import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import i18n from '@/lib/i18n';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export type LanguageCode = 'en' | 'es';

interface LanguageContextValue {
  language: LanguageCode;
  locked: boolean;
  setLanguage: (lang: LanguageCode) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLang] = useState<LanguageCode>('es');
  const [locked, setLocked] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);

  // Load preference from DB when user changes
  useEffect(() => {
    if (!user) {
      loadedUserIdRef.current = null;
      // Reset to Spanish on logout (app default)
      i18n.changeLanguage('es');
      setLang('es');
      setLocked(false);
      return;
    }
    if (loadedUserIdRef.current === user.id) return;

    loadedUserIdRef.current = user.id;
    supabase
      .from('user_language_preference')
      .select('language_code, locked')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        const lang = (data?.language_code as LanguageCode) ?? 'es';
        const isLocked = data?.locked ?? false;
        setLang(lang);
        setLocked(isLocked);
        i18n.changeLanguage(lang);
      });
  }, [user]);

  const setLanguage = useCallback(async (newLang: LanguageCode) => {
    if (!user) return;

    const prevLang = language;
    // Optimistic update
    setLang(newLang);
    i18n.changeLanguage(newLang);

    // Try update first
    const { error: updateError } = await supabase
      .from('user_language_preference')
      .update({ language_code: newLang, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (updateError) {
      // Update failed — try insert for legacy users with no row
      const { error: insertError } = await supabase
        .from('user_language_preference')
        .insert({ user_id: user.id, language_code: newLang });

      if (insertError) {
        console.error('[LanguageContext] Failed to persist language:', insertError);
        setLang(prevLang);
        i18n.changeLanguage(prevLang);
        toast.error(prevLang === 'es' ? 'Error al cambiar idioma' : 'Failed to change language');
      }
    }
  }, [user, language]);

  return (
    <LanguageContext.Provider value={{ language, locked, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
