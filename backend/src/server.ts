// ============================================================
// server.ts - Punto de Entrada del Servidor
// Inicia el servidor Express y maneja el apagado limpio
// ============================================================

import app from "./app";
import { config } from "./config/config";
import prisma from "./prisma/client";

const PORT = config.port;

/**
 * Inicia el servidor HTTP y verifica la conexión a la BD
 */
const startServer = async (): Promise<void> => {
  try {
    // Verificar conexión a la base de datos antes de arrancar
    await prisma.$connect();
    console.log("✅ Conexión a PostgreSQL establecida.");

    // Iniciar el servidor
    app.listen(PORT, () => {
      console.log("\n🏭 ====================================");
      console.log(`   Sistema de Gestión de Inventario`);
      console.log("   ====================================");
      console.log(`   🌍 Entorno: ${config.nodeEnv}`);
      console.log(`   🚀 Servidor: http://localhost:${PORT}`);
      console.log(`   📡 API:      http://localhost:${PORT}/api/v1`);
      console.log(`   🛠️  SWAGGER:  http://localhost:${PORT}/api-docs`);
      console.log("   ====================================\n");
    });
  } catch (error) {
    console.error("❌ Error al iniciar el servidor:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

// ── Manejo de apagado limpio (Graceful Shutdown) ────────────────
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n🛑 Señal ${signal} recibida. Cerrando servidor...`);
  await prisma.$disconnect();
  console.log("🔌 Conexión a la BD cerrada.");
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ── Errores no capturados ────────────────────────────────────────
process.on("uncaughtException", (error) => {
  console.error("💥 Excepción no capturada:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 Promesa rechazada sin manejar:", reason);
  process.exit(1);
});

// Arrancar
startServer();
