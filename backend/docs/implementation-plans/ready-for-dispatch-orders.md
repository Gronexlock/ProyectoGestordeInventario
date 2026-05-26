# Implementation Plan: Ready-for-Dispatch Orders Query

## Resumen Técnico

Endpoint GET de solo lectura que devuelve órdenes en estado `READY_FOR_DISPATCH` con sus items,
con filtros opcionales por `locationId` y rango de fechas. Se integra al patrón existente
service/controller/routes sin cambios en el schema de Prisma. Flujo estándar del proyecto:
validación de query params en la ruta → controller extrae y delega → service consulta y valida.

## Cambios en Prisma Schema

N/A — se usan los modelos `Order` y `OrderItem` existentes sin modificaciones.

## Servicios Afectados

- `order.service.ts` (modificar): agregar función `getReadyForDispatch(filters)` — consulta
  órdenes por status `READY_FOR_DISPATCH`, aplica filtros opcionales, valida existencia de
  `locationId` antes de ejecutar la query.

## Controllers y Rutas

- `GET /api/v1/orders/ready-for-dispatch` — devuelve órdenes listas para despacho con sus
  items incluidos. Query params opcionales: `locationId`, `dateFrom`, `dateTo`. Requiere auth
  (usar el mismo mecanismo existente en el sistema cuando esté disponible).

## Validaciones

- `locationId`: opcional, string UUID válido (via `query("locationId").optional().isUUID()`)
- `dateFrom` / `dateTo`: opcionales, strings ISO 8601 válidas (`.isISO8601()`)
- Si ambos `dateFrom` y `dateTo` están presentes: `dateFrom` no puede ser posterior a `dateTo` → 400
- Si `locationId` está presente: validar que la location existe en DB → 404 si no existe
  (lanzar `AppError("Location not found", 404)` desde el service)

## Transacciones

N/A — consulta de solo lectura, sin mutaciones de estado ni stock.

## Consideraciones de Concurrencia

N/A — el endpoint no modifica datos. No hay riesgo de race condition.

## Orden de Implementación

1. Agregar `getReadyForDispatch(filters)` en `order.service.ts` con lógica de query y
   validación de location.
2. Agregar método `getReadyForDispatch` en `order.controller.ts` extrayendo query params
   y usando `sendSuccess()`.
3. Agregar ruta `GET /ready-for-dispatch` en `order.routes.ts` con validadores de query
   params y `validateRequest`. **Debe registrarse antes de `GET /:id`** para evitar que
   Express interprete "ready-for-dispatch" como un valor de `:id`.

## Riesgos Técnicos

- **Orden de rutas (crítico):** `GET /ready-for-dispatch` debe declararse antes de `GET /:id`
  en el router — de lo contrario Express matchea "ready-for-dispatch" como id y el handler
  incorrecto recibe la request.
- **Auth:** el agente de exploración no encontró middleware de auth activo en el proyecto. Si
  el sistema aún no tiene auth implementada, este endpoint quedará sin protección en v1 al igual
  que el resto. Revisar antes de exponer a Proyecto 2.
- **Volumen:** sin paginación en v1. Aceptable inicialmente; agregar `take`/`skip` si el
  volumen de órdenes en estado `READY_FOR_DISPATCH` crece sostenidamente.
