# 📋 Pendientes del Proyecto — Gap Analysis

> Última actualización: 2026-06-09
> Estado general: **producción-ready en funcionalidades core** — arquitectura por capas, tests 100%, seguridad básica, CI/CD y Docker implementados.

---

## 🏛️ Arquitectura actual

```
HTTP Request
    │
Express Router  ←  helmet (headers) + rate-limit (200 req/15 min)
    │
Controller      ←  valida entrada · llama service · formatea respuesta · sin any
    │
Service         ←  lógica de negocio · NotFoundError / ConflictError / ValidationError
    │
Prisma ORM      ←  transacciones atómicas · PostgreSQL
    │
PostgreSQL 16
```

**Frontend:**
```
React 19 + Vite
    │
React Query (TanStack) ← caché + deduplicación + loading/error declarativo
    │
Services (fetch)       ← abstractores de la API REST
    │
ErrorBoundary          ← captura errores de render en toda la app
```

---

## 🔄 Flujo de rutas del sistema

```
Frontend (:5173 dev / :80 prod)
    ├── /                      →  StockPage
    ├── /Stock                 →  StockPage
    ├── /HistorialMovimientos  →  MovementsHistoryPage
    ├── /RegistrarMovimientos  →  POST /api/v1/movements
    ├── /Transferir            →  POST /api/v1/movements/transfer        (SCRUM-23)
    ├── /Alertas               →  GET  /api/v1/alerts                    (SCRUM-26/27)
    │                              POST /api/v1/replenishment/replenishment
    │                              PATCH /api/v1/replenishment/replenishment/:id/status
    │                              GET/POST /api/v1/replenishment/suppliers
    ├── /RegistrarUbicaciones  →  POST /api/v1/locations
    ├── /Reservas              →  GET/POST /api/v1/reservations
    ├── /StockUbicaciones      →  GET /api/v1/stock/:locationId
    └── /Despacho              →  rutas logísticas (Proyecto 2)

Backend (:3000)
    ├── /api/v1/locations, /products, /stock, /movements, /movements/transfer
    ├── /api/v1/alerts, /replenishment/*
    ├── /api/v1/reservations, /release-reservation, /external/*
    ├── /api/v1/orders, /routes, /logistics
    └── /api-docs (Swagger UI)
```

---

## ✅ Mejoras implementadas — Sprint 3 + Refactoring

### Nuevas funcionalidades (Sprint 3)
| HdU | Implementación |
|-----|----------------|
| **SCRUM-23** | Transferencia atómica: `POST /api/v1/movements/transfer` + `TransferPage` |
| **SCRUM-26** | Alertas automáticas de stock crítico (`StockAlert`) en OUT/TRANSFER |
| **SCRUM-27** | Panel de reposición: alertas, órdenes de compra, proveedores |

### Mejoras de calidad de software
| Área | Implementación |
|------|----------------|
| **Arquitectura** | `alert.service.ts` + `replenishment.service.ts` extraídos de controllers |
| **Error hierarchy** | `NotFoundError`, `ValidationError`, `ConflictError`, `BusinessRuleError` |
| **Tipado estricto** | Eliminados todos los `any` en controllers y services |
| **Logger** | Winston: JSON en producción, coloreado en desarrollo, silencioso en tests |
| **Env validation** | Zod valida `DATABASE_URL` + vars al arranque desde `server.ts` |
| **Seguridad** | Helmet (security headers) + express-rate-limit (200 req / 15 min) |
| **ESLint backend** | Flat config con `@typescript-eslint`, reglas `no-explicit-any` y `no-console` |
| **TanStack Query** | `AlertsPage` y `TransferPage` migradas a `useQuery` / `useMutation` |
| **ErrorBoundary** | Captura errores de render en toda la app con UI de recuperación |
| **Accesibilidad** | `aria-label`, `aria-required`, `aria-busy`, `role`, `htmlFor` en formularios clave |
| **Tests** | 66 tests backend (100% cob.) + 24 frontend (100% cob.) — 90 tests totales |
| **Docker** | Dockerfile multi-stage backend + frontend (Nginx), `docker-compose.yml` completo |
| **CI/CD** | GitHub Actions: lint + tests + docker build en cada PR a main/develop |
| **Husky** | Pre-commit hook que corre `lint-staged` antes de cada commit |

---

## 📐 Decisiones de diseño vigentes

### Jerarquía de errores
```
Error
 └── AppError (isOperational: true)
      ├── NotFoundError   (404) — recurso no encontrado
      ├── ValidationError (400) — datos de entrada inválidos
      ├── ConflictError   (409) — estado final, duplicado
      └── BusinessRuleError (422) — regla de negocio violada
```

### Service Layer
- Controllers: reciben request → validan entrada (tipos) → llaman service → responden.
- Services: contienen toda la lógica de negocio y acceso a Prisma.
- No hay lógica de negocio en controllers.

### React Query
- `staleTime: 30s` — los datos se consideran frescos por 30 segundos.
- Mutaciones invalidan sus queries relacionadas con `invalidateQueries`.
- Errores de fetch se manejan con `onError` en cada mutación.

### Transferencias atómicas (SCRUM-23)
Una sola transacción Prisma: valida stock disponible (físico − reservado) → verifica capacidad destino → descuenta origen → suma destino → registra 2 movimientos TRANSFER → crea/resuelve alertas.

### Alertas automáticas (SCRUM-26)
Se crean al detectar `stock ≤ product.minStock` en OUT o TRANSFER. Se auto-resuelven cuando un IN supera el umbral. Sin duplicados: si ya hay alerta PENDING, no se crea otra.

### Reposición → RECEIVED (SCRUM-27)
Transacción atómica: incrementa stock → registra movimiento IN → actualiza orden → resuelve alertas PENDING si `stock > minStock`.

---

## ⚠️ Pendientes (no relacionados con API Design)

### Frontend
- [ ] Campos `dispatchStart` / `dispatchEnd` en `LocationForm`
- [ ] Migrar `StockPage`, `MovementsHistoryPage`, `ReservationsPage` a React Query
- [ ] Página detalle de ubicación

### Backend
- [ ] Campo `transportRestrictions` en Location (migración + endpoint)
- [ ] `SCRUM-59` — Trazabilidad de liberaciones: `ReservationLog` o `MovementType.RELEASE`
- [ ] Notificaciones por email (`nodemailer`) al generar alerta crítica

### Integraciones externas
- [ ] Migrar reservas a `POST /api/v1/external/reservations`
- [ ] `GET /api/v1/external/stock/:sku`
- [ ] TTL automático de reservas (`node-cron` → `EXPIRED` + liberación)
- [ ] API Keys / JWT para proyectos externos

### API Design (coordinación con otros grupos)
- [ ] Paginación en endpoints de listas (movements, orders, stock)
- [ ] Versionado formal de API (estrategia de deprecación v1 → v2)
- [ ] Idempotency keys para evitar doble submit
- [ ] HATEOAS mínimo en respuestas

---

## 🧪 Tests

### Backend — 66 tests, 100% cobertura

```bash
cd backend
npm run test             # rápido, sin cobertura
npm run test:coverage    # con reporte de cobertura
```

| Archivo | Tests | Stmts | Branch | Funcs | Lines |
|---------|-------|-------|--------|-------|-------|
| `movement.service.ts` | 22 | 100% | 100% | 100% | 100% |
| `alert.service.ts` | 4 | 100% | 100% | 100% | 100% |
| `replenishment.service.ts` | 11 | 100% | 100% | 100% | 100% |
| `alert.controller.ts` | 5 | 100% | 100% | 100% | 100% |
| `replenishment.controller.ts` | 19 | 100% | 100% | 100% | 100% |
| `errors.ts` | 5 | 100% | 100% | 100% | 100% |

**Estrategia de mocking:**
- Prisma mockeado con `mockDeep<PrismaClient>()` vía `moduleNameMapper` en Jest
- Controllers testeados mockeando sus services (`jest.mock('../../services/...')`)
- `$transaction` mockeado para ejecutar callbacks sin DB real
- `Date` controlada con `jest.useFakeTimers()` para validar horarios de despacho

### Frontend — 24 tests, 100% cobertura

```bash
cd frontend
pnpm test              # rápido
pnpm test:coverage     # con reporte
```

| Archivo | Tests |
|---------|-------|
| `alertService.ts` | 5 |
| `replenishmentService.ts` | 11 |
| `movementService.ts` | 8 |

**Estrategia:** `fetch` global mockeado con `vi.fn()` para simular respuestas ok y error de cada endpoint.

---

## 🐳 Docker

```bash
# Levantar todo el stack (postgres + backend + frontend)
docker compose up --build

# Solo base de datos (para desarrollo local del backend)
docker compose up postgres

# Ver logs
docker compose logs -f backend
```

Servicios:
- `postgres` — PostgreSQL 16 con healthcheck
- `backend` — Node.js 22 multi-stage, arranque tras healthcheck de postgres
- `frontend` — Nginx con SPA fallback + caché de assets

---

## 🔀 CI/CD

GitHub Actions ejecuta en cada push/PR a `main` o `develop`:
1. **Backend**: `npm run lint` + `npm run test:coverage`
2. **Frontend**: `pnpm lint` + `pnpm test:coverage`
3. **Docker**: build de imágenes de producción (verifica que compilan)

Artefactos de cobertura se guardan automáticamente en cada run.

---

## 🧰 Cómo probar localmente

```bash
# Con Docker (modo producción)
docker compose up --build
# → http://localhost (frontend) + http://localhost:3000 (API)

# Modo desarrollo
cd backend && npm run dev    # http://localhost:3000
cd frontend && pnpm dev      # http://localhost:5173
```

### Flujos clave
1. **Transferencia** (SCRUM-23): `/Transferir` → producto + origen + destino → confirmar
2. **Alerta** (SCRUM-26): Registrar OUT hasta bajar bajo `minStock` → ver alerta en `/Alertas`
3. **Reposición** (SCRUM-27): Desde alerta → "Reponer Stock" → proveedor + cantidad → "✓ Recibido" → stock sube + alerta resuelta
4. **Reservas** (SCRUM-20/33): `/Reservas` → Liberar (ACTIVE→RELEASED) o Confirmar entrega (ACTIVE→SOLD)
