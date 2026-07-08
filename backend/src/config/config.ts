// ============================================================
// Configuración de la Aplicación
// Carga y valida las variables de entorno necesarias
// ============================================================

import dotenv from "dotenv";

// Cargar .env antes de cualquier otra importación
dotenv.config();

/**
 * Configuración centralizada de la aplicación.
 * Falla rápido si falta alguna variable crítica.
 */
export const config = {
  /** Puerto en el que escucha el servidor */
  port: parseInt(process.env.PORT ?? "3000", 10),

  /** Entorno de ejecución */
  nodeEnv: process.env.NODE_ENV ?? "development",

  /** Indica si estamos en producción */
  isProduction: process.env.NODE_ENV === "production",

  /** Umbral de stock crítico para alertas */
  criticalStockThreshold: 5,

  /** Timezone usada para validaciones horarias de despacho */
  appTimezone: process.env.APP_TIMEZONE ?? "America/Santiago",

  /** TTL por defecto de reservas (Grupo 3: 30 min para completar pago) */
  reservationTtlMinutes: parseInt(process.env.RESERVATION_TTL_MINUTES ?? "30", 10),

  /** Intervalo del job que expira reservas vencidas (ms) */
  reservationExpiryIntervalMs: parseInt(
    process.env.RESERVATION_EXPIRY_INTERVAL_MS ?? "60000",
    10
  ),

  /** Outbox eventos — Grupo 9 Analítica */
  analyticsEventsUrl: process.env.ANALYTICS_EVENTS_URL ?? "",
  analyticsApiKey: process.env.ANALYTICS_API_KEY ?? "",
  eventWorkerIntervalMs: parseInt(process.env.EVENT_WORKER_INTERVAL_MS ?? "30000", 10),
  eventMaxAttempts: parseInt(process.env.EVENT_MAX_ATTEMPTS ?? "5", 10),
  eventRequestTimeoutMs: parseInt(process.env.EVENT_REQUEST_TIMEOUT_MS ?? "10000", 10),

  /** Alertas de incidentes — Grupo 11 Incidentes Operacionales */
  incidentsUrl: process.env.INCIDENTS_URL ?? "",
} as const;
