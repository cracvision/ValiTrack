
Objetivo: corregir el 403 real en `check-scheduled-notifications` y dejar una forma confiable de dispararlo manualmente para pruebas.

Lo que ya verifiqué
- La función sí parece estar desplegada: los logs muestran el deployment activo y analytics registra un `POST | 403` a `check-scheduled-notifications` en la versión actual.
- El código live que vi sí contiene esta validación:
  - extrae el token con `authHeader.replace("Bearer ", "")`
  - compara contra `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY`
- El cron/manual test en SQL está enviando el header `Authorization: Bearer <publishable/anon key>`.

Diagnóstico más probable
- El problema ya no es el cron ni `verify_jwt`.
- El problema está en la validación interna del token:
  1. la extracción actual no es suficientemente robusta (`replace("Bearer ", "")`),
  2. la función solo acepta `SUPABASE_ANON_KEY`, pero en este proyecto también existe `SUPABASE_PUBLISHABLE_KEY`; en Lovable Cloud ambos nombres pueden intervenir y no conviene depender de uno solo,
  3. puede haber diferencia de espacios/case/formato en el header.

Plan de corrección
1. Endurecer la autenticación de `check-scheduled-notifications`
- Normalizar el header de forma robusta:
  - aceptar `Bearer ...` en forma case-insensitive
  - hacer `trim()` del token extraído
- Construir un conjunto de credenciales válidas desde runtime:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_PUBLISHABLE_KEY` si existe
- Comparar el token normalizado contra ese conjunto, filtrando valores vacíos.

2. Agregar diagnóstico seguro en logs
- Antes del `403`, registrar solo datos no sensibles:
  - si llegó `Authorization`
  - longitud del token recibido
  - si hubo match con service / anon / publishable
- No exponer secretos completos en logs ni en respuestas.

3. Desplegar explícitamente la función actualizada
- Forzar redeploy de `check-scheduled-notifications` para eliminar la duda de versión live.

4. Revalidar manualmente
- Probar con invocación manual desde SQL usando `net.http_post`.
- Si pasa autenticación, la respuesta debe ser `200` con el JSON `success/summary` aunque no haya notificaciones para enviar.

Forma manual de prueba que dejaré
- SQL de prueba inmediata con `net.http_post` usando el mismo header `Authorization`.
- Opcionalmente, si quieres dejarlo más cómodo después, puedo planear un botón interno de “Run scheduled notifications now”, pero para esta corrección el SQL es la vía más directa y segura.

Validación esperada
- Ya no debe devolver `403` cuando se invoque con la clave publishable/anon desde SQL.
- Debe responder `200`.
- Los logs deben mostrar qué credencial hizo match sin revelar secretos.
- El cron diario seguirá funcionando sin depender de `current_setting(...)`.

Impacto evaluado
- RLS / visibilidad por rol: sin cambios; la función sigue siendo backend-only y usa cliente privilegiado internamente.
- Componentes que consumen el mismo dato: sin impacto frontend; no cambia hooks, páginas ni contratos UI.
- Audit trail / compliance: sin cambios de esquema; solo se corrige autenticación de invocación.
- i18n: sin cambios.
- Tipos TypeScript: sin cambios frontend.
- UI condicional por rol: no aplica.

Resultado final a implementar
- Fix puntual en `supabase/functions/check-scheduled-notifications/index.ts`
- Redeploy de esa función
- Entrega de query SQL manual lista para pruebas
