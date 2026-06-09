import { useState, useEffect } from "react";
import type { StockItem } from "../types/stock";
import { getAllStock } from "../services/stockService";
import { getAllLocations } from "../services/locationService";
import type { Location } from "../types/location";

const CRITICAL_THRESHOLD = 5;

const getLevelInfo = (stockDisponible: number, quantity: number) => {
  if (stockDisponible <= 0)
    return { label: "Sin stock", color: "#c62828", bg: "#ffebee", bar: "#ef5350", pct: 0 };
  if (stockDisponible <= CRITICAL_THRESHOLD)
    return { label: "Crítico", color: "#e65100", bg: "#fff3e0", bar: "#ff7043", pct: Math.min(100, (stockDisponible / (quantity || 1)) * 100) };
  if (stockDisponible <= 20)
    return { label: "Bajo", color: "#f57f17", bg: "#fffde7", bar: "#ffd54f", pct: Math.min(100, (stockDisponible / (quantity || 1)) * 100) };
  return { label: "Normal", color: "#2e7d32", bg: "#e8f5e9", bar: "#66bb6a", pct: Math.min(100, (stockDisponible / (quantity || 1)) * 100) };
};

export const StockPage = () => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadStock = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const [stockData, locData] = await Promise.all([getAllStock(), getAllLocations()]);
        if (!cancelled) {
          setStock(stockData);
          setLocations(locData);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el stock");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const filtered = stock.filter((item) => {
    const matchLocation = selectedLocation === "all" || item.locationId === selectedLocation;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      item.product.name.toLowerCase().includes(q) ||
      item.product.sku.toLowerCase().includes(q) ||
      item.location.name.toLowerCase().includes(q);
    return matchLocation && matchSearch;
  });

  const critical = filtered.filter((i) => i.stockDisponible <= CRITICAL_THRESHOLD && i.stockDisponible > 0);
  const outOfStock = filtered.filter((i) => i.stockDisponible <= 0);
  const totalUnits = filtered.reduce((sum, i) => sum + i.quantity, 0);
  const totalReserved = filtered.reduce((sum, i) => sum + i.reserved, 0);

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", color: "#1a237e" }}>📊 Reporte de Niveles de Stock</h1>
          {lastUpdated && (
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#777" }}>
              Última actualización: {lastUpdated.toLocaleTimeString("es-CL")}
            </p>
          )}
        </div>
        <button
          onClick={loadStock}
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
          {loading ? "Actualizando…" : "↻ Actualizar"}
        </button>
      </div>

      {/* Tarjetas de resumen */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Registros", value: filtered.length, color: "#1565c0", bg: "#e3f2fd" },
            { label: "Uds. físicas", value: totalUnits.toLocaleString("es-CL"), color: "#1b5e20", bg: "#e8f5e9" },
            { label: "Uds. reservadas", value: totalReserved.toLocaleString("es-CL"), color: "#6a1b9a", bg: "#f3e5f5" },
            { label: "Stock crítico", value: critical.length, color: "#bf360c", bg: "#fbe9e7" },
            { label: "Sin stock", value: outOfStock.length, color: "#c62828", bg: "#ffebee" },
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
              <div style={{ fontSize: "28px", fontWeight: 700, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar producto o SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            fontSize: "14px",
            flex: "1 1 200px",
            minWidth: "160px",
          }}
        />
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            fontSize: "14px",
            flex: "1 1 200px",
            minWidth: "160px",
          }}
        >
          <option value="all">Todas las ubicaciones</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} ({loc.type})
            </option>
          ))}
        </select>
      </div>

      {/* Estado de carga / error */}
      {error && (
        <div style={{ padding: "12px", backgroundColor: "#ffebee", color: "#c62828", borderRadius: "6px", marginBottom: "16px", border: "1px solid #ef9a9a" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#777", padding: "40px" }}>Cargando niveles de stock…</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: "center", color: "#777", padding: "40px" }}>
          {stock.length === 0
            ? "No hay registros de stock. Ejecuta el seed o registra movimientos de entrada."
            : "No hay resultados para los filtros aplicados."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#1a237e", color: "white", textAlign: "left" }}>
                {["Producto", "SKU", "Ubicación", "Tipo", "Físico", "Reservado", "Disponible", "Nivel", "Barra"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const level = getLevelInfo(item.stockDisponible, item.quantity);
                return (
                  <tr
                    key={item.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#fafafa" : "white",
                      borderBottom: "1px solid #e8e8e8",
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{item.product.name}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#555" }}>{item.product.sku}</td>
                    <td style={{ padding: "10px 12px" }}>{item.location.name}</td>
                    <td style={{ padding: "10px 12px", color: "#777", fontSize: "12px" }}>{item.location.type}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{item.quantity.toLocaleString("es-CL")}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#6a1b9a" }}>
                      {item.reserved > 0 ? `−${item.reserved}` : "0"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: level.color }}>
                      {item.stockDisponible.toLocaleString("es-CL")}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: level.color,
                          backgroundColor: level.bg,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {level.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", minWidth: "100px" }}>
                      <div style={{ backgroundColor: "#e0e0e0", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${level.pct}%`,
                            backgroundColor: level.bar,
                            height: "100%",
                            borderRadius: "4px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ textAlign: "right", fontSize: "12px", color: "#999", marginTop: "8px" }}>
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""} mostrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
};
