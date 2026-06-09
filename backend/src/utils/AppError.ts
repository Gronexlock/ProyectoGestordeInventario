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

    Error.captureStackTrace(this, this.constructor);
    // Preserva la cadena de prototipos correcta para subclases
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
