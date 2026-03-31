import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IntrayFiltersProps {
  systems: { id: string; name: string }[];
  selectedSystem: string;
  onSystemChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

export function IntrayFilters({ systems, selectedSystem, onSystemChange, sortBy, onSortChange }: IntrayFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={selectedSystem} onValueChange={onSystemChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={t('intray.filters.allSystems')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('intray.filters.allSystems')}</SelectItem>
          {systems.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="due_date">{t('intray.filters.sortDueDate')}</SelectItem>
          <SelectItem value="system">{t('intray.filters.sortSystem')}</SelectItem>
          <SelectItem value="type">{t('intray.filters.sortType')}</SelectItem>
          <SelectItem value="created">{t('intray.filters.sortDateAdded')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
