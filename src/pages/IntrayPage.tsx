import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useIntrayItems } from '@/hooks/useIntrayItems';
import { useIntrayCount } from '@/hooks/useIntrayCount';
import { IntrayItemCard } from '@/components/intray/IntrayItemCard';
import { IntrayEmptyState } from '@/components/intray/IntrayEmptyState';
import { IntrayFilters } from '@/components/intray/IntrayFilters';
import { IntraySuperUserFilter } from '@/components/intray/IntraySuperUserFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type TabValue = 'all' | 'tasks' | 'signoffs' | 'actions';

const TAB_FILTER: Record<TabValue, (item: any) => boolean> = {
  all: () => true,
  tasks: (item) => item.item_type === 'task',
  signoffs: (item) => item.item_type === 'review_signoff' || item.item_type === 'profile_signoff',
  actions: (item) => item.item_type === 'action',
};

export default function IntrayPage() {
  const { t } = useTranslation();
  const { isSuperUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const initialTab = (['all', 'tasks', 'signoffs', 'actions'] as const).includes(
    searchParams.get('tab') as any
  )
    ? (searchParams.get('tab') as TabValue)
    : 'all';

  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('due_date');

  const targetUserId = selectedUserId === 'all' ? null : selectedUserId;
  const { data: items = [], isLoading } = useIntrayItems(targetUserId);
  const { data: counts } = useIntrayCount(targetUserId);

  // Derive unique systems from items
  const systems = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (item.system_profile_id && item.system_name) {
        map.set(item.system_profile_id, item.system_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = items.filter(TAB_FILTER[activeTab]);

    if (selectedSystem !== 'all') {
      result = result.filter((item) => item.system_profile_id === selectedSystem);
    }

    const sortFn = (a: any, b: any) => {
      switch (sortBy) {
        case 'system':
          return (a.system_name || '').localeCompare(b.system_name || '');
        case 'type':
          return (a.item_type || '').localeCompare(b.item_type || '');
        case 'created':
          return new Date(b.item_created_at).getTime() - new Date(a.item_created_at).getTime();
        case 'due_date':
        default: {
          // Already sorted by urgency from DB, keep original order
          return 0;
        }
      }
    };

    if (sortBy !== 'due_date') {
      result = [...result].sort(sortFn);
    }

    return result;
  }, [items, activeTab, selectedSystem, sortBy]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['intray-items'] });
    queryClient.invalidateQueries({ queryKey: ['intray-count'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('intray.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('intray.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('intray.refresh')}
        </Button>
      </div>

      {/* Super User filter */}
      {isSuperUser() && (
        <IntraySuperUserFilter
          selectedUserId={selectedUserId}
          onUserChange={setSelectedUserId}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              {t('intray.tabs.all')}
              {counts && counts.total_count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{counts.total_count}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5">
              {t('intray.tabs.tasks')}
              {counts && counts.tasks_count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{counts.tasks_count}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="signoffs" className="gap-1.5">
              {t('intray.tabs.signoffs')}
              {counts && counts.signoffs_count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{counts.signoffs_count}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1.5">
              {t('intray.tabs.actions')}
              {counts && counts.actions_count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{counts.actions_count}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <IntrayFilters
            systems={systems}
            selectedSystem={selectedSystem}
            onSystemChange={setSelectedSystem}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          ['all', 'tasks', 'signoffs', 'actions'].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-2">
              {filtered.length === 0 ? (
                <IntrayEmptyState />
              ) : (
                filtered.map((item) => (
                  <IntrayItemCard
                    key={`${item.item_type}-${item.item_id}`}
                    item={item}
                    showAssignedTo={isSuperUser() && selectedUserId === 'all'}
                  />
                ))
              )}
            </TabsContent>
          ))
        )}
      </Tabs>
    </div>
  );
}
