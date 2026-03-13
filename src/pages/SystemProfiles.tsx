import { useState } from 'react';
import { Plus, Pencil, Trash2, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SystemProfileForm } from '@/components/SystemProfileForm';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from '@/hooks/use-toast';
import type { SystemProfile } from '@/types';

const classificationColor: Record<string, string> = {
  'GxP Critical': 'bg-destructive/10 text-destructive',
  'GxP Non-Critical': 'bg-orange-100 text-orange-700',
  'Non-GxP': 'bg-muted text-muted-foreground',
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

export default function SystemProfiles() {
  const [systems, setSystems] = useLocalStorage<SystemProfile[]>('gxp_systems', []);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemProfile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = systems.filter((s) => {
    if (filterCategory !== 'all' && s.system_category !== filterCategory) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    return true;
  });

  const handleSubmit = (system: SystemProfile) => {
    setSystems((prev) => {
      const exists = prev.find((s) => s.id === system.id);
      if (exists) {
        return prev.map((s) => (s.id === system.id ? system : s));
      }
      return [...prev, system];
    });
    toast({
      title: editingSystem ? 'System updated' : 'System created',
      description: `${system.name} (${system.system_identifier}) has been saved.`,
    });
    setEditingSystem(null);
  };

  const handleEdit = (system: SystemProfile) => {
    setEditingSystem(system);
    setFormOpen(true);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const system = systems.find((s) => s.id === deleteId);
    setSystems((prev) => prev.filter((s) => s.id !== deleteId));
    setDeleteId(null);
    toast({
      title: 'System deleted',
      description: `${system?.name} has been removed.`,
    });
  };

  const handleNewSystem = () => {
    setEditingSystem(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Register and manage your validated computerized systems
          </p>
        </div>
        <Button onClick={handleNewSystem}>
          <Plus className="mr-2 h-4 w-4" />
          New System Profile
        </Button>
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
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {['LIMS', 'ERP', 'DCS', 'MES', 'QMS', 'DMS', 'SCADA', 'CDS', 'ELN', 'Other'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
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
                  <TableHead>Category</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Review</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((system) => (
                  <TableRow key={system.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{system.name}</p>
                        <p className="text-xs text-muted-foreground">{system.system_identifier} · {system.vendor_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{system.system_category}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={classificationColor[system.gxp_classification]}>
                        {system.gxp_classification}
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(system)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(system.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
