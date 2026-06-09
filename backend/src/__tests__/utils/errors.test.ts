import { NotFoundError, ValidationError, ConflictError, BusinessRuleError } from "../../utils/errors";
import { AppError } from "../../utils/AppError";

describe("Jerarquía de errores", () => {
  it("NotFoundError tiene statusCode 404 y mensaje con ID", () => {
    const err = new NotFoundError("Producto", "prod-1");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("prod-1");
  });

  it("NotFoundError sin ID tiene mensaje genérico", () => {
    const err = new NotFoundError("Producto");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("Producto");
  });

  it("ValidationError tiene statusCode 400", () => {
    const err = new ValidationError("Campo requerido.");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Campo requerido.");
  });

  it("ConflictError tiene statusCode 409", () => {
    const err = new ConflictError("Ya existe un registro con ese valor.");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.statusCode).toBe(409);
  });

  it("BusinessRuleError tiene statusCode 422", () => {
    const err = new BusinessRuleError("La cantidad debe ser positiva.");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(BusinessRuleError);
    expect(err.statusCode).toBe(422);
  });
});
