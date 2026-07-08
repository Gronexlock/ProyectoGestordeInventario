# Coordinación Técnica — Grupo 5 (Inventario) ↔ Grupo 11 (Incidentes Operacionales)

> **Estado actual: ✅ IMPLEMENTACIÓN COMPLETA — pendiente validación de pruebas de humo**
> Última actualización: 2026-07-08

---

## Resumen del acuerdo

El Grupo 5 (Inventario) **emite alertas** hacia el Grupo 11 (Incidentes Operacionales) cada vez que ocurre un evento de **stock crítico** o **desabastecimiento total**. El Grupo 11 no consume ningún endpoint del Grupo 5.

| Dirección | Descripción |
|-----------|-------------|
| **Grupo 5 → Grupo 11** | `POST /api/v1/alertas` cuando stock cae ≤ umbral mínimo |
| **Grupo 11 → Grupo 5** | ❌ No aplica — no consumimos sus endpoints |

---

## 1. Conexión técnica

| Parámetro | Valor |
|-----------|-------|
| **URL del endpoint** | `https://proyecto11-mochicode.onrender.com/api/v1/alertas` |
| **Método** | `POST` |
| **Autenticación** | No requerida (por ahora) |
| **Content-Type** | `application/json` |
| **Tolerancia a fallos** | Fire-and-forget — un fallo de red se registra en el log pero no interrumpe las operaciones de inventario |

### ⚙️ Variable de entorno requerida

```env
INCIDENTS_URL=https://proyecto11-mochicode.onrender.com/api/v1/alertas
```

---

## 2. Eventos que disparan una alerta al Grupo 11

Nuestra lógica emite una alerta al Grupo 11 en los siguientes escenarios:

| Situación | `alert_type` enviado | Disparado desde |
|-----------|----------------------|-----------------|
| Stock cae ≤ `minStock` (sin llegar a 0) | `critical_threshold_reached` | Movimiento OUT, Transferencia, Confirmación de entrega de reserva |
| Stock llega a `0` | `stock_out_error` | Ídem anterior |

---

## 3. Payload enviado a `POST /api/v1/alertas`

Estructura acordada con el Grupo 11 según su documentación de integración:

```json
{
  "sistema_id": "P05",
  "creado_en": "2026-07-08T22:30:00.000Z",
  "payload": {
    "alert_type": "critical_threshold_reached",
    "sku_id": "SKU-PROD-001",
    "location_id": "b1b0b555-d41d-4e9e-88ef-222a7f5a4400",
    "location_name": "Bodega Norte",
    "current_stock": 3,
    "min_stock": 10,
    "product_name": "Tornillo M8"
  }
}
```

### Campos del payload

| Campo | Tipo | Descripción | Obligatorio |
|-------|------|-------------|-------------|
| `sistema_id` | String | Siempre `"P05"` | ✅ |
| `creado_en` | String ISO 8601 UTC | Timestamp del momento de la alerta | ✅ |
| `payload.alert_type` | String | `"critical_threshold_reached"` o `"stock_out_error"` | ✅ |
| `payload.sku_id` | String | Código SKU del producto afectado | ✅ |
| `payload.location_id` | String UUID | ID de la ubicación afectada | ✅ |
| `payload.location_name` | String | Nombre de la ubicación | Opcional |
| `payload.current_stock` | Number | Stock físico actual al momento de la alerta | ✅ |
| `payload.min_stock` | Number | Umbral mínimo configurado para el producto | ✅ |
| `payload.product_name` | String | Nombre descriptivo del producto | Opcional |

---

## 4. Implementación en el código

El servicio encargado es [`incident.service.ts`](./backend/src/services/incident.service.ts).

La función `notifyIncident()` se llama de forma **fire-and-forget** (sin `await`) en:

| Archivo | Función | Cuándo |
|---------|---------|--------|
| [`movement.service.ts`](./backend/src/services/movement.service.ts) | `createMovement()` | Movimiento OUT que baja el stock ≤ `minStock` |
| [`movement.service.ts`](./backend/src/services/movement.service.ts) | `createTransfer()` | Transferencia que deja el origen ≤ `minStock` |
| [`reservation.service.ts`](./backend/src/services/reservation.service.ts) | `confirmDelivery()` | Confirmación de entrega de reserva que baja el stock ≤ `minStock` |

---

## 5. Guía de pruebas locales

### Paso 1: Verificar la variable de entorno

```env
INCIDENTS_URL=https://proyecto11-mochicode.onrender.com/api/v1/alertas
```

### Paso 2: Levantar el servidor

```powershell
npm.cmd run dev --prefix backend
```

### Paso 3: Provocar un stock crítico

Realiza un movimiento de salida (OUT) o una transferencia que deje el stock de algún producto por debajo de su umbral mínimo (`minStock`). Por ejemplo, vía la API:

```http
POST http://localhost:3000/api/v1/movements
Content-Type: application/json

{
  "productId": "<id-del-producto>",
  "locationId": "<id-de-la-ubicacion>",
  "type": "OUT",
  "quantity": <cantidad-que-deje-stock-critico>
}
```

### Paso 4: Verificar en los logs del servidor

Busca líneas como:

```
[debug] Grupo 11: alerta enviada { alertType: 'critical_threshold_reached', sku: '...', locationId: '...' }
```

Si hay error de conexión verás:

```
[warn] Grupo 11: error al enviar alerta (red) { error: '...', sku: '...', alertType: '...' }
```

### Paso 5: Confirmar en Grupo 11

Coordinar con el Grupo 11 para que validen que el incidente apareció en su plataforma correctamente.

---

## 6. Lo que el Grupo 11 expone (para referencia, no lo usamos)

Según su documentación, el Grupo 11 también expone los siguientes endpoints. **El Grupo 5 no los consume**, se listan solo como referencia del ecosistema:

| Endpoint | Propósito |
|----------|-----------|
| `POST /api/v1/incidentes` | Crear incidente manual con SLA |
| `GET /api/v1/incidentes/metricas` | Métricas de incidentes (lo consume P09) |

---

## 7. Payloads internos de Inventario (para referencia del Grupo 11)

Estructura interna de los eventos del Grupo 5 por si el Grupo 11 necesita entender el contexto de origen de las alertas.

### Eventos de stock (`stock_received`, `stock_dispatched`, `stock_adjusted`, `stock_transfer_initiated`)

```json
{
  "source": "inventory",
  "event_type": "stock_received",
  "payload": {
    "sku_id": "PROD-001",
    "location_id": "b1b0b555-d41d-4e9e-88ef-222a7f5a4400",
    "quantity": 100,
    "unit_price": 12500.0,
    "product_name": "Tornillo M8",
    "category": "Ferretería",
    "unit": "unidad",
    "location_name": "Bodega Central",
    "location_type": "WAREHOUSE"
  }
}
```

### Alerta de stock crítico (`critical_threshold_reached`)

```json
{
  "source": "inventory",
  "event_type": "critical_threshold_reached",
  "payload": {
    "sku_id": "PROD-001",
    "location_id": "b1b0b555-d41d-4e9e-88ef-222a7f5a4400",
    "current_stock": 3,
    "threshold_limite": 5,
    "product_name": "Tornillo M8",
    "location_name": "Tienda Norte",
    "location_type": "RETAIL_POINT",
    "city": "Santiago"
  }
}
```

---

Saludos,
**Equipo Inventario — Grupo 5**
