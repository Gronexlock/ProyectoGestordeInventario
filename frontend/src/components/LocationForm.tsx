import { useState } from "react";
import type { CreateLocationDto, LocationType } from "../types/location";
import { createLocation } from "../services/locationService";

const LOCATION_TYPES: LocationType[] = ["bodega", "tienda", "almacen", "deposito", "otro"];

interface LocationFormProps {
  onSuccess?: () => void;
}

export const LocationForm = ({ onSuccess }: LocationFormProps) => {
  const [formData, setFormData] = useState<CreateLocationDto>({
    name: "",
    type: "bodega",
    capacity: undefined,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "capacity" && value ? parseInt(value, 10) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await createLocation(formData);
      setSuccess(true);
      setFormData({ name: "", type: "bodega", capacity: undefined });

      setTimeout(() => setSuccess(false), 3000);

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "400px", margin: "0 auto" }}>
      {error && (
        <div style={{ padding: "10px", marginBottom: "15px", color: "#d32f2f", backgroundColor: "#ffebee", border: "1px solid #ef5350", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: "10px", marginBottom: "15px", color: "#2e7d32", backgroundColor: "#e8f5e9", border: "1px solid #66bb6a", borderRadius: "4px" }}>
          ✓ Ubicación creada exitosamente
        </div>
      )}

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="name" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
          Nombre <span style={{ color: "red" }}>*</span>
        </label>
        <input
          id="name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Ej: Bodega Principal"
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxSizing: "border-box",
            fontSize: "14px",
          }}
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="type" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
          Tipo <span style={{ color: "red" }}>*</span>
        </label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxSizing: "border-box",
            fontSize: "14px",
          }}
        >
          {LOCATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="capacity" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
          Capacidad (opcional)
        </label>
        <input
          id="capacity"
          type="number"
          name="capacity"
          value={formData.capacity || ""}
          onChange={handleChange}
          min="1"
          placeholder="Ej: 1000"
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxSizing: "border-box",
            fontSize: "14px",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: "10px",
          backgroundColor: loading ? "#ccc" : "#1976d2",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "14px",
          fontWeight: "500",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Creando..." : "Crear Ubicación"}
      </button>
    </form>
  );
};
