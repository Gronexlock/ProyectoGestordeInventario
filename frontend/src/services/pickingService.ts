import { API_BASE } from "../config/apiConfig";

export interface PickItem {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: number;
  orders: Array<{ orderId: string; quantity: number }>;
}

export interface LocationPickGroup {
  location: { id: string; name: string; type: string; priority: number };
  items: PickItem[];
  totalUnits: number;
}

export interface BatchPickList {
  orderIds: string[];
  validOrders: number;
  skippedOrders: string[];
  groups: LocationPickGroup[];
  totalUnits: number;
}

export const getBatchPickList = async (orderIds: string[]): Promise<BatchPickList> => {
  const params = orderIds.join(",");
  const res = await fetch(`${API_BASE}/picking?orderIds=${encodeURIComponent(params)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Error al generar lista de picking");
  }
  const data = await res.json();
  return data.data;
};

export const getReadyForDispatchOrders = async (): Promise<Array<{
  id: string;
  customerName: string;
  status: string;
  createdAt: string;
  items: Array<{ productId: string; quantity: number }>;
}>> => {
  const res = await fetch(`${API_BASE}/orders?status=READY_FOR_DISPATCH`);
  if (!res.ok) throw new Error("Error al obtener órdenes");
  const data = await res.json();
  return data.data ?? [];
};
