// ============================================================
// server.ts - Punto de Entrada del Servidor
// ============================================================

import { validateEnv } from "./config/env";
import app from "./app";
import { config } from "./config/config";
import { logger } from "./config/logger";
import prisma from "./prisma/client";

// Validar variables de entorno antes de arrancar
validateEnv();

const PORT = config.port;

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info("Conexión a PostgreSQL establecida.");

    app.listen(PORT, () => {
      logger.info(`Servidor iniciado en http://localhost:${PORT}`, {
        env: config.nodeEnv,
        api: `http://localhost:${PORT}/api/v1`,
        docs: `http://localhost:${PORT}/api-docs`,
      });
    });
  } catch (error) {
    logger.error("Error al iniciar el servidor", { error });
    await prisma.$disconnect();
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Señal ${signal} recibida. Cerrando servidor...`);
  await prisma.$disconnect();
  logger.info("Conexión a la BD cerrada.");
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error: Error) => {
  logger.error("Excepción no capturada", { error });
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Promesa rechazada sin manejar", { reason });
  process.exit(1);
});

startServer();
