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
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locsData, prodsData] = await Promise.all([
          getAllLocations(),
          getAllProducts(),
        ]);
        setLocations(locsData);
        setProducts(prodsData);

        if (locsData.length > 0 && prodsData.length > 0) {
          setFormData((prev) => ({
            ...prev,
            locationId: locsData[0].id,
            productId: prodsData[0].id,
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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
      const selectedLocation = locations.find((l) => l.id === formData.locationId);
      if (selectedLocation?.capacity) {
        const currentStock =
          selectedLocation.stocks?.reduce((t, s) => t + s.quantity, 0) ?? 0;
        if (currentStock + formData.quantity > selectedLocation.capacity) {
          setError(
            `"${selectedLocation.name}" tiene capacidad para ${selectedLocation.capacity} uds. ` +
              `(stock actual: ${currentStock}). No puedes ingresar ${formData.quantity} más.`
          );
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
      setFormData((prev) => ({ ...prev, quantity: 1, note: "" }));
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || products.length === 0 || locations.length === 0;

  return (
    <form onSubmit={handleSubmit} className="mf-form">
      {error && (
        <div className="alert alert--error">
          <span className="alert-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert--success">
          <span className="alert-icon">✓</span>
          <span>Movimiento registrado exitosamente</span>
        </div>
      )}

      {fetching ? (
        <div className="mf-loading">
          <span className="spinner spinner--dark" />
          <span>Cargando datos...</span>
        </div>
      ) : (
        <>
          {/* Tipo de movimiento — toggle prominente */}
          <div className="form-group">
            <label className="form-label">Tipo de Movimiento <span className="required">*</span></label>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-toggle-btn ${formData.type === "IN" ? "type-toggle-btn--in active" : ""}`}
                onClick={() => setFormData((p) => ({ ...p, type: "IN" }))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
                Entrada
              </button>
              <button
                type="button"
                className={`type-toggle-btn ${formData.type === "OUT" ? "type-toggle-btn--out active" : ""}`}
                onClick={() => setFormData((p) => ({ ...p, type: "OUT" }))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                </svg>
                Salida
              </button>
            </div>
          </div>

          {/* Producto */}
          <div className="form-group">
            <label htmlFor="productId" className="form-label">
              Producto <span className="required">*</span>
            </label>
            <div className="select-wrapper">
              <select
                id="productId"
                name="productId"
                value={formData.productId}
                onChange={handleChange}
                required
                className="form-input form-select"
              >
                <option value="" disabled>Selecciona un producto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — SKU: {p.sku}
                  </option>
                ))}
              </select>
              <span className="select-arrow">▾</span>
            </div>
          </div>

          {/* Ubicación */}
          <div className="form-group">
            <label htmlFor="locationId" className="form-label">
              Ubicación <span className="required">*</span>
            </label>
            <div className="select-wrapper">
              <select
                id="locationId"
                name="locationId"
                value={formData.locationId}
                onChange={handleChange}
                required
                className="form-input form-select"
              >
                <option value="" disabled>Selecciona una ubicación</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.type})
                    {l.capacity ? ` — Cap: ${l.capacity}` : ""}
                  </option>
                ))}
              </select>
              <span className="select-arrow">▾</span>
            </div>
          </div>

          {/* Cantidad */}
          <div className="form-group">
            <label htmlFor="quantity" className="form-label">
              Cantidad <span className="required">*</span>
            </label>
            <div className="quantity-row">
              <button
                type="button"
                className="qty-btn"
                onClick={() =>
                  setFormData((p) => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))
                }
              >−</button>
              <input
                id="quantity"
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                min="1"
                required
                className="form-input qty-input"
              />
              <button
                type="button"
                className="qty-btn"
                onClick={() =>
                  setFormData((p) => ({ ...p, quantity: p.quantity + 1 }))
                }
              >+</button>
            </div>
          </div>

          {/* Nota */}
          <div className="form-group">
            <label htmlFor="note" className="form-label">
              Nota
              <span className="form-label-hint">opcional</span>
            </label>
            <textarea
              id="note"
              name="note"
              value={formData.note || ""}
              onChange={handleChange}
              placeholder="Ej: Ingreso por nuevo lote..."
              rows={3}
              className="form-input form-textarea"
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            className={`btn btn-primary mf-submit ${isDisabled ? "btn--loading" : ""}`}
          >
            {loading ? (
              <><span className="spinner" />Registrando...</>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Registrar Movimiento
              </>
            )}
          </button>
        </>
      )}

      <style>{`
        .mf-form { display: flex; flex-direction: column; gap: 0; }

        .mf-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 32px;
          color: #888;
          font-size: 0.9rem;
        }

        .alert {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: var(--radius-md);
          font-size: 0.875rem; font-weight: 500; margin-bottom: 20px;
        }
        .alert--error   { background: #fff0f0; color: #b91c1c; border: 1px solid #fecaca; }
        .alert--success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }

        .required { color: var(--color-teal); margin-left: 2px; }
        .form-label-hint {
          margin-left: 8px; font-size: 0.72rem; font-weight: 400; color: #999;
          background: var(--color-gray); padding: 1px 7px; border-radius: 20px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }

        /* Type toggle */
        .type-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .type-toggle-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px;
          border: 1.5px solid var(--color-gray);
          border-radius: var(--radius-md);
          background: var(--color-white);
          font-family: var(--font-body); font-size: 0.9rem; font-weight: 600;
          color: #777; cursor: pointer; transition: all var(--transition);
        }
        .type-toggle-btn:hover { border-color: #aaa; color: #333; }
        .type-toggle-btn--in.active {
          border-color: var(--color-teal); background: var(--color-teal);
          color: white; box-shadow: 0 2px 10px rgba(60,110,113,.35);
        }
        .type-toggle-btn--out.active {
          border-color: var(--color-navy); background: var(--color-navy);
          color: white; box-shadow: 0 2px 10px rgba(40,75,99,.35);
        }

        /* Select */
        .select-wrapper { position: relative; display: block; }
        .form-select {
          appearance: none; -webkit-appearance: none;
          padding-right: 36px; cursor: pointer;
          width: 100%; display: block;
          font-family: var(--font-body);
        }
        .select-arrow {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          color: #999; pointer-events: none; font-size: 0.9rem; line-height: 1;
        }

        /* Textarea */
        .form-textarea { resize: vertical; min-height: 80px; font-family: var(--font-body); }

        /* Quantity row */
        .quantity-row { display: flex; align-items: center; gap: 8px; }
        .qty-btn {
          width: 38px; height: 38px; border-radius: var(--radius-md);
          border: 1.5px solid var(--color-gray); background: var(--color-white);
          font-size: 1.1rem; color: var(--color-dark);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all var(--transition); flex-shrink: 0;
        }
        .qty-btn:hover { border-color: var(--color-teal); color: var(--color-teal); }
        .qty-input { text-align: center; flex: 1; }

        .mf-submit {
          width: 100%; justify-content: center; padding: 12px;
          font-size: 0.9rem; margin-top: 8px;
        }
        .btn--loading { opacity: 0.7; cursor: not-allowed; }

        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.4); border-top-color: white;
          border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
        }
        .spinner--dark {
          border-color: rgba(0,0,0,0.15); border-top-color: var(--color-teal);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
};