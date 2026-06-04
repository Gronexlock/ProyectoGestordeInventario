# Ejemplos de Commits - Reparadores.cl

Esta guía contiene ejemplos reales de buenos commits para diferentes escenarios del proyecto.

## Features (feat)

### Nuevo Endpoint
```
feat(iam): add user registration endpoint

Implement POST /auth/register endpoint that creates new users.
Validates email uniqueness, hashes passwords with bcrypt, and returns
JWT token upon successful registration.

- Add RegisterUserDto with validation
- Add CreateUserUseCase with business logic
- Add POST /auth/register to AuthController
- Add Swagger documentation
- Add unit tests for CreateUserUseCase

Closes #123

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Nueva Funcionalidad en Módulo
```
feat(requests): add file upload support for service requests

Allow clients to attach photos when creating service requests.
Files are validated (max 5MB, jpg/png only) and stored in S3.

- Add FileUploadDto with size and type validation
- Integrate @nestjs/platform-express multer
- Add S3 upload service in shared/storage
- Update CreateServiceRequestDto to accept files
- Add Swagger docs for multipart/form-data

Closes #234

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Nueva Entidad/Módulo Completo
```
feat(reputation): add reviews and ratings module

Implement complete review system allowing clients to rate repairers
after service completion. Reviews are visible on repairer profiles
and affect overall reputation score.

- Add Review entity with rating, comment, and timestamps
- Add ReviewRepository with TypeORM
- Add CreateReviewUseCase with validation
- Add GET/POST /reviews endpoints
- Add average rating calculation in ReputationService
- Add database migration for reviews table
- Add unit tests for all use cases

Closes #345

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Bug Fixes (fix)

### Null Pointer / TypeError
```
fix(iam): handle null user_id in JWT authentication guard

Previously, the JWT middleware did not validate that user_id exists
in the decoded token before passing it to downstream handlers. This
caused a TypeError when malformed tokens were accepted.

Now we explicitly check for user_id presence and return 401 Unauthorized
if missing or null.

Fixes #456

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Validación Incorrecta
```
fix(requests): validate repairer availability before assignment

Service requests were being assigned to repairers even when they had
set their status to unavailable. This caused confusion and poor UX.

Now we check repairer.isAvailable before allowing assignment and return
400 Bad Request with clear error message if unavailable.

Fixes #567

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Race Condition
```
fix(catalog): prevent duplicate category creation with unique constraint

Multiple concurrent requests to POST /categories with the same name
caused duplicate entries due to race condition in validation logic.

Add unique constraint on category.name at database level and handle
unique violation with proper 409 Conflict response.

Fixes #678

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Refactoring (refactor)

### Extracción a Servicio
```
refactor(shared): extract token verification to standalone service

Extract JWT token verification logic from AuthGuard into dedicated
TokenVerifierService following the Core + Adapters pattern. This
enables reuse across multiple guards and improves testability.

- Create TokenVerifierService in shared/auth/core
- Update JwtAuthGuard to use TokenVerifierService
- Add unit tests for TokenVerifierService
- No functional changes - same behavior

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Simplificación de Código
```
refactor(requests): simplify request status validation logic

Replace nested if-else chains in status transition validation with
a state machine map. Improves readability and makes it easier to add
new status transitions.

No functional changes - same validation rules apply.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Reorganización de Estructura
```
refactor(iam): reorganize use cases into subdirectories

Group related use cases into subdirectories for better organization:
- auth/ (login, register, logout)
- users/ (create, update, delete)
- roles/ (assign, revoke)

Update imports across the codebase. No functional changes.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Documentation (docs)

### Actualizar README
```
docs: add deployment instructions to README

Add step-by-step guide for deploying to Railway including:
- Environment variables setup
- Database migrations
- Health check verification

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Actualizar Diagramas
```
docs(architecture): update C4 diagrams for v2 module structure

Add updated context and container diagrams showing the new domain-driven
module layout with bounded contexts. Update sequence diagrams for
request assignment flow.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Swagger/API Docs
```
docs(requests): add comprehensive Swagger docs to requests endpoints

Add @ApiOperation, @ApiResponse, and @ApiProperty decorators to all
request endpoints and DTOs. Improves API documentation clarity for
frontend team.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Tests (test)

### Agregar Tests Faltantes
```
test(iam): add unit tests for CreateUserUseCase

Add comprehensive unit tests covering:
- Successful user creation
- Email uniqueness validation
- Password hashing
- Error handling for invalid input

Increases coverage from 60% to 95% for this use case.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Tests E2E
```
test(requests): add e2e tests for request lifecycle

Add integration tests covering complete request flow:
- Client creates request
- Repairer accepts request
- Request is completed
- Client reviews repairer

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Chores (chore)

### Actualizar Dependencias
```
chore(deps): upgrade NestJS to v10.3.0

Update @nestjs/* packages to latest stable version. Includes
performance improvements and security patches. No breaking changes
for our usage patterns.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Configuración
```
chore(config): update ESLint rules for stricter type checking

Enable additional TypeScript ESLint rules:
- @typescript-eslint/no-explicit-any (error)
- @typescript-eslint/no-floating-promises (error)

Update existing code to comply with new rules.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Limpieza
```
chore: remove unused imports and dead code

Remove unused imports and commented-out code across the codebase.
No functional changes.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## CI/CD (ci)

### Actualizar Pipeline
```
ci: add automated deployment to Railway on main push

Add GitHub Actions workflow to automatically deploy to Railway
development environment when code is pushed to main branch.

- Add .github/workflows/deploy-dev.yml
- Configure Railway project token in secrets
- Add health check after deployment

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Mejorar Tests en CI
```
ci: parallelize test execution in GitHub Actions

Split test suites into parallel jobs to reduce CI time from 5min to 2min.
Run unit tests and e2e tests concurrently.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Performance (perf)

### Optimización de Query
```
perf(requests): add database indexes for request queries

Add composite index on (client_id, status, created_at) to optimize
the most common query pattern. Reduces query time from 800ms to 50ms
for clients with many requests.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Caching
```
perf(catalog): add Redis caching for service categories

Categories rarely change but are queried frequently. Add Redis cache
with 1-hour TTL to reduce database load by 80%.

- Add CacheService in shared/cache
- Wrap CategoryRepository with caching layer
- Add cache invalidation on category updates

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Style (style)

### Formateo
```
style: apply Prettier formatting to all TypeScript files

Run Prettier with project config across entire codebase. No functional
changes - only whitespace and formatting adjustments.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Build (build)

### Configuración de Build
```
build: optimize TypeScript compilation for production

Update tsconfig.json to enable additional optimizations:
- Enable incremental compilation
- Add composite project references
- Exclude test files from production build

Reduces build time by 30%.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Breaking Changes

Cuando hay breaking changes, usa el footer `BREAKING CHANGE:`:

```
feat(iam)!: change user role enum values

Rename role enum values to match industry standard:
- ADMIN → ADMINISTRATOR
- USER → CLIENT
- REPAIRER → SERVICE_PROVIDER

BREAKING CHANGE: API responses now return new role enum values.
Frontend must update role checks to use new values.

Migration guide: docs/migrations/role-enum-migration.md

Closes #789

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Nota el `!` después del scope para indicar breaking change en el subject.

## Anti-Patrones (NO HACER)

### ❌ Demasiado Vago
```
feat(iam): add stuff
chore: update things
fix: fix bug
```

### ❌ Demasiado Largo en Subject
```
feat(requests): add new endpoint that allows users to create service requests with multiple file attachments
```

### ❌ Mezcla de Concerns
```
feat(iam): add login endpoint and fix typo in README
```
Debería ser dos commits separados.

### ❌ Sin Scope
```
feat: add user registration
```
Debería especificar `feat(iam): add user registration`

### ❌ No Imperativo
```
feat(iam): added user registration endpoint
feat(iam): adds user registration endpoint
```
Debería ser `add` (imperativo).

## Tips para Decidir el Type

- ¿Agrega algo nuevo que el usuario puede usar? → `feat`
- ¿Corrige algo que no funcionaba bien? → `fix`
- ¿Cambia código sin cambiar comportamiento? → `refactor`
- ¿Solo cambia documentación? → `docs`
- ¿Solo cambia formato/estilo? → `style`
- ¿Agrega/modifica tests? → `test`
- ¿Actualiza dependencias o build? → `chore` o `build`
- ¿Cambia CI/CD? → `ci`
- ¿Mejora performance sin agregar features? → `perf`
