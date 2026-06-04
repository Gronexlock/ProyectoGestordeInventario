# Implementation Plan: Logistics Simulation

## Resumen Técnico

Módulo que simula el comportamiento de Proyecto 2 (Logística) desde dentro del backend, completando el flujo de despacho hasta la entrega. Se añade `COMPLETED` al enum `RouteStatus` y se crean tres artefactos nuevos (`logistics.service.ts`, `logistics.controller.ts`, `logistics.routes.ts`) sin tocar los módulos de rutas u órdenes existentes. El único riesgo de concurrencia real está en la transición automática de ruta a `COMPLETED` cuando se entrega la última orden.

## Cambios en Prisma Schema

- `RouteStatus` enum: añadir valor `COMPLETED` — estado terminal que indica que todas las órdenes de la ruta fueron entregadas.

Único cambio. No hay modelos ni tablas nuevas.

## Servicios Afectados

- `logistics.service.ts` (nuevo): cuatro funciones — listar rutas logísticas con progreso, detalle de ruta, confirmar entrega de una orden individual, y completar ruta en bulk.

Ningún servicio existente se modifica.

## Controllers y Rutas

- `GET /api/v1/logistics/routes` — lista rutas en estado `DISPATCHED` o `COMPLETED` con conteos de progreso (total órdenes / entregadas / en tránsito)
- `GET /api/v1/logistics/routes/:id` — detalle de una ruta con estado por orden
- `POST /api/v1/logistics/routes/:id/orders/:orderId/deliver` — confirma entrega de una orden individual; si es la última `IN_TRANSIT`, la ruta pasa a `COMPLETED`
- `POST /api/v1/logistics/routes/:id/complete` — marca todas las órdenes `IN_TRANSIT` de la ruta como `DELIVERED` y la ruta como `COMPLETED`

Sin auth requerida en v1 (consistente con el resto del sistema).

## Validaciones

- `confirmOrderDelivery`: ruta debe estar en `DISPATCHED`; la orden debe pertenecer a la ruta (`order.routeId === routeId`); la orden debe estar en `IN_TRANSIT`
- `completeRoute`: ruta debe estar en `DISPATCHED`; debe tener al menos una orden `IN_TRANSIT` (si ya no hay, la ruta ya debería ser `COMPLETED` — rechazar con 400)
- Ambos endpoints rechazan sobre rutas `COMPLETED`, `OPEN` o `CANCELLED`

## Transacciones

- `confirmOrderDelivery`: transacción única — `order.update({ status: DELIVERED })` → `count` órdenes `IN_TRANSIT` restantes en la ruta → si 0, `route.update({ status: COMPLETED })`
- `completeRoute`: transacción única — `order.updateMany({ status: DELIVERED, where: { routeId, status: IN_TRANSIT } })` → `route.update({ status: COMPLETED })`

## Consideraciones de Concurrencia

El caso crítico es dos requests concurrentes que confirman la entrega de las dos últimas órdenes simultáneamente. Ambas leen el conteo en la misma ventana y ambas podrían intentar marcar la ruta como `COMPLETED`.

Mitigación: dentro de la transacción de `confirmOrderDelivery`, el update de la ruta usa `updateMany` con `where: { id: routeId, status: DISPATCHED }`. Si la ruta ya fue marcada `COMPLETED` por la primera request concurrente, `updateMany` simplemente matchea 0 filas sin error — la segunda request retorna exitosamente igual. No es un riesgo de corrupción de datos.

## Orden de Implementación

1. Añadir `COMPLETED` a `RouteStatus` en `prisma/schema.prisma` y correr `prisma migrate dev`
2. Crear `src/services/logistics.service.ts` con las cuatro funciones
3. Crear `src/controllers/logistics.controller.ts` siguiendo el patrón de `route.controller.ts`
4. Crear `src/routes/logistics.routes.ts` con validaciones `express-validator` (mismo patrón que `route.routes.ts`)
5. Registrar `logistics.routes.ts` en `app.ts` bajo `/api/v1/logistics`

## Riesgos Técnicos

- La migración de `RouteStatus` en PostgreSQL requiere `ALTER TYPE` — Prisma maneja esto bien con `migrate dev`, pero si la DB tiene datos existentes con ese enum en uso, verificar que `COMPLETED` se añade sin afectar registros existentes (es solo una adición, no un rename).
- `completeRoute` hace `updateMany` sobre órdenes: si alguna orden de la ruta no está en `IN_TRANSIT` (ya fue entregada antes), `updateMany` la ignora silenciosamente — comportamiento correcto e idempotente.
- El endpoint `GET /logistics/routes` devuelve rutas con progreso calculado. Si el volumen de órdenes por ruta crece mucho, considerar agregar los conteos en la query con `_count` de Prisma en lugar de calcularlos en memoria. Para v1 con volúmenes de demo esto no es un problema.
