import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Server } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SystemProfileForm } from '@/components/SystemProfileForm';
import { SystemProfileDetailDialog } from '@/components/SystemProfileDetailDialog';
import { ProfileApprovalBadge } from '@/components/profiles/ProfileApprovalBadge';
import { useSystemProfiles } from '@/hooks/useSystemProfiles';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { GXP_SHORT_LABELS, ENVIRONMENT_SHORT_LABELS, GAMP_SHORT_LABELS, SYSTEM_ENVIRONMENT_OPTIONS } from '@/lib/gxpClassifications';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SystemProfile, GxPClassification, SystemEnvironment, GampCategory, ProfileApprovalStatus } from '@/types';

const classificationColor: Record<string, string> = {
  GMP: 'bg-red-50 text-red-700 dark:bg-neutral-800 dark:text-red-400 dark:border-neutral-700',
  GLP: 'bg-red-50 text-red-700 dark:bg-neutral-800 dark:text-red-400 dark:border-neutral-700',
  GCP: 'bg-red-50 text-red-700 dark:bg-neutral-800 dark:text-red-400 dark:border-neutral-700',
  GDP: 'bg-orange-50 text-orange-700 dark:bg-neutral-800 dark:text-orange-400 dark:border-neutral-700',
  GVP: 'bg-red-50 text-red-700 dark:bg-neutral-800 dark:text-red-400 dark:border-neutral-700',
  NON_GXP_CRITICAL: 'bg-orange-50 text-orange-700 dark:bg-neutral-800 dark:text-orange-400 dark:border-neutral-700',
  NON_GXP_STANDARD: 'bg-muted text-muted-foreground',
};

const riskColor: Record<string, string> = {
  High: 'bg-red-50 text-red-600 dark:bg-neutral-800 dark:text-red-400 dark:border-neutral-700',
  Medium: 'bg-amber-50 text-amber-700 dark:bg-neutral-800 dark:text-amber-400 dark:border-neutral-700',
  Low: 'bg-green-50 text-green-700 dark:bg-neutral-800 dark:text-green-400 dark:border-neutral-700',
};

const statusColor: Record<string, string> = {
  Active: 'bg-green-50 text-green-700 dark:bg-neutral-800 dark:text-green-400 dark:border-neutral-700',
  Retired: 'bg-muted text-muted-foreground',
  'Under Validation': 'bg-primary/10 text-primary dark:bg-neutral-800 dark:text-primary dark:border-neutral-700',
};

const gampColor: Record<string, string> = {
  '1': 'bg-green-50 text-green-700 dark:bg-neutral-800 dark:text-green-400 dark:border-neutral-700',
  '3': 'bg-muted text-muted-foreground',
  '4': 'bg-orange-50 text-orange-700 dark:bg-neutral-800 dark:text-orange-300 dark:border-neutral-700',
  '5': 'bg-red-50 text-red-700 dark:bg-neutral-800 dark:text-red-400 dark:border-neutral-700',
};

export default function SystemProfiles() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const { systems, loading, addSystem, updateSystem, deleteSystem, transitionApprovalStatus } = useSystemProfiles();
  const canEdit = roles.includes('system_owner') || roles.includes('super_user');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemProfile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterEnvironment, setFilterEnvironment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  const [viewingSystem, setViewingSystem] = useState<SystemProfile | null>(null);

  const filtered = systems.filter((s) => {
    if (filterEnvironment !== 'all' && s.system_environment !== filterEnvironment) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (filterApproval !== 'all' && s.approval_status !== filterApproval) return false;
    return true;
  });

  const handleSubmit = async (system: SystemProfile) => {
    const isEdit = !!editingSystem;
    const success = isEdit
      ? await updateSystem(system)
      : await addSystem(system);

    if (success) {
      toast({
        title: isEdit ? t('systemProfiles.toast.systemUpdated') : t('systemProfiles.toast.systemCreated'),
        description: t('systemProfiles.toast.systemSaved', { name: system.name, id: system.system_identifier }),
      });
    }
    setEditingSystem(null);
  };

  const handleEdit = (system: SystemProfile) => {
    if (system.approval_status !== 'draft') return;
    setEditingSystem(system);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const system = systems.find((s) => s.id === deleteId);
    const success = await deleteSystem(deleteId);
    setDeleteId(null);
    if (success) {
      toast({
        title: t('systemProfiles.toast.systemDeleted'),
        description: t('systemProfiles.toast.systemRemoved', { name: system?.name }),
      });
    }
  };

  const handleNewSystem = () => {
    setEditingSystem(null);
    setFormOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('systemProfiles.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('systemProfiles.subtitle')}
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleNewSystem}>
            <Plus className="mr-2 h-4 w-4" />
            {t('systemProfiles.newSystemProfile')}
          </Button>
        )}
      </div>

      {systems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Server className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">{t('systemProfiles.empty.title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('systemProfiles.empty.description')}
            </p>
            <Button onClick={handleNewSystem}>
              <Plus className="mr-2 h-4 w-4" />
              {t('systemProfiles.empty.action')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t(systems.length === 1 ? 'systemProfiles.countOfSingular' : 'systemProfiles.countOf', { count: filtered.length, total: systems.length })}
              </CardTitle>
              <div className="flex gap-2">
                <Select value={filterEnvironment} onValueChange={setFilterEnvironment}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder={t('systemProfiles.columns.environment')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('systemProfiles.filters.allEnvironments')}</SelectItem>
                    {SYSTEM_ENVIRONMENT_OPTIONS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder={t('systemProfiles.columns.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('systemProfiles.filters.allStatuses')}</SelectItem>
                    {['Active', 'Retired', 'Under Validation'].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterApproval} onValueChange={setFilterApproval}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder={t('systemProfiles.columns.approval')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('systemProfiles.approval.filters.allApproval')}</SelectItem>
                    <SelectItem value="draft">{t('systemProfiles.approval.status.draft')}</SelectItem>
                    <SelectItem value="in_review">{t('systemProfiles.approval.status.inReview')}</SelectItem>
                    <SelectItem value="approved">{t('systemProfiles.approval.status.approved')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('systemProfiles.columns.system')}</TableHead>
                  <TableHead>{t('systemProfiles.columns.environment')}</TableHead>
                  <TableHead>{t('systemProfiles.columns.classification')}</TableHead>
                  <TableHead>{t('systemProfiles.columns.gamp')}</TableHead>
                  <TableHead>{t('systemProfiles.columns.risk')}</TableHead>
                  <TableHead>{t('systemProfiles.columns.status')}</TableHead>
                  <TableHead>{t('systemProfiles.columns.approval')}</TableHead>
                  <TableHead>{t('systemProfiles.columns.nextReview')}</TableHead>
                  {canEdit && <TableHead className="w-[80px]">{t('systemProfiles.columns.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((system) => (
                  <TableRow key={system.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingSystem(system)}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{system.name}</p>
                        <p className="text-xs text-muted-foreground">{system.system_identifier} · {system.vendor_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">
                        {ENVIRONMENT_SHORT_LABELS[system.system_environment as SystemEnvironment] ?? system.system_environment}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={classificationColor[system.gxp_classification] ?? 'bg-muted text-muted-foreground'}>
                        {GXP_SHORT_LABELS[system.gxp_classification as GxPClassification] ?? system.gxp_classification}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={gampColor[system.gamp_category] ?? 'bg-muted text-muted-foreground'}>
                        {GAMP_SHORT_LABELS[system.gamp_category as GampCategory] ?? system.gamp_category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={riskColor[system.risk_level]}>
                        {system.risk_level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColor[system.status]}>
                        {system.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ProfileApprovalBadge status={system.approval_status as ProfileApprovalStatus} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">
                        {new Date(system.next_review_date).toLocaleDateString()}
                      </span>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={system.approval_status !== 'draft'}
                                    onClick={(e) => { e.stopPropagation(); handleEdit(system); }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {system.approval_status !== 'draft' && (
                                <TooltipContent>
                                  {system.approval_status === 'in_review'
                                    ? t('systemProfiles.approval.banners.inReviewReadonly')
                                    : t('systemProfiles.approval.banners.approvedReadonly')}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(system.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <SystemProfileDetailDialog
        system={viewingSystem}
        open={!!viewingSystem}
        onOpenChange={(open) => { if (!open) setViewingSystem(null); }}
        onEdit={(system) => {
          setViewingSystem(null);
          handleEdit(system);
        }}
        onTransition={async (profileId, fromStatus, toStatus, reason) => {
          const success = await transitionApprovalStatus(profileId, fromStatus, toStatus, reason);
          if (success) {
            const updated = systems.find(s => s.id === profileId);
            if (updated) setViewingSystem(null);
          }
          return success;
        }}
      />

      <SystemProfileForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingSystem(null);
        }}
        onSubmit={handleSubmit}
        editingSystem={editingSystem}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('systemProfiles.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('systemProfiles.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('systemProfiles.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('systemProfiles.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
