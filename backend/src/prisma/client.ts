// ============================================================
// Prisma Client Singleton
// Exporta una única instancia del cliente de base de datos
// para evitar múltiples conexiones en desarrollo
// ============================================================

import { PrismaClient } from "@prisma/client";

// Declaración global para hot-reloading en desarrollo
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Reutiliza la instancia en desarrollo (evita agotamiento de conexiones)
const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export default prisma;
