// ============================================================
// Tipos Compartidos del Sistema de Inventario
// ============================================================

// ── Respuesta API Estándar ────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// ── DTOs de Ubicación ────────────────────────────────────────────
export interface CreateLocationDto {
  name: string;
  type: string;
  capacity?: number;
}

export interface UpdateLocationDto {
  name?: string;
  type?: string;
  capacity?: number | null;
}

// ── DTOs de Producto ─────────────────────────────────────────────
export interface CreateProductDto {
  name: string;
  sku: string;
}

// ── DTOs de Movimiento ───────────────────────────────────────────
export interface CreateMovementDto {
  productId: string;
  locationId: string;
  type: "IN" | "OUT";
  quantity: number;
  note?: string;
}

// ── Tipo de resultado de movimiento ─────────────────────────────
export interface MovementResult {
  movement: {
    id: string;
    productId: string;
    locationId: string;
    type: string;
    quantity: number;
    note?: string | null;
    reservationId?: number | null;
    createdAt: Date;
  };
  updatedStock: {
    id: string;
    productId: string;
    locationId: string;
    quantity: number;
  };
  alert?: string;
}

// ── DTOs de Reserva ──────────────────────────────────────────────
export interface CreateReservationDto {
  orderId: number;
  sku: string;
  locationId: string;
  quantity: number;
  expiresAt?: string;
}

export interface ReleaseReservationDto {
  reservationId: number;
}

export interface ConfirmDeliveryDto {
  deliveredAt?: string;
  note?: string;
}
