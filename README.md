# 📦 Sistema de Gestión de Inventario Distribuido

Sistema de gestión de inventario para controlar stock en múltiples ubicaciones (bodegas, tiendas, centros de distribución). Permite registrar movimientos, transferir productos, detectar stock crítico y gestionar órdenes de reposición con proveedores.

## 🏗️ Estructura del Proyecto

```
ProyectoAgilEscalado/
├── backend/    → API REST (Node.js · Express · TypeScript · Prisma · PostgreSQL)
├── frontend/   → Aplicación web (React · TypeScript · Vite)
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## ✨ Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| 📊 Stock | Reporte de niveles por ubicación con `stockDisponible`, filtros y búsqueda |
| 📋 Historial | Movimientos IN/OUT/TRANSFER con filtros por tipo, texto y fecha |
| ➕ Movimientos | Registro atómico de entradas y salidas |
| 🔄 Transferencias | Traspaso de stock entre ubicaciones (SCRUM-23) |
| 🔔 Alertas | Detección automática de stock crítico al cruzar `minStock` (SCRUM-26) |
| 📦 Reposición | Gestión de proveedores y órdenes de compra (SCRUM-27) |
| 📍 Ubicaciones | CRUD con validación de capacidad y horarios de despacho |
| 🔖 Reservas | Flujo ACTIVE → RELEASED / SOLD (SCRUM-20 / SCRUM-33) |
| 🚚 Despacho | Integración con rutas logísticas (Proyecto 2) |

## 🚀 Inicio Rápido

### Con Docker (recomendado)

```bash
# Clonar y arrancar todo el stack
git clone <repo>
cp backend/.env.example backend/.env   # ajusta DATABASE_URL si es necesario
docker compose up --build
```

- Frontend: http://localhost:80
- Backend API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api-docs

### Desarrollo local

```bash
# Backend
cd backend
npm install
cp .env.example .env       # configura DATABASE_URL
npm run db:generate        # genera cliente Prisma
npm run db:migrate         # aplica migraciones
npm run db:seed            # carga datos iniciales
npm run dev                # http://localhost:3000

# Frontend
cd frontend
pnpm install
pnpm run dev               # http://localhost:5173
```

## 🧪 Testing

### Backend (Jest · ts-jest · jest-mock-extended)

```bash
cd backend
npm run test               # 66 tests, 6 suites
npm run test:coverage      # cobertura 100% (statements · branches · funcs · lines)
```

| Suite | Tests | Archivos cubiertos |
|-------|-------|--------------------|
| Services | 37 | `movement.service.ts`, `alert.service.ts`, `replenishment.service.ts` |
| Controllers | 18 | `alert.controller.ts`, `replenishment.controller.ts` |
| Utils | 5 | `errors.ts` |
| Servicios de movimientos | 6 | `movement.service.ts` (extra) |

### Frontend (Vitest · jsdom)

```bash
cd frontend
pnpm test                  # 24 tests, 3 suites
pnpm test:coverage         # cobertura 100% (statements · branches · funcs · lines)
```

## 🏛️ Arquitectura

```
HTTP Request
    │
Express Router
    │
Controller          ← valida entrada, llama al servicio, formatea respuesta
    │
Service             ← lógica de negocio, validaciones de dominio
    │
Prisma ORM          ← acceso a datos con transacciones atómicas
    │
PostgreSQL
```

**Patrones aplicados:**
- **Service Layer**: lógica de negocio separada de los controllers
- **Error Hierarchy**: `AppError → NotFoundError | ValidationError | ConflictError | BusinessRuleError`
- **Dependency Injection**: Prisma como singleton inyectado vía módulo
- **React Query**: caché de servidor, deduplicación de requests, estado loading/error declarativo

## 🗂️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 22, Express, TypeScript, Prisma ORM |
| Seguridad | Helmet (headers), express-rate-limit (200 req/15 min) |
| Logger | Winston (consola coloreada en dev, JSON en prod) |
| Validación env | Zod (falla rápido si falta `DATABASE_URL`) |
| Base de datos | PostgreSQL 16 |
| Frontend | React 19, TypeScript, Vite, React Router DOM |
| Data fetching | TanStack Query (React Query v5) |
| Testing backend | Jest, ts-jest, jest-mock-extended |
| Testing frontend | Vitest, @testing-library/react, jsdom |
| Docs API | Swagger UI (`/api-docs`) |
| CI/CD | GitHub Actions (lint + tests + docker build) |
| Contenedores | Docker + docker-compose |
| Pre-commit | Husky + lint-staged |

## 📋 Pendientes y Decisiones

Consulta [PENDIENTES.md](./PENDIENTES.md) para el gap analysis completo, reglas de negocio, decisiones de diseño y próximos pasos.
