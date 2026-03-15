

## Plan: Refactorizar autenticación a AuthContext singleton

### Problema confirmado
`useAuth()` se instancia independientemente en 6 componentes, creando 6 suscripciones paralelas a `onAuthStateChange`, 18 queries por login, y race conditions en logout que producen pantalla en blanco.

### Cambios

#### 1. Crear `src/contexts/AuthContext.tsx` (archivo nuevo)
- Mover toda la lógica de `useAuth.ts` a un `AuthProvider`
- Una sola suscripción a `onAuthStateChange`, un solo estado
- Agregar flag `isSigningOut` (ref) que se activa antes de `supabase.auth.signOut()` y se usa para cancelar fetches en vuelo
- Agregar ref `isMounted` para prevenir `setState` después del unmount
- En `SIGNED_OUT`, limpiar todo el estado en una sola llamada síncrona
- Manejar `getSession()` para carga inicial, `onAuthStateChange` solo para eventos posteriores
- Exportar `useAuth()` que hace `useContext` con error si se usa fuera del provider

#### 2. Simplificar `src/hooks/useAuth.ts`
- Reemplazar todo el contenido por un re-export:
  ```ts
  export { useAuth } from '@/contexts/AuthContext';
  ```
- Ningún componente consumidor necesita cambiar sus imports

#### 3. Actualizar `src/App.tsx`
- Envolver la app con `<AuthProvider>` dentro de `QueryClientProvider`

#### 4. Proteger `UserManagement.tsx` contra logout
- En `callAdmin`, además del check de sesión existente, verificar `isSigningOut` del contexto (exponer como parte del estado o como método)
- Alternativa más limpia: exponer `isSigningOut` desde el contexto y chequearlo en `fetchUsers`

### Archivos afectados
| Archivo | Acción |
|---------|--------|
| `src/contexts/AuthContext.tsx` | Nuevo |
| `src/hooks/useAuth.ts` | Simplificar a re-export |
| `src/App.tsx` | Agregar `<AuthProvider>` |

### Lo que NO cambia
- Ninguna edge function
- Ningún componente de UI (mismo API `useAuth()`)
- Ninguna tabla, RLS, o migración
- Ningún archivo de traducciones

