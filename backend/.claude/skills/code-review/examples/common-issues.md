# Common Issues - Ejemplos y Soluciones

Catálogo de los problemas más comunes encontrados en code reviews y cómo solucionarlos.

---

## 🔴 CRÍTICOS

### 1. Cross-Module Infrastructure Import

**Issue:**
```typescript
// ❌ src/modules/requests/application/use-cases/assign-request.usecase.ts
import { UserRepository } from '@modules/iam/infrastructure/repositories/user.repository';

export class AssignRequestUseCase {
  constructor(private userRepo: UserRepository) {} // ❌ Violación de boundaries

  async execute(requestId: string, repairerId: string) {
    const repairer = await this.userRepo.findById(repairerId); // ❌ Acceso directo
    // ...
  }
}
```

**Por qué es crítico:**
- Viola module boundaries
- Crea acoplamiento fuerte entre módulos
- Impide migración a microservicios
- ESLint debería bloquearlo (eslint-plugin-boundaries)

**Solución:**
```typescript
// ✅ src/modules/iam/application/use-cases/validate-user-exists.usecase.ts
@Injectable()
export class ValidateUserExistsUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(userId: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    return !!user;
  }
}

// ✅ Export from index
export { ValidateUserExistsUseCase } from './validate-user-exists.usecase';

// ✅ src/modules/requests/application/use-cases/assign-request.usecase.ts
import { ValidateUserExistsUseCase } from '@modules/iam/application/use-cases';

export class AssignRequestUseCase {
  constructor(
    private validateUserExists: ValidateUserExistsUseCase, // ✅ Use case público
  ) {}

  async execute(requestId: string, repairerId: string) {
    const exists = await this.validateUserExists.execute(repairerId);
    if (!exists) throw new UserNotFoundException(repairerId);
    // ...
  }
}
```

---

### 2. SQL Injection Vulnerability

**Issue:**
```typescript
// ❌ src/modules/iam/infrastructure/repositories/user.repository.ts
async findByEmail(email: string): Promise<User | null> {
  const query = `SELECT * FROM users WHERE email = '${email}'`; // ❌ SQL Injection
  const result = await this.connection.query(query);
  return result[0] || null;
}
```

**Por qué es crítico:**
- Permite inyección SQL
- Atacante puede ejecutar queries arbitrarias
- Puede exponer/modificar/eliminar datos
- OWASP Top 10 #1

**Exploit example:**
```typescript
// Atacante envía:
const maliciousEmail = "admin@example.com' OR '1'='1";
// Query resultante:
// SELECT * FROM users WHERE email = 'admin@example.com' OR '1'='1'
// Retorna TODOS los usuarios
```

**Solución:**
```typescript
// ✅ src/modules/iam/infrastructure/repositories/user.repository.ts
async findByEmail(email: string): Promise<User | null> {
  return await this.userRepository.findOne({
    where: { email }, // ✅ Parameterized query
  });
}
```

---

### 3. Hardcoded Secrets

**Issue:**
```typescript
// ❌ src/shared/auth/jwt.service.ts
export class JwtService {
  private readonly SECRET = 'mysecretkey123'; // ❌ Hardcoded secret

  sign(payload: any) {
    return jwt.sign(payload, this.SECRET);
  }
}
```

**Por qué es crítico:**
- Secret expuesto en código fuente
- Comprometido si repo es público o hay leak
- No se puede rotar sin cambiar código
- Mismo secret en dev/staging/prod

**Solución:**
```typescript
// ✅ src/shared/auth/jwt.service.ts
@Injectable()
export class JwtService {
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.secret = config.get<string>('jwt.secret'); // ✅ From env vars
    if (!this.secret) {
      throw new Error('JWT_SECRET not configured');
    }
  }

  sign(payload: JwtPayload) {
    return jwt.sign(payload, this.secret);
  }
}

// ✅ .env (no versionado)
JWT_SECRET=<generated-with-openssl-rand-base64-32>
```

---

### 4. Missing Authentication Guard

**Issue:**
```typescript
// ❌ src/modules/users/presentation/controllers/users.controller.ts
@Controller('users')
export class UsersController {
  @Delete(':id')
  deleteUser(@Param('id') id: string) { // ❌ Sin autenticación
    return this.usersService.delete(id);
  }
}
```

**Por qué es crítico:**
- Endpoint sensible sin protección
- Cualquiera puede eliminar usuarios
- Violación de seguridad masiva

**Solución:**
```typescript
// ✅ src/modules/users/presentation/controllers/users.controller.ts
@Controller('users')
@UseGuards(JwtAuthGuard) // ✅ Requiere autenticación
export class UsersController {

  @Delete(':id')
  @UseGuards(RolesGuard) // ✅ Requiere rol específico
  @Roles(Role.ADMIN) // ✅ Solo admins
  @ApiBearerAuth() // ✅ Swagger docs
  deleteUser(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
```

---

### 5. Type `any` Usage

**Issue:**
```typescript
// ❌ src/modules/requests/application/use-cases/create-request.usecase.ts
async execute(data: any) { // ❌ any type
  const request = await this.repo.save(data); // ❌ Sin validación
  return request;
}
```

**Por qué es crítico:**
- Pierde type safety
- No hay validación de input
- Bugs no detectados en compile time
- ESLint debería bloquearlo

**Solución:**
```typescript
// ✅ Create DTO
export class CreateServiceRequestDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @ApiProperty()
  @IsUUID()
  clientId: string;
}

// ✅ Use DTO
async execute(dto: CreateServiceRequestDto): Promise<ServiceRequest> {
  // TypeScript valida tipos, class-validator valida valores
  const request = await this.repo.save(dto);
  return request;
}
```

---

## 🟠 ALTOS

### 6. Null Pointer Exception

**Issue:**
```typescript
// ❌ src/modules/iam/application/use-cases/get-user-profile.usecase.ts
async execute(userId: string) {
  const user = await this.userRepo.findById(userId); // Puede retornar null
  return {
    name: user.name, // ❌ Crash si user es null
    email: user.email,
  };
}
```

**Por qué es alto:**
- Runtime crash
- Bad user experience
- Stack trace expuesta

**Solución:**
```typescript
// ✅ Opción 1: Lanzar excepción
async execute(userId: string): Promise<UserProfileDto> {
  const user = await this.userRepo.findById(userId);

  if (!user) {
    throw new UserNotFoundException(userId); // ✅ Error descriptivo
  }

  return {
    name: user.name,
    email: user.email,
  };
}

// ✅ Opción 2: Retornar null con tipo union
async execute(userId: string): Promise<UserProfileDto | null> {
  const user = await this.userRepo.findById(userId);

  if (!user) return null; // ✅ Caller maneja null

  return {
    name: user.name,
    email: user.email,
  };
}
```

---

### 7. Floating Promise

**Issue:**
```typescript
// ❌ src/modules/notifications/application/use-cases/send-notification.usecase.ts
async execute(userId: string, message: string) {
  const user = await this.userRepo.findById(userId);

  this.emailService.send(user.email, message); // ❌ Promise flotante

  return { sent: true }; // ❌ Retorna antes de que email se envíe
}
```

**Por qué es alto:**
- Email podría fallar silenciosamente
- Race condition
- Estado inconsistente
- ESLint debería detectarlo (@typescript-eslint/no-floating-promises)

**Solución:**
```typescript
// ✅ Opción 1: Await the promise
async execute(userId: string, message: string) {
  const user = await this.userRepo.findById(userId);

  await this.emailService.send(user.email, message); // ✅ Espera a que termine

  return { sent: true };
}

// ✅ Opción 2: Fire and forget consciente (con catch)
async execute(userId: string, message: string) {
  const user = await this.userRepo.findById(userId);

  this.emailService
    .send(user.email, message)
    .catch(err => this.logger.error('Failed to send email', err)); // ✅ Maneja error

  return { queued: true };
}
```

---

### 8. Missing Input Validation

**Issue:**
```typescript
// ❌ src/modules/requests/presentation/controllers/requests.controller.ts
@Post()
create(@Body() data: any) { // ❌ any, sin validación
  return this.createRequest.execute(data);
}
```

**Por qué es alto:**
- Permite input malicioso
- Datos inconsistentes en DB
- Bugs difíciles de debuggear

**Solución:**
```typescript
// ✅ Create validated DTO
export class CreateServiceRequestDto {
  @ApiProperty({ example: 'Fix refrigerator' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Refrigerator not cooling...' })
  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  description: string;

  @ApiProperty({ example: 'uuid-here' })
  @IsUUID()
  clientId: string;
}

// ✅ Use DTO in controller
@Post()
@UsePipes(new ValidationPipe({ whitelist: true })) // ✅ Valida y remueve props extras
create(@Body() dto: CreateServiceRequestDto) { // ✅ Tipo específico
  return this.createRequest.execute(dto);
}
```

---

## 🟡 MEDIOS

### 9. N+1 Query Problem

**Issue:**
```typescript
// ❌ src/modules/requests/application/use-cases/list-requests.usecase.ts
async execute() {
  const requests = await this.requestRepo.find(); // 1 query

  for (const request of requests) {
    request.client = await this.clientRepo.findById(request.clientId); // N queries
    request.repairer = await this.repairerRepo.findById(request.repairerId); // N queries
  }

  return requests;
  // Total: 1 + N + N = 1 + 2N queries
  // Con 100 requests = 201 queries! 🐌
}
```

**Por qué es medio:**
- Performance degradado
- Escala mal (más requests = más lento)
- Sobrecarga de DB

**Solución:**
```typescript
// ✅ Usar relations en TypeORM
async execute(): Promise<ServiceRequest[]> {
  const requests = await this.requestRepo.find({
    relations: ['client', 'repairer'], // ✅ 1 query con JOINs
  });

  return requests;
  // Total: 1 query con JOINs
}
```

---

### 10. Missing Index on Frequent Query

**Issue:**
```typescript
// ❌ src/modules/requests/infrastructure/orm/service-request.entity.ts
@Entity('service_requests', { schema: 'requests' })
export class ServiceRequestEntity {
  @Column()
  clientId: string; // ❌ Sin index, queries lentas

  @Column()
  status: RequestStatus; // ❌ Sin index
}

// Queries frecuentes:
// SELECT * FROM requests WHERE client_id = 'uuid' AND status = 'PENDING'
// Sin indexes = Full table scan 🐌
```

**Por qué es medio:**
- Queries lentas (>500ms)
- Escala mal
- DB bajo presión

**Solución:**
```typescript
// ✅ Add composite index
@Entity('service_requests', { schema: 'requests' })
@Index(['clientId', 'status']) // ✅ Composite index para query común
@Index(['repairerId', 'status']) // ✅ Otro patrón común
export class ServiceRequestEntity {
  @Column()
  clientId: string;

  @Column()
  status: RequestStatus;

  @Column({ nullable: true })
  repairerId: string;
}
```

---

### 11. Missing Pagination

**Issue:**
```typescript
// ❌ src/modules/requests/presentation/controllers/requests.controller.ts
@Get()
findAll() {
  return this.repo.find(); // ❌ Retorna TODOS los registros
}

// Problema: Con 10,000 requests retorna 10,000 registros
// Payload enorme, timeout, memory issues
```

**Solución:**
```typescript
// ✅ Add pagination DTO
export class PaginationDto {
  @ApiProperty({ example: 20, default: 20 })
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiProperty({ example: 0, default: 0 })
  @IsNumber()
  @Min(0)
  offset: number = 0;
}

// ✅ Use pagination
@Get()
findAll(@Query() pagination: PaginationDto) {
  return this.repo.findWithPagination(pagination);
}

// ✅ Repository
async findWithPagination(pagination: PaginationDto) {
  const [items, total] = await this.repo.findAndCount({
    take: pagination.limit,
    skip: pagination.offset,
  });

  return {
    items,
    total,
    limit: pagination.limit,
    offset: pagination.offset,
  };
}
```

---

## 🟢 BAJOS

### 12. Missing Swagger Documentation

**Issue:**
```typescript
// ❌ src/modules/requests/presentation/controllers/requests.controller.ts
@Controller('requests')
export class RequestsController {
  @Post()
  create(@Body() dto: CreateRequestDto) { // ❌ Sin docs
    return this.service.create(dto);
  }
}
```

**Solución:**
```typescript
// ✅ Add comprehensive Swagger docs
@ApiTags('Requests') // ✅ Agrupa endpoints
@Controller('requests')
export class RequestsController {

  @Post()
  @ApiOperation({ summary: 'Create a new service request' }) // ✅ Descripción
  @ApiResponse({
    status: 201,
    description: 'Request created successfully',
    type: ServiceRequestResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized'
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth() // ✅ Indica que requiere JWT
  create(@Body() dto: CreateRequestDto) {
    return this.service.create(dto);
  }
}
```

---

### 13. Poor Naming Convention

**Issue:**
```typescript
// ❌ Bad naming
const d = new Date(); // ❌ No descriptivo
const arr = await this.repo.find(); // ❌ Genérico
const f = (x: number) => x * 2; // ❌ Críptico

function process(data: any) { } // ❌ Muy vago
```

**Solución:**
```typescript
// ✅ Good naming
const currentDate = new Date();
const pendingRequests = await this.repo.findPending();
const multiplyByTwo = (value: number) => value * 2;

function calculateTotalPrice(items: CartItem[]): number { }
```

---

### 14. Magic Numbers

**Issue:**
```typescript
// ❌ Magic numbers
if (user.age >= 18) { } // ❌ ¿Por qué 18?
if (file.size > 5242880) { } // ❌ ¿Qué es 5242880?
setTimeout(() => {}, 86400000); // ❌ ¿Cuánto tiempo es?
```

**Solución:**
```typescript
// ✅ Named constants
const LEGAL_AGE = 18;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

if (user.age >= LEGAL_AGE) { }
if (file.size > MAX_FILE_SIZE_BYTES) { }
setTimeout(() => {}, ONE_DAY_MS);
```

---

### 15. Function Too Long

**Issue:**
```typescript
// ❌ Function de 150 líneas
async execute(dto: CreateRequestDto) {
  // Validate user
  const user = await this.userRepo.findById(dto.clientId);
  if (!user) throw new Error('...');
  if (!user.isActive) throw new Error('...');
  if (user.isBanned) throw new Error('...');

  // Validate category
  const category = await this.categoryRepo.findById(dto.categoryId);
  if (!category) throw new Error('...');
  if (!category.isActive) throw new Error('...');

  // Create request
  const request = new ServiceRequest(...);

  // Send notifications
  await this.emailService.send(...);
  await this.pushService.send(...);
  await this.smsService.send(...);

  // Update analytics
  await this.analyticsService.track(...);

  // ... 100 more lines
}
```

**Solución:**
```typescript
// ✅ Extract to smaller functions
async execute(dto: CreateRequestDto): Promise<ServiceRequest> {
  await this.validateUser(dto.clientId);
  await this.validateCategory(dto.categoryId);

  const request = await this.createRequest(dto);

  await this.sendNotifications(request);
  await this.trackAnalytics(request);

  return request;
}

private async validateUser(userId: string): Promise<void> {
  const user = await this.userRepo.findById(userId);
  if (!user) throw new UserNotFoundException(userId);
  if (!user.isActive) throw new InactiveUserException();
  if (user.isBanned) throw new BannedUserException();
}

private async validateCategory(categoryId: string): Promise<void> {
  const category = await this.categoryRepo.findById(categoryId);
  if (!category) throw new CategoryNotFoundException(categoryId);
  if (!category.isActive) throw new InactiveCategoryException();
}

// ... etc
```

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/Top10/)
- [Clean Code by Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [NestJS Best Practices](https://docs.nestjs.com/)
- Proyecto: docs/boundaries-and-dependencies.md
- Proyecto: docs/naming-conventions.md
- Proyecto: CLAUDE.md
