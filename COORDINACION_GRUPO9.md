# Coordinación integración Inventario (Grupo 5) → Analítica (Grupo 9)

> **Estado actual: ✅ IMPLEMENTACIÓN COMPLETA — pendiente validación conjunta con Grupo 9**
> Última actualización: 2026-07-08

---

## ✅ Respuestas recibidas del Grupo 9 — Contrato acordado

Hola equipo,

Somos el **Grupo 5 (Inventario)**. Revisamos su documento *"Módulo de Inventario — Resumen de Estado y Necesidades"* y queremos alinear algunos puntos **antes de empezar a implementar** lo que nos piden.

Nuestro sistema ya cubre stock, movimientos, alertas y reservas. Lo que nos falta de nuestro lado es **emitir los eventos con datos reales** hacia su `POST /events`. Para hacerlo bien y no rehacer trabajo, necesitamos confirmar lo siguiente:

---

## 1. Conexión técnica

- ¿Cuál es la **URL base** de su API de eventos? (ej. `https://.../events`)
- ¿Requieren **autenticación**? Si sí: ¿header, API key, otro?
- ¿Hay un **entorno de pruebas/staging** donde podamos enviar eventos sin afectar producción?
- ¿Cuál es el **timeout** recomendado y qué hacen si un evento falla? (¿reintentos, cola, o solo log?)

### ✅ Respuesta recibida

| Pregunta | Respuesta |
|----------|-----------|
| **URL base de eventos** | `https://analisis-proyecto-ti.onrender.com/v1/events` (POST) |
| **Autenticación para eventos** | No requerida para POST /events |
| **Entorno de pruebas** | La URL es producción/staging compartida. Coordinar si se necesita entorno aislado |
| **Reintentos / Timeout** | Nuestro outbox worker ya maneja: backoff exponencial, no reintenta en 4xx, sí reintenta en 5xx o falla de red |

> **Alcance de la integración:** el Grupo 5 **solo emite eventos** hacia el Grupo 9 (`POST /v1/events`). No consumimos ningún endpoint de su API. La autenticación Keycloak no aplica a nuestro lado.

#### ⚙️ Variable de entorno requerida

```env
ANALYTICS_EVENTS_URL=https://analisis-proyecto-ti.onrender.com/v1/events
```

---

## 2. Formato de eventos

Confirmamos que usaremos esta estructura general:

```json
{
  "source": "inventory",
  "event_type": "<tipo>",
  "project_id": "proyecto-09",
  "created_at": "2026-06-10T10:00:00Z",
  "payload": {}
}
```

### ✅ Respuesta recibida

El validador acepta campos adicionales en el `payload` sin romper la validación. Los IDs deben ser exactamente `sku_id` y `location_id`.

#### Campos enriquecidos acordados por event_type

**`stock_received`, `stock_dispatched`, `stock_adjusted`, `stock_transfer_initiated`:**
```json
{
  "sku_id": "SKU-PROD-001",
  "location_id": "LOC-001",
  "quantity": 50,
  "unit_price": 12500.00,
  "product_name": "Tornillo M8",
  "category": "Ferretería",
  "unit": "unidad"
}
```

**`stock_reserved`:**
```json
{
  "sku_id": "SKU-PROD-001",
  "location_id": "LOC-001",
  "quantity": 5,
  "order_id": "ORD-123",
  "reservation_id": 42
}
```

**`stock_released` (cancelación de reserva):**
```json
{
  "sku_id": "SKU-PROD-001",
  "location_id": "LOC-001",
  "quantity": 5,
  "reservation_id": 42,
  "reason": "RELEASED"
}
```

**`critical_threshold_reached`:**
```json
{
  "sku_id": "SKU-PROD-001",
  "location_id": "LOC-001",
  "current_stock": 5,
  "threshold_limite": 20,
  "location_name": "Bodega Norte",
  "location_type": "WAREHOUSE",
  "city": "Santiago"
}
```

---

## 3. Precio unitario (`total_stock_value`)

| Opción | Descripción |
|--------|-------------|
| **A** | Incluirlo en los eventos de stock (recomendado por ustedes) |
| **B** | Exponer un catálogo/endpoint con precios y que ustedes lo consulten |

### ✅ Respuesta recibida: **Opción A**

Incluir `unit_price` en los eventos de stock. Mínimo en `stock_received`. Si también está en reservas/despachos, está bien — el Grupo 9 guarda el último valor conocido.

> ~~**Pendiente nuestro:** agregar `unit_price` al emitir `emitStockMovement()` en `event.service.ts`.~~ ✅ Implementado en `movement.service.ts`, `reservation.service.ts` y `replenishment.service.ts`.

---

## 4. Ciclo de vida de reservas (`reserved_stock`)

Hoy manejamos reservas con estados: `ACTIVE` → `RELEASED` (cancelación) o `SOLD` (pedido completado).

### ✅ Respuesta recibida — Flujo validado

| Acción | Evento a emitir |
|--------|-----------------|
| Crear reserva | `stock_reserved` (con `reservation_id` + `order_id`) |
| Cancelar pedido | `stock_released` (semánticamente más claro que `stock_dispatched`) |
| Completar pedido | `stock_dispatched` con `order_id` (el mismo del `reserved`) |

Lógica del Grupo 9: restan de `reserved_stock` cualquier evento `stock_dispatched` o `stock_released` que tenga `order_id` no nulo.

---

## 5. Metadatos de ubicación (`critical_threshold_reached`)

### ✅ Respuesta recibida

Los campos `location_name`, `location_type`, `city` y `address` son aceptados.

- Preferencia: recibirlos en cada `critical_threshold_reached` (no hace falta endpoint separado)
- El Grupo 9 hace **upsert**: enviarlo una vez queda guardado
- `location_type` acepta: `WAREHOUSE`, `DISTRIBUTION_CENTER`, `RETAIL_POINT`

> ~~**Pendiente nuestro:** agregar `city` y `threshold_limite` al `emitCriticalThreshold()` en `event.service.ts`.~~ ✅ Implementado en `movement.service.ts` y `reservation.service.ts`.

---

## 6. Catálogo de productos

| Opción | Descripción |
|--------|-------------|
| **A** | Catálogo vía endpoint nuestro: `sku_id`, `product_name`, `category`, `unit`, `unit_price` |
| **B** | Esos campos en cada evento de stock |
| **C** | Ambos |

### ✅ Respuesta recibida: **Opción B**

Incluir `product_name`, `category`, `unit` en cada `stock_received`. El Grupo 9 guarda el último valor conocido.

> ~~**Pendiente nuestro:** agregar `category` y `unit` al payload de `emitStockMovement()`.~~ ✅ Implementado en `movement.service.ts`, `reservation.service.ts` y `replenishment.service.ts`.

---

## 7. Alcance y prioridades

### ✅ Orden confirmado

1. `unit_price` en `stock_received` → desbloquea `total_stock_value`
2. `order_id` en `stock_dispatched` → desbloquea `reserved_stock`
3. Metadata de ubicación en `critical_threshold_reached` (`city`, `threshold_limite`)
4. `product_name`, `category`, `unit` en eventos de stock

---

## 8. Validación conjunta

> **Nota:** el Grupo 5 solo emite eventos, no consulta endpoints del Grupo 9. La validación de que los datos llegaron correctamente la realiza el **Grupo 9 desde su lado**. Nosotros confirmamos que los eventos salen correctamente desde nuestra cola outbox.

Cuando tengamos el entorno conectado, verificar desde nuestro lado:

- [ ] Cola outbox: eventos pasan de `PENDING` a `SENT` (no quedan en `FAILED` ni `DEAD`)
- [ ] Evento `stock_received` incluye `unit_price`, `product_name`, `category`, `unit`
- [ ] Evento `stock_dispatched` con `order_id` cuando viene de una reserva
- [ ] Evento `critical_threshold_reached` incluye `city`, `threshold_limite`, `location_name`, `location_type`

El Grupo 9 confirma por su lado que los KPIs y el snapshot reflejan los datos enviados.

---

## 9. Guía de Pruebas Locales (Cómo validar del lado de Inventario)

Para confirmar el envío correcto y verificar la integración, sigue estos pasos:

### Paso 1: Configurar la URL en el entorno
Asegúrate de configurar la URL del endpoint del Grupo 9 en tu archivo `backend/.env`:
```env
ANALYTICS_EVENTS_URL=https://analisis-proyecto-ti.onrender.com/v1/events
```

### Paso 2: Levantar el servidor
Arranca la aplicación. El worker de eventos (outbox) se ejecutará en segundo plano procesando la cola de forma periódica:
```powershell
npm.cmd run dev --prefix backend
```

### Paso 3: Provocar eventos en el sistema
Usa la interfaz web o realiza peticiones HTTP directas a nuestra API para registrar transacciones:
- **Llegada de Mercancía (`stock_received`)**: Registra un movimiento de entrada o completa una orden de reposición (`RECEIVED`).
- **Crear Reserva (`stock_reserved`)**: Llama a `POST /api/v1/reservations`.
- **Confirmar Entrega (`stock_dispatched`)**: Confirma la entrega de una reserva activa.
- **Ajuste de Stock (`stock_adjusted`)**: Registra una conciliación de stock que altere el balance (ej. una reducción para forzar una cantidad negativa).
- **Transferencia (`stock_transfer_initiated`)**: Realiza una transferencia entre ubicaciones distintas.
- **Alertas Críticas (`critical_threshold_reached` / `stock_out_error`)**: Realiza un despacho o transferencia que baje el stock por debajo del mínimo (o a `0` para gatillar el `stock_out_error`).

### Paso 4: Consultar la Cola Outbox
Revisa el estado de la cola en nuestro backend consultando:
```http
GET http://localhost:3000/api/v1/events/outbox
```
- El estado (`status`) de los eventos debe cambiar de `PENDING` a `SENT` tras unos segundos.
- Si ocurre algún error en la conexión o validación del payload, el estado cambiará a `FAILED` o `DEAD`, mostrando el error detallado en `lastError`.

### Paso 5: Confirmar que los eventos llegaron
Una vez que los eventos pasen a `SENT` en la cola outbox, coordinar con el Grupo 9 para que validen que los datos impactaron su base de datos correctamente. La verificación final es responsabilidad de su lado.

---

Saludos,
**Equipo Inventario — Grupo 5**
