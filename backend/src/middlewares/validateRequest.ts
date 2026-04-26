// ============================================================
// Middleware: Validación de Resultados de express-validator
// Intercepta y devuelve errores de validación antes de llegar
// a los controladores
// ============================================================

import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

/**
 * Revisa si existen errores de validación en la solicitud.
 * Si existen, responde con 422 y el detalle de cada error.
 * Si no existen, pasa al siguiente middleware/controlador.
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(422).json({
      success: false,
      message: "Error de validación en los datos de entrada.",
      errors: errors.array().map((e) => ({
        field: e.type === "field" ? e.path : "unknown",
        message: e.msg,
      })),
    });
    return;
  }

  next();
};
