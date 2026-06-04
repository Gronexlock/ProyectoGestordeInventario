# Implementation Plan: Order State Management

## Resumen Técnico

Se construye un sistema de pedidos de salida con máquina de estados explícita. Los pedidos agrupan ítems (producto + ubicación + cantidad) y, al transicionar entre estados, generan efectos sobre el stock (reservas y movimientos OUT). La pieza técnica crítica es que todas las operaciones de stock dentro de una transición deben ocurrir en una sola transacción Prisma para evitar inconsistencias en el campo `reserved`.

---

## Cambios en Prisma Schema

- `Stock.reserved Int @default(0)` (campo nuevo): contador de unidades reservadas por pedidos activos. El stock disponible real = `quantity - reserved`.
- `OrderStatus` enum (nuevo): `PENDING | RESERVED | READY_FOR_DISPATCH | IN_TRANSIT | DELIVERED | CANCELLED`
- `Order` model (nuevo): `id, customerName, status (OrderStatus, default PENDING), createdAt, updatedAt`
- `OrderItem` model (nuevo): `id, orderId, productId, locationId, quantity`. Relación `Order` 1→N `OrderItem`.
- El modelo `Movement` existente se reutiliza para registrar las salidas OUT generadas al transicionar a `IN_TRANSIT`.

---

## Servicios Afectados

- `StockService` (modificar): agregar tres helpers internos que operan **dentro de una transacción Prisma pasada como argumento**:
  - `reserveStock(tx, items[])` — incrementa `reserved` en Stock para cada ítem; lanza error si `quantity - reserved < cantidad solicitada`
  - `releaseStock(tx, items[])` — decrementa `reserved` en Stock para cada ítem
  - `deductStock(tx, items[])` — decrementa `quantity` y `reserved` en Stock, crea un `Movement OUT` por ítem

- `OrderService` (nuevo):
  - `createOrder(dto)` — crea `Order` (PENDING) + sus `OrderItem`s; valida que producto y ubicación existan
  - `transitionOrder(orderId, newStatus)` — ejecuta la máquina de estados; llama helpers de stock dentro de una transacción
  - `getOrderById(id)` — retorna pedido con sus ítems e información de producto/ubicación
  - `getAllOrders()` — lista todos los pedidos

---

## Controllers y Rutas

- `POST /api/v1/orders` — crea pedido en estado PENDING
- `GET  /api/v1/orders` — lista pedidos (con status e ítems básicos)
- `GET  /api/v1/orders/:id` — detalle completo del pedido
- `PATCH /api/v1/orders/:id/status` — transiciona el estado del pedido (`{ status: "RESERVED" }`)

Sin auth en v1 (consistente con el resto del proyecto).

---

## Validaciones

- `createOrder`: `customerName` requerido (string, max 100 chars); `items` array con mínimo 1 ítem; cada ítem requiere `productId` (UUID), `locationId` (UUID), `quantity` (entero ≥ 1)
- `transitionOrder`: `status` requerido; debe ser un valor válido del enum `OrderStatus`
- Transiciones permitidas (whitelist en `OrderService`):
  - `PENDING` → `RESERVED | CANCELLED`
  - `RESERVED` → `READY_FOR_DISPATCH | CANCELLED`
  - `READY_FOR_DISPATCH` → `IN_TRANSIT | CANCELLED`
  - `IN_TRANSIT` → `DELIVERED`
  - `DELIVERED | CANCELLED` → ninguna
- Cualquier transición no listada lanza `AppError 400`

Usar `express-validator` (patrón existente del proyecto), no Zod.

---

## Transacciones

- `PENDING → RESERVED`: transacción que valida disponibilidad (`quantity - reserved >= cantidad`) e incrementa `reserved` para **todos** los ítems. Si cualquier ítem falla → rollback total.
- `READY_FOR_DISPATCH → IN_TRANSIT`: transacción que para cada ítem: decrementa `quantity`, decrementa `reserved`, crea `Movement OUT`.
- `→ CANCELLED` (desde RESERVED o READY_FOR_DISPATCH): transacción que decrementa `reserved` de todos los ítems.
- `→ READY_FOR_DISPATCH` y `→ DELIVERED`: solo actualización del campo `status` en `Order`, sin transacción de stock.

---

## Consideraciones de Concurrencia

Dos pedidos reservando simultáneamente el mismo `productId+locationId` pueden causar sobreventa. Dentro de `reserveStock`, la validación y el `update` deben ocurrir en la misma transacción Prisma. Prisma serializa writes en la misma fila, lo que previene el race condition más común. Para alta concurrencia futura, se puede agregar un `SELECT FOR UPDATE` vía `queryRaw`.

---

## Riesgos Técnicos

- **MovementService actual ignora `reserved`**: el endpoint `POST /movements` descuenta `quantity` sin considerar stock reservado. Un movimiento OUT manual podría tomar stock ya reservado por un pedido. En v1 esto no se resuelve, pero debe documentarse como deuda técnica pendiente.
- **`reserved` drift**: si la transacción de reserva se crea pero el commit falla, el contador queda consistente (rollback automático). El riesgo real es si se agrega lógica fuera de transacción — no hacerlo.
- **`deductStock` vs alerta de stock crítico**: el `MovementService` actual emite alertas de stock crítico. Los movimientos OUT generados por pedidos bypasearán esa lógica. Documentar para resolverlo cuando se unifique la lógica de alertas.

---

## Orden de Implementación

1. Agregar `reserved` a `Stock`, crear modelos `Order` y `OrderItem`, crear enum `OrderStatus` en schema → correr migración
2. Agregar `reserveStock`, `releaseStock`, `deductStock` en `StockService` (reciben `tx` como primer argumento)
3. Crear `OrderService` con `createOrder` y `getOrderById` / `getAllOrders`
4. Agregar `transitionOrder` en `OrderService` con la máquina de estados completa
5. Crear `OrderController` con los cuatro handlers
6. Crear `order.routes.ts` con las reglas de validación (`express-validator`)
7. Registrar rutas en `app.ts` bajo `/api/v1/orders`
8. Agregar DTOs de Order a `types.ts`
