import { API_BASE } from "../config/apiConfig";

export type BalanceStatus = "EXCESS" | "DEFICIT" | "OK";

export interface LocationBalance {
  locationId: string;
  locationName: string;
  locationType: string;
  priority: number;
  quantity: number;
  reserved: number;
  stockDisponible: number;
  average: number;
  status: BalanceStatus;
  suggestedTransferQty: number;
}

export interface SuggestedTransfer {
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  quantity: number;
}

export interface ProductBalance {
  productId: string;
  productName: string;
  sku: string;
  minStock: number;
  totalStock: number;
  averagePerLocation: number;
  locations: LocationBalance[];
  suggestedTransfers: SuggestedTransfer[];
}

export const getStockBalance = async (): Promise<ProductBalance[]> => {
  const res = await fetch(`${API_BASE}/sync/balance`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Error al obtener balance de stock");
  }
  const data = await res.json();
  return data.data;
};

export const executeSyncTransfer = async (dto: {
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
}): Promise<unknown> => {
  const res = await fetch(`${API_BASE}/sync/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Error al ejecutar transferencia");
  }
  const data = await res.json();
  return data.data;
};
