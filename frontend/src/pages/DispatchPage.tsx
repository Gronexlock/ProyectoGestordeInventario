import { useState, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
// Ajusta según los tipos reales de tu backend cuando estén disponibles
interface DispatchOrder {
  orderId: number;
  sku: string;
  productName: string;
  quantity: number;
  locationName: string;
  priority: "ALTA" | "MEDIA" | "BAJA";
  route?: string;
  assignedAt?: string;
}

// ─── Mock data (reemplaza con tu llamada real al servicio cuando esté listo) ──
const MOCK_ORDERS: DispatchOrder[] = [
  { orderId: 1001, sku: "SKU-001", productName: "Caja estándar 40x30", quantity: 50,  locationName: "Bodega Central",    priority: "ALTA" },
  { orderId: 1002, sku: "SKU-007", productName: "Pallet madera 120x80", quantity: 12, locationName: "Almacén Norte",     priority: "ALTA" },
  { orderId: 1003, sku: "SKU-012", productName: "Film strech 500m",     quantity: 8,  locationName: "Bodega Central",    priority: "MEDIA" },
  { orderId: 1004, sku: "SKU-003", productName: "Cinta adhesiva 48mm",  quantity: 200,locationName: "Depósito Sur",      priority: "MEDIA" },
  { orderId: 1005, sku: "SKU-019", productName: "Etiquetas termicas",   quantity: 500,locationName: "Tienda Showroom",   priority: "BAJA" },
  { orderId: 1006, sku: "SKU-025", productName: "Bolsas polietileno",   quantity: 300,locationName: "Almacén Norte",     priority: "BAJA" },
];

const ROUTES = ["Ruta Norte", "Ruta Sur", "Ruta Centro", "Ruta Express", "Ruta Especial"];

const PRIORITY_CONFIG = {
  ALTA:  { color: "#b91c1c", bg: "#fff0f0", dot: "#ef4444", label: "Alta" },
  MEDIA: { color: "#92400e", bg: "#fffbeb", dot: "#f59e0b", label: "Media" },
  BAJA:  { color: "#166534", bg: "#f0fdf4", dot: "#22c55e", label: "Baja" },
};

// ─── Component ───────────────────────────────────────────────────────────────
export const DispachPage = () => {
  const [orders, setOrders]     = useState<DispatchOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [assigned, setAssigned] = useState<Record<number, string>>({});
  const [saving, setSaving]     = useState<number | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("TODAS");
  const [search, setSearch]     = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 500));
      if (!cancelled) {
        setOrders(MOCK_ORDERS);
        setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleRouteChange = (orderId: number, route: string) => {
    setAssigned((prev) => ({ ...prev, [orderId]: route }));
  };

  const handleAssign = async (order: DispatchOrder) => {
    const route = assigned[order.orderId];
    if (!route) return;

    setSaving(order.orderId);
    // Simula guardado; reemplaza con tu llamada real al servicio
    await new Promise((r) => setTimeout(r, 600));

    setOrders((prev) =>
      prev.map((o) =>
        o.orderId === order.orderId
          ? { ...o, route, assignedAt: new Date().toLocaleTimeString("es-CL") }
          : o
      )
    );
    setSuccess(`Ruta asignada al pedido #${order.orderId} → ${route}`);
    setTimeout(() => setSuccess(null), 3000);
    setSaving(null);
  };

  const priorities = ["TODAS", "ALTA", "MEDIA", "BAJA"];
  const filtered = orders.filter((o) => {
    const matchPriority = filterPriority === "TODAS" || o.priority === filterPriority;
    const matchSearch   = o.productName.toLowerCase().includes(search.toLowerCase()) ||
                          o.sku.toLowerCase().includes(search.toLowerCase()) ||
                          String(o.orderId).includes(search);
    return matchPriority && matchSearch;
  });

  const pendingCount  = orders.filter((o) => !o.route).length;
  const assignedCount = orders.filter((o) => o.route).length;

  return (
    <div className="dp-root">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos para Despacho</h1>
          <p className="page-subtitle">Asigna una ruta de salida a cada pedido listo para despachar</p>
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="dp-stats">
        {[
          { label: "Total pedidos",  value: orders.length,  color: "#284B63", bg: "#eef4f8" },
          { label: "Pendientes",     value: pendingCount,   color: "#c2410c", bg: "#fff7ed" },
          { label: "Con ruta",       value: assignedCount,  color: "#15803d", bg: "#f0fdf4" },
          { label: "Prioridad alta", value: orders.filter((o) => o.priority === "ALTA").length, color: "#b91c1c", bg: "#fff0f0" },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ background: s.bg }}>
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Success alert */}
      {success && (
        <div className="alert alert--success"><span>✓</span><span>{success}</span></div>
      )}

      {/* Filters */}
      <div className="dp-filters">
        <div className="dp-search-wrap">
          <svg className="dp-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="form-input dp-search"
            placeholder="Buscar pedido, SKU o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="dp-priority-pills">
          {priorities.map((p) => (
            <button
              key={p}
              type="button"
              className={`dp-pill ${filterPriority === p ? "dp-pill--active" : ""}`}
              onClick={() => setFilterPriority(p)}
            >
              {p === "TODAS" ? "Todas" : PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="dp-empty">
          <span className="spinner spinner--dark" />
          <span>Cargando pedidos...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="dp-empty">
          <div style={{ fontSize: "2rem" }}>🚛</div>
          <p style={{ fontWeight: 600, color: "#555" }}>Sin pedidos</p>
          <p style={{ fontSize: "0.82rem", color: "#999" }}>No hay pedidos que coincidan con el filtro</p>
        </div>
      ) : (
        <div className="card dp-table-card">
          <div className="dp-table-wrap">
            <table className="dp-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Ubicación</th>
                  <th>Cant.</th>
                  <th>Prioridad</th>
                  <th>Ruta asignada</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const pc = PRIORITY_CONFIG[order.priority];
                  const isSaving = saving === order.orderId;
                  const hasRoute = !!order.route;

                  return (
                    <tr key={order.orderId} className={hasRoute ? "row--done" : ""}>
                      <td><span className="dp-id">#{order.orderId}</span></td>
                      <td><code className="dp-sku">{order.sku}</code></td>
                      <td className="dp-product">{order.productName}</td>
                      <td className="dp-location">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        {order.locationName}
                      </td>
                      <td><span className="dp-qty">{order.quantity}</span></td>
                      <td>
                        <span className="dp-badge" style={{ color: pc.color, background: pc.bg }}>
                          <span className="dp-dot" style={{ background: pc.dot }} />
                          {pc.label}
                        </span>
                      </td>
                      <td>
                        {hasRoute ? (
                          <span className="dp-route-assigned">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            {order.route}
                            {order.assignedAt && (
                              <span className="dp-route-time">{order.assignedAt}</span>
                            )}
                          </span>
                        ) : (
                          <div className="select-wrapper">
                            <select
                              className="form-input form-select dp-route-select"
                              value={assigned[order.orderId] ?? ""}
                              onChange={(e) => handleRouteChange(order.orderId, e.target.value)}
                            >
                              <option value="" disabled>Seleccionar ruta...</option>
                              {ROUTES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <span className="select-arrow">▾</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {!hasRoute ? (
                          <button
                            type="button"
                            className="dp-assign-btn"
                            disabled={!assigned[order.orderId] || isSaving}
                            onClick={() => handleAssign(order)}
                          >
                            {isSaving ? <span className="spinner" /> : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                            Asignar
                          </button>
                        ) : (
                          <span className="dp-done-label">✓ Listo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .dp-root { animation: fadeUp 0.35s ease both; font-family: var(--font-body); }

        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
        }

        /* Stats */
        .dp-stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px; margin-bottom: 20px;
        }
        .stat-card {
          border-radius: var(--radius-md); padding: 16px;
          display: flex; flex-direction: column; gap: 4px;
          border: 1px solid rgba(0,0,0,0.05);
        }
        .stat-value { font-family: var(--font-display); font-size: 1.8rem; font-weight: 700; line-height: 1; }
        .stat-label { font-size: 0.78rem; color: #888; font-weight: 500; }

        /* Alert */
        .alert {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: var(--radius-md);
          font-size: 0.875rem; font-weight: 500; margin-bottom: 16px;
          font-family: var(--font-body);
        }
        .alert--success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }

        /* Filters */
        .dp-filters {
          display: flex; gap: 12px; flex-wrap: wrap;
          align-items: center; margin-bottom: 20px;
        }
        .dp-search-wrap { position: relative; flex: 1; min-width: 220px; }
        .dp-search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: #aaa; pointer-events: none;
        }
        .dp-search { padding-left: 36px !important; width: 100%; }
        .dp-priority-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .dp-pill {
          padding: 6px 14px; border-radius: 20px;
          border: 1.5px solid var(--color-gray);
          background: white; font-family: var(--font-body);
          font-size: 0.8rem; font-weight: 500; color: #666;
          cursor: pointer; transition: all var(--transition);
        }
        .dp-pill:hover { border-color: var(--color-teal); color: var(--color-teal); }
        .dp-pill--active { background: var(--color-navy); border-color: var(--color-navy); color: white; }

        /* Table */
        .dp-table-card { padding: 0; overflow: hidden; }
        .dp-table-wrap { overflow-x: auto; }
        .dp-table {
          width: 100%; border-collapse: collapse;
          font-size: 0.875rem; font-family: var(--font-body);
        }
        .dp-table th {
          padding: 14px 14px; text-align: left;
          font-size: 0.70rem; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: #888;
          border-bottom: 1px solid var(--color-gray); background: #fafafa;
          font-family: var(--font-body); white-space: nowrap;
        }
        .dp-table td {
          padding: 12px 14px; border-bottom: 1px solid #f0f0f0;
          vertical-align: middle; color: var(--color-dark);
          font-family: var(--font-body);
        }
        .dp-table tr:last-child td { border-bottom: none; }
        .dp-table tbody tr { transition: background var(--transition); }
        .dp-table tbody tr:hover { background: #fafafa; }
        .row--done td { color: #aaa; }
        .row--done .dp-id, .row--done .dp-qty { color: #aaa !important; }

        .dp-id { font-weight: 700; color: var(--color-navy); }
        .dp-sku {
          font-family: 'Courier New', monospace; font-size: 0.78rem;
          background: var(--color-gray); padding: 2px 6px; border-radius: 4px;
        }
        .dp-product { font-weight: 500; max-width: 180px; }
        .dp-location {
          display: flex; align-items: center; gap: 4px;
          color: #666; font-size: 0.82rem;
        }
        .dp-qty { font-weight: 700; color: var(--color-teal); }

        .dp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px;
          font-size: 0.75rem; font-weight: 600; white-space: nowrap;
        }
        .dp-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        /* Route select */
        .select-wrapper { position: relative; display: block; min-width: 160px; }
        .form-select {
          appearance: none; -webkit-appearance: none;
          padding-right: 32px; cursor: pointer; width: 100%;
          font-family: var(--font-body); display: block;
        }
        .select-arrow {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          color: #999; pointer-events: none; font-size: 0.85rem; line-height: 1;
        }
        .dp-route-select { font-size: 0.82rem; padding: 7px 32px 7px 10px !important; }

        .dp-route-assigned {
          display: flex; align-items: center; gap: 5px;
          color: #15803d; font-weight: 600; font-size: 0.82rem;
        }
        .dp-route-time {
          font-weight: 400; color: #aaa; font-size: 0.75rem; margin-left: 4px;
        }

        /* Assign button */
        .dp-assign-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: var(--radius-sm);
          background: var(--color-teal); color: white;
          border: none; font-family: var(--font-body);
          font-size: 0.8rem; font-weight: 600; cursor: pointer;
          transition: all var(--transition); white-space: nowrap;
        }
        .dp-assign-btn:hover:not(:disabled) {
          background: var(--color-teal-light); transform: translateY(-1px);
        }
        .dp-assign-btn:disabled { background: #ccc; cursor: not-allowed; }
        .dp-done-label { color: #15803d; font-size: 0.82rem; font-weight: 600; }

        /* Empty / loading */
        .dp-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 60px 24px; color: #999; font-family: var(--font-body);
        }

        /* Spinner */
        .spinner {
          width: 13px; height: 13px; display: inline-block;
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