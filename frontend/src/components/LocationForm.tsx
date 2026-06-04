import { useState } from "react";
import type { CreateLocationDto, LocationType } from "../types/location";
import { createLocation } from "../services/locationService";

const LOCATION_TYPES: LocationType[] = ["bodega", "tienda", "almacen", "deposito", "otro"];

const TYPE_ICONS: Record<LocationType, string> = {
  bodega: "🏭",
  tienda: "🏪",
  almacen: "📦",
  deposito: "🏗️",
  otro: "📍",
};

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
    <form onSubmit={handleSubmit} className="lf-form">
      {error && (
        <div className="alert alert--error">
          <span className="alert-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert--success">
          <span className="alert-icon">✓</span>
          <span>Ubicación creada exitosamente</span>
        </div>
      )}

      {/* Nombre */}
      <div className="form-group">
        <label htmlFor="name" className="form-label">
          Nombre <span className="required">*</span>
        </label>
        <input
          id="name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Ej: Bodega Principal"
          className="form-input"
        />
      </div>

      {/* Tipo */}
      <div className="form-group">
        <label htmlFor="type" className="form-label">
          Tipo <span className="required">*</span>
        </label>
        <div className="type-grid">
          {LOCATION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`type-chip ${formData.type === type ? "type-chip--active" : ""}`}
              onClick={() => setFormData((prev) => ({ ...prev, type }))}
            >
              <span>{TYPE_ICONS[type]}</span>
              <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </button>
          ))}
        </div>
        {/* hidden select to keep form valid */}
        <input type="hidden" name="type" value={formData.type} />
      </div>

      {/* Capacidad */}
      <div className="form-group">
        <label htmlFor="capacity" className="form-label">
          Capacidad
          <span className="form-label-hint">opcional</span>
        </label>
        <div className="input-with-unit">
          <input
            id="capacity"
            type="number"
            name="capacity"
            value={formData.capacity || ""}
            onChange={handleChange}
            min="1"
            placeholder="1000"
            className="form-input"
          />
          <span className="input-unit">uds.</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`btn btn-primary lf-submit ${loading ? "btn--loading" : ""}`}
      >
        {loading ? (
          <>
            <span className="spinner" />
            Creando...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Crear Ubicación
          </>
        )}
      </button>

      <style>{`
        .lf-form {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 20px;
        }
        .alert--error   { background: #fff0f0; color: #b91c1c; border: 1px solid #fecaca; }
        .alert--success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
        .alert-icon { font-size: 1rem; }

        .required { color: var(--color-teal); margin-left: 2px; }

        .form-label-hint {
          margin-left: 8px;
          font-size: 0.72rem;
          font-weight: 400;
          color: #999;
          background: var(--color-gray);
          padding: 1px 7px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 8px;
        }

        .type-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 8px;
          border: 1.5px solid var(--color-gray);
          border-radius: var(--radius-md);
          background: var(--color-white);
          color: #555;
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition);
        }
        .type-chip:hover {
          border-color: var(--color-teal);
          color: var(--color-teal);
          background: rgba(60,110,113,.05);
        }
        .type-chip--active {
          border-color: var(--color-teal);
          background: var(--color-teal);
          color: var(--color-white);
          box-shadow: 0 2px 8px rgba(60,110,113,.3);
        }
        .type-chip--active:hover {
          background: var(--color-teal-light);
          color: var(--color-white);
        }

        .input-with-unit {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-with-unit .form-input {
          padding-right: 44px;
          width: 100%;
        }
        .input-unit {
          position: absolute;
          right: 14px;
          font-size: 0.8rem;
          color: #999;
          pointer-events: none;
        }

        .lf-submit {
          width: 100%;
          justify-content: center;
          padding: 12px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        .btn--loading { opacity: 0.75; cursor: not-allowed; }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
};