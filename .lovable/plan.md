
Diagnóstico

Do I know what the issue is? Yes.

Tras revisar el código, las políticas RLS activas y el estado real del registro `f2993fa0-ca71-46e1-a272-bf5bc5afee95`, la causa más probable ya no es la falta de `.select()` ni la política `WITH CHECK` que agregamos. El problema restante está en cómo el frontend decide si el soft-delete “funcionó”.

Hoy `DeleteReviewDraftDialog` hace esto:
1. `update(...).eq('id', ...).eq('status', 'draft').select('id')`
2. Si `!data || data.length === 0`, muestra error

Eso es frágil para un soft-delete con RLS, porque en cuanto `is_deleted` pasa a `true`, la política SELECT de `review_cases` deja de mostrar esa fila (`is_deleted = false`). En esa situación, el update puede quedar ambiguo desde el cliente: la respuesta puede venir vacía aunque la operación sea válida, y el componente la interpreta como fallo. Además, aunque el ajuste de RLS era necesario, el flujo sigue sin tener una confirmación transaccional y fiable.

Plan de corrección

1. Mover la eliminación a una función SQL de backend dedicada
- Crear una migración con una función `soft_delete_review_case(...)` en `public`.
- La función debe:
  - validar `auth.uid()`
  - verificar que el caso exista, siga en `draft`, no esté borrado y que el usuario sea `system_owner_id` o `super_user`
  - ejecutar el soft-delete
  - insertar el `audit_log` en la misma transacción
  - devolver un resultado explícito, por ejemplo: `deleted`, `forbidden`, `not_draft`, `not_found`

2. Actualizar el frontend para usar la función
- Modificar `src/components/reviews/DeleteReviewDraftDialog.tsx`
- Reemplazar el `update(...).select('id')` por `supabase.rpc(...)`
- Mantener exactamente el mismo diálogo, validación y mensajes visibles al usuario
- Cambiar solo la lógica de éxito/error:
  - `deleted` => toast éxito + invalidate queries + navigate
  - cualquier otro estado => toast error actual + cerrar diálogo + refrescar estado

3. Mantener el RLS actual de UPDATE
- No quitar la corrección previa de la policy `Assigned users can update review cases`
- Esa corrección sigue siendo válida para otros updates de draft, especialmente Edit Draft
- La nueva función evita depender de la representación devuelta por PostgREST para el caso específico de soft-delete

4. Preservar comportamiento funcional actual
- No cambiar textos, layout ni condiciones de visibilidad del botón
- No tocar la lista de review cases, porque ya filtra `is_deleted = false`
- No hacer cascade delete de relaciones
- No usar localStorage

Archivos a modificar

1. `supabase/migrations/<new_timestamp>_soft_delete_review_case.sql`
- Crear función `public.soft_delete_review_case(p_review_case_id uuid, p_reason text)`
- `SECURITY DEFINER`
- `SET search_path = public`
- Debe actualizar `review_cases` y escribir en `audit_log` de forma atómica

2. `src/components/reviews/DeleteReviewDraftDialog.tsx`
- Sustituir la lógica actual basada en `update(...).select('id')`
- Consumir el resultado estructurado de la RPC
- Mantener toasts y navegación tal como están definidos hoy

Impacto evaluado

- RLS / visibilidad por rol:
  - Sigue limitado a System Owner y Super User
  - No se expone información nueva
  - La función validará permisos explícitamente en backend
- Componentes afectados:
  - Solo `DeleteReviewDraftDialog`
  - `ReviewCaseDetail`, `useReviewCases` y `useReviewCase` no requieren cambios funcionales
- Audit trail / compliance:
  - Mejora clara: delete + audit quedan en una sola transacción
  - Más defendible ante auditoría GxP
- i18n:
  - Sin cambios
- TypeScript:
  - No requiere cambios de tipos de dominio; solo tipado local del resultado RPC si se desea

Verificación después de implementar

1. Borrar un draft como System Owner:
- debe desaparecer de la lista
- debe navegar a `/reviews`
- debe registrarse `REVIEW_CASE_DELETED`

2. Intentar borrar un caso que ya no esté en `draft`:
- debe mostrar el mismo error actual

3. Intentar borrar con usuario no autorizado:
- el botón no debe aparecer; si se fuerza la llamada, backend debe rechazarla

4. Verificar en red:
- ya no dependeremos de un `PATCH review_cases` ambiguo
- se verá una llamada RPC con resultado explícito de éxito o fallo
