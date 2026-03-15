import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, UserCog } from 'lucide-react';
import { UserFormDialog } from '@/components/admin/UserFormDialog';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ALL_ROLES: { value: AppRole; label: string }[] = [
  { value: 'super_user', label: 'Super User' },
  { value: 'system_owner', label: 'System Owner' },
  { value: 'system_administrator', label: 'System Administrator' },
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'quality_assurance', label: 'Quality Assurance' },
];

interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  must_change_password: boolean;
  is_blocked: boolean;
  account_expires_at: string | null;
  created_at: string;
  roles: AppRole[];
}

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const callAdmin = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-users', { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    []
  );

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const data = await callAdmin({ action: 'list_users' });
      setUsers(data.users ?? []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  }, [callAdmin, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const roleBadgeVariant = (role: AppRole) => {
    if (role === 'super_user') return 'destructive' as const;
    return 'secondary' as const;
  };

  const getUserStatus = (u: ManagedUser) => {
    if (u.is_blocked) return <Badge variant="destructive" className="text-xs">Bloqueado</Badge>;
    if (u.must_change_password) return <Badge variant="outline" className="text-xs">Pendiente</Badge>;
    return <Badge variant="secondary" className="text-xs">Activo</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Crear y gestionar cuentas de usuario y asignación de roles.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <UserFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchUsers}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Todos los Usuarios
          </CardTitle>
          <CardDescription>{users.length} usuario(s) registrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron usuarios. Crea la primera cuenta.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.username || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant={roleBadgeVariant(r)} className="text-xs">
                            {ALL_ROLES.find((ar) => ar.value === r)?.label ?? r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{getUserStatus(u)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
