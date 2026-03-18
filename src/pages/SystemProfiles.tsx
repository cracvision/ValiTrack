import { useState } from 'react';
import { Plus, Pencil, Trash2, Server } from 'lucide-react';
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
import { useSystemProfiles } from '@/hooks/useSystemProfiles';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { GXP_SHORT_LABELS, ENVIRONMENT_SHORT_LABELS, GAMP_SHORT_LABELS, SYSTEM_ENVIRONMENT_OPTIONS } from '@/lib/gxpClassifications';
import type { SystemProfile, GxPClassification, SystemEnvironment, GampCategory } from '@/types';

const classificationColor: Record<string, string> = {
  GMP: 'bg-destructive/10 text-destructive',
  GLP: 'bg-destructive/10 text-destructive',
  GCP: 'bg-destructive/10 text-destructive',
  GDP: 'bg-orange-100 text-orange-700',
  GVP: 'bg-destructive/10 text-destructive',
  NON_GXP_CRITICAL: 'bg-orange-100 text-orange-700',
  NON_GXP_STANDARD: 'bg-muted text-muted-foreground',
};

const riskColor: Record<string, string> = {
  High: 'bg-destructive/10 text-destructive',
  Medium: 'bg-orange-100 text-orange-700',
  Low: 'bg-green-100 text-green-700',
};

const statusColor: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Retired: 'bg-muted text-muted-foreground',
  'Under Validation': 'bg-primary/10 text-primary',
};

const gampColor: Record<string, string> = {
  '1': 'bg-green-100 text-green-700',
  '3': 'bg-muted text-muted-foreground',
  '4': 'bg-orange-100 text-orange-700',
  '5': 'bg-destructive/10 text-destructive',
};

export default function SystemProfiles() {
  const { roles } = useAuth();
  const { systems, loading, addSystem, updateSystem, deleteSystem } = useSystemProfiles();
  const canEdit = roles.includes('system_owner') || roles.includes('super_user');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemProfile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterEnvironment, setFilterEnvironment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewingSystem, setViewingSystem] = useState<SystemProfile | null>(null);

  const filtered = systems.filter((s) => {
    if (filterEnvironment !== 'all' && s.system_environment !== filterEnvironment) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    return true;
  });

  const handleSubmit = async (system: SystemProfile) => {
    const isEdit = !!editingSystem;
    const success = isEdit
      ? await updateSystem(system)
      : await addSystem(system);

    if (success) {
      toast({
        title: isEdit ? 'System updated' : 'System created',
        description: `${system.name} (${system.system_identifier}) has been saved.`,
      });
    }
    setEditingSystem(null);
  };

  const handleEdit = (system: SystemProfile) => {
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
        title: 'System deleted',
        description: `${system?.name} has been removed.`,
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
          <h1 className="text-2xl font-bold text-foreground">System Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Register and manage your validated computerized systems
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleNewSystem}>
            <Plus className="mr-2 h-4 w-4" />
            New System Profile
          </Button>
        )}
      </div>

      {systems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Server className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No systems registered</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first System Profile to get started with periodic reviews.
            </p>
            <Button onClick={handleNewSystem}>
              <Plus className="mr-2 h-4 w-4" />
              Create First System
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {filtered.length} of {systems.length} system{systems.length !== 1 ? 's' : ''}
              </CardTitle>
              <div className="flex gap-2">
                <Select value={filterEnvironment} onValueChange={setFilterEnvironment}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
                    {SYSTEM_ENVIRONMENT_OPTIONS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {['Active', 'Retired', 'Under Validation'].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>System</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>GAMP</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Review</TableHead>
                  {canEdit && <TableHead className="w-[80px]">Actions</TableHead>}
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
                      <span className="text-sm text-foreground">
                        {new Date(system.next_review_date).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(system); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(system.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
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
            <AlertDialogTitle>Delete System Profile</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the system profile and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
