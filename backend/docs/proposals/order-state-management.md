# Order State Management (Pedidos de Salida)

> Gestionar el ciclo de vida de pedidos de despacho a clientes, desde la creación hasta la entrega, con reserva automática de stock y generación de movimientos OUT.

## Functional Requirements

- Usuarios crean pedidos con uno o más ítems (producto + ubicación origen + cantidad)
- Los pedidos siguen una máquina de estados definida: `PENDING → RESERVED → READY_FOR_DISPATCH → IN_TRANSIT → DELIVERED`
- Al transicionar a `RESERVED`: el sistema reserva stock para todos los ítems en una sola transacción atómica
- Al transicionar a `READY_FOR_DISPATCH`: cambio de estado puro, sin modificación de stock
- Al transicionar a `IN_TRANSIT`: las reservas se convierten en movimientos `OUT` efectivos (stock descontado definitivamente)
- Al transicionar a `DELIVERED`: cambio de estado puro, cierre del pedido
- Un pedido puede cancelarse desde `PENDING`, `RESERVED` o `READY_FOR_DISPATCH`
- Cancelar desde `RESERVED` o `READY_FOR_DISPATCH` libera las reservas de stock asociadas

## Business Rules

- Stock disponible = `quantity - reserved`; las reservas no pueden exceder el stock disponible
- Solo se permiten transiciones de estado válidas (whitelist explícita en el servicio)
- No se puede cancelar un pedido en estado `IN_TRANSIT` o `DELIVERED`
- Cada ítem del pedido debe referenciar un producto existente y una ubicación con stock suficiente
- La reserva es todo o nada: si un ítem no tiene stock suficiente, la transición a `RESERVED` se rechaza completa

## Edge Cases

- **Concurrencia en reservas**: dos pedidos reservando el mismo producto+ubicación simultáneamente → usar transacción Prisma con validación dentro de la transacción para prevenir sobreventa
- **Disponibilidad parcial**: si algún ítem falla la validación de stock, rechazar toda la operación de reserva
- **Cancelación desde READY_FOR_DISPATCH**: debe liberar reservas igual que desde `RESERVED`

## Technical Decisions

- Agregar campo `reserved Int @default(0)` al modelo `Stock` para trackear cantidades reservadas por producto+ubicación
- La transición `PENDING → RESERVED` ocurre en una sola transacción Prisma (validar + reservar todos los ítems)
- La transición `→ IN_TRANSIT` ocurre en una sola transacción (liberar `reserved` + crear movimientos `OUT` + actualizar `quantity`)
- La lógica de estado vive en `OrderService`; los helpers de stock (`reserveStock`, `releaseStock`, `deductStock`) pueden vivir en `StockService`

## Architectural Impact

- Models affected: `Stock` (agregar campo `reserved`), nuevos `Order`, `OrderItem`
- Services/modules affected: nuevo `OrderService`; `StockService` con helpers de reserva/liberación/descuento
- New tables: `orders`, `order_items`
- External integrations: ninguna en v1

## Risks & Considerations

- **Drift del contador `reserved`**: si una transacción falla a medias, el contador puede quedar inconsistente — siempre operar `reserved` dentro de transacciones
- **Concurrencia en productos de alta rotación**: el bloque de transacción debe ser lo más corto posible para no generar contención
- **IN_TRANSIT → CANCELLED** no está soportado en v1; dejarlo explícitamente rechazado con mensaje claro

## Initial Scope (v1)

Endpoints: crear pedido, consultar pedido, transicionar estado. Máquina de estados aplicada en el servidor con transiciones explícitas. Sin cancelación desde `IN_TRANSIT`, sin órdenes de compra, sin integración externa, sin estados de pago.
