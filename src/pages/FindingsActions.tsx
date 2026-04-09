import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Search, Bot, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAllFindings } from '@/hooks/useFindings';
import type { FindingSeverity, FindingStatus, FindingSource, FindingCategory } from '@/types/findings';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  major: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  minor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  observation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

export default function FindingsActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [severity, setSeverity] = useState<FindingSeverity | 'all'>('all');
  const [status, setStatus] = useState<FindingStatus | 'all'>('all');
  const [source, setSource] = useState<FindingSource | 'all'>('all');

  const { data: findings = [], isLoading } = useAllFindings({
    ...(severity !== 'all' ? { severity: severity as FindingSeverity } : {}),
    ...(status !== 'all' ? { status: status as FindingStatus } : {}),
    ...(source !== 'all' ? { source: source as FindingSource } : {}),
  });

  const totalCount = findings.length;
  const pendingReview = findings.filter(f => f.status === 'ai_identified').length;
  const openCapas = findings.filter(f => f.capa_required && ['pending', 'open'].includes(f.capa_status || '')).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('findings.page.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('findings.page.subtitle')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground">{t('findings.page.summary.total')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pendingReview}</p>
          <p className="text-xs text-muted-foreground">{t('findings.page.summary.pendingReview')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{openCapas}</p>
          <p className="text-xs text-muted-foreground">{t('findings.page.summary.openCapas')}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('findings.page.filters.allSeverities')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('findings.page.filters.allSeverities')}</SelectItem>
            {(['critical', 'major', 'minor', 'observation'] as const).map(s => (
              <SelectItem key={s} value={s}>{t(`findings.severity.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('findings.page.filters.allStatuses')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('findings.page.filters.allStatuses')}</SelectItem>
            {(['ai_identified', 'confirmed', 'in_progress', 'closed', 'dismissed'] as const).map(s => (
              <SelectItem key={s} value={s}>{t(`findings.status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => setSource(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('findings.page.filters.allSources')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('findings.page.filters.allSources')}</SelectItem>
            <SelectItem value="ai_identified">{t('findings.source.ai_identified')}</SelectItem>
            <SelectItem value="manual">{t('findings.source.manual')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {findings.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
          <div className="text-center space-y-2">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('findings.page.empty')}</p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('findings.page.table.system')}</TableHead>
                <TableHead>{t('findings.page.table.title')}</TableHead>
                <TableHead>{t('findings.page.table.severity')}</TableHead>
                <TableHead>{t('findings.page.table.category')}</TableHead>
                <TableHead>{t('findings.page.table.status')}</TableHead>
                <TableHead>{t('findings.page.table.source')}</TableHead>
                <TableHead>{t('findings.page.table.capa')}</TableHead>
                <TableHead>{t('findings.page.table.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map(f => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/reviews/${f.review_case_id}`)}
                >
                  <TableCell className="text-xs">{(f as any).system_name || '—'}</TableCell>
                  <TableCell className="text-sm font-medium max-w-xs truncate">
                    {f.source === 'ai_identified' && <Bot className="h-3 w-3 inline mr-1" />}
                    {f.title}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${SEVERITY_BADGE[f.severity]}`}>
                      {t(`findings.severity.${f.severity}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{t(`findings.category.${f.category}`)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{t(`findings.status.${f.status}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{t(`findings.source.${f.source}`)}</TableCell>
                  <TableCell className="text-xs">
                    {f.capa_required ? (f.capa_reference || t(`findings.capaStatus.${f.capa_status || 'pending'}`)) : '—'}
                  </TableCell>
                  <TableCell className="text-xs">{new Date(f.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
