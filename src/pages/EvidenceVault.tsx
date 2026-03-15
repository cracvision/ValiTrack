import { useTranslation } from 'react-i18next';
import { Archive } from 'lucide-react';

export default function EvidenceVault() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('pages.evidenceVault.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('pages.evidenceVault.subtitle')}</p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
        <div className="text-center space-y-2">
          <Archive className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t('pages.evidenceVault.placeholder')}</p>
        </div>
      </div>
    </div>
  );
}
