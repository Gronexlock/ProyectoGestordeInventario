# Revisión Exhaustiva del Proyecto: Sistema de Gestión de Inventario Distribuido

> Revisado como: Arquitecto Senior de Software · Ingeniero Principal · Auditor de Seguridad · Ingeniero DevOps · Ingeniero QA
> Fecha de revisión: 2026-06-11
> Stack: Node.js 22 · Express · TypeScript · Prisma ORM · PostgreSQL 16 · React 19 · Vite

---

## Executive Summary

El proyecto es un **Sistema de Gestión de Inventario Distribuido** construido con una arquitectura de tres capas (Frontend SPA → Backend REST API → PostgreSQL). El stack técnico es moderno, la estructura de carpetas es clara y el código tiene buena legibilidad. Sin embargo, el proyecto presenta **dos vulnerabilidades de seguridad críticas que lo hacen inapropiado para producción en su estado actual**, junto con un conjunto de problemas de alta gravedad que incluyen un bug de timezone que invalida la lógica de ventanas horarias de despacho en entornos Docker, cobertura de tests real del 60% (no 100% como afirma el README), y ausencia total de autenticación en los endpoints internos. El sistema también tiene deuda técnica significativa en forma de duplicación de código, validaciones incompletas a nivel de base de datos, y ausencia de paginación que representa un riesgo directo ante crecimiento de datos.

**Veredicto previo:** No apto para producción sin corregir los hallazgos Críticos y de Alta gravedad.

---

## Top Critical Findings

| # | Gravedad | Área | Descripción resumida |
|---|----------|------|----------------------|
| F-01 | **CRÍTICO** | Seguridad | `PATCH /external/reservations/:id/confirm-delivery` sin autenticación |
| F-02 | **CRÍTICO** | Seguridad | Cero autenticación/autorización en todos los endpoints internos |
| F-03 | **ALTA** | Lógica / Bug | Inconsistencia de timezone invalida validaciones de horario de despacho |
| F-04 | **ALTA** | Concurrencia | Race condition en límite diario de despacho (TOCTOU fuera de transacción) |
| F-05 | **ALTA** | Testing | Cobertura real ≈ 60%; tres servicios críticos sin tests unitarios |
| F-06 | **ALTA** | Datos | Campo `reserved` puede volverse negativo; sin restricción en DB |
| F-07 | **ALTA** | Rendimiento | Todos los endpoints de listado sin paginación |

---

## Detailed Findings

---

### F-01 — Endpoint de confirmación de entrega sin autenticación

- **Categoría:** Seguridad
- **Gravedad:** CRÍTICO
- **Ubicación:** `backend/src/routes/external.routes.ts` (líneas 30–35)
- **Descripción:** El endpoint `PATCH /api/v1/external/reservations/:id/confirm-delivery` carece del middleware `validateApiKey`. Cualquier cliente anónimo puede confirmar una entrega, lo que desencadena la reducción del stock físico (columna `quantity`) y la creación de un movimiento `OUT` en la base de datos.
- **Por qué importa:** Un atacante puede vaciar el inventario físico de cualquier producto simplemente llamando a este endpoint con IDs de reservas activas, sin necesidad de credenciales. El daño no es solo de datos: genera movimientos contables permanentes que requieren reconciliación manual.
- **Evidencia del código:**
  ```typescript
  // external.routes.ts — líneas 30-35
  router.patch(
    "/reservations/:id/confirm-delivery",
    confirmDeliveryRules,
    validateRequest,
    reservationController.confirmDelivery  // ← SIN validateApiKey
  );

  // Contraste: payment-confirmed SÍ lo tiene
  router.post(
    "/payment-confirmed",
    validateApiKey,  // ← presente aquí pero no arriba
    paymentConfirmedRules,
    validateRequest,
    reservationController.paymentConfirmed
  );
  ```
- **Escenario de ataque:** `curl -X PATCH http://api/api/v1/external/reservations/1/confirm-delivery` reduce stock físico sin autenticación.
- **Corrección:** Agregar `validateApiKey` antes de `confirmDeliveryRules`:
  ```typescript
  router.patch(
    "/reservations/:id/confirm-delivery",
    validateApiKey,   // ← agregar
    confirmDeliveryRules,
    validateRequest,
    reservationController.confirmDelivery
  );
  ```

---

### F-02 — Sin autenticación ni autorización en endpoints internos

- **Categoría:** Seguridad
- **Gravedad:** CRÍTICO
- **Ubicación:** `backend/src/app.ts` y todos los archivos `*.routes.ts`
- **Descripción:** Ningún endpoint interno requiere autenticación. Cualquiera que alcance el servidor puede crear pedidos, registrar movimientos de stock, crear proveedores, transferir inventario entre ubicaciones, cancelar rutas de despacho, leer todo el inventario y alterar estados de órdenes.
- **Por qué importa:** En un sistema de inventario de producción esto representa exposición total del negocio. Un actor malicioso puede crear movimientos OUT masivos, cancelar todas las rutas activas, o leer datos sensibles (nombres de clientes, proveedores, niveles de stock) sin restricción.
- **Escenario de ataque:** Desde la LAN corporativa (o si el puerto 3000 está accesible públicamente): `POST /api/v1/movements` con `{ type: "OUT", quantity: 9999 }` para agotar stock. `DELETE /api/v1/routes/:id` para cancelar rutas en tránsito.
- **Corrección:** Implementar autenticación JWT o sesión para todos los endpoints internos. Como mínimo, implementar un middleware de API key global para las operaciones de escritura, similar al ya existente `validateApiKey`.

---

### F-03 — Bug de timezone: validación de horario de despacho usa tiempo UTC en Docker

- **Categoría:** Lógica de negocio / Bug
- **Gravedad:** ALTA
- **Ubicación:** `backend/src/services/movement.service.ts` (líneas 38–57 y 207–221), `backend/src/services/reservation.service.ts` (líneas 88–104)
- **Descripción:** `movement.service.ts` y `reservation.service.ts` usan `new Date().getHours()` para validar las ventanas de despacho. Este método devuelve la hora en el timezone del proceso Node.js. En el contenedor Docker (`docker-compose.yml`, sin `TZ` configurado), el timezone es UTC. Las ventanas horarias almacenadas (`dispatchStart: "8:00"`, `dispatchEnd: "18:00"`) representan horario chileno (UTC-4). La diferencia es de 4 horas, lo que invalida completamente la validación en producción Docker.
- **Por qué importa:** Todos los intentos de movimiento y reserva entre las 00:00–03:59 UTC (20:00–23:59 Santiago) serían rechazados, y operaciones fuera del horario real (ej. 07:00 UTC = 03:00 Santiago) serían aceptadas.
- **Contraste:** `order.service.ts` implementa correctamente la misma lógica usando `Intl.DateTimeFormat` con `config.appTimezone`. Los tres archivos deberían usar el mismo método.
- **Evidencia del código:**
  ```typescript
  // movement.service.ts — línea 39 (INCORRECTO)
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes(); // UTC en Docker

  // order.service.ts — (CORRECTO)
  const getCurrentMinutesInTimezone = (timezone: string): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,  // usa config.appTimezone ("America/Santiago")
      ...
    }).formatToParts(new Date());
    ...
  };
  ```
- **Corrección:** Extraer `getCurrentMinutesInTimezone` a un utility compartido y usarlo en los tres servicios, pasando `config.appTimezone`.

---

### F-04 — Race condition: límite diario de despacho fuera de transacción (TOCTOU)

- **Categoría:** Concurrencia / Seguridad de datos
- **Gravedad:** ALTA
- **Ubicación:** `backend/src/services/reservation.service.ts` (líneas 106–129)
- **Descripción:** La verificación del `maxDailyDispatch` se ejecuta fuera de la transacción Serializable. Bajo carga concurrente, dos solicitudes de reserva simultáneas para la misma ubicación pueden pasar ambas la verificación del límite diario (ambas leen el mismo `currentDailyTotal`) antes de que cualquiera escriba su reserva.
- **Por qué importa:** Permite superar el límite operacional de despacho diario, lo que puede causar incumplimiento de SLAs logísticos y sobrecargar la capacidad de procesamiento físico de una sede.
- **Evidencia del código:**
  ```typescript
  // reservation.service.ts — líneas 113-129 (FUERA de la transacción)
  const todayReservations = await prisma.reservation.aggregate({ ... });
  const currentDailyTotal = todayReservations._sum.quantity || 0;

  if (currentDailyTotal + dto.quantity > location.maxDailyDispatch) {
    throw new AppError(...);  // Esta verificación puede ser stale bajo concurrencia
  }

  // === 3. La transacción Serializable empieza AQUÍ (demasiado tarde) ===
  const reservation = await prisma.$transaction(async (tx) => {
    ...
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  ```
- **Corrección:** Mover toda la lógica de verificación (incluyendo `maxDailyDispatch`) dentro de la transacción Serializable.

---

### F-05 — Cobertura de tests real ≈ 60%; README afirma 100%

- **Categoría:** Testing / Documentación
- **Gravedad:** ALTA
- **Ubicación:** `backend/jest.config.js` (líneas 26–36), README
- **Descripción:** El `jest.config.js` tiene un umbral de cobertura del 60%, con un comentario explícito que admite que `reservation.service.ts`, `order.service.ts` y `stock.service.ts` "aún no tienen tests unitarios". Estos son tres de los servicios más críticos del sistema (manejo de reservas, máquina de estados de pedidos, y operaciones de stock). El README afirma incorrectamente "100% test coverage".
- **Por qué importa:** La máquina de estados de pedidos (`order.service.ts`), las reservas con aislamiento Serializable (`reservation.service.ts`), y las operaciones atómicas de stock (`stock.service.ts`) son el núcleo financiero del sistema. Sin tests exhaustivos de estas rutas, cualquier refactor puede introducir regresiones silenciosas.
- **Evidencia del código:**
  ```javascript
  // jest.config.js — líneas 28-36
  coverageThreshold: {
    global: {
      // Umbral reducido temporalmente al incorporar reservation.service.ts,
      // order.service.ts y stock.service.ts que aún no tienen tests unitarios.
      branches: 60,  // ← no es 100%
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  ```
- **Corrección:** Escribir tests unitarios para los tres servicios faltantes y restaurar el umbral al 90%+ antes de producción. Corregir el README.

---

### F-06 — Campo `reserved` en Stock puede volverse negativo

- **Categoría:** Integridad de datos
- **Gravedad:** ALTA
- **Ubicación:** `backend/src/services/stock.service.ts` (líneas 106–121), `backend/prisma/schema.prisma` (línea 70)
- **Descripción:** La función `releaseStock` decrementa `reserved` incondicionalmente sin verificar que el valor sea ≥ la cantidad a liberar. La base de datos no tiene una restricción `CHECK (reserved >= 0)`. Una doble cancelación de la misma orden, o un bug en la lógica de transición de estados, puede producir un `reserved` negativo, lo que hace que `stockDisponible = quantity - reserved` sea mayor que la cantidad física real.
- **Por qué importa:** Permite comprometer más stock del disponible, causando underselling físico (se vende lo que no existe).
- **Evidencia del código:**
  ```typescript
  // stock.service.ts — líneas 109-121
  export const releaseStock = async (tx: TxClient, items: StockItem[]): Promise<void> => {
    for (const item of items) {
      await tx.stock.update({
        ...
        data: { reserved: { decrement: item.quantity } }, // ← sin verificar que reserved >= quantity
      });
    }
  };
  ```
- **Corrección:**
  1. Agregar `CHECK (reserved >= 0)` en PostgreSQL via migración.
  2. En `releaseStock`, verificar que `stock.reserved >= item.quantity` antes de decrementar.

---

### F-07 — Sin paginación en endpoints de listado

- **Categoría:** Rendimiento / Escalabilidad
- **Gravedad:** ALTA
- **Ubicación:** `movement.service.ts` línea 373, `order.service.ts` línea 127, `stock.service.ts` línea 163, `reservation.service.ts` línea 189
- **Descripción:** Todos los endpoints `GET` de listado retornan todos los registros sin límite: `GET /movements`, `GET /orders`, `GET /stock`, `GET /reservations`, `GET /alerts`, `GET /replenishment/replenishment`. Un sistema con 12 meses de operación puede acumular cientos de miles de movimientos.
- **Por qué importa:** Una sola petición puede hacer que el backend lea toda la tabla `movements`, serialice miles de objetos JSON y sature la memoria del proceso Node.js. También expone toda la historia del inventario en una sola respuesta.
- **Corrección:** Implementar paginación `cursor`-based o `offset`-based con parámetros `limit` y `cursor`/`page`. Recomendado: cursor-based para `movements` (tabla de append-only).

---

### F-08 — Comparación de API Key no resistente a timing attacks

- **Categoría:** Seguridad
- **Gravedad:** MEDIA
- **Ubicación:** `backend/src/middlewares/validateApiKey.ts` (línea 20)
- **Descripción:** La comparación de API keys usa el operador `===` de JavaScript, que termina en cuanto encuentra el primer carácter diferente. Un atacante con suficientes intentos puede inferir la clave caracter por caracter midiendo tiempos de respuesta.
- **Evidencia del código:**
  ```typescript
  if (!provided || provided !== apiKey) {  // ← comparación temporal vulnerable
  ```
- **Corrección:**
  ```typescript
  import { timingSafeEqual } from "crypto";
  const providedBuf = Buffer.from(String(provided));
  const expectedBuf = Buffer.from(apiKey);
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    ...
  }
  ```

---

### F-09 — Credenciales débiles por defecto en docker-compose y API key conocida

- **Categoría:** Seguridad
- **Gravedad:** MEDIA
- **Ubicación:** `docker-compose.yml` (líneas 11, 34)
- **Descripción:** El `docker-compose.yml` tiene `POSTGRES_PASSWORD:-inventario123` y `EXTERNAL_API_KEY:-dev-api-key-change-in-production` como valores por defecto. Cualquier despliegue que no configure explícitamente estas variables (por ejemplo, en un demo o staging olvidado) queda expuesto con credenciales conocidas públicamente (el código es presumiblemente público).
- **Evidencia del código:**
  ```yaml
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-inventario123}
  EXTERNAL_API_KEY: ${EXTERNAL_API_KEY:-dev-api-key-change-in-production}
  ```
- **Corrección:** Eliminar los valores por defecto de producción. Usar `${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}` para que el arranque falle si no está configurada. Agregar un `.env.example` que documentе las variables requeridas.

---

### F-10 — Duplicación de la función `parseTime` en tres servicios

- **Categoría:** Calidad de código / Mantenibilidad
- **Gravedad:** MEDIA
- **Ubicación:** `movement.service.ts` (líneas 41–44 y 208–210), `reservation.service.ts` (líneas 91–94)
- **Descripción:** La misma lógica de parseo de tiempo "H:mm" → minutos desde medianoche está implementada tres veces (incluso dos veces dentro del mismo archivo). `order.service.ts` tiene la versión más robusta (`normalizeTime` + `parseTimeToMinutes`) que no es usada por los otros servicios. Además, las versiones duplicadas no normalizan el formato ni validan rangos fuera de 0-23 horas / 0-59 minutos.
- **Por qué importa:** Una corrección de bug en esta lógica debe hacerse en cuatro lugares. Ya ocurrió: `order.service.ts` valida rangos y maneja formatos inválidos, las otras no.
- **Corrección:** Mover `normalizeTime` y `parseTimeToMinutes` a `backend/src/utils/timeUtils.ts` y usarlos en los cuatro servicios.

---

### F-11 — `console.warn()` en lugar de logger en `reservation.service.ts`

- **Categoría:** Observabilidad
- **Gravedad:** MEDIA
- **Ubicación:** `backend/src/services/reservation.service.ts` (líneas 382–386)
- **Descripción:** El bloque de alerta de stock crítico post-confirmación de entrega usa `console.warn()` directamente, saltando el logger Winston estructurado del proyecto. En producción, los logs de Winston se escriben en formato JSON a un archivo (`/app/logs`), mientras que `console.warn` va a stdout sin estructura, sin nivel, sin correlación.
- **Evidencia del código:**
  ```typescript
  console.warn(`\n⚠️  ALERTA DE STOCK CRÍTICO (venta confirmada)`);
  console.warn(`   Producto:  ${product.name} (${product.sku})`);
  // ...
  ```
- **Corrección:** Reemplazar con `logger.warn("Stock crítico post-confirmación de entrega", { ... })`.

---

### F-12 — Inconsistencia de `criticalStockThreshold` vs `product.minStock`

- **Categoría:** Lógica de negocio
- **Gravedad:** MEDIA
- **Ubicación:** `backend/src/config/config.ts` (línea 27), `backend/src/services/reservation.service.ts` (línea 377)
- **Descripción:** El sistema tiene dos umbrales para alertas de stock: `config.criticalStockThreshold = 5` (hardcoded global) y `product.minStock` (configurable por producto). La generación de alertas en `movement.service.ts` usa correctamente `product.minStock`. Pero la verificación de alerta crítica en `confirmDelivery` usa el umbral global. Un producto con `minStock = 20` que cae a 15 unidades debería generar alerta, pero con `criticalStockThreshold = 5` no lo hará.
- **Corrección:** Usar siempre `product.minStock` como umbral. Eliminar `config.criticalStockThreshold` o usarlo solo como fallback si `minStock` no está definido.

---

### F-13 — Detección de errores Prisma por `constructor.name` (frágil)

- **Categoría:** Fiabilidad / Mantenibilidad
- **Gravedad:** MEDIA
- **Ubicación:** `backend/src/middlewares/errorHandler.ts` (líneas 34–44)
- **Descripción:** Los errores de Prisma son detectados comparando `err.constructor.name === "PrismaClientKnownRequestError"`. Esta comparación de strings puede romperse si Prisma cambia el nombre de clase en una actualización (ya ocurrió en versiones anteriores), o si el código es minificado.
- **Evidencia del código:**
  ```typescript
  if (err.constructor.name === "PrismaClientKnownRequestError" && ...) {
  ```
- **Corrección:**
  ```typescript
  import { Prisma } from "@prisma/client";
  if (err instanceof Prisma.PrismaClientKnownRequestError && ...) {
  ```

---

### F-14 — `DispatchSchedule.status` y `.priority` son Strings sin tipo

- **Categoría:** Diseño de schema / Integridad de datos
- **Gravedad:** MEDIA
- **Ubicación:** `backend/prisma/schema.prisma` (líneas 187–190)
- **Descripción:** Los campos `status` y `priority` de `DispatchSchedule` son `String` en lugar de usar los enums `Priority` y un enum de status dedicado. El código inserta valores como `"SCHEDULED"`, `"CANCELLED"`, `"NORMAL"` sin ninguna garantía a nivel de base de datos.
- **Contraste:** El mismo proyecto define `enum Priority { LOW NORMAL HIGH CRITICAL }` que no se usa para `DispatchSchedule.priority`.
- **Corrección:** Definir `enum DispatchStatus { SCHEDULED CANCELLED COMPLETED }` y usar `Priority` para el campo priority. Agregar una migración.

---

### F-15 — `Location.type` es String libre sin validación

- **Categoría:** Diseño de schema / Integridad de datos
- **Gravedad:** MEDIA
- **Ubicación:** `backend/prisma/schema.prisma` (línea 21)
- **Descripción:** El tipo de ubicación (`bodega`, `tienda`, `almacen`) es un String libre. No hay enum ni validación en la capa de rutas para `location.type`. Se puede crear una ubicación con `type: "xyz"` o `type: ""`.
- **Corrección:** Definir `enum LocationType { BODEGA TIENDA ALMACEN DISTRIBUCION }` y usarlo como tipo del campo.

---

### F-16 — `replenishment.createOrder` siempre crea con estado `ORDERED`, ignorando el flujo

- **Categoría:** Lógica de negocio
- **Gravedad:** MEDIA
- **Ubicación:** `backend/src/services/replenishment.service.ts` (línea 43)
- **Descripción:** La función `createOrder` del servicio de reposición fuerza `status: "ORDERED"` en la creación, saltando el estado inicial `PENDING`. El schema define `@default(PENDING)` para este campo. Esto rompe el flujo lógico donde una orden de reposición empieza como `PENDING` (creada) y luego se envía al proveedor como `ORDERED`.
- **Evidencia del código:**
  ```typescript
  return prisma.replenishmentOrder.create({
    data: { ...dto, status: "ORDERED" },  // ← ignora el default PENDING
  ```
- **Corrección:** Eliminar la sobreescritura de `status` y dejar que el schema use su `@default(PENDING)`.

---

### F-17 — `Reservation.orderId` es `Int` pero `Order.id` es `String (UUID)`

- **Categoría:** Diseño de datos / Arquitectura
- **Gravedad:** MEDIA
- **Ubicación:** `backend/prisma/schema.prisma` (líneas 161, 109)
- **Descripción:** El modelo `Reservation.orderId` es de tipo `Int` para compatibilidad con el Grupo 3 (sistema externo de pedidos). Sin embargo, el modelo interno `Order.id` es `String (UUID)`. No hay relación FK entre ambos, y los seeds usan IDs enteros ficticios (1001, 1002) que no corresponden a ningún registro en la tabla `orders`. Esta dualidad genera ambigüedad semántica: ¿`reservation.orderId` es un Order interno o externo?
- **Corrección:** Documentar explícitamente (en el schema y en el DTO) que `Reservation.orderId` referencia pedidos del sistema externo (Grupo 3), no la tabla `orders` interna. Considerar renombrar el campo a `externalOrderId` o agregar un campo separado.

---

### F-18 — Sin índices en columnas de consulta frecuente

- **Categoría:** Rendimiento / Base de datos
- **Gravedad:** BAJA-MEDIA
- **Ubicación:** `backend/prisma/schema.prisma`
- **Descripción:** Varias columnas usadas frecuentemente en cláusulas `WHERE` carecen de índices explícitos:
  - `Reservation(status)` — usada en casi todas las queries de reserva
  - `Reservation(sku, locationId, status)` — combinación usada en agregaciones críticas
  - `StockAlert(productId, locationId, status)` — usada en `findFirst` y `updateMany`
  - `Movement(productId, locationId, createdAt)` — historial de movimientos
  - `Order(status)` — listados filtrados por estado
- **Corrección:** Agregar `@@index` en el schema de Prisma para estas columnas.

---

### F-19 — Operaciones secuenciales en loops donde podrían ser paralelas

- **Categoría:** Rendimiento
- **Gravedad:** BAJA
- **Ubicación:** `backend/src/services/stock.service.ts` (líneas 59–99, 106–121, 128–157)
- **Descripción:** Las funciones `reserveStock`, `releaseStock` y `deductStock` procesan items en un `for...of` con `await` secuencial. Para un pedido con 10 ítems, esto genera 10 queries secuenciales cuando podrían ser paralelas.
- **Nota:** Dentro de una transacción Prisma, las queries paralelas pueden causar deadlocks si afectan las mismas filas. La corrección debe considerar el orden de bloqueo.
- **Corrección parcial:** Para `reserveStock` con items de diferentes productos/ubicaciones, usar `Promise.all`. Para items que puedan competir, mantener orden determinístico.

---

### F-20 — Seed destruye datos existentes sin protección

- **Categoría:** Operaciones / Riesgo de producción
- **Gravedad:** BAJA
- **Ubicación:** `backend/src/prisma/seed.ts` (líneas 16–25)
- **Descripción:** El seed inicia con `deleteMany()` en todas las tablas. Si alguien ejecuta `npm run db:seed` contra una base de datos de producción por error, se pierden todos los datos.
- **Corrección:** Agregar una verificación: si existe algún dato en producción, abortar con un mensaje claro. Alternativamente, usar `upsert` en lugar de delete+create.

---

### F-21 — Sin health check para el backend en docker-compose

- **Categoría:** DevOps / Confiabilidad
- **Gravedad:** BAJA
- **Ubicación:** `docker-compose.yml` (líneas 23–44)
- **Descripción:** El servicio `frontend` depende del `backend` sin verificar que esté saludable (`condition: service_healthy`). El backend tiene un endpoint `/health` pero el compose no lo usa para su healthcheck.
- **Corrección:**
  ```yaml
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
  frontend:
    depends_on:
      backend:
        condition: service_healthy
  ```

---

### F-22 — CI sin base de datos para tests de integración

- **Categoría:** CI/CD / Testing
- **Gravedad:** BAJA
- **Ubicación:** `.github/workflows/ci.yml`
- **Descripción:** El pipeline de CI ejecuta tests con Prisma mockeado. No levanta un contenedor PostgreSQL real. Esto significa que las migraciones, queries complejas, y el comportamiento transaccional real (incluyendo el aislamiento Serializable) nunca son validados automáticamente.
- **Corrección:** Agregar un servicio PostgreSQL al job de CI usando `services:` en GitHub Actions.

---

### F-23 — Sin escaneo de secretos en CI

- **Categoría:** Seguridad / CI-CD
- **Gravedad:** BAJA
- **Ubicación:** `.github/workflows/ci.yml`
- **Descripción:** El pipeline no incluye escaneo de secretos (ej. `truffleHog`, `gitleaks`). Dado que hay archivos `.env.example` y valores por defecto en docker-compose, un secreto hardcodeado no sería detectado automáticamente.
- **Corrección:** Agregar un step de `gitleaks` o `truffleHog` al workflow de CI.

---

### F-24 — Inconsistencia de ID: Route usa CUID, todos los demás usan UUID

- **Categoría:** Consistencia de diseño
- **Gravedad:** BAJA
- **Ubicación:** `backend/prisma/schema.prisma` (línea 226)
- **Descripción:** El modelo `Route` usa `@id @default(cuid())` mientras que todos los demás modelos usan `@id @default(uuid())`. Esta inconsistencia puede causar confusión y dificulta la migración futura a un generador de IDs uniforme.
- **Corrección:** Migrar `Route.id` a UUID para consistencia.

---

## Technical Debt Assessment

| Área | Descripción | Impacto | Esfuerzo |
|------|-------------|---------|----------|
| **Tests** | reservation.service, order.service, stock.service sin tests unitarios | Alto | Medio |
| **Autenticación** | Sin auth en endpoints internos | Crítico | Alto |
| **Paginación** | Todos los listados retornan resultados ilimitados | Alto | Medio |
| **Timezone** | Duplicación + inconsistencia en parseo de tiempo | Alto | Bajo |
| **Schema DB** | Falta de enums, índices y constraints CHECK | Medio | Bajo |
| **Seed destructivo** | `deleteMany()` sin protección | Alto operacional | Bajo |
| **Logs con console.warn** | Bypasa sistema de logging estructurado | Bajo | Bajo |
| **Limpieza de reservas expiradas** | No existe job para estado EXPIRED | Medio | Medio |
| **Idempotencia** | Sin idempotency keys en POSTs críticos | Medio | Alto |
| **Notificaciones** | Alertas de stock generadas pero no notificadas | Bajo | Alto |

**Deuda técnica total estimada:** 3–4 sprints de un ingeniero para llevar el sistema a estándares de producción.

---

## Security Assessment

| ID | Vulnerabilidad | Severidad | Estado |
|----|----------------|-----------|--------|
| F-01 | Endpoint confirm-delivery sin auth → stock deduction anónima | **CRÍTICO** | Sin corregir |
| F-02 | Zero auth/authz en todos los endpoints internos | **CRÍTICO** | Sin corregir |
| F-08 | Timing attack en comparación de API key | **MEDIA** | Sin corregir |
| F-09 | Credenciales débiles por defecto en docker-compose | **MEDIA** | Sin corregir |
| F-04 | TOCTOU en límite diario de despacho | **ALTA** | Sin corregir |
| F-23 | Sin escaneo de secretos en CI | **BAJA** | Sin corregir |
| — | Sin HTTPS enforcement | **MEDIA** | Sin corregir |
| — | Rate limiting solo global (no por IP/usuario) | **BAJA** | Parcial |
| — | Sin request ID para correlación de logs en auditoría | **BAJA** | Sin corregir |

**Positivos de seguridad:**
- Helmet.js configurado (headers de seguridad)
- CORS restrictivo con origen configurable
- Validación de input con `express-validator` en todas las rutas
- Transacciones Serializable para reservas (correcto uso de aislamiento)
- Errores no exponen stack trace en producción
- Variables de entorno validadas con Zod al inicio

---

## Refactoring Roadmap

### Immediate (must fix before production)

1. **[F-01]** Agregar `validateApiKey` a `PATCH /external/reservations/:id/confirm-delivery`
2. **[F-02]** Implementar autenticación (JWT u API key) en todos los endpoints internos. Mínimo aceptable: API key compartida con middleware global. Ideal: JWT con roles.
3. **[F-03]** Extraer `getCurrentMinutesInTimezone` a utility y reemplazar `new Date().getHours()` en `movement.service.ts` y `reservation.service.ts`
4. **[F-04]** Mover la verificación `maxDailyDispatch` dentro de la transacción Serializable
5. **[F-06]** Agregar constraint `CHECK (reserved >= 0)` en PostgreSQL y guard en `releaseStock`
6. **[F-09]** Eliminar credenciales por defecto de docker-compose; usar variables obligatorias

### Short Term

7. **[F-05]** Escribir tests unitarios para `reservation.service.ts`, `order.service.ts`, `stock.service.ts`; restaurar threshold a 90%
8. **[F-07]** Implementar paginación en todos los endpoints de listado
9. **[F-08]** Reemplazar comparación de API key con `crypto.timingSafeEqual`
10. **[F-10]** Extraer `parseTime`/`normalizeTime` a utility compartido
11. **[F-13]** Reemplazar detección de errores Prisma por `instanceof Prisma.PrismaClientKnownRequestError`
12. **[F-16]** Corregir `replenishment.createOrder` para usar el default `PENDING`
13. **[F-11]** Reemplazar `console.warn` con `logger.warn` en `reservation.service.ts`

### Medium Term

14. **[F-12]** Unificar umbrales de alerta; usar siempre `product.minStock`
15. **[F-14]** Migrar `DispatchSchedule.status` y `.priority` a enums tipados
16. **[F-15]** Migrar `Location.type` a enum `LocationType`
17. **[F-18]** Agregar índices DB en columnas de consulta frecuente
18. **[F-21]** Agregar healthcheck de backend en docker-compose
19. **[F-22]** Agregar servicio PostgreSQL al pipeline CI para tests de integración
20. **[F-20]** Agregar protección al seed contra ejecución en producción
21. Implementar job de limpieza de reservas `EXPIRED`
22. Agregar request ID middleware para correlación de logs

### Long Term

23. **[F-02]** Migrar de API key a JWT con roles diferenciados (operador de bodega, administrador, sistema externo)
24. **[F-07]** Evaluar GraphQL para queries flexibles con paginación cursor nativa
25. Implementar notificaciones (email/webhook) al generar alertas de stock crítico
26. Agregar idempotency keys en endpoints de mutación críticos
27. Configurar réplica de lectura PostgreSQL para consultas analíticas
28. Implementar trazabilidad distribuida (OpenTelemetry)
29. Agregar auditoría formal (tabla `audit_log` con before/after values)

---

## Production Readiness Assessment

**Puntuación de preparación para producción: 3.5 / 10**

| Dimensión | Puntuación | Notas |
|-----------|-----------|-------|
| Seguridad | 2/10 | Endpoint crítico sin auth; zero auth interna |
| Confiabilidad | 5/10 | Transacciones correctas pero timezone bug y TOCTOU |
| Rendimiento | 4/10 | Sin paginación; queries bien optimizadas |
| Testing | 4/10 | 60% real; servicios críticos sin cobertura |
| Mantenibilidad | 6/10 | Estructura clara; DRY violations puntuales |
| Operaciones/DevOps | 5/10 | Docker bien hecho; CI básico; sin secrets scan |
| Documentación | 7/10 | README completo; Swagger presente; datos erróneos de cobertura |
| Diseño de BD | 6/10 | Schema sólido; faltan índices, constraints y enums |

**Riesgos de despliegue principales:**
1. Reducción de stock sin autenticación via endpoint externo expuesto
2. Todos los endpoints de escritura accesibles anónimamente
3. Validaciones de horario de despacho basadas en UTC en lugar de timezone de Santiago
4. Sin paginación: primer mes operativo puede generar queries que saturen memoria

**Condiciones requeridas antes del lanzamiento:**
- [ ] F-01 y F-02 corregidos (autenticación mínima implementada)
- [ ] F-03 corregido (timezone consistente en todos los servicios)
- [ ] F-04 corregido (maxDailyDispatch dentro de transacción)
- [ ] F-06 corregido (constraint NOT NULL y guard en releaseStock)
- [ ] Paginación implementada en al menos los 3 endpoints más voluminosos (movements, orders, reservations)
- [ ] Cobertura de tests real ≥ 80% en servicios críticos
- [ ] Credenciales por defecto eliminadas del docker-compose

---

## Maintainability Assessment

- **Puntuación de mantenibilidad: 6 / 10**
- **Puntuación de deuda técnica: 5 / 10** (moderada, pero localizada y reparable)

**Áreas más difíciles de mantener actualmente:**
1. `reservation.service.ts` — mezcla lógica de horarios, límites diarios, creación atómica y confirmación de entrega en un solo archivo de 430 líneas
2. `order.service.ts` — la máquina de estados y las validaciones de despacho crecerán con los nuevos estados; actualmente no tiene tests
3. Validación de ventanas horarias — dispersa en 4 archivos con implementaciones inconsistentes

**Prioridades de refactoring:**
1. Extraer lógica de timezone a utility
2. Tests para servicios críticos
3. Enums en schema

---

## Final Verdict

> **¿Aprobaría este proyecto para deployment en producción?**
>
> **NO.**

### Justificación detallada

El proyecto demuestra un nivel de ingeniería sólido en muchos aspectos: la arquitectura de capas es coherente, las transacciones Prisma son correctas, el manejo de errores es uniforme, las validaciones de entrada están presentes en todas las rutas, y el uso de TypeScript estricto es correcto. El sistema tiene bases técnicas que, con trabajo adicional, pueden elevarse a estándares de producción.

Sin embargo, existen dos vulnerabilidades de seguridad de nivel **CRÍTICO** que hacen imposible el despliegue responsable:

**Primero**, `PATCH /external/reservations/:id/confirm-delivery` no requiere autenticación. Este endpoint modifica stock físico real y crea registros contables permanentes. Cualquier atacante, script automatizado, o usuario interno mal intencionado puede vaciar el inventario del sistema o falsificar confirmaciones de entrega con una simple llamada HTTP. Esto no es un riesgo hipotético: es una vulnerabilidad explotable hoy con cero conocimiento técnico.

**Segundo**, la totalidad de las operaciones internas — crear órdenes, registrar movimientos de inventario, transferir stock entre ubicaciones, crear proveedores, cambiar estados de pedidos — son accesibles de forma completamente anónima. En un sistema que gestiona inventario físico con implicaciones financieras, esto equivale a dejar la puerta del almacén abierta sin vigilante.

A esto se suma un **bug de lógica de alta gravedad**: el código de validación de ventanas horarias de despacho usa `new Date().getHours()` que en un contenedor Docker estándar (UTC) calculará incorrectamente si las operaciones están dentro del horario. Este bug pasará inadvertido en desarrollo local (donde el desarrollador probablemente está en América/Santiago) y fallará en producción de forma no determinística dependiendo del servidor.

La afirmación en el README de "100% test coverage" es incorrecta: el propio `jest.config.js` documenta con comentarios que tres servicios críticos carecen de tests y reduce el umbral a 60% por esa razón. Esto crea un falso sentido de seguridad sobre la calidad del código.

El proyecto requiere aproximadamente **2–3 semanas de trabajo focado** para corregir los hallazgos Críticos y de Alta gravedad antes de ser candidato serio para producción. Los hallazgos de Media y Baja gravedad representan deuda técnica manejable que puede abordarse iterativamente post-lanzamiento.

---

*Revisión generada el 2026-06-11. Basada en lectura directa de código fuente, schema de base de datos, configuración de Docker e infraestructura CI/CD.*
