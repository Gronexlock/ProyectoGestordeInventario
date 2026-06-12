import type { StockItem } from "../types/stock";
import { API_BASE } from "../config/apiConfig";

export const getAllStock = async (): Promise<StockItem[]> => {
  const response = await fetch(`${API_BASE}/stock`);

  if (!response.ok) {
    throw new Error("Error al obtener el stock");
  }

  const data = await response.json();
  return data.data;
};

export const getStockByLocation = async (
  locationId: string
): Promise<{ location: { id: string; name: string; type: string }; stocks: StockItem[] }> => {
  const response = await fetch(`${API_BASE}/stock/${locationId}`);

  if (!response.ok) {
    throw new Error("Error al obtener el stock de la ubicación");
  }

  const data = await response.json();
  return data.data;
};
