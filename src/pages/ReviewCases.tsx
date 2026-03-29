import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useReviewCases } from '@/hooks/useReviewCases';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { CreateReviewDialog } from '@/components/reviews/CreateReviewDialog';
import { ReviewStatusBadge } from '@/components/reviews/ReviewStatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { REVIEW_LEVEL_CONFIG, REVIEW_STATUS_CONFIG } from '@/lib/reviewWorkflow';
import type { ReviewStatus, ReviewLevel } from '@/types';

const STATUSES: ReviewStatus[] = [
  'draft', 'plan_review', 'plan_approval', 'approved_for_execution',
  'in_progress', 'execution_review', 'approved', 'rejected', 'cancelled',
];

export default function ReviewCases() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const { roles } = useAuth();
  const canCreate = roles.includes('system_owner') || roles.includes('super_user');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filters = statusFilter !== 'all' ? { status: statusFilter as ReviewStatus } : undefined;
  const { data: reviewCases = [], isLoading } = useReviewCases(filters);

  const initiatorIds = useMemo(
    () => [...new Set(reviewCases.map(rc => rc.initiated_by).filter(Boolean))],
    [reviewCases]
  );
  const { data: userNames = {} } = useResolveUserNames(initiatorIds);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('reviews.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('reviews.pageSubtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('reviews.newReview')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('reviews.filters.allStatuses')}</SelectItem>
            {STATUSES.map(s => {
              const config = REVIEW_STATUS_CONFIG[s];
              return (
                <SelectItem key={s} value={s}>
                  {t(config?.labelKey ?? `reviews.status.${s}`, { defaultValue: config?.label ?? s })}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">{t('common.loading')}</div>
      ) : reviewCases.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
          <div className="text-center space-y-3">
            <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t(canCreate ? 'reviews.empty' : 'reviews.emptyNoCreate')}</p>
            {canCreate && (
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('reviews.newReview')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reviews.table.system')}</TableHead>
                <TableHead>{t('reviews.table.title')}</TableHead>
                <TableHead>{t('reviews.table.period')}</TableHead>
                <TableHead>{t('reviews.table.level')}</TableHead>
                <TableHead>{t('reviews.table.status')}</TableHead>
                <TableHead>{t('reviews.table.dueDate')}</TableHead>
                <TableHead>{t('reviews.table.initiatedBy')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewCases.map(rc => {
                const isOverdue = new Date(rc.due_date) < new Date() && !['approved', 'rejected', 'cancelled'].includes(rc.status);
                const levelConfig = REVIEW_LEVEL_CONFIG[rc.review_level as ReviewLevel];
                return (
                  <TableRow
                    key={rc.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/reviews/${rc.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{rc.system_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{rc.system_identifier}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{rc.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rc.review_period_start} — {rc.review_period_end}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {levelConfig?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ReviewStatusBadge status={rc.status} />
                    </TableCell>
                    <TableCell className={isOverdue ? 'text-destructive text-sm font-medium' : 'text-sm'}>
                      {rc.due_date}
                    </TableCell>
                    <TableCell className="text-sm">
                      {userNames[rc.initiated_by] || '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateReviewDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
