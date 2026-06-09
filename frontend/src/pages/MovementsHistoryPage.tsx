import { useState, useEffect } from "react";
import type { Movement, MovementType } from "../types/movement";
import { getAllMovements } from "../services/movementService";

const TYPE_CONFIG: Record<MovementType, { label: string; color: string; bg: string; icon: string }> = {
  IN: { label: "Entrada", color: "#1b5e20", bg: "#e8f5e9", icon: "↓" },
  OUT: { label: "Salida", color: "#b71c1c", bg: "#ffebee", icon: "↑" },
};

const fmt = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const MovementsHistoryPage = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filtros
  const [filterType, setFilterType] = useState<"all" | MovementType>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const loadMovements = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAllMovements();
        if (!cancelled) setMovements(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar movimientos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const filtered = movements.filter((m) => {
    if (filterType !== "all" && m.type !== filterType) return false;

    const q = filterSearch.toLowerCase();
    if (q) {
      const inProduct = m.product?.name?.toLowerCase().includes(q) || m.product?.sku?.toLowerCase().includes(q);
      const inLocation = m.location?.name?.toLowerCase().includes(q);
      const inNote = m.note?.toLowerCase().includes(q);
      if (!inProduct && !inLocation && !inNote) return false;
    }

    if (filterDateFrom) {
      if (new Date(m.createdAt) < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(m.createdAt) > to) return false;
    }

    return true;
  });

  const totalIN = filtered.filter((m) => m.type === "IN").reduce((s, m) => s + m.quantity, 0);
  const totalOUT = filtered.filter((m) => m.type === "OUT").reduce((s, m) => s + m.quantity, 0);

  const handleClearFilters = () => {
    setFilterType("all");
    setFilterSearch("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasFilters = filterType !== "all" || filterSearch || filterDateFrom || filterDateTo;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", color: "#1a237e" }}>📋 Historial de Movimientos</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#777" }}>
            Todas las entradas y salidas de inventario registradas
          </p>
        </div>
        <button
          onClick={loadMovements}
          disabled={loading}
          style={{
            padding: "8px 20px",
            backgroundColor: loading ? "#ccc" : "#1976d2",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 500,
            fontSize: "14px",
          }}
        >
          {loading ? "Cargando…" : "↻ Actualizar"}
        </button>
      </div>

      {/* Resumen */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Total movimientos", value: filtered.length, color: "#1565c0", bg: "#e3f2fd" },
            { label: "Entradas (uds.)", value: `+${totalIN.toLocaleString("es-CL")}`, color: "#1b5e20", bg: "#e8f5e9" },
            { label: "Salidas (uds.)", value: `−${totalOUT.toLocaleString("es-CL")}`, color: "#b71c1c", bg: "#ffebee" },
            { label: "Balance neto", value: (totalIN - totalOUT).toLocaleString("es-CL"), color: totalIN - totalOUT >= 0 ? "#1b5e20" : "#b71c1c", bg: totalIN - totalOUT >= 0 ? "#e8f5e9" : "#ffebee" },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                backgroundColor: card.bg,
                border: `1px solid ${card.color}30`,
                borderRadius: "8px",
                padding: "16px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "26px", fontWeight: 700, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div
        style={{
          backgroundColor: "#f5f5f5",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: "2 1 200px" }}>
          <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px", fontWeight: 500 }}>
            Buscar producto / ubicación / nota
          </label>
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Ej: camiseta, bodega…"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px", fontWeight: 500 }}>Tipo</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "all" | MovementType)}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
          >
            <option value="all">Todos</option>
            <option value="IN">Entradas</option>
            <option value="OUT">Salidas</option>
          </select>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px", fontWeight: 500 }}>Desde</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
          />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px", fontWeight: 500 }}>Hasta</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
          />
        </div>
        {hasFilters && (
          <button
            onClick={handleClearFilters}
            style={{
              padding: "8px 14px",
              backgroundColor: "white",
              color: "#555",
              border: "1px solid #bbb",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              alignSelf: "flex-end",
            }}
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px", backgroundColor: "#ffebee", color: "#c62828", borderRadius: "6px", marginBottom: "16px", border: "1px solid #ef9a9a" }}>
          {error}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#777", padding: "40px" }}>Cargando historial…</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: "center", color: "#777", padding: "40px" }}>
          {movements.length === 0
            ? "No hay movimientos registrados. Registra entradas o salidas desde la página de movimientos."
            : "No hay resultados para los filtros aplicados."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#1a237e", color: "white", textAlign: "left" }}>
                {["Fecha y hora", "Tipo", "Producto", "SKU", "Ubicación", "Cantidad", "Nota", "Reserva"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => {
                const cfg = TYPE_CONFIG[m.type];
                return (
                  <tr
                    key={m.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#fafafa" : "white",
                      borderBottom: "1px solid #e8e8e8",
                    }}
                  >
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#555", fontSize: "13px" }}>
                      {fmt(m.createdAt)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: cfg.color,
                          backgroundColor: cfg.bg,
                          letterSpacing: "0.3px",
                        }}
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                      {m.product?.name ?? <span style={{ color: "#bbb" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#555" }}>
                      {m.product?.sku ?? <span style={{ color: "#bbb" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {m.location?.name ?? <span style={{ color: "#bbb" }}>—</span>}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: m.type === "IN" ? "#1b5e20" : "#b71c1c",
                      }}
                    >
                      {m.type === "IN" ? "+" : "−"}{m.quantity.toLocaleString("es-CL")}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#666", maxWidth: "220px" }}>
                      {m.note ? (
                        <span title={m.note} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.note}
                        </span>
                      ) : (
                        <span style={{ color: "#ccc" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#888", fontSize: "13px" }}>
                      {m.reservationId ? `#${m.reservationId}` : <span style={{ color: "#ddd" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ textAlign: "right", fontSize: "12px", color: "#999", marginTop: "8px" }}>
            {filtered.length} de {movements.length} movimiento{movements.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
};
