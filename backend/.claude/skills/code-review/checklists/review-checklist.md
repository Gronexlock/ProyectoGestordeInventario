# Code Review Checklist - Reparadores.cl

Use esta checklist para validar que el código cumple con todos los estándares del proyecto.

## 🔒 Seguridad (CRÍTICO)

- [ ] No hay SQL injection vulnerabilities
- [ ] No hay XSS vulnerabilities
- [ ] No hay secrets hardcodeados (API keys, passwords, tokens)
- [ ] Input validation con DTOs y class-validator
- [ ] Endpoints protegidos con guards apropiados (@UseGuards)
- [ ] Roles y permisos verificados correctamente
- [ ] No hay path traversal vulnerabilities
- [ ] Files uploads validados (size, type, content)
- [ ] CORS configurado correctamente
- [ ] Rate limiting en endpoints sensibles (opcional pero recomendado)

## 🏗️ Arquitectura (CRÍTICO)

- [ ] ✅ Clean Architecture layers respetadas
- [ ] ✅ NO imports de infrastructure de otros módulos
- [ ] ✅ NO imports de domain entities de otros módulos (usar DTOs)
- [ ] ✅ Module boundaries respetados (eslint-plugin-boundaries)
- [ ] ✅ Dependency Injection usado correctamente
- [ ] ✅ Single Responsibility Principle
- [ ] ✅ Domain entities sin dependencias de frameworks
- [ ] ✅ Use cases en application layer
- [ ] ✅ TypeORM entities en infrastructure layer
- [ ] ✅ Controllers solo en presentation layer
- [ ] ✅ Shared services siguen Core + Adapters pattern

## 🗺️ Bounded Contexts (CRÍTICO si hay cross-module)

```
CORE: requests | SUPPORTING: catalog, comms, reputation | GENERIC: iam, backoffice
```
- [ ] Si cruza bounded contexts: ¿usa SOLO use cases públicos del módulo destino?
- [ ] Si importa de otro módulo: ¿lo hace via `@modules/{module}/application/use-cases` (NO `infrastructure/`)?
- [ ] El módulo destino exporta el use case en su `application/use-cases/index.ts`?
- [ ] Si no existe el use case necesario: ¿está documentado como pendiente de crear?

## 🐛 Bugs y Errores Lógicos (ALTO)

- [ ] No hay null/undefined pointer exceptions
- [ ] Array/object access validado
- [ ] Promises con await o .catch()
- [ ] No hay floating promises (async sin await)
- [ ] Error handling apropiado (try-catch en lugares críticos)
- [ ] Edge cases manejados (empty arrays, null, 0, etc.)
- [ ] No hay off-by-one errors
- [ ] No hay race conditions
- [ ] No hay infinite loops
- [ ] Async/await usado correctamente

## ⚡ Performance (MEDIO)

- [ ] No hay N+1 query problems
- [ ] Queries con relations en lugar de loops
- [ ] Indexes en columnas frecuentemente consultadas
- [ ] Paginación en endpoints que retornan listas
- [ ] No hay operaciones síncronas bloqueantes
- [ ] Files procesados asíncronamente
- [ ] Lazy loading donde sea apropiado
- [ ] Caching considerado para datos estáticos (opcional)

## 📝 TypeScript (CRÍTICO)

- [ ] ✅ NO uso de `any` type (ESLint bloqueará)
- [ ] ✅ Tipos explícitos en parámetros de funciones
- [ ] ✅ Tipos de retorno declarados
- [ ] ✅ Strict null checks respetados
- [ ] ✅ No hay implicit any
- [ ] ✅ Interfaces o types para objetos complejos
- [ ] ✅ Enums para valores constantes relacionados
- [ ] ✅ Union types para valores posibles limitados

## 📛 Naming Conventions (MEDIO)

### Files
- [ ] Use cases: `verb-noun.use-case.ts`
- [ ] Entities: `noun.entity.ts`
- [ ] Repositories: `noun.repository.ts`
- [ ] Controllers: `plural-noun.controller.ts`
- [ ] DTOs: `verb-noun.dto.ts`
- [ ] Tests: `filename.spec.ts`

### Code
- [ ] Classes: PascalCase
- [ ] Functions: camelCase, verb + context
- [ ] Variables: camelCase
- [ ] Constants: UPPER_SNAKE_CASE (primitivos)
- [ ] Booleans: is/has/can/should prefix
- [ ] Interfaces: PascalCase (sin I prefix)
- [ ] Types: PascalCase

## 📚 Documentación (MEDIO)

### Swagger/OpenAPI
- [ ] Todos los controllers tienen `@ApiTags()`
- [ ] Todos los endpoints tienen `@ApiOperation()`
- [ ] Todos los endpoints tienen `@ApiResponse()` (200, 400, 401, etc.)
- [ ] Endpoints protegidos tienen `@ApiBearerAuth()`
- [ ] Todos los DTOs tienen `@ApiProperty()` en cada field
- [ ] Ejemplos en `@ApiProperty()` cuando sea útil

### Código
- [ ] Funciones complejas tienen comentarios explicativos
- [ ] Algoritmos no obvios están documentados
- [ ] TODOs tienen contexto y fecha

## 🧪 Tests (MEDIO)

- [ ] Use cases tienen tests unitarios (.spec.ts)
- [ ] Tests siguen patrón AAA (Arrange-Act-Assert)
- [ ] Mocks configurados correctamente
- [ ] Tests tienen assertions significativas
- [ ] Nombres de tests descriptivos (`should X when Y`)
- [ ] Tests no dependen de orden de ejecución
- [ ] Coverage aceptable (>70% para use cases)

## 📦 Module Splitting (INFORMATIVO)

> No bloquea PR — es señal de refactor futuro.

- [ ] El módulo tiene menos de 35 archivos TypeScript
- [ ] Menos de 10 use cases en `application/use-cases/`
- [ ] No más de 1 entidad de dominio con ciclo de vida propio (o 2+ bien separadas)
- [ ] No más de 1 controller REST por recurso principal
- [ ] Si hay señales de crecimiento: ¿se sugirió sub-paquetes? (`docs/architecture/patterns/module-splitting.md`)

## 🎨 Code Quality (BAJO)

### Code Smells
- [ ] Funciones no exceden 50 líneas
- [ ] No más de 4 parámetros por función
- [ ] Anidación máxima de 3 niveles
- [ ] No hay código duplicado (DRY)
- [ ] No hay magic numbers (usar constantes)
- [ ] No hay comentarios excesivos (código auto-explicativo)
- [ ] No hay variables globales
- [ ] No hay God classes

### Clean Code
- [ ] Nombres descriptivos y claros
- [ ] Un propósito por función
- [ ] Código fácil de leer
- [ ] Abstracción apropiada
- [ ] KISS (Keep It Simple, Stupid)
- [ ] YAGNI (You Aren't Gonna Need It)

## 🔧 NestJS Específico

- [ ] Decorators usados correctamente (@Injectable, @Controller, etc.)
- [ ] Dependency Injection en constructores
- [ ] Providers registrados en módulos
- [ ] Guards aplicados donde corresponde
- [ ] Pipes de validación usados (@UsePipes)
- [ ] Exception filters personalizados si es necesario
- [ ] Interceptors solo cuando agregan valor

## 🏛️ Patrones del Proyecto (CRÍTICO)

- [ ] **Domain entity (Aggregate Root)**: constructor privado + `static create()` + `static reconstitute()` si tiene `status`, transiciones, o la crea un actor de dominio (`User`, `Request`, `Review`) — ver `src/modules/iam/domain/entities/user.entity.ts`
- [ ] **Domain entity (Lookup)**: constructor simple aceptable si es solo referencia sin lógica (`ServiceCategory`, `Region`)
- [ ] **Repository contract**: `abstract class EntityRepository` en `domain/interfaces/` — cero imports de NestJS (ADR-019)
- [ ] **NO tokens file**: NO debe existir `{module}.tokens.ts` — la abstract class ES el DI token (ADR-019)
- [ ] **Use case DI**: `constructor(private readonly repo: EntityRepository)` — sin `@Inject()`, TypeScript verifica en compile time
- [ ] **TenantDbService**: SOLO en repository impl (NO en use cases)
- [ ] **Mapper methods**: `toDomain()` y `toPersistence()` — estándar DDD community (preferir sobre `toOrm()`/`toTypeOrm()`)
- [ ] **Mapper ubicación**: `infrastructure/mappers/{entity}.mapper.ts` (NO `infrastructure/orm/mappers/`)
- [ ] **@Entity format**: `@Entity({ schema: 'iam', name: 'users' })` (NO `@Entity('iam.users')`)
- [ ] **Controller request**: `@CurrentUser() user: AuthUser` o `@CurrentUser('sub') userId: string` (NO interface local `AuthenticatedRequest`)
- [ ] **Guard order**: `JwtAuthGuard → TenantGuard → RolesGuard` (orden importa)
- [ ] **Structured Logging**: NO `console.log/warn/error` ni `new Logger()` en app code — inyectar `LoggerService` + `setContext(ClassName.name)` ([docs](../../../docs/architecture/reference/structured-logging.md))
- [ ] **No tenant_id en tablas**: database-per-tenant (la BD es el boundary)
- [ ] **Tests**: `new UseCase(mock)` directamente, mock de `EntityRepository` (abstract class, no TypeORM), `jest.spyOn(TenantContext, 'getTenantId')` si aplica

## 🗄️ Database (MEDIO)

- [ ] Migraciones creadas para cambios de schema
- [ ] Entities con decorators TypeORM correctos
- [ ] Relations definidas apropiadamente (OneToMany, ManyToOne)
- [ ] Cascade options configuradas correctamente
- [ ] onDelete behavior definido (CASCADE, SET NULL, etc.)
- [ ] Transactions para operaciones atómicas
- [ ] Schemas correctos por dominio

## 📦 Dependencies

- [ ] No se agregan dependencias innecesarias
- [ ] Dependencias de dev en devDependencies
- [ ] Versiones específicas (no `*` o `latest`)
- [ ] package.json actualizado si hay cambios
- [ ] No hay imports de packages no declarados

## 🚀 DevOps/CI

- [ ] `npm run check` pasa (lint + typecheck + tests + build)
- [ ] ESLint sin warnings
- [ ] TypeScript compila sin errores
- [ ] Tests pasan
- [ ] Build exitoso
- [ ] No hay merge conflicts

## 📋 Git

- [ ] Commits siguen Conventional Commits
- [ ] Commit messages descriptivos
- [ ] Commits atómicos (un propósito por commit)
- [ ] Branch naming correcto (type/id-description)
- [ ] No hay archivos sensibles (.env, credentials)

---

## Scoring

**Total checks:** ~100+

**Criterio de aprobación:**
- 🔴 **CRÍTICOS:** 100% (Seguridad, Arquitectura, TypeScript)
- 🟠 **ALTOS:** >90% (Bugs)
- 🟡 **MEDIOS:** >80% (Performance, Naming, Docs, Tests)
- 🟢 **BAJOS:** >70% (Code Quality)

**Veredictos:**
- ✅ **APROBADO:** Todos los criterios cumplidos
- ⚠️ **APROBADO CON CAMBIOS:** MEDIOS y BAJOS no al 100%
- ❌ **REQUIERE CAMBIOS:** CRÍTICOS o ALTOS no cumplidos

---

## Uso del Checklist

### Manual
```bash
# Imprime el checklist y marca cada item mientras revisas
cat .claude/skills/code-review/checklists/review-checklist.md
```

### Con /code-review
```bash
# El skill usa esta checklist automáticamente
/code-review
```

El skill `/code-review` revisa automáticamente todos estos puntos y genera un reporte detallado con issues encontrados.
