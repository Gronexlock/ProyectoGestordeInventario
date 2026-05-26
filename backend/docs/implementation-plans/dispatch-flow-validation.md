# Implementation Plan: Dispatch Flow Validation

## Resumen Técnico

Se agregan dos validaciones de negocio a la transición `READY_FOR_DISPATCH → IN_TRANSIT` dentro de `transitionOrder()` en `order.service.ts`: existencia de un `DispatchSchedule` válido para hoy y hora actual dentro de la ventana de despacho de cada ubicación origen. El `PATCH /orders/:id/status` existente se mantiene sin cambios de interfaz. Se agrega un endpoint mínimo `POST /orders/:id/dispatch-schedule` para permitir el testing real del flujo. Las comparaciones horarias usan una timezone explícita y configurable (`APP_TIMEZONE`). El formato `HH:mm` se valida estrictamente antes de parsear.

## Cambios en Prisma Schema

- `DispatchSchedule.orderId String` (corregido de `Int`): alineado con `Order.id` UUID para la relación  ✅ migración `20260523161351_fix_dispatch_schedule` aplicada
- `DispatchSchedule.order Order @relation(...)` (nuevo): FK explícita hacia `Order` ✅
- `Order.dispatchSchedules DispatchSchedule[]` (nuevo): back-relation requerida por Prisma ✅
- `DispatchSchedule.@@map("dispatch_schedules")` (nuevo): convención de nombres del proyecto ✅
- Cierre `}` del modelo `DispatchSchedule` (corregido): el enum `OrderStatus` estaba dentro por error ✅

Sin cambios adicionales de schema para esta iteración.

## Cambios en Config

- `config.ts`: agregar `appTimezone: process.env.APP_TIMEZONE ?? "America/Santiago"` — timezone explícita usada en todas las comparaciones horarias del flujo de despacho
- `.env` / `.env.example`: agregar variable `APP_TIMEZONE=America/Santiago`

## Servicios Afectados

- `order.service.ts` (modificar):
  - `validateDispatchSchedule()`: implementada ✅ — busca schedule válido para hoy
  - `validateDispatchWindow()`: implementada ✅ — verificar ventana horaria por ubicación
  - `validateDispatchWindow()` pendiente de actualizar: reemplazar `new Date().getHours()` por cálculo timezone-aware usando `Intl.DateTimeFormat`
  - `parseTimeToMinutes()`: pendiente de agregar validación estricta de formato `HH:mm` antes de parsear
  - `createDispatchSchedule()` (nuevo): crear y asociar un `DispatchSchedule` a un pedido existente

## Controllers y Rutas

Endpoint existente (sin cambios de firma):
- `PATCH /orders/:id/status` con `{ status: "IN_TRANSIT" }` — dispara las validaciones antes de descontar stock ✅

Endpoint nuevo:
- `POST /orders/:id/dispatch-schedule` — crea un `DispatchSchedule` para el pedido

  Body: `{ scheduleDate: string (ISO 8601), priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL" }`

  Responde con el schedule creado. No requiere `startTime`/`endTime` — el schedule registra la intención de despacho para esa fecha; la ventana horaria se lee desde `Location` en el momento de la transición.

## Validaciones

### Ventana horaria (existente, actualizar timezone)
- Obtener hora actual en `config.appTimezone` usando `Intl.DateTimeFormat` con `timeZone` — sin dependencias externas
- Comparar contra `dispatchStart`–`dispatchEnd` de cada ubicación origen (límites inclusivos)

### Formato HH:mm (nuevo)
- Regex: `/^\d{2}:\d{2}$/`
- Rango: horas `0–23`, minutos `0–59`
- Aplicar en `parseTimeToMinutes()` antes de operar — lanzar `AppError 400` si el formato es inválido
- Aplicar también en las validaciones de entrada del endpoint `POST /orders/:id/dispatch-schedule` si acepta `startTime`/`endTime` en el futuro

### Endpoint POST /orders/:id/dispatch-schedule
- El pedido debe existir → `AppError 404`
- El pedido debe estar en estado `READY_FOR_DISPATCH` → `AppError 400` (no tiene sentido agendar un despacho para un pedido que no está listo)
- `scheduleDate` obligatoria, formato ISO 8601 válido, no puede ser una fecha pasada → `AppError 400`
- No puede existir un `DispatchSchedule` activo (status ≠ `CANCELLED`) para el mismo pedido en la misma fecha → `AppError 409` con mensaje claro
- `priority` opcional, default `"NORMAL"`, valores: `LOW | NORMAL | HIGH | CRITICAL`
- `status` del schedule creado: `"SCHEDULED"` (fijo, no configurable en creación)

## Transacciones

- Las validaciones de despacho se ejecutan **fuera** de la transacción Prisma para fallar rápido
- `deductStock` + `order.update` siguen en la misma transacción atómica ✅
- La creación del `DispatchSchedule` es una escritura simple sin transacción (no modifica stock ni estado del pedido)

## Consideraciones de Concurrencia

La validación de schedule duplicado (`findFirst` + `create`) tiene una ventana de race condition bajo concurrencia alta. Para v1 el riesgo es bajo (operación manual). Si fuera necesario endurecer: agregar `@@unique([orderId, scheduleDate])` filtrado por status en el schema, aunque Prisma no soporta unique parciales — alternativa: unique compuesto en DB con partial index.

## Orden de Implementación

1. ✅ Corregir `DispatchSchedule` en `schema.prisma` + migración
2. ✅ Implementar `validateDispatchSchedule()` en `order.service.ts`
3. ✅ Implementar `validateDispatchWindow()` con `parseTimeToMinutes()`
4. ✅ Integrar validaciones en `transitionOrder()` antes de `prisma.$transaction`
5. ⬜ Agregar `appTimezone` a `config.ts` y `.env.example`
6. ⬜ Actualizar `validateDispatchWindow()` para usar timezone explícita vía `Intl.DateTimeFormat`
7. ⬜ Agregar validación estricta de formato `HH:mm` en `parseTimeToMinutes()`
8. ⬜ Implementar `createDispatchSchedule()` en `order.service.ts`
9. ⬜ Agregar `POST /orders/:id/dispatch-schedule` en `order.routes.ts` + controller + validaciones de entrada

## Riesgos Técnicos

- **`Intl.DateTimeFormat` y Node.js**: disponible nativamente desde Node 12+, sin dependencias. Verificar que el runtime de producción tenga las ICU data completas (`full-icu`); en algunos entornos minimalistas la timezone no resuelve correctamente.
- **`dispatchStart`/`dispatchEnd` en registros existentes**: ubicaciones ya creadas podrían tener valores en formato `"8:00"` (sin cero inicial). El nuevo validador estricto rechazará `"8:00"` en runtime. Evaluar si se hace una migración de datos o si se flexibiliza el regex a `H:mm` / `HH:mm`.
- **Estado del pedido para crear schedule**: se valida `READY_FOR_DISPATCH`, pero podría ser razonable agendar desde `RESERVED`. Decisión tomada: solo desde `READY_FOR_DISPATCH` para v1 — revisar si genera fricción en el flujo real.
