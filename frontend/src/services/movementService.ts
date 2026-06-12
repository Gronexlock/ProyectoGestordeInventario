import type { CreateMovementDto, Movement } from "../types/movement";
import { API_BASE } from "../config/apiConfig";

export const createMovement = async (dto: CreateMovementDto): Promise<Movement> => {
  const response = await fetch(`${API_BASE}/movements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al registrar el movimiento");
  }

  const data = await response.json();
  return data.data;
};

export const createTransfer = async (dto: {
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  note?: string;
}): Promise<{ movement: Movement; updatedStock: unknown }> => {
  const response = await fetch(`${API_BASE}/movements/transfer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al transferir el inventario");
  }

  const data = await response.json();
  return data.data;
};

export const getAllMovements = async (): Promise<Movement[]> => {
  const response = await fetch(`${API_BASE}/movements`);

  if (!response.ok) {
    throw new Error("Error al obtener el historial de movimientos");
  }

  const data = await response.json();
  return data.data;
};
