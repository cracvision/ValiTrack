

# Plan: Reconstrucción del Prototipo - Enfoque Correcto

## Entendimiento del Problema

Tienes razón. Lo que se construyó hasta ahora tiene mock data estática y un modelo de datos incompleto que no refleja tu visión real. Tu app es una **plataforma multi-sistema** donde:

- Cualquier cliente puede registrar **sus propios** sistemas GxP
- Cada sistema tiene su propio ciclo de periodic review con fechas configurables
- Se suben documentos reales (validaciones, SOPs, reportes de incidentes/cambios)
- Un agente de IA ejecuta el ejercicio de review automáticamente
- Notificaciones proactivas antes de que llegue la fecha del review
- Roles (System Owner, System Admin, QA) con tareas asignadas por rol

## Lo que hay que corregir

**SystemProfile actual** le faltan campos críticos que mencionas:
- `system_identifier` (número identificador)
- `system_category` (categoría del sistema)
- `intended_use` (uso previsto)
- `review_period_months` (cada cuánto toca el review)
- Información de vendor más completa (nombre, contacto, contrato)

**Dashboard** depende 100% de mock data. Debe mostrar datos vacíos cuando no hay sistemas registrados y llenarse conforme el usuario los crea.

**No hay CRUD funcional** en ninguna página. Todo son placeholders.

## Plan de Reconstrucción - Fase 1: System Profiles Funcional

Empezamos con lo más fundamental: poder crear y gestionar System Profiles con datos reales. Sin mock data. Estado local (React state + localStorage) para persistencia temporal hasta que conectemos Supabase.

### 1. Actualizar el modelo de datos `SystemProfile`

Campos del perfil expandido:
- `id`, `name`, `system_identifier` (ej: "SYS-001")
- `system_category` (ej: "LIMS", "ERP", "DCS", "MES", "QMS", "DMS", "Other")
- `intended_use` (texto libre describiendo el uso previsto)
- `gxp_classification` (GxP Critical, GxP Non-Critical, Non-GxP)
- `risk_level` (High, Medium, Low)
- `status` (Active, Retired, Under Validation)
- `vendor_name`, `vendor_contact`, `vendor_contract_ref`
- `owner_id`, `owner_name`
- `validation_date`, `review_period_months`, `next_review_date` (calculado)
- `description`, `created_at`, `updated_at`

### 2. Crear System Profiles CRUD completo

- **Lista de sistemas** con tabla (filtrable por categoría, clasificación, estado)
- **Botón "New System Profile"** que abre un formulario (dialog o página dedicada)
- **Formulario** con todos los campos organizados en secciones:
  - System Information (name, identifier, category, intended use)
  - Classification & Risk (GxP classification, risk level)
  - Vendor Information (vendor name, contact, contract ref)
  - Review Schedule (validation date, review period, next review date auto-calculado)
- **Editar / Ver detalle** de cada sistema
- **Validación** con zod (campos requeridos, formatos)

### 3. Persistencia local temporal

- `useLocalStorage` hook para guardar los sistemas creados
- Cuando conectemos Supabase, migraremos a la base de datos real

### 4. Dashboard dinámico

- Eliminar toda referencia a mock data
- Cards que leen del estado real (0 sistemas si no has creado ninguno)
- Mensaje de bienvenida tipo "empty state" cuando no hay datos

### 5. Eliminar mock data

- Eliminar `src/data/mockData.ts`
- Todas las páginas parten de estado vacío

### Archivos a crear/modificar

```text
src/types/index.ts              → Modelo expandido
src/hooks/useLocalStorage.ts    → Hook de persistencia local
src/pages/SystemProfiles.tsx    → Lista + tabla funcional
src/components/SystemProfileForm.tsx → Formulario crear/editar
src/pages/Dashboard.tsx         → Dinámico, sin mock data
src/data/mockData.ts            → ELIMINAR
```

### Resultado

Podrás crear el perfil de **BePAS|X** con datos reales como primer sistema registrado. El dashboard reflejará ese sistema. Las demás secciones (Review Cases, Evidence Vault, etc.) las construiremos en fases siguientes, conectadas al sistema que crees.

