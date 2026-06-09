import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Location } from "../types/location";
import type { Product } from "../types/product";
import { getAllLocations } from "../services/locationService";
import { getAllProducts } from "../services/productService";
import { createTransfer } from "../services/movementService";
import { useToast } from "../hooks/useToast";

export const TransferPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [productId, setProductId] = useState("");
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState("");

  const { data: locations = [], isLoading: loadingLocs } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: getAllLocations,
    select: (locs) => {
      if (!sourceLocationId && locs.length > 0) setSourceLocationId(locs[0].id);
      if (!destinationLocationId && locs.length > 1) setDestinationLocationId(locs[1].id);
      return locs;
    },
  });

  const { data: products = [], isLoading: loadingProds } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: getAllProducts,
    select: (prods) => {
      if (!productId && prods.length > 0) setProductId(prods[0].id);
      return prods;
    },
  });

  const transferMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      showToast("Transferencia registrada exitosamente.", "success");
      setQuantity(1);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (err: Error) => {
      showToast(err.message || "Error al realizar la transferencia", "error");
    },
  });

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSourceLocationId(val);
    if (val === destinationLocationId) {
      const other = locations.find((l) => l.id !== val);
      setDestinationLocationId(other?.id ?? "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !sourceLocationId || !destinationLocationId) {
      showToast("Por favor, completa todos los campos requeridos.", "warning");
      return;
    }
    if (sourceLocationId === destinationLocationId) {
      showToast("La ubicación de origen y destino deben ser distintas.", "warning");
      return;
    }
    if (quantity <= 0) {
      showToast("La cantidad debe ser mayor a cero.", "warning");
      return;
    }
    transferMutation.mutate({ productId, sourceLocationId, destinationLocationId, quantity, note });
  };

  const destinationOptions = locations.filter((l) => l.id !== sourceLocationId);
  const isFetching = loadingLocs || loadingProds;

  return (
    <div className="page" style={{ padding: "20px" }}>
      <div className="page-header" style={{ marginBottom: "28px" }}>
        <h1 className="page-title" style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700 }}>
          🔄 Transferencia de Inventario
        </h1>
        <p className="page-subtitle" style={{ fontSize: "0.9rem", color: "#666", marginTop: "4px" }}>
          Transfiere stock de forma atómica y segura entre distintas ubicaciones
        </p>
      </div>

      <div className="card" style={{ maxWidth: "600px", margin: "0 auto" }}>
        {transferMutation.isError && (
          <div
            role="alert"
            style={{ marginBottom: "20px", display: "flex", gap: "10px", padding: "12px", background: "#fff0f0", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.875rem" }}
          >
            <span aria-hidden="true">⚠️</span>
            <span>{(transferMutation.error as Error)?.message}</span>
          </div>
        )}

        {isFetching ? (
          <div role="status" aria-live="polite" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px", color: "#888" }}>
            <span>Cargando datos del almacén...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} aria-label="Formulario de transferencia de inventario">
            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label htmlFor="product-select" className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#555", display: "block", marginBottom: "6px" }}>
                Seleccionar Producto <span aria-hidden="true" style={{ color: "var(--color-teal)" }}>*</span>
              </label>
              <select
                id="product-select"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="form-input"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid var(--color-gray)" }}
                required
                aria-required="true"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — SKU: {p.sku}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div className="form-group">
                <label htmlFor="source-select" className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#555", display: "block", marginBottom: "6px" }}>
                  Ubicación Origen <span aria-hidden="true" style={{ color: "var(--color-teal)" }}>*</span>
                </label>
                <select id="source-select" value={sourceLocationId} onChange={handleSourceChange} className="form-input" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid var(--color-gray)" }} required aria-required="true">
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="dest-select" className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#555", display: "block", marginBottom: "6px" }}>
                  Ubicación Destino <span aria-hidden="true" style={{ color: "var(--color-teal)" }}>*</span>
                </label>
                <select id="dest-select" value={destinationLocationId} onChange={(e) => setDestinationLocationId(e.target.value)} className="form-input" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid var(--color-gray)" }} required aria-required="true" disabled={destinationOptions.length === 0}>
                  {destinationOptions.length === 0
                    ? <option value="">No hay otras ubicaciones</option>
                    : destinationOptions.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label htmlFor="quantity-input" className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#555", display: "block", marginBottom: "6px" }}>
                Cantidad a Transferir <span aria-hidden="true" style={{ color: "var(--color-teal)" }}>*</span>
              </label>
              <input id="quantity-input" type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} className="form-input" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid var(--color-gray)" }} required aria-required="true" />
            </div>

            <div className="form-group" style={{ marginBottom: "24px" }}>
              <label htmlFor="note-input" className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#555", display: "block", marginBottom: "6px" }}>
                Comentario / Motivo <span style={{ fontSize: "0.75rem", color: "#999", marginLeft: "4px" }}>(opcional)</span>
              </label>
              <textarea id="note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Traspaso de excedente a bodega de despacho..." rows={3} className="form-input" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid var(--color-gray)", resize: "vertical" }} />
            </div>

            <button
              type="submit"
              disabled={transferMutation.isPending || destinationOptions.length === 0}
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px", borderRadius: "8px", fontWeight: "bold" }}
              aria-busy={transferMutation.isPending}
            >
              {transferMutation.isPending ? "Procesando Transferencia..." : "Confirmar Transferencia"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
