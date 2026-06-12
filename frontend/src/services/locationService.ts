import type { CreateLocationDto, Location } from "../types/location";
import { API_BASE } from "../config/apiConfig";

export const createLocation = async (dto: CreateLocationDto): Promise<Location> => {
  const response = await fetch(`${API_BASE}/locations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al crear la ubicación");
  }

  const data = await response.json();
  return data.data;
};

export const suggestSource = async (
  productId: string,
  quantity = 1
): Promise<Array<{
  location: { id: string; name: string; type: string; priority: number };
  quantity: number;
  reserved: number;
  stockDisponible: number;
  rank: number;
}>> => {
  const response = await fetch(`${API_BASE}/stock/suggest-source/${productId}?quantity=${quantity}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al obtener sugerencias");
  }
  const data = await response.json();
  return data.data;
};

export const getAllLocations = async (): Promise<Location[]> => {
  const response = await fetch(`${API_BASE}/locations`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Error al obtener ubicaciones");
  }

  const data = await response.json();
  return data.data;
};
