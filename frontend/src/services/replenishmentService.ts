import type {
  Supplier,
  ReplenishmentOrder,
  CreateReplenishmentDto,
} from "../types/replenishment";
import { API_BASE } from "../config/apiConfig";

// Proveedores
export const getAllSuppliers = async (): Promise<Supplier[]> => {
  const response = await fetch(`${API_BASE}/replenishment/suppliers`);
  if (!response.ok) {
    throw new Error("Error al obtener proveedores.");
  }
  const data = await response.json();
  return data.data;
};

export const createSupplier = async (
  supplier: Omit<Supplier, "id" | "createdAt">
): Promise<Supplier> => {
  const response = await fetch(`${API_BASE}/replenishment/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(supplier),
  });
  if (!response.ok) {
    throw new Error("Error al crear proveedor.");
  }
  const data = await response.json();
  return data.data;
};

// Reposición
export const getAllReplenishmentOrders = async (): Promise<ReplenishmentOrder[]> => {
  const response = await fetch(`${API_BASE}/replenishment/replenishment`);
  if (!response.ok) {
    throw new Error("Error al obtener órdenes de reposición.");
  }
  const data = await response.json();
  return data.data;
};

export const createReplenishmentOrder = async (
  dto: CreateReplenishmentDto
): Promise<ReplenishmentOrder> => {
  const response = await fetch(`${API_BASE}/replenishment/replenishment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    throw new Error("Error al solicitar orden de reposición.");
  }
  const data = await response.json();
  return data.data;
};

export const updateReplenishmentOrderStatus = async (
  id: string,
  status: string
): Promise<ReplenishmentOrder> => {
  const response = await fetch(`${API_BASE}/replenishment/replenishment/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Error al actualizar estado de la orden.");
  }
  const data = await response.json();
  return data.data;
};
