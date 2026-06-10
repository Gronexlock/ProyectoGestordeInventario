# 📦 Sistema de Gestión de Inventario Distribuido

Sistema de gestión de inventario para controlar stock en múltiples ubicaciones (bodegas, tiendas, centros de distribución). Permite registrar movimientos, transferir productos, detectar stock crítico y gestionar órdenes de reposición con proveedores.

## 🏗️ Estructura del Proyecto

```
ProyectoAgilEscalado/
├── backend/              → API REST (Node.js · Express · TypeScript · Prisma · PostgreSQL)
│   ├── prisma/           → schema + migraciones + seed
│   └── src/              → controllers · services · routes · middlewares
├── frontend/             → SPA React (TypeScript · Vite · TanStack Query)
│   └── src/              → pages · components · services · types
├── docker-compose.yml
├── README.md             → inicio rápido y guía de demo
├── PENDIENTES.md         → gap analysis y decisiones de diseño
├── COORDINACION_GRUPO3.md → contrato de integración con sistema de pedidos
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
| 🏆 Prioridad de ubicaciones | Campo `priority` (1–10) en Location; `GET /stock/suggest-source/:productId` ordena por prioridad (SCRUM-69) |
| ⚖️ Sincronización entre almacenes | Análisis de balance y transferencias automáticas (`GET/POST /sync`) (SCRUM-68) |
| 📋 Picking por lotes | Lista consolidada de picking agrupada por ubicación (`GET /picking`) (SCRUM-70) |
| 💳 Pedido Pagado | Endpoint externo autenticado con API Key (`POST /external/payment-confirmed`) (SCRUM-31) |

## 🚀 Inicio Rápido

### Con Docker

```bash
git clone <repo>
cd ProyectoAgilEscalado

# 1. Levantar solo PostgreSQL
docker compose up postgres -d

# 2. Preparar backend (.env apuntando al contenedor de Postgres)
cp backend/.env.example backend/.env
# Edita DATABASE_URL en backend/.env:
# postgresql://inventario:inventario123@localhost:5432/inventario_db

cd backend
npm install
npm run db:generate
npx prisma migrate deploy   # aplica migraciones sin modo interactivo
npm run db:seed             # datos de demo (obligatorio para la presentación)

# 3. Levantar backend + frontend
cd ..
docker compose up --build backend frontend
```

- Frontend: http://localhost
- Backend API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api-docs

> **Nota:** El contenedor de producción no ejecuta el seed automáticamente. Si la demo se ve vacía, vuelve a correr `npm run db:seed` desde `backend/` con la misma `DATABASE_URL`.

### Desarrollo local (recomendado para demo)

Hot-reload y el mismo flujo que usarás en la presentación:

```bash
# Terminal 1 — Base de datos
docker compose up postgres -d

# Terminal 2 — Backend
cd backend
npm install
cp .env.example .env
# DATABASE_URL="postgresql://inventario:inventario123@localhost:5432/inventario_db"
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev                # http://localhost:3000

# Terminal 3 — Frontend
cd frontend
pnpm install
pnpm dev                   # http://localhost:5173
```

## 🎬 Guía de Demo

Guion sugerido (~15 min) para presentar el sistema con datos realistas precargados.

### Pre-requisitos

| Herramienta | Versión mínima |
|-------------|----------------|
| Node.js | 22 |
| npm | incluido con Node |
| pnpm | última estable |
| Docker Desktop | para PostgreSQL |

Antes de empezar la presentación, verifica que todo responde:

1. Backend: http://localhost:3000/health → debe devolver `200 OK`
2. Frontend: http://localhost:5173 (dev) o http://localhost (Docker)
3. API con datos: http://localhost:3000/api/v1/stock → debe listar productos

Si algo falla, ejecuta de nuevo desde `backend/`:

```bash
npm run db:reset   # borra, migra y vuelve a cargar el seed
```

### Datos precargados (seed)

Al ejecutar `npm run db:seed` se crea un escenario listo para mostrar:

| Elemento | Detalle |
|----------|---------|
| Ubicaciones | **Bodega Central** (cap. 1000) y **Tienda Norte** (cap. 200) |
| Productos | Laptop Dell (`DELL-INS-15-001`, minStock 5) y Mouse Logitech (`LOG-MOUSE-WL-002`, minStock 10) |
| Stock | Laptops: 50 en bodega / 10 en tienda. Mouses: 150 en bodega / **3 en tienda** (bajo mínimo) |
| Reservas | 2 reservas **ACTIVE** (pedidos #1001 y #1002) |
| Alertas | 1 alerta **PENDING** por stock crítico del mouse en Tienda Norte |
| Reposición | 1 orden **PENDING** de 50 mouses con proveedor Importadora LogiGlobal |
| Proveedores | Distribuidora Tech S.A. e Importadora LogiGlobal |

### Paso a paso de la demo

#### 0. Arranque (antes de la audiencia)

```bash
docker compose up postgres -d
cd backend && npm run db:seed && npm run dev
# otra terminal:
cd frontend && pnpm dev
```

Abre el navegador en http://localhost:5173 y deja la pestaña en **Stock**.

#### 1. Vista general de inventario — `/Stock`

- Muestra `stockDisponible` (cantidad menos reservas activas).
- Filtra por producto o ubicación.
- **Mensaje clave:** el inventario está distribuido en varias ubicaciones y las reservas reducen el stock disponible.

#### 2. Stock por ubicación — `/StockUbicaciones`

> Ruta directa (no está en la barra de navegación).

- Compara niveles entre Bodega Central y Tienda Norte.
- Señala el mouse en Tienda Norte con stock bajo el `minStock`.

#### 3. Alertas y reposición — `/Alertas`

Pestaña **Alertas:**

- Aparece la alerta del mouse en Tienda Norte (3 uds. vs mínimo 10).
- Resuelve una alerta o crea una orden desde el modal.

Pestaña **Órdenes de reposición:**

- Muestra la orden PENDING de 50 mouses.
- Cambia el estado a **RECEIVED** → el stock se incrementa automáticamente y la alerta se resuelve.

Pestaña **Proveedores:**

- Lista los proveedores del seed; opcionalmente crea uno nuevo.

#### 4. Reservas — `/Reservas`

- Muestra las 2 reservas ACTIVE (pedidos #1001 y #1002).
- **Liberar:** devuelve stock al inventario (simula cancelación de pedido).
- **Confirmar entrega:** registra salida OUT y pasa la reserva a **SOLD**.

Vuelve a `/Stock` para mostrar cómo cambió el `stockDisponible`.

#### 5. Movimientos — `/RegistrarMovimientos` y `/HistorialMovimientos`

En **Registrar Movimiento:**

- Registra una **entrada (IN)** de 20 laptops en Bodega Central.

En **Historial:**

- Filtra por tipo IN/OUT/TRANSFER y por fecha.
- Muestra el movimiento recién creado.

#### 6. Transferencias — `/Transferir`

- Transfiere 5 laptops de Bodega Central → Tienda Norte.
- **Mensaje clave:** operación atómica (OUT en origen + IN en destino en una sola transacción).
- Si el origen baja del `minStock`, se genera alerta automática.

#### 7. Ubicaciones — `/RegistrarUbicaciones`

- Crea una ubicación nueva (ej. **Tienda Sur**, tipo tienda, prioridad 2, capacidad 150).
- Edita la prioridad de una ubicación existente (1 = alta, 10 = baja).

#### 8. Sincronización entre almacenes — `/Sincronizacion`

> Ruta directa.

- Pulsa **Analizar balance** → muestra ubicaciones en EXCESS / DEFICIT / OK.
- Ejecuta una transferencia sugerida para rebalancear stock.

#### 9. Picking por lotes — `/Picking`

> Ruta directa. Requiere órdenes en estado `READY_FOR_DISPATCH`.

- Selecciona órdenes y genera la lista agrupada por ubicación (ordenada por prioridad).
- Útil para mostrar optimización del recorrido físico en bodega.

#### 10. Despacho logístico — `/Despacho`

> Ruta directa. Integración con el Proyecto 2 (logística).

- Muestra rutas y órdenes listas para despacho (si hay datos en BD).

#### 11. API externa (opcional, vía Swagger)

Abre http://localhost:3000/api-docs

**Consultar fuente óptima (SCRUM-69):**

```http
GET /api/v1/stock/suggest-source/{productId}?quantity=5
```

**Pedido pagado desde sistema externo (SCRUM-31):**

Agrega en `backend/.env`:

```env
EXTERNAL_API_KEY=demo-clave-secreta
```

Reinicia el backend y prueba en Swagger:

```http
POST /api/v1/external/payment-confirmed
Header: X-Api-Key: demo-clave-secreta
Body: { "reservationId": 1 }
```

### Rutas del frontend

| Ruta | En navbar | Qué demostrar |
|------|-----------|---------------|
| `/Stock` | Sí | Resumen de inventario |
| `/HistorialMovimientos` | Sí | Trazabilidad |
| `/RegistrarMovimientos` | Sí | Entradas y salidas |
| `/Transferir` | Sí | Transferencias atómicas |
| `/Alertas` | Sí | Alertas + reposición + proveedores |
| `/RegistrarUbicaciones` | Sí | CRUD de ubicaciones |
| `/Reservas` | Sí | Ciclo de reservas |
| `/StockUbicaciones` | No | Stock desglosado por bodega/tienda |
| `/Sincronizacion` | No | Balance entre almacenes |
| `/Picking` | No | Picking consolidado |
| `/Despacho` | No | Rutas logísticas |

### Checklist rápido pre-demo

- [ ] PostgreSQL corriendo (`docker compose ps`)
- [ ] Seed ejecutado (`npm run db:seed`)
- [ ] Backend en http://localhost:3000
- [ ] Frontend abierto y cargando datos
- [ ] (Opcional) `EXTERNAL_API_KEY` configurada para demo de pago externo

### Problemas frecuentes en demo

| Síntoma | Solución |
|---------|----------|
| Pantallas vacías | `cd backend && npm run db:seed` |
| Error de conexión a BD | Verificar `DATABASE_URL` en `backend/.env` |
| CORS o fetch fallido | Backend debe estar en puerto 3000; frontend en 5173 |
| `/external/payment-confirmed` → 503 | Agregar `EXTERNAL_API_KEY` al `.env` y reiniciar |
| Picking sin órdenes | Confirmar reservas y avanzar órdenes a `READY_FOR_DISPATCH` |

Integración con Grupo 3 (Pedidos): [COORDINACION_GRUPO3.md](./COORDINACION_GRUPO3.md)

## 🧪 Testing

### Backend (Jest · ts-jest · jest-mock-extended)

```bash
cd backend
npm run test               # 101 tests, 10 suites
npm run test:coverage      # cobertura 100% (statements · branches · funcs · lines)
```

| Suite | Tests | Archivos cubiertos |
|-------|-------|--------------------|
| Services | 41 | `movement.service.ts`, `alert.service.ts` (+ syncCriticalAlerts), `replenishment.service.ts` |
| Controllers | 18 | `alert.controller.ts`, `replenishment.controller.ts` |
| Utils | 5 | `errors.ts` |
| Location | 12 | `location.service.ts` (priority CRUD + suggestSource) |
| Sync | 6 | `sync.service.ts` (balance + transfer) |
| Picking | 8 | `picking.service.ts` (batch pick list) |
| Payment | 4 | `reservation.service.ts::processPaymentConfirmed` |
| Alert sync | 4 | `alert.service.ts::syncCriticalAlerts` |

### Frontend (Vitest · jsdom)

```bash
cd frontend
pnpm test                  # 56 tests, 8 suites
pnpm test:coverage         # cobertura 100% (statements · branches · funcs · lines)
```

| Suite | Archivos cubiertos |
|-------|--------------------|
| Services | `alertService`, `movementService`, `replenishmentService`, `syncService`, `pickingService`, `stockService`, `reservationService` |
| Utils | `disableNumberInputWheel` |

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
- **Priority-based routing**: campo `priority` en Location (1=alta, 10=baja) para ordenar despacho y sugerencias de fuente
- **Batch aggregation**: picking service agrupa ítems multi-orden por ubicación para optimizar el recorrido físico
- **External API auth**: middleware `validateApiKey` protege endpoints de integración con header `X-Api-Key`

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
