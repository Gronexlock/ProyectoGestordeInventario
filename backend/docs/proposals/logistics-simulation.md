# Logistics Simulation

> Simulate the behavior of Proyecto 2 (Logística) from within this backend, enabling a complete end-to-end demo of the dispatch flow without depending on an external system.

## Functional Requirements

- Operators can confirm delivery of an individual IN_TRANSIT order on a dispatched route
- Operators can bulk-complete a dispatched route, marking all remaining IN_TRANSIT orders as DELIVERED at once
- The route automatically transitions to COMPLETED when its last IN_TRANSIT order is delivered
- A consolidated logistics view shows dispatched routes with delivery progress (orders total / delivered / in transit)
- A detail view shows a dispatched route with per-order delivery status

## Business Rules

- Only orders in IN_TRANSIT can be confirmed as delivered
- Only routes in DISPATCHED status can receive delivery confirmations
- A route transitions to COMPLETED only when it has zero IN_TRANSIT orders remaining
- Bulk-complete is idempotent: if all orders are already DELIVERED the route is simply marked COMPLETED
- COMPLETED is a terminal state for a route — no further modifications allowed

## Edge Cases

- Confirming delivery for an order that doesn't belong to the route → 400
- Confirming delivery on a COMPLETED or CANCELLED route → 400
- Bulk-complete on a route that has some orders already DELIVERED and others IN_TRANSIT → only transitions the IN_TRANSIT ones
- Concurrent delivery confirmations for the last two IN_TRANSIT orders on a route → both succeed; only the second triggers COMPLETED

## Technical Decisions

- New `RouteStatus.COMPLETED` added to the existing enum
- New `/logistics` route namespace — semantically represents the external logistics system surface
- Individual delivery uses a Prisma transaction: update order → check remaining IN_TRANSIT → conditionally update route to COMPLETED
- Bulk-complete reuses the same individual delivery logic in a loop within a single transaction
- No new models needed — reads and writes existing `Route` and `Order` tables

## Architectural Impact

- Models affected: `Route` (new COMPLETED status in `RouteStatus` enum)
- Services/modules affected: new `logistics.service.ts`, new `logistics.controller.ts`, new `logistics.routes.ts`
- New tables or fields needed: none
- External integrations: none

## Risks & Considerations

- Race condition on last-order delivery: two concurrent requests both see 1 remaining IN_TRANSIT order and both try to set COMPLETED — wrap the "count remaining + update route" check inside the same transaction
- `RouteStatus.COMPLETED` is a schema migration — must add to the Prisma enum and run `prisma migrate`

## Initial Scope (v1)

`GET /logistics/routes` (dispatched + completed routes with progress), `GET /logistics/routes/:id` (detail with per-order status), `POST /logistics/routes/:id/orders/:orderId/deliver` (confirm single delivery), `POST /logistics/routes/:id/complete` (bulk-complete all remaining). Out of scope: GPS tracking, driver authentication, partial-failure handling on bulk-complete, delivery timestamps per order.
