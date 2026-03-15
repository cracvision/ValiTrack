import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isPasswordValid } from '@/lib/passwordValidation';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Eye, EyeOff, Lock, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { UserData } from './UserManagement';

const ROLE_OPTIONS = [
  { value: 'super_user', label: 'Super User' },
  { value: 'system_owner', label: 'System Owner' },
  { value: 'system_administrator', label: 'System Administrator' },
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'quality_assurance', label: 'Quality Assurance' },
] as const;

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData;
  onSuccess: () => void;
}

export function UserEditDialog({ open, onOpenChange, user, onSuccess }: UserEditDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [languageCode, setLanguageCode] = useState('es');
  const [role, setRole] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  useEffect(() => {
    if (user && open) {
      setFullName(user.full_name || '');
      setUsername(user.username || '');
      setEmail(user.email);
      setPassword('');
      setLanguageCode(user.language_code || 'es');
      setRole(user.roles?.split(',')[0] || '');
      setExpiresAt(user.account_expires_at ? new Date(user.account_expires_at) : undefined);
      setShowPassword(false);
    }
  }, [user, open]);

  const passwordValid = password.length === 0 || isPasswordValid(password, email, username);
  const formValid = fullName.length >= 2 && email.length > 0 && role.length > 0 && passwordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        action: 'update_user',
        user_id: user.user_id,
        full_name: fullName,
        username: username || undefined,
        role,
        language_code: languageCode,
        account_expires_at: expiresAt ? expiresAt.toISOString() : null,
      };

      // Only send email if changed
      if (email !== user.email) body.email = email;
      // Only send password if provided
      if (password.length > 0) body.password = password;

      const { data, error } = await supabase.functions.invoke('admin-manage-users', { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Usuario actualizado', description: `${email} ha sido actualizado.` });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modificar los datos del usuario. Deja la contraseña vacía para no cambiarla.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="ue-name">Nombre Completo *</Label>
            <Input
              id="ue-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="ue-username">Username</Label>
            <Input
              id="ue-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="ue-email">Email *</Label>
            <Input
              id="ue-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password (optional for edit) */}
          <div className="space-y-2">
            <Label htmlFor="ue-password">Nueva Contraseña (opcional)</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="ue-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Dejar vacío para no cambiar"
                className="pl-10 pr-10"
                minLength={12}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword
                  ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                  : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          {password.length > 0 && (
            <PasswordRequirements password={password} email={email} username={username} />
          )}

          {/* Language */}
          <div className="space-y-2">
            <Label>Idioma *</Label>
            <Select value={languageCode} onValueChange={setLanguageCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Rol del Usuario *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label>Fecha de Expiración</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'flex-1 justify-start text-left font-normal',
                      !expiresAt && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiresAt ? format(expiresAt, 'dd/MM/yyyy') : 'Sin fecha de expiración'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiresAt}
                    onSelect={setExpiresAt}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {expiresAt && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setExpiresAt(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !formValid}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
