---
name: backend-plan
description: "Converts a proposal.md into a lightweight, actionable backend implementation plan. Use this skill whenever the user asks to plan, design, or break down a backend feature, especially when a proposal.md or feature spec exists. Trigger on phrases like \"crea el plan de implementación\", \"planifica el backend\", \"genera el implementation plan\", \"backend plan\", \"cómo implementamos\", \"plan técnico\", or when the user references a proposal, spec, or feature description and wants to know how to implement it in the backend. Works especially well with Express, TypeScript, Prisma, PostgreSQL, inventory systems, reservations, movements, APIs, and transactional operations. Do NOT generate code — only plans."
argument-hint: "<feature-name>"
disable-model-invocation: false
user-invocable: true
---
 
# backend-plan
 
You are acting as a **senior backend engineer** planning a real implementation. Your job is to
read a `proposal.md` and produce a tight, practical `implementation-plan.md` — not enterprise
documentation, not a diagram gallery, not a refactor wishlist. A plan a developer can open on
Monday morning and start executing.
 
---
 
## Workflow
 
### 1. Locate and read the proposal
 
Read proposal files from:
- docs/proposals/<feature-name>.md
Rules:
- preserve the same feature name used during discovery
- do not generate duplicate proposal files
- if multiple proposal files exist, ask the user which one to plan
Read the proposal fully before planning.
 
### 2. Understand the project architecture
 
Before planning, orient yourself in the codebase:
 
- Scan the directory structure (`src/`, `prisma/schema.prisma`, route files, service files).
- Identify the existing patterns: naming conventions, how services are structured, how
  controllers call services, how errors are handled.
- Note which modules already exist that this feature will touch.
Do **not** read every file — skim what you need to understand the shape of things.
 
### 3. Identify the core of the feature
 
From the proposal, extract:
- The main user-facing behavior
- The key entities involved (new or existing)
- The critical business rules and constraints
- Any concurrency or consistency concerns
### 4. Generate `implementation-plan.md`
 
Write the file using the structure below. Keep it short and honest.
 
---
 
## Output destination
 
Create the folder if it does not exist:
- docs/implementation-plans/
Generate implementation plans using:
- docs/implementation-plans/<feature-name>.md
Rules:
- preserve the same feature name from proposal phase
- implementation plans must remain lightweight and incremental
- avoid enterprise-style documentation
- avoid generating multiple implementation plan versions
## Output structure: `implementation-plan.md`
 
Use this exact structure. Skip sections that don't apply (write "N/A" or omit entirely).
 
```markdown
# Implementation Plan: [Feature Name]
 
## Resumen Técnico
Two to four sentences max. What is being built, how it plugs into the existing system,
and what the critical technical constraint is (if any).
 
## Cambios en Prisma Schema
List only new or modified models, enums, relations, and fields.
For each change, include a brief justification.
 
Example:
- `Movement` model (new): tracks inventory in/out with reference to `Product` and `Location`
- `MovementType` enum (new): `IN | OUT | ADJUSTMENT`
- `Product.currentStock Int` (new field): denormalized for fast reads
 
## Servicios Afectados
List services to create or modify. One line each — what it does, not how.
 
- `MovementService` (new): handles creation, validation, and stock update atomically
- `ProductService` (modify): add `recalculateStock` method
 
## Controllers y Rutas
Only the endpoints needed. For each:
- Method + path
- What it does
- Auth/permission level if relevant
 
Example:
- `POST /movements` — creates a movement and updates stock (requires auth)
- `GET /movements?productId=&from=&to=` — paginated movement history
 
## Validaciones
Business rules that must be enforced, not just field-level validations.
 
- Stock cannot go below 0 (enforce in service, not just DB constraint)
- `locationId` must belong to the authenticated user's organization
- Movements cannot be backdated more than 30 days
 
## Transacciones
Operations that must execute atomically. Be specific.
 
- Creating a `Movement` + updating `Product.currentStock` must be a single Prisma transaction
- Bulk import must wrap all rows in one transaction; fail entirely or succeed entirely
 
## Consideraciones de Concurrencia
Only include if there's a real risk. Be concrete.
 
- Multiple simultaneous `POST /movements` for the same product could cause a race condition
  on `currentStock`. Consider `SELECT FOR UPDATE` or optimistic locking with a version field.
- If not high-traffic initially, note that and flag it for later.
 
## Eventos e Integraciones
External side effects or integrations triggered by this feature.
 
- Emit `movement.created` event for downstream audit log service
- Notify webhook if stock drops below `Product.alertThreshold`
 
## Orden de Implementación
Numbered steps. Each step should be shippable or at least testable on its own.
 
1. Add Prisma schema changes and run migration
2. Create `MovementService` with basic create + stock update (transaction)
3. Add `POST /movements` endpoint with auth
4. Add input validation (zod schema)
5. Add `GET /movements` with filters and pagination
6. Add concurrency protection if load tests show contention
7. Wire events/webhooks
 
## Riesgos Técnicos
Honest list of what could go wrong or get complicated.
 
- Recalculating `currentStock` from history vs. keeping it denormalized — decide early,
  changing later is costly
- If existing `Product` records have no stock data, migration needs a backfill strategy
- Webhook delivery failures need retry logic — scope that or explicitly defer it
```
 
---
 
## Principles to follow
 
**Be direct.** Write like you're handing this to a teammate, not writing a spec for a client.
 
**Stay minimal.** The smallest plan that enables confident execution. Every section should
answer "what do I actually need to build?" not "what could we theoretically consider?"
 
**Prioritize the happy path first.** Edge cases go in Riesgos or Validaciones — don't let
them bloat the core plan.
 
**No code.** Pseudocode is fine to clarify intent in edge cases, but this is a plan, not
an implementation.
 
**No refactors out of scope.** If you notice something unrelated that could be improved,
leave it out. Mention it briefly in Riesgos if it's a dependency risk.
 
**Prefer existing patterns.** If the project already handles auth a certain way or structures
services a certain way, follow that pattern. Don't introduce new conventions without flagging it.
 
**Flag assumptions.** If the proposal is ambiguous on something important, note your
assumption explicitly in the relevant section.
 
---
 
## Stack defaults
 
Unless the codebase shows otherwise, assume:
- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **ORM**: Prisma
- **DB**: PostgreSQL
- **Auth**: JWT middleware (already in place)
- **Validation**: Zod
- **Error handling**: centralized error middleware
Adjust if the actual codebase shows something different.
 
After writing the implementation plan, confirm in chat:
- implementation plan written to docs/implementation-plans/<feature-name>.md