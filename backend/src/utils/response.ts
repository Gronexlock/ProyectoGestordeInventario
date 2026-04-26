// ============================================================
// Helper para construir respuestas API uniformes
// ============================================================

import { Response } from "express";
import { ApiResponse } from "./types";

/**
 * Envía una respuesta exitosa con formato estándar
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = "Operación exitosa",
  statusCode: number = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  res.status(statusCode).json(response);
};

/**
 * Envía una respuesta de error con formato estándar
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500
): void => {
  const response: ApiResponse = {
    success: false,
    message,
    error: message,
  };
  res.status(statusCode).json(response);
};
