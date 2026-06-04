# 📋 Pendientes del Proyecto — Gap Analysis

> Última actualización: 2026-06-03
> Estado general: **desarrollo intermedio-avanzado** — núcleo operativo + flujo de reservas (SCRUM-20 / SCRUM-33) implementado con mocks internos.

> ✅ **Control básico cumplido al 100%** — stock por ubicación, movimientos manuales, reporte de niveles y historial con filtros ya operativos.

---

## 🔄 Flujo actual del sistema

```
Frontend (React + Vite, :5173)
    │
    ├── /               →  StockPage (reporte de niveles, filtros, tarjetas resumen)
    ├── /Stock           →  StockPage
    ├── /HistorialMovimientos  →  MovementsHistoryPage (filtros tipo/texto/fecha)
    ├── /RegistrarMovimientos  →  POST /api/v1/movements
    ├── /RegistrarUbicaciones  →  POST /api/v1/locations
    └── /Reservas              →  GET  /api/v1/reservations
                                 POST /api/v1/reservations       (mock crear reserva P3)
                                 POST /api/v1/release-reservation
                                 PATCH /api/v1/external/reservations/:id/confirm-delivery
                                        │
Backend (Express + TypeScript, :3000)   │
    ├── GET  /                           (health check + docs)
    ├── GET  /health
    ├── /api/v1/locations                (CRUD completo: POST, GET, GET/:id, PUT/:id, DELETE/:id)
    ├── /api/v1/products                 (crear + listar)
    ├── /api/v1/stock                    (consulta global y por ubicación, incluye stockDisponible)
    ├── /api/v1/stock/:locationId        (stock filtrado por ubicación)
    ├── /api/v1/movements                (registro IN/OUT + historial completo con product+location)
    ├── /api/v1/reservations             (mock Proyecto 3 — crear/listar con filtro por status)
    ├── /api/v1/release-reservation      (SCRUM-20 — ACTIVE → RELEASED)
    └── /api/v1/external/reservations/:id/confirm-delivery  (SCRUM-33 — ACTIVE → SOLD)
                                        │
Prisma ORM  →  PostgreSQL
```

**Reglas de negocio activas hoy:**
- Stock no puede quedar negativo en salidas (`OUT`).
- **Reservas ACTIVE reducen `stockDisponible` pero no `quantity` físico** hasta confirmar venta.
- **Cancelación + liberación en un paso:** `ACTIVE → RELEASED` vía `POST /release-reservation`.
- **Entrega confirmada (SCRUM-33):** `ACTIVE → SOLD` + movimiento `OUT` + descuento de `quantity`.
- Movimientos y actualización de stock ocurren en transacción atómica.
- Alerta de stock crítico con umbral global (`criticalStockThreshold = 5`).
- Validación de capacidad de ubicación en frontend al registrar entradas (`IN`).
- `dispatchStart` y `dispatchEnd` en schema con defaults `"8:00"`/`"18:00"` — **no expuestos en API ni UI**.

---

## ✅ Lo implementado recientemente (SCRUM-20 / SCRUM-33)

| HdU / Tarea | Implementación |
|-------------|----------------|
| SCRUM-20 | Cancelación + liberación continua en un paso |
| SCRUM-57 | `cancelAndReleaseReservation()` en `reservation.service.ts` |
| SCRUM-58 | `stockDisponible` en `stock.service.ts` |
| SCRUM-59 | Trazabilidad por cambio de estado en `Reservation` *(ver deuda técnica)* |
| SCRUM-60 | `POST /api/v1/release-reservation` |
| SCRUM-61 | Página `/Reservas` con botones **Liberar** y **Confirmar entrega** |
| SCRUM-33 | `PATCH /api/v1/external/reservations/:id/confirm-delivery` |

**Migración:** `20260521120000_add_reservation_status` — enum `ReservationStatus`, campos `releasedAt`/`soldAt`, `Movement.reservationId`.

---

## 📐 Decisiones de diseño acordadas

### 1. Cancelación + liberación en un solo paso
No hay estado intermedio `CANCELLED`. Al cancelar una compra, la reserva pasa directamente de `ACTIVE → RELEASED` y el stock disponible se restaura en la misma operación.

### 2. Historial de movimientos en liberaciones
- **Venta confirmada (SCRUM-33):** sí genera `Movement` tipo `OUT` con `reservationId`.
- **Liberación por cancelación:** por ahora solo cambio de estado en `Reservation` *(sin registro en `movements`)*.

> **🔮 Deuda técnica — SCRUM-59:** En el futuro conviene agregar trazabilidad de liberaciones mediante una de estas opciones:
> - Tabla `ReservationLog` para auditoría de cambios de estado, o
> - Nuevo valor `MovementType.RELEASE` / campo `relatedReservationId` en `Movement`.
> - Objetivo: historial unificado consultable desde el panel de movimientos.

### 3. POST vs PATCH — cuándo usar cada uno

| Verbo | Uso en este proyecto | Ejemplo |
|-------|---------------------|---------||
| **POST** | Crear recurso nuevo o **acción compuesta** que no es una simple edición de campos | `POST /release-reservation` (cancela + libera) |
| **PATCH** | **Actualización parcial** de un recurso existente identificado por ID | `PATCH /external/reservations/:id/confirm-delivery` (ACTIVE → SOLD) |

**Recomendación aplicada:** `POST` para liberación (acción de negocio compuesta) y `PATCH` para confirmación de entrega (transición de estado sobre una reserva concreta). Es semánticamente correcto según REST: PATCH modifica un recurso; POST ejecuta una operación o crea algo nuevo.

### 4. Modelo de stock con reservas
- Crear reserva → solo reduce `stockDisponible`.
- Confirmar entrega → descuenta `quantity` físico con movimiento `OUT`.
- Liberar reserva → restaura `stockDisponible` sin tocar `quantity`.

### 5. Integración Proyecto 3 (mock interno)
Por ahora la creación de reservas se simula con `POST /api/v1/reservations` desde el mismo backend/frontend. El endpoint acepta `orderId`, `sku`, `locationId`, `quantity` y `expiresAt` (opcional, default 24 h).

> **🔮 Pendiente futuro — Proyecto 3 externo:**
> - Mover creación a `POST /api/v1/external/reservations` con autenticación (API Key / JWT).
> - Validar TTL (`expiresAt`) con job periódico (`node-cron`) → estado `EXPIRED` + liberación automática.
> - Endpoint `GET /api/v1/external/stock/:sku` con filtro por ubicación.
> - Rate limiting en rutas `/external/*`.

---

## ✅ Lo que ya estaba implementado (base)

### Backend — API operativa
- CRUD completo de ubicaciones (POST, GET, GET/:id, PUT/:id, DELETE/:id)
  - Validación: nombres únicos, tipos permitidos (`bodega`, `tienda`, `almacen`, `deposito`, `otro`), capacidad opcional
  - Protección: no se puede eliminar ubicación con stock asociado
- Crear y listar productos
- Consulta de stock global y por ubicación **con `stockDisponible`**
- Registro de movimientos `IN`/`OUT` con historial (incluye `product` y `location` en respuesta)
- Validación de stock negativo, alertas críticas (`≤ 5`), transacciones atómicas
- Middlewares: `errorHandler`, `validateRequest` (express-validator), CORS, morgan

### Frontend — UI operativa
- Navegación: navbar oscura con `NavLink` activo — **Stock** (inicio), **Historial**, Registrar Movimiento, Ubicaciones, **Reservas**
- `StockPage`: reporte de niveles de stock con tarjetas resumen (registros, uds. físicas, reservadas, crítico, sin stock), tabla con barra de progreso y badge Crítico/Bajo/Normal, filtros por ubicación y búsqueda por nombre/SKU
- `MovementsHistoryPage`: historial completo de movimientos con tarjetas (total, entradas, salidas, balance neto), filtros por tipo, búsqueda de texto y rango de fechas
- `LocationForm`: crea ubicaciones con nombre, tipo, capacidad
- `MovementForm`: selecciona producto, ubicación, tipo (IN/OUT), cantidad, nota. Valida capacidad en frontend para entradas.
- `ReservationsPage`: lista todas las reservas con badge de estado; botones **Liberar** y **Confirmar entrega** solo en ACTIVE
- Servicios frontend: `locationService`, `movementService`, `productService`, `reservationService`, **`stockService`**

### Schema de base de datos
- Modelos: `Location`, `Product`, `Stock`, `Movement`, `Reservation`, `DispatchSchedule`
- Enum: `ReservationStatus` (`ACTIVE`, `RELEASED`, `SOLD`, `EXPIRED`)
- Enum: `Priority` (`LOW`, `NORMAL`, `HIGH`, `CRITICAL`) — declarado pero no usado en modelos activos
- `Location`: `dispatchStart` / `dispatchEnd` (default `"8:00"` / `"18:00"`)
- `Movement.reservationId`: vincula venta confirmada con su reserva

---

## ⚠️ Implementado parcialmente

| Elemento | Estado | Falta |
|----------|--------|-------|
| `Location.dispatchStart` / `dispatchEnd` | ✅ Schema + defaults | Exponer en API (`createLocation`, `updateLocation`) y formulario frontend |
| `DispatchSchedule` | ✅ Schema | Servicio, endpoints y relación con pedidos |
| `Priority` enum | ✅ Declarado | No está relacionado a ningún modelo activo |
| Proyecto 3 externo | 🔶 Mock interno (`POST /api/v1/reservations`) | API externa, TTL automático, seguridad |
| Proyecto 2 externo | 🔶 PATCH mock | API Key, webhook real de logística |
| Auditoría liberaciones | 🔶 Solo cambio de estado | Registro en `Movement` o tabla `ReservationLog` |
| Historial de movimientos (frontend) | ✅ Implementado | `MovementsHistoryPage` con filtros por tipo, búsqueda y fechas |
| Tipos de ubicación | 🔶 Texto libre (`bodega`, `tienda`…) | Considerar enum `centro_distribucion`, `punto_atencion` según reqs |

> **Deuda técnica:** existe `backend/src/prisma/schema.prisma` (schema desactualizado / duplicado). El canónico es `backend/prisma/schema.prisma`.

---

## ❌ Pendientes por Requerimiento

---

### 1. 📍 Catálogo de Ubicaciones — ~55%

#### Backend
- [ ] Exponer `dispatchStart` y `dispatchEnd` en create/update de ubicaciones (ya en schema, falta en DTO y rutas)
- [ ] Campo `transportRestrictions` → nueva migración
- [ ] Tipos `"centro_distribucion"` y `"punto_atencion"` (o enum Prisma)
- [ ] Endpoints `DispatchSchedule` (CRUD)

#### Frontend
- [ ] Campos horario (`dispatchStart`/`dispatchEnd`) y restricciones en `LocationForm`
- [ ] Página detalle de ubicación con stock y reservas asociadas

---

### 2. 🔄 Movimientos y Transacciones — ~65%

#### Backend — Schema
- [ ] `MovementType.TRANSFER` y `RETURN`
- [ ] `destinationLocationId`, `relatedMovementId` en modelo `Movement`

#### Backend — Lógica
- [ ] Servicio y endpoint de transferencias entre ubicaciones (descuenta origen, suma destino, atómico)
- [ ] Devoluciones vinculadas a salida original (`relatedMovementId`)
- [ ] Validar reservas activas antes de salidas manuales `OUT` (hoy solo valida stock físico)

#### Frontend
- [x] Página de historial de movimientos con filtros por tipo, búsqueda de texto y rango de fechas (`MovementsHistoryPage`)
- [ ] Formulario para `TRANSFER` y `RETURN`

---

### 3. 🔔 Reposiciones y Alertas — ~10%

#### Backend — Schema
- [ ] `Product.minStock` (umbral mínimo por producto)
- [ ] Modelo `Supplier` (proveedor)
- [ ] Modelo `ReplenishmentOrder` (pedido de reposición)

#### Backend — Lógica
- [ ] Servicio de reposición: detectar stock ≤ `minStock` y crear `ReplenishmentOrder`
- [ ] Job periódico (`node-cron`) para revisión de umbrales
- [ ] Notificación por email (`nodemailer`) al superar umbral crítico
- [ ] Endpoints CRUD de `ReplenishmentOrder`

#### Frontend
- [ ] Panel de alertas de stock crítico
- [ ] Vista de pedidos de reposición

---

### 4. 🔌 Integraciones Externas — ~35%

#### Implementado (mock)
- [x] `POST /api/v1/reservations` — crear reserva (mock P3)
- [x] `POST /api/v1/release-reservation` — liberar (SCRUM-20)
- [x] `PATCH /api/v1/external/reservations/:id/confirm-delivery` — vender (SCRUM-33)
- [x] `stockDisponible` en consultas de stock

#### Pendiente
- [ ] Migrar creación de reservas a `POST /api/v1/external/reservations`
- [ ] `GET /api/v1/external/stock/:sku` con filtro por ubicación
- [ ] TTL automático de reservas (`node-cron` → `EXPIRED` + liberación)
- [ ] API Keys / JWT para proyectos externos
- [ ] Rate limiting en `/external/*`
- [ ] Webhook o callback real desde Proyecto 2 (logística) para confirmar entregas

---

## 🗃️ Resumen de Cambios al Schema de Prisma

| Cambio | Estado |
|--------|--------|
| `Location.dispatchStart` / `dispatchEnd` | ✅ Migrado (sin exponer en API) |
| `Reservation` + `ReservationStatus` | ✅ Migrado + API |
| `Movement.reservationId` | ✅ Migrado |
| `DispatchSchedule` | ✅ Migrado (sin API) |
| `Priority` enum | ✅ Declarado (no vinculado) |
| `ReservationLog` o `MovementType.RELEASE` | ❌ Futuro (SCRUM-59) |
| `Location.transportRestrictions` | ❌ Pendiente |
| `MovementType.TRANSFER` / `RETURN` | ❌ Pendiente |
| `Product.minStock`, `Supplier`, `ReplenishmentOrder` | ❌ Pendiente |

> ⚠️ Ejecutar `npx prisma migrate dev` desde `backend/` tras clonar o actualizar schema.

---

## 📦 Dependencias Externas a Instalar (estimado)

| Librería | Para qué |
|----------|----------|
| `nodemailer` + `@types/nodemailer` | Alertas de reposición por email |
| `node-cron` | TTL de reservas + revisión de umbrales de stock |

---

## 🎯 Próximos pasos sugeridos

> ✅ **Control básico completado** — reporte de stock (`StockPage`) e historial de movimientos (`MovementsHistoryPage`) ya implementados.

1. **Horarios de ubicación** — exponer `dispatchStart`/`dispatchEnd` en API y `LocationForm` (cambio pequeño, alto impacto).
2. **Auditoría SCRUM-59** — `ReservationLog` o movimiento de liberación.
3. **Transferencias / devoluciones** — extender `MovementType` + lógica atómica + formulario frontend.
4. **Reposiciones** — `minStock` por producto + pedidos automáticos.
5. **Proyecto 3 real** — externalizar reservas + TTL + API Key.

---

## 🧪 Cómo probar SCRUM-20 / SCRUM-33 localmente

```bash
# Backend
cd backend
npm install        # o pnpm install
# Configurar .env con DATABASE_URL
npx prisma migrate dev
npm run db:seed
npm run dev

# Frontend
cd frontend
npm install        # o pnpm install
npm run dev
```

1. Ir a http://localhost:5173/Reservas — ver reservas ACTIVE del seed.
2. **Liberar** → estado RELEASED, `stockDisponible` sube.
3. **Confirmar entrega** (mock P2) → estado SOLD, movimiento OUT, `quantity` baja.
4. Verificar stock: `GET http://localhost:3000/api/v1/stock`