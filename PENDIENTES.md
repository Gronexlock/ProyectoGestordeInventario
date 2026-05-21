# 📋 Pendientes del Proyecto — Gap Analysis

> Última actualización: 2026-05-21
> Estado general: **desarrollo intermedio-avanzado** — núcleo operativo + flujo de reservas (SCRUM-20 / SCRUM-33) implementado con mocks internos.

---

## 🔄 Flujo actual del sistema

```
Frontend (React + Vite, :5173)
    │
    ├── /RegistrarUbicaciones  →  POST /api/v1/locations
    ├── /RegistrarMovimientos  →  POST /api/v1/movements
    └── /Reservas              →  GET  /api/v1/reservations
                                 POST /api/v1/release-reservation
                                 PATCH /api/v1/external/reservations/:id/confirm-delivery
                                        │
Backend (Express + TypeScript, :3000)   │
    ├── /api/v1/locations
    ├── /api/v1/products
    ├── /api/v1/stock          (+ stockDisponible = quantity − reservado)
    ├── /api/v1/movements
    ├── /api/v1/reservations   (mock Proyecto 3 — crear/listar)
    ├── /api/v1/release-reservation  (SCRUM-20 — cancelar + liberar)
    └── /api/v1/external/reservations/:id/confirm-delivery  (SCRUM-33 — Proyecto 2)
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

---

## ✅ Lo implementado recientemente (SCRUM-20 / SCRUM-33)

| HdU / Tarea | Implementación |
|-------------|----------------|
| SCRUM-20 | Cancelación + liberación continua en un paso |
| SCRUM-57 | `cancelAndReleaseReservation()` en `reservation.service.ts` |
| SCRUM-58 | `stockDisponible` en `stock.service.ts` |
| SCRUM-59 | Trazabilidad por cambio de estado en `Reservation` *(ver deuda técnica)* |
| SCRUM-60 | `POST /api/v1/release-reservation` |
| SCRUM-61 | Página `/Reservas` con botón **Liberar** |
| SCRUM-33 | `PATCH /api/v1/external/reservations/:id/confirm-delivery` |

**Migración:** `20260521120000_add_reservation_status` — enum `ReservationStatus`, campos `releasedAt`/`soldAt`, `Movement.reservationId`.

---

## 📐 Decisiones de diseño acordadas

### 1. Cancelación + liberación en un solo paso
No hay estado intermedio `CANCELLED`. Al cancelar una compra, la reserva pasa directamente de `ACTIVE` → `RELEASED` y el stock disponible se restaura en la misma operación.

### 2. Historial de movimientos en liberaciones
- **Venta confirmada (SCRUM-33):** sí genera `Movement` tipo `OUT` con `reservationId`.
- **Liberación por cancelación:** por ahora solo cambio de estado en `Reservation` *(sin registro en `movements`)*.

> **🔮 Deuda técnica — SCRUM-59:** En el futuro conviene agregar trazabilidad de liberaciones mediante una de estas opciones:
> - Tabla `ReservationLog` para auditoría de cambios de estado, o
> - Nuevo valor `MovementType.RELEASE` / campo `relatedReservationId` en `Movement`.
> - Objetivo: historial unificado consultable desde el panel de movimientos.

### 3. POST vs PATCH — cuándo usar cada uno

| Verbo | Uso en este proyecto | Ejemplo |
|-------|---------------------|---------|
| **POST** | Crear recurso nuevo o **acción compuesta** que no es una simple edición de campos | `POST /release-reservation` (cancela + libera) |
| **PATCH** | **Actualización parcial** de un recurso existente identificado por ID | `PATCH /external/reservations/:id/confirm-delivery` (ACTIVE → SOLD) |

**Recomendación aplicada:** `POST` para liberación (acción de negocio compuesta) y `PATCH` para confirmación de entrega (transición de estado sobre una reserva concreta). Es semánticamente correcto según REST: PATCH modifica un recurso; POST ejecuta una operación o crea algo nuevo.

### 4. Modelo de stock con reservas
- Crear reserva → solo reduce `stockDisponible`.
- Confirmar entrega → descuenta `quantity` físico con movimiento `OUT`.
- Liberar reserva → restaura `stockDisponible` sin tocar `quantity`.

### 5. Integración Proyecto 3 (mock interno)
Por ahora la creación de reservas se simula con `POST /api/v1/reservations` desde el mismo backend/frontend.

> **🔮 Pendiente futuro — Proyecto 3 externo:**
> - Mover creación a `POST /api/v1/external/reservations` con autenticación (API Key / JWT).
> - Validar TTL (`expiresAt`) con job periódico (`node-cron`) → estado `EXPIRED` + liberación automática.
> - Endpoint `GET /api/v1/external/stock/:sku` con filtro por ubicación.
> - Rate limiting en rutas `/external/*`.

---

## ✅ Lo que ya estaba implementado (base)

### Backend — API operativa
- CRUD completo de ubicaciones
- Crear y listar productos
- Consulta de stock global y por ubicación **con `stockDisponible`**
- Registro de movimientos `IN`/`OUT` con historial
- Validación de stock negativo, alertas críticas, transacciones atómicas

### Frontend — UI básica
- Navegación: Inicio, Registrar Ubicaciones, Registrar Movimientos, **Reservas**
- Formularios de ubicaciones y movimientos

### Schema de base de datos
- Modelos: `Location`, `Product`, `Stock`, `Movement`, `Reservation`, `DispatchSchedule`
- Enum: `ReservationStatus` (`ACTIVE`, `RELEASED`, `SOLD`, `EXPIRED`)
- Enum: `Priority`, campos `dispatchStart`/`dispatchEnd` en `Location`

---

## ⚠️ Implementado parcialmente

| Elemento | Estado | Falta |
|----------|--------|-------|
| `Location.dispatchStart` / `dispatchEnd` | ✅ Schema | Exponer en API y formulario frontend |
| `DispatchSchedule` | ✅ Schema | Servicio, endpoints, relación con pedidos |
| Proyecto 3 externo | 🔶 Mock interno | API externa, TTL automático, seguridad |
| Proyecto 2 externo | 🔶 PATCH mock | API Key, webhook real de logística |
| Auditoría liberaciones | 🔶 Solo estado | Registro en `Movement` o `ReservationLog` |

> **Deuda técnica:** schema duplicado en `backend/src/prisma/schema.prisma` (desactualizado). Canónico: `backend/prisma/schema.prisma`.

---

## ❌ Pendientes por Requerimiento

---

### 1. 📍 Catálogo de Ubicaciones — ~55%

#### Backend
- [ ] Exponer `dispatchStart` y `dispatchEnd` en create/update de ubicaciones
- [ ] Campo `transportRestrictions` → nueva migración
- [ ] Tipos `"centro_distribucion"` y `"punto_atencion"`
- [ ] Endpoints `DispatchSchedule`

#### Frontend
- [ ] Campos horario y restricciones en formulario de ubicaciones
- [ ] Página detalle de ubicación con stock y reservas

---

### 2. 🔄 Movimientos y Transacciones — ~55%

#### Backend — Schema
- [ ] `MovementType.TRANSFER` y `RETURN`
- [ ] `destinationLocationId`, `relatedMovementId` en `Movement`

#### Backend — Lógica
- [ ] Transferencias entre ubicaciones
- [ ] Devoluciones vinculadas a salida original
- [ ] Validar reservas activas en salidas manuales `OUT`

#### Frontend
- [ ] Historial de movimientos con filtros
- [ ] Formulario TRANSFER y RETURN

---

### 3. 🔔 Reposiciones y Alertas — ~15%

Sin cambios. Ver sección anterior del documento para detalle completo (`minStock`, `Supplier`, `ReplenishmentOrder`, panel de alertas).

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
- [ ] TTL automático de reservas (`EXPIRED` + liberación)
- [ ] API Keys / JWT para proyectos externos
- [ ] Rate limiting en `/external/*`

---

## 🗃️ Resumen de Cambios al Schema de Prisma

| Cambio | Estado |
|--------|--------|
| `Location.dispatchStart` / `dispatchEnd` | ✅ Migrado |
| `Reservation` + `ReservationStatus` | ✅ Migrado + API |
| `Movement.reservationId` | ✅ Migrado |
| `DispatchSchedule` | ✅ Migrado (sin API) |
| `Priority` enum | ✅ Migrado |
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

1. **Proyecto 3 real** — externalizar reservas + TTL + API Key.
2. **Auditoría SCRUM-59** — `ReservationLog` o movimiento de liberación.
3. **Transferencias / devoluciones** — extender `MovementType`.
4. **Reposiciones** — `minStock` por producto + pedidos automáticos.
5. **Horarios de ubicación** — exponer `dispatchStart`/`dispatchEnd` en UI.

---

## 🧪 Cómo probar SCRUM-20 / SCRUM-33 localmente

```bash
# Backend
cd backend
npm install
# Configurar .env con DATABASE_URL
npx prisma migrate dev
npm run db:seed
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

1. Ir a http://localhost:5173/Reservas — ver reservas ACTIVE del seed.
2. **Liberar** → estado RELEASED, `stockDisponible` sube.
3. **Confirmar entrega** (mock P2) → estado SOLD, movimiento OUT, `quantity` baja.
4. Verificar stock: `GET http://localhost:3000/api/v1/stock`
