import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getReservations,
  createReservation,
  releaseReservation,
  confirmDelivery,
} from "../services/reservationService";

beforeEach(() => {
  vi.restoreAllMocks();
});

const mockReservation = {
  reservationId: 1,
  orderId: 1001,
  sku: "SKU-001",
  quantity: 2,
  status: "ACTIVE",
};

describe("reservationService.getReservations", () => {
  it("obtiene reservas sin filtro", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [mockReservation] }),
    } as Response);

    const result = await getReservations();
    expect(result).toEqual([mockReservation]);
    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/api/v1/reservations");
  });

  it("obtiene reservas filtrando por estado", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [mockReservation] }),
    } as Response);

    await getReservations("ACTIVE");
    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/api/v1/reservations?status=ACTIVE");
  });

  it("lanza error con mensaje del servidor", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Sin acceso" }),
    } as Response);

    await expect(getReservations()).rejects.toThrow("Sin acceso");
  });

  it("lanza mensaje genérico si no hay message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(getReservations()).rejects.toThrow("Error al obtener reservas");
  });
});

describe("reservationService.createReservation", () => {
  const dto = {
    orderId: 1001,
    sku: "SKU-001",
    locationId: "loc-1",
    quantity: 2,
  };

  it("crea una reserva correctamente", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { reservationId: 1 } }),
    } as Response);

    const result = await createReservation(dto);
    expect(result).toEqual({ reservationId: 1 });
  });

  it("lanza error al fallar la creación", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Stock insuficiente" }),
    } as Response);

    await expect(createReservation(dto)).rejects.toThrow("Stock insuficiente");
  });

  it("lanza mensaje genérico si no hay message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(createReservation(dto)).rejects.toThrow("Error al crear la reserva");
  });
});

describe("reservationService.releaseReservation", () => {
  it("libera una reserva", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { reservationId: 1, status: "RELEASED", stockDisponible: 10 } }),
    } as Response);

    const result = await releaseReservation(1);
    expect(result.status).toBe("RELEASED");
  });

  it("lanza error al fallar la liberación", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(releaseReservation(1)).rejects.toThrow("Error al liberar la reserva");
  });
});

describe("reservationService.confirmDelivery", () => {
  it("confirma entrega de una reserva", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: "SOLD" } }),
    } as Response);

    const result = await confirmDelivery(1);
    expect(result).toEqual({ status: "SOLD" });
  });

  it("lanza error al fallar la confirmación", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Reserva no encontrada" }),
    } as Response);

    await expect(confirmDelivery(1)).rejects.toThrow("Reserva no encontrada");
  });

  it("lanza mensaje genérico si no hay message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(confirmDelivery(1)).rejects.toThrow("Error al confirmar entrega");
  });
});
