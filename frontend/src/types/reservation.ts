export type ReservationStatus = "ACTIVE" | "RELEASED" | "SOLD" | "EXPIRED";

export interface Reservation {
  reservationId: number;
  orderId: number;
  sku: string;
  locationId: string;
  quantity: number;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string;
  releasedAt?: string | null;
  soldAt?: string | null;
  location?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface CreateReservationDto {
  orderId: number;
  sku: string;
  locationId: string;
  quantity: number;
  expiresAt?: string;
}

export interface ReleaseReservationResponse {
  reservation: Reservation;
  quantity: number;
  reserved: number;
  stockDisponible: number;
  alreadyReleased: boolean;
}
