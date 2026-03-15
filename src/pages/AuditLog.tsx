import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';

export default function AuditLog() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('pages.auditLog.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('pages.auditLog.subtitle')}</p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
        <div className="text-center space-y-2">
          <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t('pages.auditLog.placeholder')}</p>
        </div>
      </div>
    </div>
  );
}
