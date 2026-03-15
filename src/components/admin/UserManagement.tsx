import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
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
  const { t } = useTranslation();
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
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [callAdmin, toast, t]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await callAdmin({ action: 'delete_user', user_id: deleteTarget.user_id });
      toast({ title: t('users.userDeleted'), description: t('users.userDeletedDesc', { email: deleteTarget.email }) });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setActionLoading(true);
    try {
      await callAdmin({ action: 'unblock_user', user_id: unblockTarget.user_id });
      toast({ title: t('users.userUnblocked'), description: t('users.userUnblockedDesc', { email: unblockTarget.email }) });
      setUnblockTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const getUserStatus = (u: UserData) => {
    if (u.is_blocked) return <Badge variant="destructive" className="text-xs">{t('users.statusBlocked')}</Badge>;
    if (u.account_expires_at && new Date(u.account_expires_at) < new Date()) {
      return <Badge variant="outline" className="text-xs border-destructive text-destructive">{t('users.statusExpired')}</Badge>;
    }
    if (u.must_change_password) return <Badge variant="outline" className="text-xs">{t('users.statusPending')}</Badge>;
    return <Badge variant="secondary" className="text-xs">{t('users.statusActive')}</Badge>;
  };

  const getRoleBadges = (rolesStr: string) => {
    if (!rolesStr) return <span className="text-muted-foreground text-xs">{t('users.noRole')}</span>;
    return rolesStr.split(',').map((r) => (
      <Badge key={r} variant={r === 'super_user' ? 'destructive' : 'secondary'} className="text-xs">
        {ROLE_LABELS[r] ?? r}
      </Badge>
    ));
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.full_name?.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q) || (u.username?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('users.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('users.createUser')}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('users.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            {t('users.allUsers')}
          </CardTitle>
          <CardDescription>
            {t('users.countOf', { filtered: filteredUsers.length, total: users.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {users.length === 0 ? t('users.noUsers') : t('users.noMatch')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.name')}</TableHead>
                  <TableHead>{t('users.email')}</TableHead>
                  <TableHead>{t('users.language')}</TableHead>
                  <TableHead>{t('users.status')}</TableHead>
                  <TableHead>{t('users.role')}</TableHead>
                  <TableHead className="w-[70px]">{t('users.actions')}</TableHead>
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
                          {isSelf && <Badge variant="outline" className="text-xs">{t('users.you')}</Badge>}
                        </div>
                        {u.username && <span className="text-xs text-muted-foreground">@{u.username}</span>}
                      </TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs uppercase">{u.language_code || '—'}</Badge>
                      </TableCell>
                      <TableCell>{getUserStatus(u)}</TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{getRoleBadges(u.roles)}</div></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditUser(u)}>
                              <Pencil className="mr-2 h-4 w-4" />{t('users.edit')}
                            </DropdownMenuItem>
                            {u.is_blocked && (
                              <DropdownMenuItem onClick={() => setUnblockTarget(u)}>
                                <Unlock className="mr-2 h-4 w-4" />{t('users.unblock')}
                              </DropdownMenuItem>
                            )}
                            {!isSelf && !u.is_blocked && (
                              <DropdownMenuItem onClick={async () => {
                                try {
                                  await callAdmin({ action: 'block_user', user_id: u.user_id, reason: 'Blocked by administrator' });
                                  toast({ title: t('users.userBlocked') });
                                  fetchUsers();
                                } catch (err: any) {
                                  toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
                                }
                              }}>
                                <Lock className="mr-2 h-4 w-4" />{t('users.block')}
                              </DropdownMenuItem>
                            )}
                            {!isSelf && (
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(u)}>
                                <Trash2 className="mr-2 h-4 w-4" />{t('users.delete')}
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

      <UserFormDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={fetchUsers} />

      {editUser && (
        <UserEditDialog
          open={!!editUser}
          onOpenChange={(v) => { if (!v) setEditUser(null); }}
          user={editUser}
          onSuccess={fetchUsers}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('users.deleteDesc', { email: deleteTarget?.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>{t('users.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('users.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unblockTarget} onOpenChange={(v) => { if (!v) setUnblockTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.unblockTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('users.unblockDesc', { email: unblockTarget?.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>{t('users.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblock} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('users.confirmUnblock')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
