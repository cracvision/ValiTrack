# GxP Periodic Review — Especificación del Producto

**Versión:** 1.0  
**Fecha:** 2026-03-16  
**Estado:** En desarrollo activo

---

## 1. Visión General

### 1.1 Propósito

GxP Periodic Review es una plataforma web para la **gestión centralizada de revisiones periódicas de sistemas computarizados validados** en la industria farmacéutica. Cumple con los requisitos regulatorios de **21 CFR Part 11**, **EU Annex 11**, y guías **GAMP 5**, proporcionando trazabilidad completa, control de acceso basado en roles, y un registro de auditoría inmutable.

### 1.2 Usuarios Objetivo

| Rol | Responsabilidad |
|-----|----------------|
| **Super User** | Administra la plataforma, crea/revoca cuentas, configura políticas de seguridad |
| **System Owner** | Dueño del sistema bajo revisión periódica, gestiona perfiles de sistema |
| **System Administrator** | Administrador técnico del sistema bajo revisión |
| **Business Owner** | Responsable del negocio, aprueba revisiones |
| **Quality Assurance** | Aprueba/rechaza revisiones, gestiona hallazgos y CAPAs |

### 1.3 Stack Tecnológico

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — Auth, Database, Edge Functions, Storage
- **Internacionalización:** i18next (ES/EN)
- **State Management:** React Context (AuthContext singleton) + TanStack Query
- **Routing:** React Router v6

---

## 2. Estado Actual de Implementación

### ✅ Completado

#### 2.1 Autenticación y Seguridad (Iteración 6)

- **Login con email/contraseña** — Sin registro público; las cuentas son creadas exclusivamente por administradores
- **Cambio obligatorio de contraseña** — Los usuarios con credenciales temporales son redirigidos a `/reset-password` antes de acceder a la app
- **Política de contraseñas robusta** (validación cliente + servidor):
  - Mínimo 12 caracteres
  - Mayúscula, minúscula, número, carácter especial
  - No puede contener email ni username del usuario
- **Historial de contraseñas** — Se almacena hash SHA-256 de las últimas 5 contraseñas para prevenir reutilización
- **AuthContext Singleton** — Una sola suscripción a `onAuthStateChange`, prevención de race conditions durante logout con flag `isSigningOut` y ref `isMounted`
- **Rutas protegidas** — `ProtectedRoute` redirige a `/auth` si no hay sesión, a `/reset-password` si `must_change_password` es true
- **Guard por roles** — `RoleGuard` verifica roles antes de renderizar rutas restringidas

#### 2.2 Gestión de Usuarios (Iteración 6)

- **CRUD completo de usuarios** vía Edge Functions (`admin-create-user`, `admin-manage-users`)
- **Creación de usuario:** nombre, username, email, contraseña temporal, idioma (ES/EN), rol, fecha de expiración opcional
- **Edición de usuario:** todos los campos editables, contraseña opcional con revalidación de política
- **Bloqueo/desbloqueo de cuentas** — Bloqueo con ban en auth + flag `is_blocked` en `app_users`
- **Eliminación de usuario** — Elimina del auth y cascade en tablas relacionadas
- **Verificación de rol `super_user`** en cada Edge Function vía `has_role()` RPC (SECURITY DEFINER)
- **Audit log** — Cada acción administrativa (crear, editar, bloquear, desbloquear, eliminar) se registra en tabla `audit_log`
- **UI:** Tabla con búsqueda, badges de estado (Activa/Bloqueada/Expirada/Pendiente), menú de acciones por usuario

#### 2.3 Dashboard (Iteración 1-2)

- **KPIs:** Sistemas totales, GxP Críticos, Alto Riesgo, Revisiones próximas (90 días)
- **Alertas de revisiones vencidas** con tarjeta destacada en rojo
- **Lista de próximas revisiones** ordenadas por fecha
- **Lista de sistemas registrados** con badges de clasificación
- **Estado vacío** con CTA para registrar el primer sistema

#### 2.4 Perfiles de Sistema — CRUD (Iteración 2)

- **Formulario completo** con validación Zod:
  - Información del sistema: nombre, identificador, categoría (LIMS/ERP/DCS/MES/QMS/DMS/SCADA/CDS/ELN/Other), estado, uso previsto, descripción
  - Clasificación y riesgo: GxP Critical / GxP Non-Critical / Non-GxP, Alto/Medio/Bajo
  - Información del vendor: nombre, contacto, referencia de contrato
  - Programación de revisión: dueño, fecha de validación, periodo de revisión (meses), cálculo automático de próxima revisión
- **Tabla con filtros** por categoría y estado
- **Edición y eliminación** con diálogo de confirmación
- **Almacenamiento:** localStorage (pendiente migración a base de datos)

#### 2.5 Layout y Navegación

- **Sidebar colapsable** con secciones: Principal, Cumplimiento, Administración
- **Footer con perfil de usuario** — Iniciales, nombre, rol principal, botón de logout
- **Responsive** con soporte mobile via `useSidebar`
- **Navegación activa** resaltada

#### 2.6 Internacionalización (i18n)

- **Idiomas:** Español (predeterminado) e Inglés
- **Preferencia de idioma por usuario** almacenada en tabla `user_language_preference` con flag `locked`
- **Archivos de traducción:** `es/common.json`, `es/auth.json`, `en/common.json`, `en/auth.json`

#### 2.7 Base de Datos (Lovable Cloud)

**Tablas implementadas:**

| Tabla | Propósito |
|-------|-----------|
| `app_users` | Perfil extendido de usuario (nombre, username, email, bloqueo, intentos fallidos, expiración) |
| `user_roles` | Roles RBAC separados de perfil (patrón recomendado anti-escalamiento de privilegios) |
| `user_language_preference` | Idioma por usuario con flag de bloqueo |
| `password_history` | Hashes SHA-256 de contraseñas anteriores |
| `audit_log` | Registro inmutable de acciones (user_id, action, resource_type, resource_id, details JSONB) |
| `profiles` | Tabla legacy (migrada a `app_users`) |

**Funciones RPC:**
- `has_role(_user_id, _role)` — SECURITY DEFINER, evita recursión RLS
- `get_user_roles(_user_id)` — Retorna array de roles del usuario

**Edge Functions:**
- `admin-create-user` — Crea usuario en auth + app_users + role + language + password_history + audit_log
- `admin-manage-users` — list_users, update_user, delete_user, block_user, unblock_user

### 🔲 Placeholder (UI existe, sin funcionalidad)

| Módulo | Ruta | Iteración Planificada |
|--------|------|----------------------|
| Casos de Revisión | `/reviews` | Iteración 3 |
| Bóveda de Evidencia | `/evidence` | Iteración 4 |
| Hallazgos y Acciones | `/findings` | Iteración 5 |
| Reportes | `/reports` | Iteración 7 |
| Registro de Auditoría (UI) | `/audit-log` | Iteración 7 |

---

## 3. Descripción del Producto Final

### 3.1 Módulo: Casos de Revisión (Iteración 3)

**Workflow de estados:** `Draft → Under Review → Pending QA → Completed`

- Crear caso de revisión vinculado a un System Profile
- Asignar revisor y fecha límite
- Checklist configurable de puntos de revisión (SOPs vigentes, Change Controls pendientes, desviaciones, training, etc.)
- Transiciones de estado con validación de prerrequisitos (e.g., no puede pasar a Pending QA sin evidencia adjunta)
- **E-signature simulada** (usuario + contraseña + timestamp + motivo) para aprobación QA
- Historial completo de transiciones en audit log
- Dashboard de casos: filtros por sistema, estado, revisor, fecha
- Notificaciones de vencimiento (próximamente con integración de email)

### 3.2 Módulo: Bóveda de Evidencia (Iteración 4)

- **Upload de documentos** a Lovable Cloud Storage con categorización:
  - SOP, Change Control, Validation Report, Audit Report, Training Record, Other
- **Verificación de integridad:** Hash SHA-256 calculado al subir, verificable en cualquier momento
- Vinculación de evidencia a casos de revisión
- Previsualización de documentos (PDF, imágenes)
- Metadatos: nombre, categoría, quien lo subió, fecha, hash
- Protección con RLS: solo usuarios con acceso al caso pueden ver/descargar
- Versionado de documentos (reemplazo con historial)

### 3.3 Módulo: Hallazgos y Acciones CAPA (Iteración 5)

- **Hallazgos (Findings):**
  - Severidad: Critical / Major / Minor / Observation
  - Estado: Open → In Progress → Closed
  - Vinculado a un caso de revisión
  - Descripción detallada, evidencia de soporte
  
- **Acciones Correctivas/Preventivas (CAPA):**
  - Estado: Open → In Progress → Completed → Verified
  - Asignación a responsable con fecha límite
  - Verificación de cierre por QA
  - Escalamiento automático por vencimiento

- **Dashboard de hallazgos:** Métricas por severidad, tendencias, sistemas con más hallazgos

### 3.4 Módulo: Reportes (Iteración 7)

- **Reporte de Revisión Periódica** — Documento PDF generado automáticamente que consolida:
  - Perfil del sistema
  - Checklist de revisión completado
  - Evidencia adjunta con hashes
  - Hallazgos y acciones CAPA
  - Firmas electrónicas de revisores y QA
  
- **Dashboard analítico:**
  - Sistemas por clasificación GxP y nivel de riesgo
  - Tendencias de hallazgos (por trimestre, por sistema)
  - Cumplimiento de fechas de revisión (% on-time)
  - CAPAs abiertas vs cerradas
  - Tiempo promedio de cierre de hallazgos

- **Exportación:** PDF, CSV, Excel

### 3.5 Módulo: Registro de Auditoría (Iteración 7)

- **Tabla inmutable** que registra toda acción relevante:
  - Creación/edición/eliminación de sistemas, casos, evidencia, hallazgos, acciones
  - Cambios de estado en workflows
  - Acciones administrativas (usuarios, roles)
  - Login/logout
- **Filtros:** por usuario, fecha, tipo de recurso, acción
- **Exportación** para inspecciones regulatorias
- **Cumplimiento 21 CFR Part 11:** registros no editables, timestamp del servidor, identificación de usuario

### 3.6 Migración de System Profiles a Base de Datos

- Migrar de localStorage a tabla `system_profiles` en Lovable Cloud
- RLS: System Owners ven solo sus sistemas, QA y Super Users ven todos
- Trigger de audit log para cambios en perfiles
- Relación foreign key con `app_users` para `owner_id`

### 3.7 Visión Futura (Post-Iteración 7)

- **Integración de IA:**
  - Automatización de ejecución de revisiones con LLM
  - Consultas inteligentes a base de datos para comparar parámetros técnicos entre sistemas
  - Detección de anomalías en tendencias de hallazgos
  - Generación automática de resúmenes de revisión
  
- **Notificaciones preventivas:**
  - Alertas por email antes del vencimiento de revisiones
  - Recordatorios de CAPAs pendientes
  - Escalamiento automático a supervisores

- **Integraciones externas:**
  - Sistemas QMS existentes
  - Document Management Systems (DMS)
  - Sistemas de training (LMS)

---

## 4. Modelo de Datos

### 4.1 Tipos del Dominio

```typescript
// Enums
type SystemCategory = 'LIMS' | 'ERP' | 'DCS' | 'MES' | 'QMS' | 'DMS' | 'SCADA' | 'CDS' | 'ELN' | 'Other';
type GxPClassification = 'GxP Critical' | 'GxP Non-Critical' | 'Non-GxP';
type RiskLevel = 'High' | 'Medium' | 'Low';
type SystemStatus = 'Active' | 'Retired' | 'Under Validation';
type ReviewStatus = 'Draft' | 'Under Review' | 'Pending QA' | 'Completed';
type FindingSeverity = 'Critical' | 'Major' | 'Minor' | 'Observation';
type FindingStatus = 'Open' | 'In Progress' | 'Closed';
type ActionItemStatus = 'Open' | 'In Progress' | 'Completed' | 'Verified';
type EvidenceCategory = 'SOP' | 'Change Control' | 'Validation Report' | 'Audit Report' | 'Training Record' | 'Other';
type AppRole = 'super_user' | 'system_owner' | 'system_administrator' | 'business_owner' | 'quality_assurance';

// Entidades principales
interface SystemProfile { id, name, system_identifier, system_category, description, intended_use, gxp_classification, risk_level, status, vendor_name, vendor_contact, vendor_contract_ref, owner_id, owner_name, validation_date, review_period_months, next_review_date, created_at, updated_at }
interface ReviewCase { id, system_id, system_name, title, status, reviewer_id, reviewer_name, due_date, completion_date, created_at }
interface EvidenceItem { id, case_id, file_name, file_url, file_hash_sha256, category, uploaded_by, uploaded_at }
interface Finding { id, case_id, system_name, severity, description, status, created_at }
interface ActionItem { id, finding_id, description, assignee, status, due_date, completed_date }
interface AuditLogEntry { id, user_id, user_name, table_name, record_id, action, change_ts }
```

### 4.2 Tablas Implementadas en BD

| Tabla | Estado |
|-------|--------|
| `app_users` | ✅ Producción |
| `user_roles` | ✅ Producción |
| `user_language_preference` | ✅ Producción |
| `password_history` | ✅ Producción |
| `audit_log` | ✅ Producción |
| `system_profiles` | 🔲 Pendiente (actualmente localStorage) |
| `review_cases` | 🔲 Pendiente |
| `evidence_items` | 🔲 Pendiente |
| `findings` | 🔲 Pendiente |
| `action_items` | 🔲 Pendiente |

---

## 5. Arquitectura de Seguridad

### 5.1 Autenticación
- Lovable Cloud Auth con email/contraseña
- Sin registro público — solo admin puede crear cuentas
- Cambio obligatorio de contraseña en primer login
- Política de contraseñas validada en cliente y servidor
- Historial de contraseñas (SHA-256, últimas 5)

### 5.2 Autorización
- RBAC con tabla `user_roles` separada (anti-escalamiento de privilegios)
- `has_role()` como SECURITY DEFINER (evita recursión RLS)
- Edge Functions verifican rol antes de ejecutar operaciones administrativas
- `RoleGuard` en frontend para protección de rutas
- RLS policies en todas las tablas

### 5.3 Bloqueo de Cuentas
- Campo `is_blocked` + `blocked_reason` en `app_users`
- Ban en auth layer (876600h = ~100 años)
- Contador de intentos fallidos (`failed_login_attempts`)
- Expiración de cuenta configurable (`account_expires_at`)

### 5.4 Audit Trail
- Tabla `audit_log` inmutable
- Registro de acciones administrativas vía Edge Functions
- Detalle en JSONB para contexto completo
- Preparado para cumplimiento 21 CFR Part 11

---

## 6. Estructura del Proyecto

```
src/
├── App.tsx                          # Router principal
├── contexts/AuthContext.tsx          # Singleton auth state
├── hooks/
│   ├── useAuth.ts                   # Re-export del context
│   ├── useLocalStorage.ts           # Persistencia local
│   └── use-toast.ts                 # Notificaciones
├── components/
│   ├── Layout.tsx                   # Shell con sidebar
│   ├── AppSidebar.tsx               # Navegación lateral
│   ├── ProtectedRoute.tsx           # Guard de autenticación
│   ├── RoleGuard.tsx                # Guard de roles
│   ├── SystemProfileForm.tsx        # Formulario de sistema
│   ├── PasswordRequirements.tsx     # Indicador visual de política
│   ├── admin/
│   │   ├── UserManagement.tsx       # Tabla de usuarios
│   │   ├── UserFormDialog.tsx       # Crear usuario
│   │   └── UserEditDialog.tsx       # Editar usuario
│   └── ui/                          # shadcn/ui components
├── pages/
│   ├── Auth.tsx                     # Login
│   ├── ResetPassword.tsx            # Cambio de contraseña
│   ├── Dashboard.tsx                # Panel principal
│   ├── SystemProfiles.tsx           # CRUD sistemas
│   ├── ReviewCases.tsx              # Placeholder
│   ├── EvidenceVault.tsx            # Placeholder
│   ├── FindingsActions.tsx          # Placeholder
│   ├── Reports.tsx                  # Placeholder
│   ├── AuditLog.tsx                 # Placeholder
│   └── UserManagement.tsx           # Wrapper admin
├── types/index.ts                   # Tipos del dominio
├── lib/
│   ├── i18n.ts                      # Configuración i18next
│   ├── passwordValidation.ts        # Validación de contraseña (cliente)
│   └── utils.ts                     # Utilidades (cn)
├── locales/
│   ├── es/common.json, auth.json
│   └── en/common.json, auth.json
└── integrations/supabase/
    ├── client.ts                    # Auto-generado
    └── types.ts                     # Auto-generado

supabase/
├── config.toml                      # Auto-generado
└── functions/
    ├── _shared/passwordPolicy.ts    # Política compartida (servidor)
    ├── admin-create-user/index.ts   # Edge Function: crear usuario
    └── admin-manage-users/index.ts  # Edge Function: gestión de usuarios
```

---

## 7. Roadmap de Iteraciones

| # | Módulo | Estado |
|---|--------|--------|
| 1 | Layout + Nav + Tipos + Dashboard básico | ✅ Completado |
| 2 | CRUD System Profiles | ✅ Completado (localStorage) |
| 3 | Review Cases + Workflow | 🔲 Siguiente |
| 4 | Evidence Vault (upload + hash) | 🔲 Pendiente |
| 5 | Findings & Actions CAPA | 🔲 Pendiente |
| 6 | Integración Lovable Cloud (Auth + Users + DB) | ✅ Completado |
| 7 | Reports + Audit Log UI | 🔲 Pendiente |
| 8 | Migración System Profiles a DB | 🔲 Pendiente |
| 9 | IA y Automatización | 🔭 Visión futura |
