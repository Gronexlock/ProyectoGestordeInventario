import type {
  CreateReservationDto,
  ReleaseReservationResponse,
  Reservation,
} from "../types/reservation";

const API_BASE = "http://localhost:3000/api/v1";

export const getReservations = async (
  status?: string
): Promise<Reservation[]> => {
  const query = status ? `?status=${status}` : "";
  const response = await fetch(`${API_BASE}/reservations${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al obtener reservas");
  }

  const data = await response.json();
  return data.data;
};

export const createReservation = async (
  dto: CreateReservationDto
): Promise<unknown> => {
  const response = await fetch(`${API_BASE}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al crear la reserva");
  }

  const data = await response.json();
  return data.data;
};

export const releaseReservation = async (
  reservationId: number
): Promise<ReleaseReservationResponse> => {
  const response = await fetch(`${API_BASE}/release-reservation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reservationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al liberar la reserva");
  }

  const data = await response.json();
  return data.data;
};

export const confirmDelivery = async (
  reservationId: number
): Promise<unknown> => {
  const response = await fetch(
    `${API_BASE}/external/reservations/${reservationId}/confirm-delivery`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveredAt: new Date().toISOString() }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al confirmar entrega");
  }

  const data = await response.json();
  return data.data;
};
