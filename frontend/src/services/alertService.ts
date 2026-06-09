import type { StockAlert } from "../types/alert";

const API_BASE = "http://localhost:3000/api/v1";

export const getAlerts = async (status?: string): Promise<StockAlert[]> => {
  const url = status ? `${API_BASE}/alerts?status=${status}` : `${API_BASE}/alerts`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Error al obtener alertas de stock.");
  }
  const data = await response.json();
  return data.data;
};

export const resolveAlert = async (id: string): Promise<StockAlert> => {
  const response = await fetch(`${API_BASE}/alerts/${id}/resolve`, {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error("Error al resolver la alerta.");
  }
  const data = await response.json();
  return data.data;
};
