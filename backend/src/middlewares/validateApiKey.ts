// ============================================================
// Middleware: Validación de API Key para integraciones externas
// SCRUM-31: Verifica el header X-Api-Key contra la variable EXTERNAL_API_KEY
// ============================================================

import type { Request, Response, NextFunction } from "express";

/**
 * Middleware: valida `X-Api-Key` contra la(s) clave(s) configurada(s).
 * - Conserva compatibilidad con `EXTERNAL_API_KEY`.
 * - Si se quiere permitir múltiples claves, establecer `EXTERNAL_API_KEYS` como comma-separated.
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const singleKey = process.env.EXTERNAL_API_KEY;
  const keysList = process.env.EXTERNAL_API_KEYS; // opcional: lista separada por comas

  const validKeys = new Set<string>();
  if (singleKey && singleKey.trim().length > 0) validKeys.add(singleKey.trim());
  if (keysList && keysList.trim().length > 0) {
    for (const k of keysList.split(",")) {
      const t = k.trim();
      if (t.length > 0) validKeys.add(t);
    }
  }

  if (validKeys.size === 0) {
    res.status(503).json({
      success: false,
      message: "El servicio de integración externa no está configurado.",
    });
    return;
  }

  const providedRaw = req.headers["x-api-key"];
  const provided = Array.isArray(providedRaw) ? providedRaw[0] : providedRaw;

  if (!provided || typeof provided !== "string" || !validKeys.has(provided)) {
    res.status(401).json({
      success: false,
      message: "API Key inválida o no proporcionada.",
    });
    return;
  }

  next();
};
