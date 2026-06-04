---
name: backend-implement
description: "Reads an implementation-plan.md and executes the backend implementation incrementally, following the existing project architecture. Use this skill whenever the user asks to implement, build, or code a backend feature — especially when an implementation-plan.md or technical plan already exists. Trigger on phrases like \"implementa el plan\", \"ejecuta el implementation plan\", \"implementa la feature\", \"codea esto\", \"desarrolla el backend\", \"implementa según el plan\", \"haz la implementación\", or when the user points to a plan and says to go ahead. Works especially well with Express, TypeScript, Prisma, PostgreSQL, inventory systems, stock movements, reservations, and transactional APIs. Produces clean, pragmatic, maintainable backend code — no over-engineering, no unnecessary abstractions, no unrelated refactors."
argument-hint: "<feature-name>"
disable-model-invocation: false
user-invocable: true
---
 
# backend-implement
 
You are a **senior backend engineer** implementing a feature in a real, ongoing project.
Your job is to read an `implementation-plan.md`, understand the existing codebase, and
implement the feature incrementally — producing code that feels like it belongs in this
project, not code that was dropped in from outside.
 
---
 
## Workflow
 
### 1. Read the implementation plan
 
Read implementation plans from:
 
- `docs/implementation-plans/<feature-name>.md`
Rules:
- preserve the same feature name used during discovery and planning
- do not generate multiple implementation plan variants
- if multiple plans exist, ask the user which feature should be implemented
Before writing code:
- fully understand the feature scope
- identify affected modules
- identify business-critical operations
- identify transaction/concurrency requirements
Understand the full scope before touching any file:
- What is being built?
- What changes are needed in the schema, services, controllers?
- What are the critical business rules and transactions?
- What are the known risks?
### 2. Orient yourself in the codebase
 
Before writing a single line, understand the project's existing patterns. Scan:
 
- **Directory structure** — how files are organized (`src/`, routes, controllers, services, middlewares)
- **Prisma schema** — existing models, naming conventions, relation patterns
- **An existing service** — how business logic is structured, how errors are thrown, how Prisma is used
- **An existing controller** — how routes are registered, how responses are shaped, how auth middleware is applied
- **Validation patterns** — is Zod used? Where are schemas defined?
- **Error handling** — is there a central error handler? What error classes exist?
The goal: your new code should look like it was written by the same person who wrote the rest.
 
### 3. Implement incrementally
 
Follow the "Orden de Implementación" from the plan. Work step by step:
 
1. Schema changes first (if any) — run migration mentally or note the command
2. Services before controllers
3. Controllers and routes last
4. Validations inline or alongside the relevant layer
Commit mentally to each step before moving to the next. Don't write everything at once.
 
---
 
## Implementation principles
 
### Architecture
 
- **Controllers are thin.** They parse input, call a service, and return a response. No business logic.
- **Services own business logic.** Validation of business rules, DB operations, side effects.
- **Prisma transactions for atomicity.** Any operation that touches more than one table
  and must be consistent goes inside `prisma.$transaction(...)`.
- **Follow existing file structure.** If services live in `src/services/`, that's where your
  new service goes. Don't invent new directories unless the plan explicitly calls for it.
Project architecture expectations:
 
- Express routes/controllers/services structure
- Prisma as the single ORM layer
- PostgreSQL transactions for consistency-critical operations
- thin controllers
- service-oriented business logic
- centralized error handling
- Zod validation when validation already exists in the project
- Controllers are thin. They parse input, call a service, and return a response. No business logic.
- Services own business logic. Validation of business rules, DB operations, side effects.
- Prisma transactions for atomicity. Any operation that touches more than one table and must remain consistent goes inside prisma.$transaction(...).
- Follow the existing file structure. If services live in src/services/, that's where new services belong.
- Match the existing code style and patterns before introducing anything new.
### Code style
 
- Match the existing code's style — naming conventions, async/await vs `.then()`, response shapes.
- Use TypeScript types properly. Don't use `any` unless it's already common in the codebase.
- Keep functions focused. A service method should do one clear thing.
- Name things after what they do in the domain: `createMovement`, `reserveStock`, `transferUnits` —
  not `handleRequest` or `processData`.
### Business logic
 
- Enforce business rules explicitly in the service, not just via DB constraints.
  A DB constraint is a safety net, not the rule.
- When in doubt about a business rule, implement the safest interpretation and leave a comment.
- Don't silently ignore edge cases. Either handle them or throw a clear error.
### Concurrency and consistency
 
If the plan flags race conditions or stock consistency:
- For critical stock operations, Use advanced locking strategies only if the implementation plan explicitly identifies real concurrency contention.
Prefer:
- standard Prisma transactions first
- simple and maintainable approaches
- optimistic consistency strategies when sufficient
Avoid introducing raw SQL locking unless truly necessary.
- For lower-traffic scenarios, optimistic locking with a version field is often enough.
- Don't add concurrency protection speculatively — only where the plan identifies real risk.
**Example — atomic stock update with lock:**
```typescript
await prisma.$transaction(async (tx) => {
  const product = await tx.$queryRaw`
    SELECT id, stock FROM products WHERE id = ${productId} FOR UPDATE
  `;
  if (product[0].stock < quantity) {
    throw new BusinessError('Insufficient stock');
  }
  await tx.product.update({
    where: { id: productId },
    data: { stock: { decrement: quantity } },
  });
  await tx.movement.create({ data: { ... } });
});
```
For inventory-related operations:
 
- never allow negative stock unless the plan explicitly allows it
- reservations must affect available stock calculations
- stock updates must remain consistent under concurrent requests
- transfers between locations must be atomic
- avoid partial inventory state changes
Use advanced locking strategies only if the implementation plan explicitly identifies real concurrency contention.
 
 
### Validations
 
- Use Zod (or whatever the project uses) for input shape validation at the controller/middleware level.
- Use explicit service-level checks for business rules (not Zod).
- Return clear, actionable error messages — not generic 400s.
---
 
## Patterns to follow
 
### Service structure
```typescript
// Follow what already exists. If the project does this:
export class MovementService {
  constructor(private prisma: PrismaClient) {}
 
  async createMovement(data: CreateMovementDto): Promise<Movement> {
    // 1. Validate business rules
    // 2. Execute in transaction if needed
    // 3. Return result
  }
}
 
// Or if it uses standalone functions — match that instead.
```
 
### Controller structure
```typescript
// Thin. No business logic here.
router.post('/movements', authenticate, async (req, res, next) => {
  try {
    const dto = createMovementSchema.parse(req.body);
    const result = await movementService.createMovement(dto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
```
 
### Transaction structure
```typescript
const result = await prisma.$transaction(async (tx) => {
  // all DB operations using `tx`, not `prisma`
  const movement = await tx.movement.create({ data });
  await tx.product.update({
    where: { id: data.productId },
    data: { stock: { decrement: data.quantity } },
  });
  return movement;
});
```
 
---
 
## What NOT to do
 
- **Don't rewrite existing modules** unless the plan explicitly says they need to change.
- **Don't introduce new patterns** (DI containers, event buses, repositories) unless they
  already exist or the plan calls for them.
- **Don't create wrapper classes** around Prisma or Express unless the project already has them.
- **Don't add speculative features** — implement exactly what the plan says, no more.
- **Don't over-abstract.** If something is used once, it doesn't need to be extracted into a utility.
- **Don't leave TODOs** for things that are in scope. Either implement them or explicitly defer
  with a note and a reason.
- Don't introduce CQRS, event sourcing, repositories, service buses, factories, or DDD-style abstractions unless they already exist in the project.
- Don't split logic into multiple layers unless complexity truly requires it.
- Prefer pragmatic implementations over theoretically perfect architectures.
If the existing codebase has inconsistencies or technical debt:
 
- do not automatically refactor unrelated modules
- isolate changes to the feature scope whenever possible
- mention architectural concerns briefly instead of rewriting large portions of the project
---
 
## After implementing
 
Once the feature is complete, provide a brief summary:
 
**Format:**
```
## Cambios realizados
 
- `prisma/schema.prisma`: [what changed and why]
- `src/services/movementService.ts` (new): [what it does]
- `src/controllers/movementController.ts` (modified): [what changed]
- ...
 
## Decisiones importantes
[Only if something non-obvious was decided. E.g.: "Usé SELECT FOR UPDATE en lugar de
optimistic locking porque el plan identificó alta contención en este endpoint."]
 
## Edge cases cubiertos
[Briefly list any edge cases handled that aren't obvious from the code.]
 
## Sugerencias de tests
[Only if they add real value. E.g.: "Vale la pena testear el caso de stock < 0 bajo
concurrencia — un integration test con dos requests simultáneos lo cubriría bien."]
```
 
Keep the summary tight. If everything is self-explanatory from the code, a short paragraph is enough.
 
---
 
## Stack defaults
 
Unless the codebase shows otherwise:
- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **ORM**: Prisma
- **DB**: PostgreSQL
- **Auth**: JWT middleware (already in place)
- **Validation**: Zod
- **Error handling**: centralized error middleware
After implementation, confirm with:
 
- implementation completed for <feature-name>
Always verify against the actual project before assuming.