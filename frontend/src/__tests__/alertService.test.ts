import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAlerts, resolveAlert } from '../services/alertService';

const mockAlert = {
  id: 'alert-1',
  productId: 'prod-1',
  locationId: 'loc-1',
  currentStock: 5,
  minStock: 10,
  status: 'PENDING' as const,
  createdAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── getAlerts ────────────────────────────────────────────────────────────────

describe('alertService.getAlerts', () => {
  it('obtiene alertas sin filtro de estado', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockAlert] }),
    } as Response);

    const result = await getAlerts();

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/alerts');
    expect(result).toEqual([mockAlert]);
  });

  it('obtiene alertas filtrando por estado PENDING', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockAlert] }),
    } as Response);

    const result = await getAlerts('PENDING');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/alerts?status=PENDING');
    expect(result).toEqual([mockAlert]);
  });

  it('lanza Error cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(getAlerts()).rejects.toThrow('Error al obtener alertas de stock.');
  });
});

// ─── resolveAlert ─────────────────────────────────────────────────────────────

describe('alertService.resolveAlert', () => {
  it('resuelve una alerta por su ID', async () => {
    const resolvedAlert = { ...mockAlert, status: 'RESOLVED' as const };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: resolvedAlert }),
    } as Response);

    const result = await resolveAlert('alert-1');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/alerts/alert-1/resolve',
      { method: 'PATCH' }
    );
    expect(result).toEqual(resolvedAlert);
  });

  it('lanza Error cuando la respuesta no es ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(resolveAlert('alert-1')).rejects.toThrow('Error al resolver la alerta.');
  });
});
