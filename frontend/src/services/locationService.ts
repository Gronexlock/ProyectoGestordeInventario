import type { CreateLocationDto, Location } from "../types/location";

const API_BASE = "http://localhost:3000/api";

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

export const getAllLocations = async (): Promise<Location[]> => {
  const response = await fetch(`${API_BASE}/v1/locations`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Error al obtener ubicaciones");
  }

  const data = await response.json();
  return data.data;
};
