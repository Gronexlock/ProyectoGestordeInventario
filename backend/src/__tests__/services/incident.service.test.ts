// ============================================================
// Tests: incident.service.ts — Notificación al Grupo 11
// ============================================================

import { notifyIncident } from "../../services/incident.service";
import { logger } from "../../config/logger";

// ─── Mock de fetch global ────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Mock de config ──────────────────────────────────────────────────────────
jest.mock("../../config/config", () => ({
  config: {
    incidentsUrl: "https://proyecto11-mochicode.onrender.com/api/v1/alertas",
    eventRequestTimeoutMs: 10000,
  },
}));

jest.mock("../../config/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const baseParams = {
  alertType: "critical_threshold_reached" as const,
  sku: "SKU-001",
  locationId: "loc-1",
  locationName: "Bodega Norte",
  currentStock: 3,
  minStock: 10,
  productName: "Tornillo M8",
};

describe("incidentService.notifyIncident", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("realiza POST a INCIDENTS_URL con el payload correcto", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    notifyIncident(baseParams);

    // Esperar microtasks
    await Promise.resolve();
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://proyecto11-mochicode.onrender.com/api/v1/alertas");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({ "Content-Type": "application/json" });

    const body = JSON.parse(options.body as string);
    expect(body.sistema_id).toBe("P05");
    expect(body.creado_en).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    expect(body.payload.alert_type).toBe("critical_threshold_reached");
    expect(body.payload.sku_id).toBe("SKU-001");
    expect(body.payload.location_id).toBe("loc-1");
    expect(body.payload.location_name).toBe("Bodega Norte");
    expect(body.payload.current_stock).toBe(3);
    expect(body.payload.min_stock).toBe(10);
    expect(body.payload.product_name).toBe("Tornillo M8");
  });

  it("envía alert_type stock_out_error cuando currentStock es 0", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    notifyIncident({ ...baseParams, alertType: "stock_out_error", currentStock: 0 });

    await Promise.resolve();
    await Promise.resolve();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.payload.alert_type).toBe("stock_out_error");
    expect(body.payload.current_stock).toBe(0);
  });

  it("omite campos opcionales (locationName, productName) si no se pasan", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    notifyIncident({
      alertType: "critical_threshold_reached",
      sku: "SKU-002",
      locationId: "loc-2",
      currentStock: 1,
      minStock: 5,
    });

    await Promise.resolve();
    await Promise.resolve();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.payload).not.toHaveProperty("location_name");
    expect(body.payload).not.toHaveProperty("product_name");
  });

  it("no llama a fetch si INCIDENTS_URL no está configurada", async () => {
    jest.resetModules();
    jest.doMock("../../config/config", () => ({
      config: { incidentsUrl: "", eventRequestTimeoutMs: 10000 },
    }));

    // Reimportar el módulo con config vacía
    const { notifyIncident: notifyWithoutUrl } = await import("../../services/incident.service");
    notifyWithoutUrl(baseParams);

    await Promise.resolve();
    expect(mockFetch).not.toHaveBeenCalled();

    // Restaurar mock original
    jest.resetModules();
  });

  it("registra warn en el log si el servidor responde con error HTTP", async () => {
    const mockText = jest.fn().mockResolvedValue("Bad Request");
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: mockText,
    } as unknown as Response);

    notifyIncident(baseParams);

    // Esperar que se resuelvan las promesas encadenadas
    await new Promise((r) => setTimeout(r, 50));

    expect(logger.warn).toHaveBeenCalledWith(
      "Grupo 11: alerta rechazada",
      expect.objectContaining({ status: 400, sku: "SKU-001" })
    );
  });

  it("registra warn en el log si hay error de red", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    notifyIncident(baseParams);

    await new Promise((r) => setTimeout(r, 50));

    expect(logger.warn).toHaveBeenCalledWith(
      "Grupo 11: error al enviar alerta (red)",
      expect.objectContaining({ error: "Network error", sku: "SKU-001" })
    );
  });
});
