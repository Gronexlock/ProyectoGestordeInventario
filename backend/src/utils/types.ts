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
