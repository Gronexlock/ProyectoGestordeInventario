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
} as const;
