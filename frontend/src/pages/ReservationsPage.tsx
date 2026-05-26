import { useState, useEffect, useCallback } from "react";
import type { Reservation } from "../types/reservation";
import {
  getReservations,
  releaseReservation,
  confirmDelivery,
} from "../services/reservationService";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ACTIVE:   { label: "Activa",    color: "#1d4ed8", bg: "#eff6ff", dot: "#3b82f6" },
  RELEASED: { label: "Liberada",  color: "#7e22ce", bg: "#faf5ff", dot: "#a855f7" },
  SOLD:     { label: "Vendida",   color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
  EXPIRED:  { label: "Expirada",  color: "#c2410c", bg: "#fff7ed", dot: "#f97316" },
};

export const ReservationsPage = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReservations();
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reservas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const handleRelease = async (reservation: Reservation) => {
    const confirmed = window.confirm(
      `¿Cancelar y liberar la reserva #${reservation.reservationId} (Pedido #${reservation.orderId})?\n` +
        `Se restaurarán ${reservation.quantity} unidades al stock disponible.`
    );
    if (!confirmed) return;

    setActionId(reservation.reservationId);
    setError(null);
    setSuccess(null);

    try {
      const result = await releaseReservation(reservation.reservationId);
      setSuccess(
        result.alreadyReleased
          ? `La reserva #${reservation.reservationId} ya estaba liberada.`
          : `Reserva #${reservation.reservationId} liberada. Stock disponible: ${result.stockDisponible} uds.`
      );
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al liberar");
    } finally {
      setActionId(null);
    }
  };

  const handleConfirmDelivery = async (reservation: Reservation) => {
    const confirmed = window.confirm(
      `¿Confirmar entrega de la reserva #${reservation.reservationId}?\n` +
        `Se registrará salida de ${reservation.quantity} unidades y el estado pasará a Vendida.`
    );
    if (!confirmed) return;

    setActionId(reservation.reservationId);
    setError(null);
    setSuccess(null);

    try {
      await confirmDelivery(reservation.reservationId);
      setSuccess(`Entrega confirmada — Reserva #${reservation.reservationId} marcada como Vendida.`);
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar entrega");
    } finally {
      setActionId(null);
    }
  };

  // Stats
  const stats = {
    total: reservations.length,
    active: reservations.filter((r) => r.status === "ACTIVE").length,
    sold:   reservations.filter((r) => r.status === "SOLD").length,
    expired: reservations.filter((r) => r.status === "EXPIRED").length,
  };

  return (
    <div className="rp-root">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Gestión y seguimiento de reservas de stock</p>
        </div>
        <button className="btn btn-primary" onClick={loadReservations} disabled={loading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="rp-stats">
        {[
          { label: "Total", value: stats.total, color: "#353535", bg: "#f4f5f7" },
          { label: "Activas", value: stats.active, color: "#1d4ed8", bg: "#eff6ff" },
          { label: "Vendidas", value: stats.sold, color: "#15803d", bg: "#f0fdf4" },
          { label: "Expiradas", value: stats.expired, color: "#c2410c", bg: "#fff7ed" },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ background: s.bg }}>
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert--error">
          <span>⚠</span><span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert--success">
          <span>✓</span><span>{success}</span>
        </div>
      )}

      {/* Table */}
      <div className="card rp-table-card">
        {loading ? (
          <div className="rp-empty">
            <span className="spinner spinner--dark" />
            <span>Cargando reservas...</span>
          </div>
        ) : reservations.length === 0 ? (
          <div className="rp-empty">
            <div className="rp-empty-icon">📋</div>
            <p className="rp-empty-title">Sin reservas</p>
            <p className="rp-empty-hint">
              Ejecuta <code>pnpm run db:seed</code> en el backend para cargar datos de prueba.
            </p>
          </div>
        ) : (
          <div className="rp-table-wrapper">
            <table className="rp-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pedido</th>
                  <th>SKU</th>
                  <th>Ubicación</th>
                  <th>Cant.</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.ACTIVE;
                  const isBusy = actionId === r.reservationId;

                  return (
                    <tr key={r.reservationId} className={isBusy ? "row--busy" : ""}>
                      <td>
                        <span className="rp-id">#{r.reservationId}</span>
                      </td>
                      <td>
                        <span className="rp-order">#{r.orderId}</span>
                      </td>
                      <td>
                        <code className="rp-sku">{r.sku}</code>
                      </td>
                      <td>{r.location?.name ?? r.locationId}</td>
                      <td>
                        <span className="rp-qty">{r.quantity}</span>
                      </td>
                      <td>
                        <span className="rp-badge" style={{ color: cfg.color, background: cfg.bg }}>
                          <span className="rp-dot" style={{ background: cfg.dot }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td>
                        {r.status === "ACTIVE" ? (
                          <div className="rp-actions">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleRelease(r)}
                              className="action-btn action-btn--release"
                            >
                              {isBusy ? <span className="spinner" /> : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                </svg>
                              )}
                              Liberar
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleConfirmDelivery(r)}
                              className="action-btn action-btn--confirm"
                            >
                              {isBusy ? <span className="spinner" /> : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                              Confirmar
                            </button>
                          </div>
                        ) : (
                          <span className="rp-none">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .rp-root { animation: fadeUp 0.35s ease both; }

        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
        }

        /* Stats */
        .rp-stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .stat-card {
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex; flex-direction: column; gap: 4px;
          border: 1px solid rgba(0,0,0,0.05);
        }
        .stat-value { font-family: var(--font-display); font-size: 1.8rem; font-weight: 700; line-height: 1; }
        .stat-label { font-size: 0.78rem; color: #888; font-weight: 500; }

        /* Alerts */
        .alert {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: var(--radius-md);
          font-size: 0.875rem; font-weight: 500; margin-bottom: 16px;
        }
        .alert--error   { background: #fff0f0; color: #b91c1c; border: 1px solid #fecaca; }
        .alert--success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }

        /* Table card */
        .rp-table-card { padding: 0; overflow: hidden; }
        .rp-table-wrapper { overflow-x: auto; }

        .rp-table {
          width: 100%; border-collapse: collapse; font-size: 0.875rem;
          font-family: var(--font-body);
        }
        .rp-table th {
          padding: 14px 16px; text-align: left;
          font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: #888;
          border-bottom: 1px solid var(--color-gray);
          background: #fafafa;
          font-family: var(--font-body);
        }
        .rp-table td {
          padding: 13px 16px; border-bottom: 1px solid #f0f0f0;
          vertical-align: middle; color: var(--color-dark);
          font-family: var(--font-body);
        }
        .rp-table tr:last-child td { border-bottom: none; }
        .rp-table tbody tr { transition: background var(--transition); }
        .rp-table tbody tr:hover { background: #fafafa; }
        .row--busy { opacity: 0.6; }

        .rp-id, .rp-order { font-weight: 600; color: var(--color-navy); }
        .rp-sku {
          font-family: 'Courier New', monospace; font-size: 0.8rem;
          background: var(--color-gray); padding: 2px 7px; border-radius: 4px;
        }
        .rp-qty { font-weight: 600; }

        /* Badge */
        .rp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px;
          font-size: 0.75rem; font-weight: 600;
        }
        .rp-dot {
          width: 6px; height: 6px; border-radius: 50%;
        }

        /* Actions */
        .rp-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .action-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: var(--radius-sm);
          border: none; font-family: var(--font-body);
          font-size: 0.78rem; font-weight: 600; cursor: pointer;
          transition: all var(--transition);
        }
        .action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .action-btn--release {
          background: #f5f3ff; color: #7e22ce;
          border: 1px solid #e9d5ff;
        }
        .action-btn--release:hover:not(:disabled) {
          background: #7e22ce; color: white;
        }
        .action-btn--confirm {
          background: #f0fdf4; color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .action-btn--confirm:hover:not(:disabled) {
          background: #15803d; color: white;
        }
        .rp-none { color: #ccc; font-size: 0.85rem; }

        /* Empty state */
        .rp-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 56px 24px; color: #999;
        }
        .rp-empty-icon { font-size: 2.5rem; }
        .rp-empty-title { font-weight: 600; color: #555; font-size: 0.95rem; }
        .rp-empty-hint { font-size: 0.82rem; text-align: center; }
        .rp-empty-hint code {
          background: var(--color-gray); padding: 1px 6px; border-radius: 4px;
          font-size: 0.78rem;
        }

        /* Spinner */
        .spinner {
          width: 14px; height: 14px; display: inline-block;
          border: 2px solid rgba(255,255,255,0.4); border-top-color: white;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        .spinner--dark { border-color: rgba(0,0,0,0.1); border-top-color: var(--color-teal); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};