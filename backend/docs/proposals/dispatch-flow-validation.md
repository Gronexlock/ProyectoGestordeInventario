# Dispatch Flow Validation

> Agregar validaciones de negocio dentro de la transición READY_FOR_DISPATCH → IN_TRANSIT para garantizar que un pedido solo se despacha cuando tiene un schedule válido y dentro de la ventana horaria de la ubicación origen.

## Functional Requirements

- Al intentar transicionar un pedido a IN_TRANSIT, el sistema valida automáticamente dos condiciones antes de ejecutar el despacho
- Condición 1: debe existir un `DispatchSchedule` asociado al pedido con status válido (no cancelado) y cuya `scheduleDate` corresponda al día actual
- Condición 2: la hora actual del servidor debe estar dentro del rango `dispatchStart`–`dispatchEnd` de la(s) ubicación(es) origen del pedido
- Si alguna validación falla, la transición se rechaza con un error claro indicando cuál condición no se cumplió
- Si ambas pasan, el flujo continúa normalmente: `deductStock` + cambio de estado a IN_TRANSIT

## Business Rules

- Un pedido sin `DispatchSchedule` asignado no puede despacharse
- Un `DispatchSchedule` con status `CANCELLED` se considera inválido
- La ventana horaria se evalúa contra la hora actual del servidor (UTC o local, debe definirse consistentemente)
- Si el pedido tiene ítems de múltiples ubicaciones con distintas ventanas, se valida que la hora esté dentro de la intersección (todas deben estar activas) — si no hay intersección posible, el pedido no puede despacharse en ese momento
- Las validaciones se ejecutan dentro de la misma transacción atómica del despacho

## Edge Cases

- `DispatchSchedule` existe pero scheduleDate es de un día anterior: rechazar, no es válido para hoy
- Múltiples `DispatchSchedule` para el mismo pedido: usar el más reciente con status válido
- Ubicación sin `dispatchStart`/`dispatchEnd` definidos (defaults "8:00"/"18:00"): usar los defaults del schema
- Pedido con ítems en una sola ubicación: solo se valida esa ventana
- Hora exactamente igual al límite (dispatchStart o dispatchEnd): definir si el límite es inclusivo (recomendado: `>=` start y `<=` end)

## Technical Decisions

- Las validaciones se agregan en `transitionOrder()` en `order.service.ts`, dentro del bloque `if (newStatus === "IN_TRANSIT")`
- Se ejecutan **antes** de llamar a `deductStock` para evitar descontar stock si falla la validación
- La validación de ventana horaria usa strings "H:MM" o "HH:MM" — parsear con split(":") y comparar minutos totales
- `DispatchSchedule.orderId` es `Int` en el schema actual pero `Order.id` es UUID String — **requiere corrección en el schema antes de implementar** (cambiar `orderId` a `String` y agregar relación)
- El modelo `DispatchSchedule` en el schema actual tiene la llave de cierre `}` faltante — **bug a corregir en la migración**

## Architectural Impact

- Models affected: Order, DispatchSchedule, Location, OrderItem
- Services/modules affected: `order.service.ts` (única modificación)
- New tables or fields needed: corrección de `DispatchSchedule` (tipo de orderId, relación con Order, cierre de modelo)
- New migration: corrección del schema de DispatchSchedule
- External integrations: ninguna

## Risks & Considerations

- **Inconsistencia de tipos en el schema**: `DispatchSchedule.orderId Int` vs `Order.id String` — si no se corrige antes de implementar, las queries fallarán en runtime
- **Zona horaria**: comparar hora actual sin definir timezone puede causar comportamiento distinto en prod vs local; documentar que se usa hora del servidor
- **Múltiples ubicaciones con ventanas incompatibles**: posible que un pedido nunca pueda despacharse si las ventanas no se solapan — considerar logging o advertencia

## Initial Scope (v1)

Modificar `transitionOrder()` para ejecutar dos validaciones en serie cuando `newStatus === "IN_TRANSIT"`: (1) buscar DispatchSchedule válido del pedido, (2) verificar ventana horaria de ubicaciones origen. Si falla, lanzar `AppError` 400 con mensaje descriptivo. Corregir el schema de `DispatchSchedule` (tipo orderId + relación + llave de cierre) y generar migración. Fuera de scope: endpoint para crear/gestionar DispatchSchedules, UI de planificación, integración con Proyecto 2.
