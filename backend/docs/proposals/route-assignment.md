# Route Assignment

> Allow operators to group READY_FOR_DISPATCH orders into a dispatch route (trip), tracking which orders leave together in the same vehicle.

## Functional Requirements

- Operators can create a route with a vehicle code and optional driver name
- Operators can assign one or more `READY_FOR_DISPATCH` orders to a route; those orders transition to `ROUTE_ASSIGNED`
- Operators can remove an order from a route; that order reverts to `READY_FOR_DISPATCH`
- Operators can dispatch a route, transitioning all its `ROUTE_ASSIGNED` orders to `IN_TRANSIT`
- Operators can cancel a route; all `ROUTE_ASSIGNED` orders on it revert to `READY_FOR_DISPATCH`
- Operators can list routes and view the orders grouped under each one

## Business Rules

- Only orders in `READY_FOR_DISPATCH` can be assigned to a route
- An order can only belong to one active route at a time
- A route cannot be dispatched if it has zero orders
- Dispatching a route triggers the existing `IN_TRANSIT` state transition for each order (validates dispatch schedule + dispatch window per current state machine)
- A `ROUTE_ASSIGNED` order must not appear in `GET /orders/ready-for-dispatch` results

## Edge Cases

- Assigning an order already on another active route → reject with 409
- Removing an order from a route after the route is already dispatched → reject (route is immutable once dispatched)
- Cancelling a route with orders that have already moved to `IN_TRANSIT` → not possible in v1; dispatch is atomic per route
- Concurrent assignment of the same order to two routes → use a transaction with a uniqueness check on `routeId` per order

## Technical Decisions

- New `Route` model with `RouteStatus` enum: `OPEN`, `DISPATCHED`, `CANCELLED`
- `routeId` foreign key added to `Order` (nullable — not all orders have a route)
- `ROUTE_ASSIGNED` added to `OrderStatus` enum
- Dispatching a route reuses existing `IN_TRANSIT` transition logic per order, wrapped in a single transaction
- New `route.service.ts` — route creation, order assignment, dispatch, cancellation
- New `route.controller.ts` and `route.routes.ts` following existing patterns

## Architectural Impact

- Models affected: `Order` (new `routeId` field, new `ROUTE_ASSIGNED` status), new `Route` model
- Services/modules affected: `order.service.ts` (add `ROUTE_ASSIGNED` state), new `route.service.ts`
- New tables or fields needed:
  - `Route` (id, vehicleCode, driverName?, status, createdAt, updatedAt)
  - `Order.routeId` (nullable FK → Route)
  - `OrderStatus` enum: add `ROUTE_ASSIGNED`
- External integrations: none

## Risks & Considerations

- Dispatching a route is a bulk state transition — one order failing validation (e.g., no dispatch schedule, outside window) should abort the entire route dispatch atomically
- `GET /orders/ready-for-dispatch` must exclude `ROUTE_ASSIGNED` orders — that endpoint represents only orders available to be assigned, not ones already in the logistics flow
- `RouteStatus.DISPATCHED` is terminal; no modifications allowed after dispatch

## Initial Scope (v1)

`POST /routes`, `GET /routes`, `GET /routes/:id`, `POST /routes/:id/orders` (assign), `DELETE /routes/:id/orders/:orderId` (remove), `POST /routes/:id/dispatch`, `DELETE /routes/:id` (cancel). Order list endpoint updated to exclude `ROUTE_ASSIGNED` from "pending dispatch" view. Out of scope: route editing after creation, partial dispatch, geolocation, driver model, integration with Proyecto 2.
