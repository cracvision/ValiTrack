

## Diagnóstico

El problema es un **bug de timing en `RoleGuard`**. Cuando navegas a `/admin/users`:

1. `useAuth()` inicia con `roles: []` y `loading: true`
2. `RoleGuard` evalúa `requiredRoles.some(r => roles.includes(r))` — es `false` porque los roles aún no se cargaron
3. Inmediatamente hace `<Navigate to="/" />` y te redirige al Dashboard
4. Nunca llegas a ver `UserManagement`

Los componentes `UserManagement.tsx`, `UserFormDialog.tsx`, `UserEditDialog.tsx` **ya están creados y completos**. El único problema es que `RoleGuard` no espera a que los roles terminen de cargar.

## Plan

### 1. Corregir `RoleGuard.tsx`
Agregar estado `loading` del hook `useAuth`. Mientras carga, mostrar un spinner o `null`. Solo redirigir cuando `loading === false` y el usuario no tiene el rol requerido.

```tsx
export function RoleGuard({ children, requiredRoles }: RoleGuardProps) {
  const { roles, loading } = useAuth();

  if (loading) return <div>Loading...</div>; // o spinner

  const hasAccess = requiredRoles.some((r) => roles.includes(r));
  if (!hasAccess) return <Navigate to="/" replace />;

  return <>{children}</>;
}
```

### 2. Verificar edge function `admin-manage-users`
Confirmar que la acción `list_users` funciona correctamente con la vista `private.admin_user_roles_view` o el fallback manual, ya que el bug de `profile.id` vs `u.id` fue reportado anteriormente.

Ese es el único cambio necesario. Una vez que `RoleGuard` espere la carga, verás el panel completo de User Management con la tabla, búsqueda, y botón de crear usuario.

