import { AppError } from "./AppError";

/** Recurso no encontrado — HTTP 404 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id
      ? `${resource} con ID "${id}" no encontrado.`
      : `${resource} no encontrado.`;
    super(msg, 404);
  }
}

/** Datos de entrada inválidos — HTTP 400 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

/** Conflicto de negocio (duplicado, estado final, etc.) — HTTP 409 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** Operación rechazada por regla de negocio — HTTP 422 */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}
