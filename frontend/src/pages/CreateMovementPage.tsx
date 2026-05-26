import { MovementForm } from "../components/MovementForm";

export const CreateMovementPage = () => {
  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ 
          fontFamily: "var(--font-display)", 
          fontSize: "1.75rem", 
          fontWeight: 700, 
          color: "var(--color-dark)",
          lineHeight: "1.2" // <-- Corregido aquí también
        }}>
          Registrar Movimiento de Stock
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#666", marginTop: "4px" }}>
          Registra entradas o salidas de productos en el inventario
        </p>
      </div>

      <MovementForm />
    </div>
  );
};