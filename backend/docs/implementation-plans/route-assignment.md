# Implementation Plan: Route Assignment

## Resumen Técnico

Se construye un módulo de rutas que permite agrupar órdenes `READY_FOR_DISPATCH` en un viaje operativo. El nuevo estado `ROUTE_ASSIGNED` se inserta entre `READY_FOR_DISPATCH` e `IN_TRANSIT` en la máquina de estados existente. El riesgo técnico central es el despacho masivo atómico: todas las órdenes de una ruta deben deducir stock y cambiar a `IN_TRANSIT` en una sola transacción Prisma, reutilizando la lógica existente de `order.service.ts`.

---

## Cambios en Prisma Schema

- `RouteStatus` enum (nuevo): `OPEN | DISPATCHED | CANCELLED`
- `Route` model (nuevo): `id` (cuid), `vehicleCode String`, `driverName String?`, `status RouteStatus @default(OPEN)`, `createdAt`, `updatedAt`, relación `orders Order[]`
- `OrderStatus` enum (modificar): agregar `ROUTE_ASSIGNED` entre `READY_FOR_DISPATCH` e `IN_TRANSIT`
- `Order` model (modificar): agregar `routeId String?` con FK a `Route` (nullable, `onDelete: SetNull`)

---

## Servicios Afectados

- `route.service.ts` (nuevo): crear, listar, obtener, asignar órdenes, remover orden, despachar y cancelar rutas
- `order.service.ts` (modificar):
  - Agregar `ROUTE_ASSIGNED` a `VALID_TRANSITIONS`: `READY_FOR_DISPATCH → ROUTE_ASSIGNED` y `ROUTE_ASSIGNED → READY_FOR_DISPATCH`
  - Extraer función interna `applyInTransitMutation(tx, order)` que ejecuta `deductStock` + actualiza status — llamable con un `tx` externo para soporte de transacciones compartidas
  - Actualizar `getReadyForDispatch()` para excluir órdenes con status `ROUTE_ASSIGNED`

---

## Controllers y Rutas

**Nuevos archivos:** `route.controller.ts`, `route.routes.ts`

| Método | Path | Descripción |
|---|---|---|
| `POST` | `/api/v1/routes` | Crea una ruta nueva en estado `OPEN` |
| `GET` | `/api/v1/routes` | Lista rutas con sus órdenes agrupadas |
| `GET` | `/api/v1/routes/:id` | Detalle de una ruta con órdenes |
| `POST` | `/api/v1/routes/:id/orders` | Asigna órdenes a la ruta → pasan a `ROUTE_ASSIGNED` |
| `DELETE` | `/api/v1/routes/:id/orders/:orderId` | Remueve una orden de la ruta → vuelve a `READY_FOR_DISPATCH` |
| `POST` | `/api/v1/routes/:id/dispatch` | Despacha la ruta → todas las órdenes a `IN_TRANSIT` |
| `DELETE` | `/api/v1/routes/:id` | Cancela la ruta → órdenes vuelven a `READY_FOR_DISPATCH` |

Registrar el router en `app.ts` bajo `/api/v1/routes`.

---

## Validaciones

- `POST /routes`: `vehicleCode` requerido, no vacío; `driverName` opcional string
- `POST /routes/:id/orders`: `orderIds` array de UUIDs, mínimo 1 elemento
- Todas las rutas con `:id` o `:orderId`: validar formato UUID
- En servicio — verificar antes de mutar:
  - Ruta debe existir y estar en estado `OPEN` para asignar, remover o cancelar
  - Ruta debe existir y estar en estado `OPEN` con al menos 1 orden para despachar
  - Cada orden a asignar debe estar en `READY_FOR_DISPATCH`
  - Cada orden a asignar no debe tener `routeId` activo (no estar en otra ruta)
  - Al remover: orden debe pertenecer a esta ruta y estar en `ROUTE_ASSIGNED`
  - Al despachar: validar `DispatchSchedule` y ventana horaria de cada orden ANTES de abrir la transacción (fast-fail idéntico al flujo actual en `transitionOrder`)

---

## Transacciones

- **Asignar órdenes a ruta**: una sola `prisma.$transaction` que actualiza status → `ROUTE_ASSIGNED` y setea `routeId` para todas las órdenes del batch. La verificación de que cada orden no tiene `routeId` activo se hace dentro de la transacción (no antes) para evitar race conditions.

- **Remover orden de ruta**: `prisma.$transaction` que setea `status → READY_FOR_DISPATCH` y `routeId → null` en la orden.

- **Despachar ruta**: una sola `prisma.$transaction` que para cada orden llama a `applyInTransitMutation(tx, order)` (deducción de stock + status → `IN_TRANSIT` + `routeId → null`) y al finalizar actualiza `Route.status → DISPATCHED`. Si una orden falla, se revierte todo.

- **Cancelar ruta**: `prisma.$transaction` que setea todas las órdenes `ROUTE_ASSIGNED` de la ruta a `READY_FOR_DISPATCH` + `routeId → null`, luego `Route.status → CANCELLED`.

---

## Consideraciones de Concurrencia

- **Race condition al asignar**: dos operadores asignan la misma orden a rutas distintas simultáneamente. Mitigación: dentro de la transacción, verificar `routeId IS NULL` y `status = READY_FOR_DISPATCH` con `findUnique` + lanzar 409 si ya fue tomada antes de hacer el `update`. Prisma no tiene `SELECT FOR UPDATE` directo, pero la verificación + update dentro de la misma transacción serializable es suficiente para v1 con bajo volumen.

- **Despacho masivo**: si el volumen de órdenes por ruta es alto en el futuro, una sola transacción grande puede generar contención. Para v1 no es un riesgo real; documentar el techo operacional cuando sea conocido.

---

## Orden de Implementación

1. Agregar cambios en `prisma/schema.prisma` y correr migración
2. Actualizar `order.service.ts`: agregar `ROUTE_ASSIGNED` a transitions, extraer `applyInTransitMutation`, actualizar `getReadyForDispatch` para excluir `ROUTE_ASSIGNED`
3. Crear `route.service.ts` con `createRoute`, `getRoutes`, `getRouteById`
4. Agregar `assignOrdersToRoute` con transacción y verificación de concurrencia
5. Agregar `removeOrderFromRoute`
6. Agregar `dispatchRoute` (validaciones fast-fail + transacción masiva)
7. Agregar `cancelRoute`
8. Crear `route.controller.ts` y `route.routes.ts` con validaciones express-validator
9. Registrar router en `app.ts`

---

## Riesgos Técnicos

- **`applyInTransitMutation` necesita ser extraída con cuidado**: actualmente `transitionOrder` tiene la lógica de `deductStock` y `validateDispatchWindow` mezcladas en un solo flujo. Extraer sin romper el flujo existente de `READY_FOR_DISPATCH → IN_TRANSIT` individual es el cambio más delicado del plan. Hacerlo en el paso 2, antes de tocar rutas.
- **`onDelete: SetNull` en `Order.routeId`**: si una ruta se elimina de la DB (no cancela, sino elimina físicamente), las órdenes pierden su referencia silenciosamente. En v1 no hay endpoint de delete físico de rutas, pero es un riesgo a considerar si se agrega después.
- **`OrderStatus` enum en DB**: agregar `ROUTE_ASSIGNED` requiere que la migración modifique el tipo enum en PostgreSQL. Prisma genera el `ALTER TYPE ... ADD VALUE` correctamente, pero no es reversible sin pasos adicionales. Verificar en entorno de dev antes de aplicar en prod.
