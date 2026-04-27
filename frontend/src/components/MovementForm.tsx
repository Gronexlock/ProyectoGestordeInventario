import { useState, useEffect } from "react";
import type { CreateMovementDto } from "../types/movement";
import type { Location } from "../types/location";
import type { Product } from "../types/product";
import { createMovement } from "../services/movementService";
import { getAllLocations } from "../services/locationService";
import { getAllProducts } from "../services/productService";

export const MovementForm = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [formData, setFormData] = useState<CreateMovementDto>({
    productId: "",
    locationId: "",
    type: "IN",
    quantity: 1,
    note: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locsData, prodsData] = await Promise.all([
          getAllLocations(),
          getAllProducts()
        ]);
        setLocations(locsData);
        setProducts(prodsData);

        if (locsData.length > 0 && prodsData.length > 0) {
          setFormData(prev => ({
            ...prev,
            locationId: locsData[0].id,
            productId: prodsData[0].id
          }));
        }
      } catch (err) {
        console.error("Error cargando dependencias", err);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantity" ? parseInt(value, 10) : value,
    }));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    
    if (!formData.productId || !formData.locationId) {
      setError("Debes seleccionar un producto y una ubicación.");
      return;
    }

    if (formData.type === "IN") {
      const selectedLocation = locations.find(l => l.id === formData.locationId);
      
      if (selectedLocation && selectedLocation.capacity) {
        
        const currentStock = selectedLocation.stocks?.reduce((total, stock) => total + stock.quantity, 0) || 0;
        const newTotalStock = currentStock + formData.quantity;
        
        if (newTotalStock > selectedLocation.capacity) {
          const errMsg = `Error: La ubicación "${selectedLocation.name}" tiene capacidad para ${selectedLocation.capacity} unidades. Estás intentando agregar ${formData.quantity}.`;
          console.error(errMsg); 
          setError(errMsg); 
          return; 
        }
      }
    }

    setLoading(true);

    try {
      await createMovement(formData);
      setSuccess(true);
      
      const updatedLocs = await getAllLocations();
      setLocations(updatedLocs);
      
      setFormData(prev => ({ ...prev, quantity: 1, note: "" })); 
      setTimeout(() => setSuccess(false), 3000);
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
          ✓ Movimiento registrado exitosamente
        </div>
      )}

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="productId" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
          Producto <span style={{ color: "red" }}>*</span>
        </label>
        <select
          id="productId"
          name="productId"
          value={formData.productId}
          onChange={handleChange}
          required
          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px" }}
        >
          <option value="" disabled>Selecciona un producto</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="locationId" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
          Ubicación <span style={{ color: "red" }}>*</span>
        </label>
        <select
          id="locationId"
          name="locationId"
          value={formData.locationId}
          onChange={handleChange}
          required
          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px" }}
        >
          <option value="" disabled>Selecciona una ubicación</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="type" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
          Tipo de Movimiento <span style={{ color: "red" }}>*</span>
        </label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px" }}
        >
          <option value="IN">Entrada (IN)</option>
          <option value="OUT">Salida (OUT)</option>
        </select>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="quantity" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
          Cantidad <span style={{ color: "red" }}>*</span>
        </label>
        <input
          id="quantity"
          type="number"
          name="quantity"
          value={formData.quantity}
          onChange={handleChange}
          min="1"
          required
          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px" }}
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="note" style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
          Nota (opcional)
        </label>
        <textarea
          id="note"
          name="note"
          value={formData.note || ""}
          onChange={handleChange}
          placeholder="Ej: Ingreso por nuevo lote..."
          rows={3}
          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit" }}
        />
      </div>

      <button
        type="submit"
        disabled={loading || products.length === 0 || locations.length === 0}
        style={{
          width: "100%",
          padding: "10px",
          backgroundColor: (loading || products.length === 0 || locations.length === 0) ? "#ccc" : "#1976d2",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "14px",
          fontWeight: "500",
          cursor: (loading || products.length === 0 || locations.length === 0) ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Registrando..." : "Registrar Movimiento"}
      </button>
    </form>
  );
};
