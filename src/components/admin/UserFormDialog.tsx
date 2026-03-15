import { useState } from 'react';
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

const ROLE_OPTIONS = [
  { value: 'super_user', label: 'Super User', description: 'Administra la plataforma, crea y revoca cuentas' },
  { value: 'system_owner', label: 'System Owner', description: 'Dueño del sistema bajo revisión periódica' },
  { value: 'system_administrator', label: 'System Administrator', description: 'Administrador del sistema bajo revisión' },
  { value: 'business_owner', label: 'Business Owner', description: 'Responsable del negocio' },
  { value: 'quality_assurance', label: 'Quality Assurance', description: 'Garantía de calidad' },
] as const;

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UserFormDialog({ open, onOpenChange, onSuccess }: UserFormDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [languageCode, setLanguageCode] = useState('es');
  const [role, setRole] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setLanguageCode('es');
    setRole('');
    setExpiresAt(undefined);
    setShowPassword(false);
  };

  const passwordValid = isPasswordValid(password, email, username);
  const formValid = fullName.length >= 2 && email.length > 0 && passwordValid && role.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email,
          password,
          full_name: fullName,
          username: username || undefined,
          language_code: languageCode,
          role,
          account_expires_at: expiresAt ? expiresAt.toISOString() : undefined,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Usuario creado',
        description: `${email} ha sido creado con contraseña temporal.`,
      });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Cuenta de Usuario</DialogTitle>
          <DialogDescription>
            El usuario deberá cambiar su contraseña en el primer inicio de sesión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="uf-name">Nombre Completo *</Label>
            <Input
              id="uf-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="uf-username">Username</Label>
            <Input
              id="uf-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jdoe (opcional)"
              maxLength={50}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="uf-email">Email *</Label>
            <Input
              id="uf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="uf-password">Contraseña Temporal *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="uf-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 12 caracteres"
                className="pl-10 pr-10"
                required
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
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar idioma" />
              </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpiresAt(undefined)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !formValid}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear Cuenta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
