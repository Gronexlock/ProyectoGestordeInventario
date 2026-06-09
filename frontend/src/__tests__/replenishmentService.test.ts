import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAllSuppliers,
  createSupplier,
  getAllReplenishmentOrders,
  createReplenishmentOrder,
  updateReplenishmentOrderStatus,
} from '../services/replenishmentService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockSupplier = {
  id: 'sup-1',
  name: 'Distribuidora Central',
  email: 'contacto@distrib.com',
  phone: '+56 9 1234 5678',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockOrder = {
  id: 'order-1',
  productId: 'prod-1',
  locationId: 'loc-1',
  supplierId: 'sup-1',
  quantity: 50,
  status: 'ORDERED' as const,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── getAllSuppliers ───────────────────────────────────────────────────────────

describe('replenishmentService.getAllSuppliers', () => {
  it('retorna lista de proveedores', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockSupplier] }),
    } as Response);

    const result = await getAllSuppliers();

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/replenishment/suppliers');
    expect(result).toEqual([mockSupplier]);
  });

  it('lanza Error cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);

    await expect(getAllSuppliers()).rejects.toThrow('Error al obtener proveedores.');
  });
});

// ─── createSupplier ───────────────────────────────────────────────────────────

describe('replenishmentService.createSupplier', () => {
  it('crea un proveedor y lo retorna', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockSupplier }),
    } as Response);

    const dto = { name: 'Distribuidora Central', email: 'contacto@distrib.com' };
    const result = await createSupplier(dto);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/replenishment/suppliers',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(dto) })
    );
    expect(result).toEqual(mockSupplier);
  });

  it('lanza Error cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);

    await expect(
      createSupplier({ name: 'X', email: 'x@x.com' })
    ).rejects.toThrow('Error al crear proveedor.');
  });
});

// ─── getAllReplenishmentOrders ─────────────────────────────────────────────────

describe('replenishmentService.getAllReplenishmentOrders', () => {
  it('retorna lista de órdenes de reposición', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockOrder] }),
    } as Response);

    const result = await getAllReplenishmentOrders();

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/replenishment/replenishment');
    expect(result).toEqual([mockOrder]);
  });

  it('lanza Error cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);

    await expect(getAllReplenishmentOrders()).rejects.toThrow(
      'Error al obtener órdenes de reposición.'
    );
  });
});

// ─── createReplenishmentOrder ─────────────────────────────────────────────────

describe('replenishmentService.createReplenishmentOrder', () => {
  const dto = {
    productId: 'prod-1',
    locationId: 'loc-1',
    supplierId: 'sup-1',
    quantity: 50,
  };

  it('crea una orden de reposición y la retorna', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockOrder }),
    } as Response);

    const result = await createReplenishmentOrder(dto);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/replenishment/replenishment',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(dto) })
    );
    expect(result).toEqual(mockOrder);
  });

  it('lanza Error cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);

    await expect(createReplenishmentOrder(dto)).rejects.toThrow(
      'Error al solicitar orden de reposición.'
    );
  });
});

// ─── updateReplenishmentOrderStatus ──────────────────────────────────────────

describe('replenishmentService.updateReplenishmentOrderStatus', () => {
  it('actualiza el estado de una orden exitosamente', async () => {
    const updatedOrder = { ...mockOrder, status: 'RECEIVED' as const };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: updatedOrder }),
    } as Response);

    const result = await updateReplenishmentOrderStatus('order-1', 'RECEIVED');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/replenishment/replenishment/order-1/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'RECEIVED' }),
      })
    );
    expect(result).toEqual(updatedOrder);
  });

  it('lanza Error con mensaje del servidor cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Orden ya está en estado final.' }),
    } as Response);

    await expect(updateReplenishmentOrderStatus('order-1', 'CANCELLED')).rejects.toThrow(
      'Orden ya está en estado final.'
    );
  });

  it('usa mensaje genérico si el servidor no devuelve message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(updateReplenishmentOrderStatus('order-1', 'CANCELLED')).rejects.toThrow(
      'Error al actualizar estado de la orden.'
    );
  });
});
