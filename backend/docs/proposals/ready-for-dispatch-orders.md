# Ready-for-Dispatch Orders Query

> Expose a read-only endpoint so Logistics (Proyecto 2) and internal operators can query all orders currently ready for dispatch.

## Functional Requirements

- GET endpoint returns all orders with status `READY_FOR_DISPATCH`
- Each order includes its items (productId, locationId, quantity)
- Supports optional filter by `locationId` (filter by origin warehouse)
- Supports optional filter by date range (`dateFrom`, `dateTo`) based on order creation date
- Returns empty array when no orders match — never errors on empty result

## Business Rules

- Only orders in `READY_FOR_DISPATCH` status are returned — no other statuses
- Filters are AND-combined when both are provided
- Date filters are inclusive on both ends
- No state transitions or side effects occur on this endpoint

## Edge Cases

- No READY_FOR_DISPATCH orders exist: return `[]` with 200
- Invalid `locationId`: return 404 if location does not exist
- `dateFrom` after `dateTo`: return 400 with a clear message
- Large result sets: acceptable in v1 without pagination; can be added later if needed

## Technical Decisions

- Read-only Prisma query with `include: { items: true }` — no transaction needed
- Filter params passed as query strings: `?locationId=...&dateFrom=...&dateTo=...`
- Location existence validated before query to avoid silent empty results on typos

## Architectural Impact

- Models affected: Order, OrderItem
- Services/modules affected: order.service (new `getReadyForDispatch` function), order.controller, order.routes
- New tables or fields needed: none
- External integrations: consumed by Proyecto 2 (Logística)

## Risks & Considerations

- No auth specified yet — if this is externally consumed by Proyecto 2, consider API key or token validation before exposing
- Result set could grow large in high-throughput scenarios; pagination should be added proactively once volume is known

## Initial Scope (v1)

`GET /api/v1/orders/ready-for-dispatch` with optional `locationId`, `dateFrom`, `dateTo` query params. Returns orders with their items. Out of scope: pagination, sorting options, DispatchSchedule linking, auth middleware.
