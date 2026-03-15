import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Loader2, Plus, UserCog, Search, MoreHorizontal, Pencil, Trash2, Unlock, Lock } from 'lucide-react';
import { UserFormDialog } from '@/components/admin/UserFormDialog';
import { UserEditDialog } from '@/components/admin/UserEditDialog';

const ROLE_LABELS: Record<string, string> = {
  super_user: 'Super User',
  system_owner: 'System Owner',
  system_administrator: 'System Admin',
  business_owner: 'Business Owner',
  quality_assurance: 'Quality Assurance',
};

export interface UserData {
  user_id: string;
  full_name: string | null;
  username: string | null;
  email: string;
  roles: string;
  language_code: string | null;
  account_expires_at: string | null;
  is_blocked: boolean | null;
  blocked_reason: string | null;
  must_change_password: boolean | null;
  registered_at: string | null;
}

interface UserManagementProps {
  currentUserId: string;
}

export function UserManagement({ currentUserId }: UserManagementProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<UserData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const callAdmin = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-manage-users', { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await callAdmin({ action: 'list_users' });
      setUsers(data.users ?? []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [callAdmin, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await callAdmin({ action: 'delete_user', user_id: deleteTarget.user_id });
      toast({ title: 'Usuario eliminado', description: `${deleteTarget.email} ha sido eliminado.` });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setActionLoading(true);
    try {
      await callAdmin({ action: 'unblock_user', user_id: unblockTarget.user_id });
      toast({ title: 'Usuario desbloqueado', description: `${unblockTarget.email} ha sido desbloqueado.` });
      setUnblockTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const getUserStatus = (u: UserData) => {
    if (u.is_blocked) return <Badge variant="destructive" className="text-xs">Bloqueada</Badge>;
    if (u.account_expires_at && new Date(u.account_expires_at) < new Date()) {
      return <Badge variant="outline" className="text-xs border-destructive text-destructive">Expirada</Badge>;
    }
    if (u.must_change_password) return <Badge variant="outline" className="text-xs">Pendiente</Badge>;
    return <Badge variant="secondary" className="text-xs">Activa</Badge>;
  };

  const getRoleBadges = (rolesStr: string) => {
    if (!rolesStr) return <span className="text-muted-foreground text-xs">Sin rol</span>;
    return rolesStr.split(',').map((r) => (
      <Badge
        key={r}
        variant={r === 'super_user' ? 'destructive' : 'secondary'}
        className="text-xs"
      >
        {ROLE_LABELS[r] ?? r}
      </Badge>
    ));
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.full_name?.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q) ||
      (u.username?.toLowerCase().includes(q))
    );
  });

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
          Create User
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Todos los Usuarios
          </CardTitle>
          <CardDescription>
            {filteredUsers.length} de {users.length} usuario(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {users.length === 0
                ? 'No se encontraron usuarios. Crea la primera cuenta.'
                : 'No se encontraron usuarios que coincidan con la búsqueda.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => {
                  const isSelf = u.user_id === currentUserId;
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {u.full_name || 'N/A'}
                          {isSelf && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        {u.username && (
                          <span className="text-xs text-muted-foreground">@{u.username}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs uppercase">
                          {u.language_code || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getUserStatus(u)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getRoleBadges(u.roles)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditUser(u)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {u.is_blocked && (
                              <DropdownMenuItem onClick={() => setUnblockTarget(u)}>
                                <Unlock className="mr-2 h-4 w-4" />
                                Unblock
                              </DropdownMenuItem>
                            )}
                            {!isSelf && !u.is_blocked && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await callAdmin({ action: 'block_user', user_id: u.user_id, reason: 'Blocked by administrator' });
                                    toast({ title: 'Usuario bloqueado' });
                                    fetchUsers();
                                  } catch (err: any) {
                                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                  }
                                }}
                              >
                                <Lock className="mr-2 h-4 w-4" />
                                Block
                              </DropdownMenuItem>
                            )}
                            {!isSelf && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(u)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <UserFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchUsers}
      />

      {/* Edit Dialog */}
      {editUser && (
        <UserEditDialog
          open={!!editUser}
          onOpenChange={(v) => { if (!v) setEditUser(null); }}
          user={editUser}
          onSuccess={fetchUsers}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la cuenta de{' '}
              <strong>{deleteTarget?.email}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock Confirmation */}
      <AlertDialog open={!!unblockTarget} onOpenChange={(v) => { if (!v) setUnblockTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desbloquear usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto desbloqueará la cuenta de <strong>{unblockTarget?.email}</strong> y
              reiniciará los intentos fallidos de inicio de sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblock} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
