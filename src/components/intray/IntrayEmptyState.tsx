import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function IntrayEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-sm font-medium text-foreground">{t('intray.empty.title')}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{t('intray.empty.description')}</p>
    </div>
  );
}
