import type { Product } from "./product";
import type { Location } from "./location";

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}

export type ReplenishmentStatus = "PENDING" | "ORDERED" | "RECEIVED" | "CANCELLED";

export interface ReplenishmentOrder {
  id: string;
  productId: string;
  locationId: string;
  supplierId: string;
  quantity: number;
  status: ReplenishmentStatus;
  createdAt: string;
  updatedAt: string;

  product?: Product;
  location?: Location;
  supplier?: Supplier;
}

export interface CreateReplenishmentDto {
  productId: string;
  locationId: string;
  supplierId: string;
  quantity: number;
}
