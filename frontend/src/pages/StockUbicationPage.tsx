import { useState, useEffect, useCallback } from "react";
import type { Location } from "../types/location";
import { getAllLocations } from "../services/locationService";

// ─── helpers ────────────────────────────────────────────────────────────────
function pct(used: number, cap: number) {
  return Math.min(100, Math.round((used / cap) * 100));
}

function capacityColor(p: number) {
  if (p >= 90) return { bar: "#ef4444", text: "#b91c1c", bg: "#fff0f0" };
  if (p >= 65) return { bar: "#f97316", text: "#c2410c", bg: "#fff7ed" };
  return { bar: "#22c55e", text: "#15803d", bg: "#f0fdf4" };
}

const TYPE_ICONS: Record<string, string> = {
  bodega: "🏭", tienda: "🏪", almacen: "📦", deposito: "🏗️", otro: "📍",
};

// ─── Component ───────────────────────────────────────────────────────────────
export const StockUbicationPage = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [filterType, setFilterType] = useState<string>("todos");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllLocations();
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar ubicaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const types = ["todos", ...Array.from(new Set(locations.map((l) => l.type)))];

  const filtered = locations.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase());
    const matchType   = filterType === "todos" || l.type === filterType;
    return matchSearch && matchType;
  });

  // Global stats
  const totalStock = locations.reduce(
    (t, l) => t + (l.stocks?.reduce((s, st) => s + st.quantity, 0) ?? 0), 0
  );
  const totalCap = locations.reduce((t, l) => t + (l.capacity ?? 0), 0);
  const critical  = locations.filter((l) => {
    if (!l.capacity) return false;
    const used = l.stocks?.reduce((s, st) => s + st.quantity, 0) ?? 0;
    return pct(used, l.capacity) >= 90;
  }).length;

  return (
    <div className="su-root">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock por Ubicación</h1>
          <p className="page-subtitle">Disponibilidad real de cada bodega, tienda y almacén</p>
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Summary stats */}
      <div className="su-stats">
        {[
          { label: "Ubicaciones",    value: locations.length, color: "#284B63", bg: "#eef4f8" },
          { label: "Stock total",    value: totalStock,        color: "#3C6E71", bg: "#eef6f6" },
          { label: "Cap. total",     value: totalCap || "—",   color: "#555",    bg: "#f4f5f7" },
          { label: "Críticas (≥90%)", value: critical,          color: "#b91c1c", bg: "#fff0f0" },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ background: s.bg }}>
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="su-filters">
        <div className="su-search-wrap">
          <svg className="su-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="form-input su-search"
            placeholder="Buscar ubicación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="su-type-pills">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              className={`su-pill ${filterType === t ? "su-pill--active" : ""}`}
              onClick={() => setFilterType(t)}
            >
              {t === "todos" ? "Todos" : `${TYPE_ICONS[t] ?? ""} ${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert--error"><span>⚠</span><span>{error}</span></div>
      )}

      {/* Content */}
      {loading ? (
        <div className="su-empty">
          <span className="spinner spinner--dark" />
          <span>Cargando ubicaciones...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="su-empty">
          <div style={{ fontSize: "2rem" }}>🔍</div>
          <p style={{ fontWeight: 600, color: "#555" }}>Sin resultados</p>
          <p style={{ fontSize: "0.82rem", color: "#999" }}>Prueba con otro filtro o búsqueda</p>
        </div>
      ) : (
        <div className="su-grid">
          {filtered.map((loc) => {
            const used = loc.stocks?.reduce((s, st) => s + st.quantity, 0) ?? 0;
            const hasCap = !!loc.capacity;
            const p = hasCap ? pct(used, loc.capacity!) : null;
            const col = p !== null ? capacityColor(p) : null;
            const available = hasCap ? loc.capacity! - used : null;

            return (
              <div key={loc.id} className="su-card card">
                {/* Card header */}
                <div className="su-card-header">
                  <span className="su-card-icon">{TYPE_ICONS[loc.type] ?? "📍"}</span>
                  <div className="su-card-title-wrap">
                    <h3 className="su-card-name">{loc.name}</h3>
                    <span className="su-card-type">{loc.type}</span>
                  </div>
                  {p !== null && (
                    <span className="su-pct-badge" style={{ color: col!.text, background: col!.bg }}>
                      {p}%
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {hasCap && p !== null && (
                  <div className="su-bar-wrap">
                    <div className="su-bar-track">
                      <div
                        className="su-bar-fill"
                        style={{ width: `${p}%`, background: col!.bar }}
                      />
                    </div>
                  </div>
                )}

                {/* Numbers row */}
                <div className="su-card-nums">
                  <div className="su-num">
                    <span className="su-num-value">{used}</span>
                    <span className="su-num-label">En stock</span>
                  </div>
                  {hasCap && (
                    <>
                      <div className="su-num-divider" />
                      <div className="su-num">
                        <span className="su-num-value" style={{ color: col!.text }}>{available}</span>
                        <span className="su-num-label">Espacio Libre</span>
                      </div>
                      <div className="su-num-divider" />
                      <div className="su-num">
                        <span className="su-num-value">{loc.capacity}</span>
                        <span className="su-num-label">Capacidad</span>
                      </div>
                    </>
                  )}
                  {!hasCap && (
                    <span className="su-no-cap">Sin capacidad definida</span>
                  )}
                </div>

                {/* Product breakdown - CORREGIDO PARA TS Y DISEÑO */}
                {loc.stocks && loc.stocks.length > 0 && (
                  <div className="su-stocks">
                    <p className="su-stocks-title">Productos</p>
                    {loc.stocks.map((st) => (
                      <div key={st.product?.id ?? st.productId} className="su-stock-row">
                        <div className="su-product-info">
                          <span className="su-product-name">
                            {st.product?.name ?? "Producto sin nombre"}
                          </span>
                          <code className="su-sku">
                            {st.product?.sku ?? st.productId}
                          </code>
                        </div>
                        <span className="su-stock-qty">{st.quantity} uds.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        /* Tipografías consistentes usando las variables globales */
        .su-root { animation: fadeUp 0.35s ease both; font-family: var(--font-body), sans-serif; }

        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
        }
        .page-title { font-family: var(--font-display), sans-serif; }

        /* Stats */
        .su-stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px; margin-bottom: 20px;
        }
        .stat-card {
          border-radius: var(--radius-md); padding: 16px;
          display: flex; flex-direction: column; gap: 4px;
          border: 1px solid rgba(0,0,0,0.05);
        }
        .stat-value { font-family: var(--font-display), sans-serif; font-size: 1.8rem; font-weight: 700; line-height: 1; }
        .stat-label { font-size: 0.78rem; color: #888; font-weight: 500; }

        /* Filters */
        .su-filters {
          display: flex; gap: 12px; flex-wrap: wrap; align-items: center;
          margin-bottom: 20px;
        }
        .su-search-wrap {
          position: relative; flex: 1; min-width: 200px;
        }
        .su-search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: #aaa; pointer-events: none;
        }
        .su-search { padding-left: 36px !important; width: 100%; }
        .su-type-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .su-pill {
          padding: 6px 14px; border-radius: 20px;
          border: 1.5px solid var(--color-gray);
          background: white; font-family: var(--font-body), sans-serif;
          font-size: 0.8rem; font-weight: 500; color: #666;
          cursor: pointer; transition: all var(--transition);
          white-space: nowrap;
        }
        .su-pill:hover { border-color: var(--color-teal); color: var(--color-teal); }
        .su-pill--active {
          background: var(--color-teal); border-color: var(--color-teal);
          color: white;
        }

        /* Alert */
        .alert {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: var(--radius-md);
          font-size: 0.875rem; font-weight: 500; margin-bottom: 16px;
          font-family: var(--font-body), sans-serif;
        }
        .alert--error { background: #fff0f0; color: #b91c1c; border: 1px solid #fecaca; }

        /* Grid */
        .su-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        /* Card */
        .su-card { display: flex; flex-direction: column; gap: 14px; }

        .su-card-header { display: flex; align-items: center; gap: 12px; }
        .su-card-icon { font-size: 1.6rem; line-height: 1; flex-shrink: 0; }
        .su-card-title-wrap { flex: 1; min-width: 0; }
        .su-card-name {
          font-family: var(--font-display), sans-serif; font-size: 1rem; font-weight: 700;
          color: var(--color-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .su-card-type {
          font-size: 0.72rem; text-transform: capitalize; color: #888;
          font-weight: 500; letter-spacing: 0.03em;
        }
        .su-pct-badge {
          font-family: var(--font-display), sans-serif; font-size: 1rem; font-weight: 700;
          padding: 4px 10px; border-radius: var(--radius-sm); flex-shrink: 0;
        }

        /* Bar */
        .su-bar-wrap { margin: -4px 0; }
        .su-bar-track {
          height: 6px; background: var(--color-gray); border-radius: 99px; overflow: hidden;
        }
        .su-bar-fill {
          height: 100%; border-radius: 99px;
          transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
        }

        /* Numbers */
        .su-card-nums {
          display: flex; align-items: center; gap: 0;
          background: #f8f9fa; border-radius: var(--radius-md); padding: 12px 16px;
        }
        .su-num { flex: 1; text-align: center; }
        .su-num-value {
          display: block; font-family: var(--font-display), sans-serif;
          font-size: 1.3rem; font-weight: 700; color: var(--color-dark); line-height: 1;
        }
        .su-num-label {
          display: block; font-size: 0.7rem; color: #999;
          font-weight: 500; margin-top: 3px;
        }
        .su-num-divider { width: 1px; height: 32px; background: #e0e0e0; flex-shrink: 0; }
        .su-no-cap { font-size: 0.78rem; color: #bbb; font-style: italic; flex: 1; text-align: center; }

        /* Product stocks */
        .su-stocks { border-top: 1px solid var(--color-gray); padding-top: 12px; }
        .su-stocks-title {
          font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.08em; color: #aaa; margin-bottom: 8px;
        }
        .su-stock-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 6px 0; border-bottom: 1px solid #f4f4f4;
          font-size: 0.85rem;
        }
        .su-stock-row:last-child { border-bottom: none; }
        
        /* Contenedor de info del producto */
        .su-product-info { display: flex; flex-direction: column; gap: 2px; }
        .su-product-name { font-weight: 600; color: var(--color-dark); font-size: 0.88rem; }
        
        .su-sku {
          font-family: 'Courier New', monospace; font-size: 0.72rem;
          background: var(--color-gray); padding: 1px 6px; border-radius: 4px; 
          color: var(--color-navy); width: fit-content;
        }
        .su-stock-qty { font-weight: 600; color: var(--color-teal); flex-shrink: 0; }

        /* Empty / loading */
        .su-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 60px 24px; color: #999;
          font-family: var(--font-body), sans-serif;
        }

        /* Spinner */
        .spinner {
          width: 18px; height: 18px; display: inline-block;
          border: 2px solid rgba(255,255,255,0.4); border-top-color: white;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        .spinner--dark { border-color: rgba(0,0,0,0.1); border-top-color: var(--color-teal); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};