import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMovement, createTransfer, getAllMovements } from '../services/movementService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockMovement = {
  id: 'mov-1',
  productId: 'prod-1',
  locationId: 'loc-1',
  type: 'IN' as const,
  quantity: 20,
  note: null,
  createdAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── createMovement ───────────────────────────────────────────────────────────

describe('movementService.createMovement', () => {
  const dto = {
    productId: 'prod-1',
    locationId: 'loc-1',
    type: 'IN' as const,
    quantity: 20,
  };

  it('registra un movimiento exitosamente', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockMovement }),
    } as Response);

    const result = await createMovement(dto);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/movements',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(dto) })
    );
    expect(result).toEqual(mockMovement);
  });

  it('lanza Error con el mensaje del servidor cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Stock insuficiente.' }),
    } as Response);

    await expect(createMovement(dto)).rejects.toThrow('Stock insuficiente.');
  });

  it('usa mensaje genérico si el servidor no devuelve message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(createMovement(dto)).rejects.toThrow('Error al registrar el movimiento');
  });
});

// ─── createTransfer ───────────────────────────────────────────────────────────

describe('movementService.createTransfer', () => {
  const dto = {
    productId: 'prod-1',
    sourceLocationId: 'loc-1',
    destinationLocationId: 'loc-2',
    quantity: 10,
    note: 'Rebalanceo',
  };

  it('realiza una transferencia exitosamente', async () => {
    const transferResult = { movOut: mockMovement, movIn: { ...mockMovement, id: 'mov-2' } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: transferResult }),
    } as Response);

    const result = await createTransfer(dto);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/movements/transfer',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(dto) })
    );
    expect(result).toEqual(transferResult);
  });

  it('lanza Error con el mensaje del servidor cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Stock insuficiente en origen.' }),
    } as Response);

    await expect(createTransfer(dto)).rejects.toThrow('Stock insuficiente en origen.');
  });

  it('usa mensaje genérico si el servidor no devuelve message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(createTransfer(dto)).rejects.toThrow('Error al transferir el inventario');
  });
});

// ─── getAllMovements ───────────────────────────────────────────────────────────

describe('movementService.getAllMovements', () => {
  it('retorna el historial de movimientos', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockMovement] }),
    } as Response);

    const result = await getAllMovements();

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/movements');
    expect(result).toEqual([mockMovement]);
  });

  it('lanza Error cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);

    await expect(getAllMovements()).rejects.toThrow('Error al obtener el historial de movimientos');
  });
});
