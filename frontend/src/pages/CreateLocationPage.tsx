import { LocationForm } from "../components/LocationForm";

export const CreateLocationPage = () => {
  return (
    <div style={{ padding: "20px" }}>
      {/* Encabezado estructurado igual al de Stock por Ubicación */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ 
          fontFamily: "var(--font-display)", 
          fontSize: "1.75rem", 
          fontWeight: 700, 
          color: "var(--color-dark)",
          lineHeight: "1.2" // <-- Corregido a camelCase y sin guión
        }}>
          Registrar Nueva Ubicación
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#666", marginTop: "4px" }}>
          Añade una nueva bodega, tienda o almacén al sistema de gestión
        </p>
      </div>

      <LocationForm />
    </div>
  );
};