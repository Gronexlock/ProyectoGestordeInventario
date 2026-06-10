import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAllStock, getStockByLocation } from "../services/stockService";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("stockService.getAllStock", () => {
  it("retorna la lista de stock del servidor", async () => {
    const mockStock = [{ id: "s-1", quantity: 10 }];
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockStock }),
    } as Response);

    const result = await getAllStock();
    expect(result).toEqual(mockStock);
    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/api/v1/stock");
  });

  it("lanza error si la respuesta no es ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);

    await expect(getAllStock()).rejects.toThrow("Error al obtener el stock");
  });
});

describe("stockService.getStockByLocation", () => {
  it("retorna stock de una ubicación", async () => {
    const mockData = {
      location: { id: "loc-1", name: "Bodega", type: "bodega" },
      stocks: [],
    };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockData }),
    } as Response);

    const result = await getStockByLocation("loc-1");
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/api/v1/stock/loc-1");
  });

  it("lanza error si la respuesta no es ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);

    await expect(getStockByLocation("loc-1")).rejects.toThrow(
      "Error al obtener el stock de la ubicación"
    );
  });
});
