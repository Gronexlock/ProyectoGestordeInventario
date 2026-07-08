// ============================================================
// Servicio: Notificación de alertas al Grupo 11 (Incidentes Operacionales)
// POST https://proyecto11-mochicode.onrender.com/api/v1/alertas
//
// Alcance: solo emitimos alertas hacia Grupo 11, no consumimos
// ningún endpoint de su API.
// ============================================================

import { config } from "../config/config";
import { logger } from "../config/logger";

/** Tipos de alerta de inventario que se reportan como incidentes */
type IncidentAlertType = "critical_threshold_reached" | "stock_out_error";

interface IncidentAlertParams {
  alertType: IncidentAlertType;
  sku: string;
  locationId: string;
  locationName?: string;
  currentStock: number;
  minStock: number;
  productName?: string;
}

/**
 * Envía una alerta de stock crítico o desabastecimiento al Grupo 11.
 * Operación fire-and-forget: un fallo de red se registra en el log
 * pero no interrumpe el flujo de inventario.
 *
 * Payload enviado a POST /api/v1/alertas (Grupo 11):
 * {
 *   "sistema_id": "P05",
 *   "creado_en": "<ISO 8601 UTC>",
 *   "payload": {
 *     "sku_id": "SKU-PROD-001",
 *     "location_id": "...",
 *     "location_name": "Bodega Norte",
 *     "current_stock": 3,
 *     "min_stock": 10,
 *     "product_name": "Tornillo M8",
 *     "alert_type": "critical_threshold_reached"
 *   }
 * }
 */
export const notifyIncident = (params: IncidentAlertParams): void => {
  const url = config.incidentsUrl;
  if (!url) {
    // No configurada en este entorno — silencioso, igual que Grupo 9
    return;
  }

  const body = {
    sistema_id: "P05",
    creado_en: new Date().toISOString(),
    payload: {
      alert_type: params.alertType,
      sku_id: params.sku,
      location_id: params.locationId,
      ...(params.locationName !== undefined && { location_name: params.locationName }),
      current_stock: params.currentStock,
      min_stock: params.minStock,
      ...(params.productName !== undefined && { product_name: params.productName }),
    },
  };

  // Fire-and-forget: no await intencional
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.eventRequestTimeoutMs),
  })
    .then((res) => {
      if (!res.ok) {
        res.text().then((text) => {
          logger.warn("Grupo 11: alerta rechazada", {
            status: res.status,
            body: text.slice(0, 200),
            sku: params.sku,
            alertType: params.alertType,
          });
        }).catch(() => undefined);
      } else {
        logger.debug("Grupo 11: alerta enviada", {
          alertType: params.alertType,
          sku: params.sku,
          locationId: params.locationId,
        });
      }
    })
    .catch((error: unknown) => {
      logger.warn("Grupo 11: error al enviar alerta (red)", {
        error: error instanceof Error ? error.message : String(error),
        sku: params.sku,
        alertType: params.alertType,
      });
    });
};
