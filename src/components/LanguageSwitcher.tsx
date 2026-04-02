import { Globe } from 'lucide-react';
import { useLanguage, type LanguageCode } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const LANGS: { value: LanguageCode; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
];

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { language, locked, setLanguage } = useLanguage();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const toggle = (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
        'text-sidebar-foreground/60 transition-colors duration-150',
        locked ? 'opacity-50 cursor-not-allowed' : ''
      )}
    >
      <Globe className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{t('nav.language')}</span>
          <div className="flex items-center gap-0.5 rounded-md border border-sidebar-border p-0.5">
            {LANGS.map((l) => (
              <button
                key={l.value}
                disabled={locked}
                onClick={() => !locked && setLanguage(l.value)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors duration-150',
                  language === l.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
                  locked ? 'pointer-events-none' : ''
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{toggle}</TooltipTrigger>
        <TooltipContent side="top">
          {t('preferences.languageLocked')}
        </TooltipContent>
      </Tooltip>
    );
  }

  return toggle;
}
