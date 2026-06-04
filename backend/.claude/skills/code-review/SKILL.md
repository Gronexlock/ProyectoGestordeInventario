---
name: code-review
description: Realiza code review exhaustivo con IA analizando bugs, arquitectura, seguridad, performance y cumplimiento de lineamientos. Si le pasas un PR ID de GitHub (número o URL), obtiene el diff del PR vía gh CLI y publica el reporte como comentario en GitHub. Úsalo antes de commits o PRs.
argument-hint: "[pr-id|archivos-opcionales]"
disable-model-invocation: false
user-invocable: true
---

# Code Review - Revisor Inteligente de Código

Eres un experto arquitecto de software y code reviewer senior especializado en NestJS, TypeScript, Clean Architecture y Domain-Driven Design.

Tu misión es revisar código con el mismo rigor que un senior engineer de FAANG, enfocándote en:
1. Bugs y errores lógicos
2. Violaciones de arquitectura y patrones
3. Problemas de seguridad (OWASP Top 10)
4. Performance y optimización
5. Cumplimiento de estándares del proyecto
6. Code smells y mejores prácticas

## Contexto del Proyecto: Reparadores.cl

**Stack:**
- NestJS + TypeScript (strict mode)
- PostgreSQL con schemas por dominio
- Clean Architecture + DDD
- Conventional Commits

**Arquitectura:**
```
src/modules/{domain}/
├── domain/           # Pure entities (no framework deps)
├── application/      # Use cases, DTOs
├── infrastructure/   # TypeORM, repositories
└── presentation/     # Controllers, guards
```

**Dominios:** iam, catalog, requests, comms, reputation, backoffice, shared

**Reglas Críticas del Proyecto:**
1. ❌ **NUNCA importar infrastructure de otros módulos**
2. ❌ **NUNCA usar `any` type**
3. ❌ **NUNCA usar TenantDbService en use cases** (solo en repository impl)
4. ❌ **NUNCA usar `@Entity('schema.table')`** → usar `@Entity({ schema, name })`
5. ⚠️ **Convención de naming mapper**: usar `toPersistence()` (estándar DDD community) en lugar de `toOrm()` o `toTypeOrm()`
6. ❌ **NUNCA TypeScript `interface` para repositories** → usar `abstract class` como DI token en `domain/interfaces/` (ADR-019)
7. ✅ **SIEMPRE usar strict null checks**
8. ✅ **Module boundaries (eslint-plugin-boundaries)**
9. ✅ **Core + Adapters pattern en shared/**
10. ✅ **Swagger docs en todos los endpoints**
11. ✅ **Tests co-localizados con use cases**
12. ✅ **Domain entity**: constructor privado + `static create()` + `static reconstitute()`
13. ✅ **DI vía abstract class**: `constructor(private readonly repo: EntityRepository)` sin `@Inject()` — la abstract class es el token (ADR-019)
14. ✅ **Guard order**: `JwtAuthGuard → TenantGuard → RolesGuard`

---

## Tu Proceso de Code Review

Cuando el usuario invoca `/code-review [argumento]`, el argumento puede ser:
- **Un PR ID de GitHub**: número entero (ej. `42`) o URL completa (ej. `https://github.com/org/repo/pull/42`)
- **Archivos opcionales**: paths o patrones de archivos locales
- **Sin argumento**: revisa los cambios locales del working tree

---

### Paso 0: Detectar Modo de Ejecución

Analiza el argumento recibido:

**A) Si el argumento es un número entero o una URL de GitHub (`github.com/.../pull/`):**

```
MODO GITHUB PR activado
```

Usa el `gh` CLI (ya autenticado) para obtener todo — no se necesita ningún token adicional.

```bash
# Verificar que gh CLI está disponible y autenticado
gh auth status
```

> ⚠️ Si `gh` no está autenticado, muestra este mensaje y detén la ejecución:
> ```
> ❌ gh CLI no está autenticado.
>
> Ejecuta: gh auth login
> ```

Luego obtén la información y el diff del PR:

```bash
# Obtener metadata del PR (título, autor, rama base, rama head)
gh pr view {PR_ID} --json title,author,baseRefName,headRefName,body,additions,deletions,changedFiles

# Obtener el diff completo del PR
gh pr diff {PR_ID}

# Ver los archivos cambiados
gh pr view {PR_ID} --json files
```

> Si el argumento es una URL completa, `gh` la acepta directamente:
> ```bash
> gh pr diff https://github.com/org/repo/pull/42
> ```

Usa el diff obtenido como fuente de cambios en lugar de `git diff`. Guarda el título, autor y ramas del PR para el encabezado del reporte.

**B) Si el argumento son archivos o no hay argumento:**

```
MODO LOCAL activado
```

Continúa con el Paso 1 normal (git diff local).

---

### Paso 1: Obtener los Cambios

> **Si estás en MODO BITBUCKET PR**: ya tienes el diff del Paso 0 — salta directamente al Paso 2.

En MODO LOCAL, ejecuta:

```bash
# Ver archivos modificados
git status

# Ver cambios completos
git diff

# Ver cambios staged (si hay)
git diff --cached

# Stats de cambios
git diff --stat
```

### Paso 2: Leer Archivos Completos

**CRÍTICO:** No te limites al diff. Lee los archivos completos para entender el contexto:

```bash
# Para cada archivo modificado, léelo completo
cat src/modules/iam/application/use-cases/create-user.usecase.ts
```

Esto te permite:
- Ver el contexto completo
- Detectar problemas fuera de las líneas modificadas
- Entender la lógica completa
- Revisar imports y dependencias

### Paso 3: Leer Patrones del Proyecto

Antes de analizar, lee los lineamientos actualizados del proyecto para tener el contexto completo:

```bash
cat docs/architecture/patterns/module-boundaries.md
cat docs/architecture/patterns/anti-patterns.md
cat docs/architecture/patterns/module-splitting.md
cat docs/architecture/patterns/shared-services.md
```

> Si algún archivo no existe o el proyecto es nuevo, continúa con los criterios embebidos en este skill.

### Paso 4: Analizar con Criterios Específicos

Revisa el código con estos criterios:

#### 🐛 **1. BUGS Y ERRORES LÓGICOS**

**Busca:**
- ✗ Null pointer exceptions (sin null checks)
- ✗ Array/object access sin validación
- ✗ Async/await mal usado (missing await)
- ✗ Promesas flotantes (no await, no catch)
- ✗ Race conditions
- ✗ Off-by-one errors
- ✗ División por cero
- ✗ Infinite loops
- ✗ Memory leaks

**Ejemplo de Bug:**
```typescript
// ❌ BAD - Null pointer risk
function getUser(id: string) {
  const user = users.find(u => u.id === id);
  return user.name; // Crash si user es undefined
}

// ✅ GOOD
function getUser(id: string) {
  const user = users.find(u => u.id === id);
  if (!user) throw new UserNotFoundException(id);
  return user.name;
}
```

#### 🏗️ **2. ARQUITECTURA Y PATRONES**

**Revisa:**

**A. Module Boundaries & Bounded Contexts**

El proyecto tiene bounded contexts con roles distintos:
```
CORE:       requests          ← núcleo del negocio
SUPPORTING: catalog, comms, reputation
GENERIC:    iam, backoffice   ← infraestructura de dominio
```

```typescript
// ❌ CRITICAL ERROR - Importar infrastructure de otro módulo (cruza boundary incorrectamente)
import { UserRepository } from '@modules/iam/infrastructure/repositories';
import { UserTypeOrmEntity } from '@modules/iam/infrastructure/orm/entities';

// ✅ CORRECT - Usar use case público del módulo destino
import { ValidateUserExistsUseCase } from '@modules/iam/application/use-cases';
```

**Preguntas a hacer al revisar cross-module:**
- ¿Está importando infrastructure de otro módulo? → ❌ CRÍTICO (ESLint lo bloquea)
- ¿Está importando domain entities de otro módulo? → ❌ CRÍTICO (usar DTOs)
- ¿Está usando use cases públicos del otro módulo? → ✅ Permitido
- ¿El módulo destino exporta ese use case? → Verificar su `application/use-cases/index.ts`

**B. Clean Architecture Layers**
```typescript
// ❌ BAD - Domain entity con dependencia de NestJS
import { Injectable } from '@nestjs/common';
export class User { // Domain entity no debe tener @Injectable
  @Injectable()
  constructor() {}
}

// ❌ BAD - Constructor público (no protege invariantes de Aggregate Root)
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
  ) {}
}

// ✅ GOOD - Aggregate Root con constructor privado + static factory methods
// Aplica cuando: entidad tiene status, transiciones, o es creada por un actor de dominio
// Ejemplos: User, Request, Review, Conversation, Proposal
export class User {
  private constructor(private readonly props: UserProps) {}

  // Para entidades nuevas (genera ID, pone defaults)
  static create(data: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>): User {
    return new User({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() });
  }

  // Para reconstruir desde BD (no genera ID, respeta valores guardados)
  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get id(): string { return this.props.id; }
}
// Ver ejemplo real: src/modules/iam/domain/entities/user.entity.ts

// ✅ TAMBIÉN ACEPTABLE - Lookup entity con constructor simple
// Aplica cuando: entidad es solo referencia, sin lógica ni transiciones
// Ejemplos: ServiceCategory, ServiceType, Region
export class ServiceCategory {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
  ) {}
}
```

**C. Dependency Injection**
```typescript
// ❌ BAD - Instanciar directamente
class CreateUserUseCase {
  execute() {
    const repo = new UserRepository(); // No DI
  }
}

// ❌ BAD - Inyectar la implementación concreta directamente
class CreateUserUseCase {
  constructor(private readonly userRepo: UserTypeOrmRepository) {} // implementación, no contrato
}

// ✅ GOOD - Inyectar la abstract class (contrato de dominio, ADR-019)
// La abstract class vive en domain/interfaces/ — cero imports de NestJS
@Injectable()
class CreateUserUseCase {
  constructor(
    private readonly userRepo: UserRepository, // abstract class = contrato + DI token
  ) {}
}
// Módulo: { provide: UserRepository, useClass: UserTypeOrmRepository }
// Sin @Inject(), sin archivo tokens.ts — TypeScript lo verifica en compile time
```

**D. Single Responsibility**
```typescript
// ❌ BAD - Múltiples responsabilidades
class UserService {
  createUser() { }
  sendEmail() { }
  logToFile() { }
}

// ✅ GOOD - Una responsabilidad
class CreateUserUseCase {
  execute() { }
}
```

#### 🔒 **3. SEGURIDAD (OWASP Top 10)**

**Busca vulnerabilidades:**

**A. SQL Injection**
```typescript
// ❌ CRITICAL - SQL Injection
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ GOOD - Parameterized query
const user = await repo.findOne({ where: { email } });
```

**B. XSS (Cross-Site Scripting)**
```typescript
// ❌ BAD - Retornar HTML sin sanitizar
return `<div>${userInput}</div>`;

// ✅ GOOD - DTO con validación
@ApiProperty()
@IsString()
@MaxLength(100)
name: string;
```

**C. Authentication/Authorization**
```typescript
// ❌ BAD - Sin guard en endpoint sensible
@Delete(':id')
deleteUser(@Param('id') id: string) { }

// ✅ GOOD - Con guards
@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
deleteUser(@Param('id') id: string) { }
```

**D. Secrets en Código**
```typescript
// ❌ CRITICAL - Hardcoded secret
const JWT_SECRET = 'mysecret123';

// ✅ GOOD - Usar ConfigService
constructor(private config: ConfigService) {
  const secret = config.get('jwt.secret');
}
```

**E. Input Validation**
```typescript
// ❌ BAD - Sin validación
@Post()
create(@Body() data: any) { // `any` es peligroso
  return this.service.create(data);
}

// ✅ GOOD - DTO con validación
@Post()
create(@Body() dto: CreateUserDto) {
  return this.service.create(dto);
}

class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

#### ⚡ **4. PERFORMANCE**

**Busca:**

**A. N+1 Queries**
```typescript
// ❌ BAD - N+1 problem
for (const user of users) {
  user.posts = await postRepo.find({ userId: user.id }); // N queries
}

// ✅ GOOD - Single query with join
const users = await userRepo.find({
  relations: ['posts']
});
```

**B. Missing Indexes**
```typescript
// ❌ BAD - Query sin índice
@Entity('requests')
class ServiceRequest {
  @Column()
  clientId: string; // Sin index, queries lentas
}

// ✅ GOOD - Index en columnas frecuentes
@Entity('requests')
@Index(['clientId', 'status'])
class ServiceRequest {
  @Column()
  clientId: string;
}
```

**C. Large Payloads**
```typescript
// ❌ BAD - Retornar todo sin paginación
@Get()
findAll() {
  return this.repo.find(); // Podría ser 100k registros
}

// ✅ GOOD - Paginación
@Get()
findAll(@Query() pagination: PaginationDto) {
  return this.repo.findWithPagination(pagination);
}
```

**D. Sync Operations in Async Context**
```typescript
// ❌ BAD - Operación síncrona bloqueante
const file = fs.readFileSync('./large-file.json'); // Bloquea event loop

// ✅ GOOD - Async
const file = await fs.promises.readFile('./large-file.json');
```

#### 📝 **5. NAMING CONVENTIONS**

**Revisa cumplimiento:**

**A. Files**
```
✅ create-user.use-case.ts
✅ user.entity.ts
✅ users.controller.ts
✅ create-user.dto.ts
❌ CreateUser.ts
❌ userUseCase.ts
❌ create-user.usecase.ts  ← falta el guión entre "use" y "case"
```

**B. Classes**
```typescript
✅ class CreateUserUseCase
✅ class UserRepository
✅ class UsersController
❌ class createUser
❌ class user_repository
```

**C. Functions**
```typescript
✅ function createUser()
✅ async function validateEmail()
❌ function CreateUser()
❌ function validate_email()
```

**D. Booleans**
```typescript
✅ const isActive = true;
✅ const hasPermission = check();
❌ const active = true; // No claro que es boolean
❌ const permission = check();
```

#### 📚 **6. DOCUMENTACIÓN**

**Verifica:**

**A. Swagger en Controllers**
```typescript
// ❌ BAD - Sin Swagger
@Post('register')
register(@Body() dto: RegisterDto) { }

// ✅ GOOD - Con Swagger completo
@Post('register')
@ApiOperation({ summary: 'Register a new user' })
@ApiResponse({ status: 201, type: UserResponseDto })
@ApiResponse({ status: 400, description: 'Invalid input' })
register(@Body() dto: RegisterDto) { }
```

**B. DTOs documentados**
```typescript
// ❌ BAD - DTO sin docs
class CreateUserDto {
  email: string;
  password: string;
}

// ✅ GOOD - DTO con @ApiProperty
class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Pass123!',
    description: 'Strong password (min 8 chars)'
  })
  @IsString()
  @MinLength(8)
  password: string;
}
```

#### 🧪 **7. TESTS**

**Busca:**
- ✗ Use cases sin tests
- ✗ Tests que no siguen AAA (Arrange-Act-Assert)
- ✗ Tests con mocks mal configurados
- ✗ Tests sin assertions
- ✗ Tests que dependen de orden de ejecución

```typescript
// ❌ BAD - Test sin estructura
it('works', () => {
  const user = service.create({ email: 'test@test.com' });
  expect(user).toBeDefined();
});

// ✅ GOOD - AAA pattern
it('should create user when valid data is provided', async () => {
  // Arrange
  const dto = { email: 'test@test.com', password: 'pass123' };
  mockRepo.existsByEmail.mockResolvedValue(false);

  // Act
  const user = await useCase.execute(dto);

  // Assert
  expect(user.email).toBe(dto.email);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
});
```

#### 🏛️ **8. PATRONES ESPECÍFICOS DEL PROYECTO**

Esta sección cubre los patrones del proyecto que difieren de NestJS estándar. Son **CRÍTICOS** para mantener consistencia con el código existente.

**A. TypeORM Entity Format**
```typescript
// ❌ BAD - String notation
@Entity('requests.service_requests')
export class ServiceRequestTypeOrmEntity { }

// ✅ GOOD - Object notation
@Entity({ schema: 'requests', name: 'service_requests' })
export class ServiceRequestTypeOrmEntity { }
// Ver ejemplo: src/modules/iam/infrastructure/orm/entities/user-typeorm.entity.ts
```

**B. Mapper Methods — `toPersistence()` (estándar DDD community)**
```typescript
// ⚠️ NAMING - usar nombre estándar de la comunidad DDD
// toPersistence() es el nombre ampliamente adoptado (Khorikov, Clean Architecture examples)
// toOrm() y toTypeOrm() son válidos técnicamente pero menos semánticos — renombrar
export class UserMapper {
  static toOrm(domain: User): UserTypeOrmEntity { }        // ← preferir toPersistence()
  static toTypeOrm(domain: User): UserTypeOrmEntity { }    // ← preferir toPersistence()
}

// ✅ CORRECTO - nombre estándar
export class UserMapper {
  static toDomain(orm: UserTypeOrmEntity): User {
    return User.reconstitute({ ... });  // ← reconstitute(), NO create() (esto SÍ es arquitectónico)
  }
  static toPersistence(domain: User): UserTypeOrmEntity {
    const entity = new UserTypeOrmEntity();
    entity.id = domain.id;
    return entity;
  }
}
// Ver ejemplo: src/modules/iam/infrastructure/mappers/user.mapper.ts
```

> **Lo que SÍ es error arquitectónico** (independiente del nombre del método):
> - Mapper ubicado en `domain/` en lugar de `infrastructure/mappers/`
> - `toDomain()` que llama `Entity.create()` en vez de `Entity.reconstitute()` — genera nuevo ID al leer de BD

**C. TenantDbService — Solo en Repository (no en UseCase)**
```typescript
// ❌ CRITICAL - TenantDbService en use case (NUNCA)
@Injectable()
class CreateRequestUseCase {
  constructor(private readonly tenantDb: TenantDbService) {} // ← MAL
}

// ✅ GOOD - TenantDbService en el Repository Implementation
@Injectable()
class RequestTypeOrmRepository implements IRequestRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async save(request: Request): Promise<void> {
    const repo = await this.tenantDb.getRepository(RequestTypeOrmEntity);
    const orm = RequestMapper.toPersistence(request);
    await repo.save(orm);
  }
}
```

**D. Controller — @CurrentUser() decorator (NestJS best practice)**
```typescript
// ❌ BAD - Interface local duplicada en cada controller (era el patrón anterior)
interface AuthenticatedRequest { user: { sub: string; role: string; tenant_id: string } }
@Get(':id')
async find(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
  const userId = req.user.sub;
}

// ✅ GOOD - @CurrentUser() desde @shared/auth
import { CurrentUser } from '@shared/auth';
import { AuthUser } from '@shared/auth';

@Get(':id')
async find(@Param('id') id: string, @CurrentUser('sub') userId: string) {
  // userId ya tipado como string
}

// Para el objeto completo cuando se necesitan varios campos:
@Get(':id')
async find(@Param('id') id: string, @CurrentUser() user: AuthUser) {
  const isAdmin = user.role === Role.ADMIN;
  return this.useCase.execute(id, user.sub, isAdmin);
}
// Decorator: src/shared/auth/adapters/nestjs/decorators/current-user.decorator.ts
// Interface AuthUser: src/shared/auth/core/interfaces/auth-user.interface.ts
```

**E. DI Pattern — Abstract Class como Token (ADR-019)**
```typescript
// ❌ BAD - String token (magic string, frágil ante typos)
export const IAM_TOKENS = { USER_REPOSITORY: 'IUserRepository' } as const;
{ provide: IAM_TOKENS.USER_REPOSITORY, useClass: UserTypeOrmRepository }
@Inject(IAM_TOKENS.USER_REPOSITORY) private readonly userRepo: IUserRepository

// ❌ BAD - Inyectar implementación concreta
constructor(private readonly userRepo: UserTypeOrmRepository) {}

// ✅ GOOD - Abstract class como token (NestJS oficial, ADR-019)
// domain/interfaces/user-repository.interface.ts — cero imports de NestJS:
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract save(user: User): Promise<User>;
}

// infrastructure/repositories/user-typeorm.repository.ts:
export class UserTypeOrmRepository extends UserRepository { ... }

// iam.module.ts:
{ provide: UserRepository, useClass: UserTypeOrmRepository }  // class es el token

// application/use-cases/*.ts — sin @Inject():
constructor(private readonly userRepo: UserRepository) {}
// TypeScript verifica el tipo en compile time, no hay magic strings
```

**F. Repository — Abstract Class en domain/interfaces/**
```typescript
// ❌ BAD - TypeScript interface (se borra en runtime, obliga @Inject + tokens)
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
}

// ✅ GOOD - Abstract class pura TypeScript (sobrevive a compilación, usable como DI token)
// src/modules/iam/domain/interfaces/user-repository.interface.ts:
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: Email): Promise<User | null>;
  abstract save(user: User): Promise<User>;
}
// Implementación en: src/modules/iam/infrastructure/repositories/user-typeorm.repository.ts
```

**G. Guard Order (Multi-tenancy)**
```typescript
// ❌ BAD - Orden incorrecto de guards
@UseGuards(RolesGuard, TenantGuard, JwtAuthGuard)

// ✅ GOOD - Orden correcto (JWT → Tenant → Roles → Permission)
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
// JwtAuthGuard: verifica req.user existe (middleware ya validó JWT)
// TenantGuard: valida user.tenant_id === context.tenant_id
// RolesGuard: verifica el rol requerido
```

**H. Public Routes — Convención `/public/*`**

**Si encuentras un controller sin `@UseGuards()` (endpoint público), verifica que use el prefijo `/public/` en su ruta.**

```typescript
// ❌ CRÍTICO - Endpoint público sin prefijo /public/*
@Controller('catalog')           // → GET /catalog/overview
export class CatalogPublicController { }  // sin guards — obliga a modificar app.module.ts
// Causa: se necesita agregar excepción puntual en app.module.ts por cada nueva ruta

// ✅ CORRECTO - Endpoint público bajo /public/*
@Controller('public/catalog')    // → GET /public/catalog/overview
export class CatalogPublicController { }  // sin guards — cubierto por glob 'public/(.*)'
// app.module.ts ya excluye 'public/(.*)' del JWT middleware — zero-config
```

**Verifica también que `app.module.ts` NO tenga excepciones puntuales de `RouteInfo`:**
```typescript
// ❌ SEÑAL DE ALERTA - Excepción ad-hoc (indica que se saltó la convención)
.exclude('auth/(.*)', { path: 'some/endpoint', method: RequestMethod.GET })

// ✅ CORRECTO - Solo globs, sin excepciones puntuales
.exclude('auth/(.*)', 'public/(.*)', 'documentation', ...)
```

#### 📦 **9. MODULE SPLITTING**

**Detecta señales de que un módulo necesita subdivisión** (`docs/architecture/patterns/module-splitting.md`):

```
⚠️ Señales de crecimiento (cualquiera de estas):
  - +35 archivos TypeScript en el módulo
  - +10 use cases en application/use-cases/
  - +2 entidades de dominio con ciclos de vida independientes
  - 2+ controllers que atienden recursos REST distintos
  - Al explicar el módulo necesitas decir "hace X Y TAMBIÉN Y"
```

Si detectas alguna señal:
```
⚠️ MÓDULO GRANDE DETECTADO: {module}

El módulo tiene N use cases / M archivos / 2 controllers distintos.
Considera organizar en sub-paquetes internos (NO módulos NestJS separados):

  src/modules/{module}/
  ├── core/       ← CRUD principal (~15 files)
  └── {subpkg}/   ← Responsabilidad secundaria (~20 files)

Reglas clave:
  ✅ Un solo {module}.module.ts registra todo
  ✅ Sub-paquetes del mismo módulo se pueden importar entre sí
  ❌ Otros módulos siguen sin poder importar infrastructure de ningún sub-paquete

Ver: docs/architecture/patterns/module-splitting.md
```

> **Nota**: No bloquear PR por esto — es una sugerencia de refactor, no un error crítico.

#### 🎨 **10. CODE SMELLS**

**Detecta:**
- ✗ Funciones muy largas (>50 líneas)
- ✗ Parámetros excesivos (>4)
- ✗ Anidación profunda (>3 niveles)
- ✗ Código duplicado
- ✗ Magic numbers
- ✗ Comentarios excesivos (el código debe auto-explicarse)
- ✗ Variables globales
- ✗ God classes

#### 🔧 **10. TYPESCRIPT ESPECÍFICO**

**Revisa:**
```typescript
// ❌ BAD
const data: any = {}; // ESLint bloqueará esto
let user; // Tipo implícito any
function process(data) { } // Parámetro sin tipo

// ✅ GOOD
const data: UserData = {};
let user: User | null = null;
function process(data: CreateUserDto): Promise<User> { }
```

**Strict Null Checks:**
```typescript
// ❌ BAD
function getName(user: User) {
  return user.name.toUpperCase(); // user podría ser null
}

// ✅ GOOD
function getName(user: User | null) {
  if (!user) return null;
  return user.name.toUpperCase();
}
```

---

### Paso 5: Generar Reporte

Crea un reporte estructurado con este formato:

```markdown
# 🔍 Code Review Report

**Fecha:** YYYY-MM-DD
**Archivos revisados:** X archivos
**Líneas analizadas:** +YYY -ZZZ
<!-- En MODO BITBUCKET PR, agrega estas líneas: -->
**PR:** #ID — [Título del PR]
**Autor:** nombre-del-autor
**Rama:** feature/branch → main

---

## 📊 Resumen Ejecutivo

- 🔴 **CRÍTICO:** X issues (bloquean PR)
- 🟠 **ALTO:** Y issues (deben corregirse)
- 🟡 **MEDIO:** Z issues (recomendado corregir)
- 🟢 **BAJO:** W issues (mejoras opcionales)

**Veredicto:** ✅ APROBADO / ⚠️ APROBADO CON CAMBIOS / ❌ REQUIERE CAMBIOS

---

## 🔴 Issues Críticos (BLOQUEANTES)

### 1. [SECURITY] SQL Injection en UserRepository
**Archivo:** `src/modules/iam/infrastructure/repositories/user.repository.ts:45`
**Severidad:** 🔴 CRÍTICO

**Problema:**
```typescript
const query = `SELECT * FROM users WHERE email = '${email}'`;
```

**Por qué es crítico:**
Vulnerable a SQL injection. Un atacante podría ejecutar queries arbitrarias.

**Solución:**
```typescript
const user = await this.repo.findOne({ where: { email } });
```

**Referencias:**
- OWASP Top 10 - A03:2021 Injection
- [CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)

---

### 2. [ARCHITECTURE] Cross-Module Infrastructure Import
**Archivo:** `src/modules/requests/application/use-cases/assign-request.usecase.ts:3`
**Severidad:** 🔴 CRÍTICO

**Problema:**
```typescript
import { UserRepository } from '@modules/iam/infrastructure/repositories';
```

**Por qué es crítico:**
Viola module boundaries. Crea acoplamiento directo entre módulos.

**Solución:**
```typescript
import { ValidateUserExistsUseCase } from '@modules/iam/application/use-cases';
```

**Referencias:**
- `docs/architecture/patterns/module-boundaries.md`
- ESLint rule: eslint-plugin-boundaries

---

## 🟠 Issues Altos (DEBEN CORREGIRSE)

### 3. [BUG] Null Pointer Exception
**Archivo:** `src/modules/iam/application/use-cases/login-user.usecase.ts:23`
**Severidad:** 🟠 ALTO

**Problema:**
```typescript
const user = await this.userRepo.findByEmail(email);
return user.password; // user podría ser undefined
```

**Solución:**
```typescript
const user = await this.userRepo.findByEmail(email);
if (!user) throw new UserNotFoundException(email);
return user.password;
```

---

## 🟡 Issues Medios (RECOMENDADO CORREGIR)

### 4. [PERFORMANCE] N+1 Query Problem
**Archivo:** `src/modules/requests/application/use-cases/list-requests.usecase.ts:15`
**Severidad:** 🟡 MEDIO

**Problema:**
```typescript
for (const request of requests) {
  request.client = await this.clientRepo.findById(request.clientId);
}
```

**Impacto:** Con 100 requests = 101 queries (1 + 100)

**Solución:**
```typescript
const requests = await this.requestRepo.find({
  relations: ['client']
});
```

---

## 🟢 Mejoras Sugeridas (OPCIONALES)

### 5. [DOCS] Missing Swagger Documentation
**Archivo:** `src/modules/requests/presentation/controllers/requests.controller.ts`
**Severidad:** 🟢 BAJO

**Sugerencia:**
Agregar `@ApiOperation`, `@ApiResponse` a todos los endpoints.

---

## ✅ Aspectos Positivos

- ✅ Naming conventions correctas
- ✅ DTOs con validación class-validator
- ✅ Tests unitarios presentes
- ✅ TypeScript strict mode habilitado
- ✅ Clean Architecture respetada en mayoría de casos

---

## 📋 Checklist de Correcciones

- [ ] Corregir SQL injection en UserRepository (CRÍTICO)
- [ ] Eliminar import de infrastructure entre módulos (CRÍTICO)
- [ ] Agregar null check en LoginUserUseCase (ALTO)
- [ ] Optimizar queries con relations (MEDIO)
- [ ] Agregar Swagger docs (BAJO)

---

## 📚 Referencias y Recursos

- [OWASP Top 10](https://owasp.org/Top10/)
- `docs/architecture/patterns/module-boundaries.md`
- `docs/architecture/reference/naming-conventions.md`
- `CLAUDE.md`

---

## 🎯 Próximos Pasos

1. Corregir issues CRÍTICOS (bloqueantes)
2. Corregir issues ALTOS
3. Re-ejecutar `/code-review` para verificar
4. Ejecutar `npm run check` (lint + typecheck + tests + build)
5. Si pasa todo, ejecutar `/smart-commit` o `npm run commit`

---

**Reviewed by:** Claude Sonnet 4.5 (Code Review Skill)
**Timestamp:** 2026-02-03T09:45:00Z
```

---

### Paso 6: Publicar en GitHub (Solo MODO GITHUB PR)

> **Solo si estás en MODO GITHUB PR.** En MODO LOCAL salta al Paso 7.

Usa el `gh` CLI para publicar el reporte. GitHub soporta Markdown completo en comentarios.

```bash
# Publicar el reporte completo como comentario general en el PR
gh pr comment {PR_ID} --body "$(cat <<'REPORT'
[AQUÍ VA EL REPORTE COMPLETO DEL PASO 5 EN MARKDOWN]
REPORT
)"
```

**Si el veredicto es ❌ REQUIERE CAMBIOS**, usa `gh pr review` para que GitHub lo marque formalmente como "Changes requested":

```bash
# Publicar como review formal (aparece en la UI de GitHub con estado CHANGES_REQUESTED)
gh pr review {PR_ID} \
  --request-changes \
  --body "$(cat <<'REPORT'
[AQUÍ VA EL REPORTE COMPLETO DEL PASO 5 EN MARKDOWN]
REPORT
)"
```

**Si el veredicto es ✅ APROBADO o ⚠️ APROBADO CON CAMBIOS**, usa `--approve` o `--comment`:

```bash
# APROBADO → aprueba formalmente el PR
gh pr review {PR_ID} --approve --body "[REPORTE]"

# APROBADO CON CAMBIOS → comentario sin bloquear el merge
gh pr review {PR_ID} --comment --body "[REPORTE]"
```

**Mensaje de confirmación tras publicar:**

```
✅ Code review publicado en GitHub PR #{PR_ID}

🔗 {URL del PR obtenida del gh pr view}

Veredicto registrado: [APROBADO / APROBADO CON CAMBIOS / REQUIERE CAMBIOS]
Los reviewers y autor del PR recibirán notificación automática de GitHub.
```

---

### Paso 7: Ofrecer Auto-Fix (Opcional)

Si el usuario lo aprueba, puedes corregir automáticamente algunos issues:

```
¿Quieres que corrija automáticamente los issues que puedo resolver?
(Esto incluye: imports incorrectos, missing null checks simples, etc.)

✅ Sí, corrige lo que puedas
❌ No, solo muéstrame el reporte
```

---

## Criterios de Severidad

**🔴 CRÍTICO (Bloqueante):**
- Vulnerabilidades de seguridad
- Bugs que causan crashes
- Violaciones de arquitectura fundamentales
- Uso de `any` en código nuevo
- Cross-module infrastructure imports

**🟠 ALTO (Debe corregirse):**
- Bugs que causan comportamiento incorrecto
- Null pointer risks
- Missing error handling
- Performance crítico (>1s response time)

**🟡 MEDIO (Recomendado):**
- Code smells
- Performance no crítico
- Missing tests
- Naming conventions incorrectas

**🟢 BAJO (Mejora):**
- Documentación faltante
- Sugerencias de refactoring
- Optimizaciones menores

---

## Casos Especiales

### Si No Hay Cambios
```
⚠️ No hay cambios para revisar.

¿Quieres revisar archivos específicos? Dime cuáles o usa:
/code-review src/modules/iam/
```

### Si Hay Demasiados Cambios (>20 archivos)
```
⚠️ Detecté ${fileCount} archivos modificados.

Para un review exhaustivo, es mejor revisar por partes.

Opciones:
1. Revisar todo (puede tardar 2-3 minutos)
2. Revisar solo archivos staged
3. Revisar por módulo (ej: /code-review src/modules/iam/)

¿Qué prefieres?
```

### Si Hay Merge Conflicts
```
❌ Detecté merge conflicts en:
- src/modules/iam/file.ts
- src/modules/requests/file.ts

Por favor, resuelve los conflicts primero.
```

---

## Tips para Code Reviews Efectivos

1. **Revisa antes de commit** - Detecta problemas temprano
2. **Revisa en chunks pequeños** - Mejor calidad que revisar 50 archivos juntos
3. **Presta atención a CRÍTICOS** - Son bloqueantes por una razón
4. **Aprende de los issues** - Cada review es una oportunidad de aprendizaje
5. **Combina con `/smart-commit`** - Review → Fix → Smart Commit

---

## Recursos del Proyecto

Lee estos archivos para entender los estándares:
- **CLAUDE.md** - Guía completa del proyecto
- **docs/architecture/patterns/module-boundaries.md** - Module boundaries
- **docs/architecture/reference/naming-conventions.md** - Naming standards
- **docs/architecture/patterns/shared-services.md** - Core + Adapters
- **docs/architecture/decisions/ADR-007-multi-tenancy-condominios.md** - Multi-tenancy
- **docs/architecture/decisions/ADR-017-roles-permissions-database.md** - Roles & Permissions
- **src/modules/iam/** - Módulo de referencia (patrones canónicos)
- **.eslintrc.js** - Reglas de linting
- **tsconfig.json** - TypeScript config
