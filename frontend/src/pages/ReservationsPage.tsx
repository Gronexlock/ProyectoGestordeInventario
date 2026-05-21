import { useState, useEffect, useCallback } from "react";
import type { Reservation } from "../types/reservation";
import {
  getReservations,
  releaseReservation,
  confirmDelivery,
} from "../services/reservationService";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "Activa", color: "#1565c0", bg: "#e3f2fd" },
  RELEASED: { label: "Liberada", color: "#6a1b9a", bg: "#f3e5f5" },
  SOLD: { label: "Vendida", color: "#2e7d32", bg: "#e8f5e9" },
  EXPIRED: { label: "Expirada", color: "#e65100", bg: "#fff3e0" },
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
      `[Mock Proyecto 2] ¿Confirmar entrega de la reserva #${reservation.reservationId}?\n` +
        `Se registrará salida de ${reservation.quantity} unidades y el estado pasará a Vendida.`
    );
    if (!confirmed) return;

    setActionId(reservation.reservationId);
    setError(null);
    setSuccess(null);

    try {
      await confirmDelivery(reservation.reservationId);
      setSuccess(
        `Entrega confirmada — Reserva #${reservation.reservationId} marcada como Vendida.`
      );
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar entrega");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 16px" }}>
      <h1 style={{ textAlign: "center" }}>Gestión de Reservas</h1>
      <p style={{ textAlign: "center", color: "#666", marginBottom: "24px" }}>
        Mock Proyecto 3 (crear/listar) · SCRUM-20 (liberar) · SCRUM-33 (confirmar entrega)
      </p>

      {error && (
        <div style={{ padding: "10px", marginBottom: "15px", color: "#d32f2f", backgroundColor: "#ffebee", border: "1px solid #ef5350", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: "10px", marginBottom: "15px", color: "#2e7d32", backgroundColor: "#e8f5e9", border: "1px solid #66bb6a", borderRadius: "4px" }}>
          {success}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center" }}>Cargando reservas...</p>
      ) : reservations.length === 0 ? (
        <p style={{ textAlign: "center", color: "#666" }}>
          No hay reservas. Ejecuta <code>pnpm run db:seed</code> en backend para datos de prueba.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>ID</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Pedido</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>SKU</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Ubicación</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Cant.</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Estado</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => {
              const badge = STATUS_LABELS[r.status] ?? STATUS_LABELS.ACTIVE;
              const isBusy = actionId === r.reservationId;

              return (
                <tr key={r.reservationId}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>{r.reservationId}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>{r.orderId}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>{r.sku}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                    {r.location?.name ?? r.locationId}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>{r.quantity}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: badge.color,
                        backgroundColor: badge.bg,
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                    {r.status === "ACTIVE" && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRelease(r)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: isBusy ? "#ccc" : "#7b1fa2",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: isBusy ? "not-allowed" : "pointer",
                            fontSize: "13px",
                          }}
                        >
                          {isBusy ? "..." : "Liberar"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleConfirmDelivery(r)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: isBusy ? "#ccc" : "#2e7d32",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: isBusy ? "not-allowed" : "pointer",
                            fontSize: "13px",
                          }}
                        >
                          {isBusy ? "..." : "Confirmar entrega"}
                        </button>
                      </div>
                    )}
                    {r.status !== "ACTIVE" && (
                      <span style={{ color: "#999", fontSize: "13px" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
