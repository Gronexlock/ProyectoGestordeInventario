// ============================================================
// Middleware: Manejador Global de Errores
// Captura cualquier error lanzado en la aplicación y devuelve
// una respuesta JSON uniforme con el código HTTP adecuado
// ============================================================

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { config } from "../config/config";

/**
 * Middleware de manejo de errores global.
 * Debe registrarse DESPUÉS de todas las rutas en app.ts
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // next es requerido por Express para reconocerlo como error handler
  _next: NextFunction
): void => {
  // ── Errores operacionales conocidos (AppError) ─────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.message,
    });
    return;
  }

  // ── Errores de Prisma: violación de unicidad ───────────────────
  if (
    err.constructor.name === "PrismaClientKnownRequestError" &&
    (err as { code?: string }).code === "P2002"
  ) {
    res.status(409).json({
      success: false,
      message: "Ya existe un registro con ese valor único (ej: SKU duplicado).",
      error: "CONFLICT",
    });
    return;
  }

  // ── Errores de Prisma: registro no encontrado ──────────────────
  if (
    err.constructor.name === "PrismaClientKnownRequestError" &&
    (err as { code?: string }).code === "P2025"
  ) {
    res.status(404).json({
      success: false,
      message: "Registro no encontrado.",
      error: "NOT_FOUND",
    });
    return;
  }

  // ── Error desconocido ──────────────────────────────────────────
  // En producción no exponemos detalles internos
  console.error("❌ Error no controlado:", err);

  res.status(500).json({
    success: false,
    message: "Error interno del servidor.",
    error: config.isProduction ? "INTERNAL_SERVER_ERROR" : err.message,
  });
};
