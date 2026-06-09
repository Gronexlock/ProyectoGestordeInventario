import type { Product } from "./product";
import type { Location } from "./location";

export type AlertStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export interface StockAlert {
  id: string;
  productId: string;
  locationId: string;
  currentStock: number;
  minStock: number;
  status: AlertStatus;
  createdAt: string;
  resolvedAt?: string;

  product?: Product & { minStock?: number };
  location?: Location;
}
