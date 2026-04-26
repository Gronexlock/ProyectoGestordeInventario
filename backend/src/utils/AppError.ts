// ============================================================
// Clase AppError - Error personalizado de la aplicación
// Permite pasar códigos HTTP junto con los mensajes de error
// ============================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Error esperado (no un bug)

    // Mantener el stack trace correcto
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
