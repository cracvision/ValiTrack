import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ShieldCheck, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { IntrayItem } from '@/hooks/useIntrayItems';

const URGENCY_BORDER: Record<string, string> = {
  overdue: 'border-l-destructive',
  due_soon: 'border-l-amber-500',
  upcoming: 'border-l-primary',
};

const URGENCY_LABEL_CLASS: Record<string, string> = {
  overdue: 'text-destructive',
  due_soon: 'text-amber-600 dark:text-amber-400',
  upcoming: 'text-muted-foreground',
};

const TYPE_ICONS: Record<string, typeof ClipboardList> = {
  task: ClipboardList,
  review_signoff: ShieldCheck,
  profile_signoff: ShieldCheck,
  action: Zap,
};

const TASK_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-blue-400',
};

interface IntrayItemCardProps {
  item: IntrayItem;
  showAssignedTo?: boolean;
}

export function IntrayItemCard({ item, showAssignedTo = false }: IntrayItemCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const Icon = TYPE_ICONS[item.item_type] || ClipboardList;
  const title = i18n.language === 'es' && item.title_es ? item.title_es : item.title;

  const handleClick = () => {
    if (item.item_type === 'profile_signoff' || item.action_code === 'approve_profile') {
      navigate('/systems');
      return;
    }
    if (item.review_case_id) {
      const taskParam = item.item_type === 'task' ? `?task=${item.item_id}` : '';
      navigate(`/reviews/${item.review_case_id}${taskParam}`);
    }
  };

  const dueDateStr = item.due_date
    ? new Date(item.due_date).toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Card
      className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors border-l-4 ${URGENCY_BORDER[item.urgency] || 'border-l-primary'}`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.item_type === 'task' && item.item_status && (
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${TASK_STATUS_CLASS[item.item_status] || ''}`}>
                  {t(`intray.taskStatus.${item.item_status}`)}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] shrink-0">
                {t(`intray.itemTypes.${item.item_type}`)}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {item.system_name} — {item.system_identifier}
          </p>
          <div className="flex items-center gap-3 text-xs">
            {dueDateStr && (
              <span className={URGENCY_LABEL_CLASS[item.urgency]}>
                {t(`intray.urgency.${item.urgency}`)} · {dueDateStr}
              </span>
            )}
            {!dueDateStr && (
              <span className="text-muted-foreground">{t('intray.urgency.upcoming')}</span>
            )}
            {showAssignedTo && item.assigned_user_name && (
              <span className="text-muted-foreground">→ {item.assigned_user_name}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
