import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

const OPTIONS: { value: ThemePreference; labelKey: string; Icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'theme.light', Icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', Icon: Moon },
  { value: 'system', labelKey: 'theme.system', Icon: Monitor },
];

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { preference, setTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
            'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            'transition-colors duration-150'
          )}
          aria-label={t('theme.switchTheme')}
        >
          <current.Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{t('theme.switchTheme')}</span>
              <span className="text-[10px] text-sidebar-foreground/40">
                {t(current.labelKey)}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-48 p-1"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
              'hover:bg-accent transition-colors duration-150',
              preference === opt.value
                ? 'text-primary font-medium'
                : 'text-popover-foreground'
            )}
          >
            <opt.Icon className="h-4 w-4" />
            <span className="flex-1 text-left">{t(opt.labelKey)}</span>
            {preference === opt.value && (
              <span className="text-primary text-xs">✓</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
