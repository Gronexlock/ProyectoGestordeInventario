import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StockAlert } from "../types/alert";
import type { Supplier, ReplenishmentOrder } from "../types/replenishment";
import type { Product } from "../types/product";
import type { Location } from "../types/location";
import { getAlerts, resolveAlert } from "../services/alertService";
import {
  getAllSuppliers,
  createSupplier as apiCreateSupplier,
  getAllReplenishmentOrders,
  createReplenishmentOrder,
  updateReplenishmentOrderStatus,
} from "../services/replenishmentService";
import { getAllLocations } from "../services/locationService";
import { getAllProducts } from "../services/productService";
import { useToast } from "../hooks/useToast";

type TabType = "alerts" | "replenishments" | "suppliers";

export const AlertsPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("alerts");

  // ── Modal estado ──────────────────────────────────────────────
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(50);

  // ── Formulario proveedor ──────────────────────────────────────
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  // ── Queries ───────────────────────────────────────────────────
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery<StockAlert[]>({
    queryKey: ["alerts", "PENDING"],
    queryFn: () => getAlerts("PENDING"),
  });

  const { data: replenishments = [], isLoading: loadingOrders } = useQuery<ReplenishmentOrder[]>({
    queryKey: ["replenishments"],
    queryFn: getAllReplenishmentOrders,
  });

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: getAllSuppliers,
    select: (list) => {
      if (!selectedSupplierId && list.length > 0) setSelectedSupplierId(list[0].id);
      return list;
    },
  });

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["products"], queryFn: getAllProducts });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["locations"], queryFn: getAllLocations });

  const loading = loadingAlerts || loadingOrders || loadingSuppliers;

  // ── Mutations ─────────────────────────────────────────────────
  const createSupplierMutation = useMutation({
    mutationFn: apiCreateSupplier,
    onSuccess: (created) => {
      showToast(`Proveedor "${created.name}" registrado con éxito.`, "success");
      setNewSupplierName(""); setNewSupplierEmail(""); setNewSupplierPhone("");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: () => showToast("Error al crear proveedor.", "error"),
  });

  const createOrderMutation = useMutation({
    mutationFn: createReplenishmentOrder,
    onSuccess: () => {
      showToast("Orden de compra registrada y solicitada al proveedor.", "success");
      setIsOrderModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["replenishments"] });
      queryClient.invalidateQueries({ queryKey: ["alerts", "PENDING"] });
    },
    onError: () => showToast("Error al procesar la orden.", "error"),
  });

  const receiveOrderMutation = useMutation({
    mutationFn: (id: string) => updateReplenishmentOrderStatus(id, "RECEIVED"),
    onSuccess: () => {
      showToast("Mercancía ingresada al inventario e historial actualizado.", "success");
      queryClient.invalidateQueries({ queryKey: ["replenishments"] });
      queryClient.invalidateQueries({ queryKey: ["alerts", "PENDING"] });
    },
    onError: (err: Error) => showToast(err.message || "Error al recibir orden", "error"),
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id: string) => updateReplenishmentOrderStatus(id, "CANCELLED"),
    onSuccess: () => {
      showToast("Orden cancelada.", "info");
      queryClient.invalidateQueries({ queryKey: ["replenishments"] });
    },
    onError: () => showToast("Error al cancelar la orden.", "error"),
  });

  const resolveAlertMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      showToast("Alerta archivada/resuelta.", "success");
      queryClient.invalidateQueries({ queryKey: ["alerts", "PENDING"] });
    },
    onError: () => showToast("Error al archivar la alerta.", "error"),
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName || !newSupplierEmail) { showToast("Nombre y Correo son requeridos.", "warning"); return; }
    createSupplierMutation.mutate({ name: newSupplierName, email: newSupplierEmail, phone: newSupplierPhone || undefined });
  };

  const openOrderModalForAlert = (alert: StockAlert) => {
    setSelectedProductId(alert.productId);
    setSelectedLocationId(alert.locationId);
    if (suppliers.length > 0 && !selectedSupplierId) setSelectedSupplierId(suppliers[0].id);
    setOrderQuantity(50);
    setIsOrderModalOpen(true);
  };

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedLocationId || !selectedSupplierId) { showToast("Faltan datos requeridos.", "warning"); return; }
    createOrderMutation.mutate({ productId: selectedProductId, locationId: selectedLocationId, supplierId: selectedSupplierId, quantity: orderQuantity });
  };

  const handleCancelOrder = (id: string) => {
    if (!window.confirm("¿Seguro que deseas cancelar esta orden?")) return;
    cancelOrderMutation.mutate(id);
  };

  // ── Tab button style helper ───────────────────────────────────
  const tabStyle = (tab: TabType) => ({
    padding: "10px 20px", border: "none", background: "none",
    borderBottom: activeTab === tab ? "3px solid var(--color-teal)" : "3px solid transparent",
    fontWeight: activeTab === tab ? "bold" : "normal" as const,
    color: activeTab === tab ? "var(--color-teal)" : "#666",
    cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px",
  });

  return (
    <div className="page" style={{ padding: "20px" }}>
      <div className="page-header" style={{ marginBottom: "28px" }}>
        <h1 className="page-title" style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700 }}>
          🔔 Reposiciones y Alertas de Stock
        </h1>
        <p className="page-subtitle" style={{ fontSize: "0.9rem", color: "#666", marginTop: "4px" }}>
          Supervisa niveles críticos de inventario, solicita reposiciones y gestiona proveedores
        </p>
      </div>

      {/* Tabs */}
      <div role="tablist" style={{ display: "flex", borderBottom: "2px solid #ddd", marginBottom: "24px", gap: "8px" }}>
        <button role="tab" aria-selected={activeTab === "alerts"} aria-controls="tab-alerts" onClick={() => setActiveTab("alerts")} style={tabStyle("alerts")}>
          ⚠️ Stock Crítico ({alerts.length})
        </button>
        <button role="tab" aria-selected={activeTab === "replenishments"} aria-controls="tab-replenishments" onClick={() => setActiveTab("replenishments")} style={tabStyle("replenishments")}>
          📦 Órdenes de Reposición ({replenishments.filter(r => r.status === "ORDERED").length} activas)
        </button>
        <button role="tab" aria-selected={activeTab === "suppliers"} aria-controls="tab-suppliers" onClick={() => setActiveTab("suppliers")} style={tabStyle("suppliers")}>
          🏢 Proveedores ({suppliers.length})
        </button>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" style={{ display: "flex", justifyContent: "center", padding: "40px", color: "#888" }}>
          <span>Cargando datos...</span>
        </div>
      ) : (
        <div>
          {/* TAB: ALERTAS */}
          {activeTab === "alerts" && (
            <div id="tab-alerts" role="tabpanel">
              {alerts.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "40px", color: "#666", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <span aria-hidden="true" style={{ fontSize: "2rem" }}>✓</span>
                  <p style={{ marginTop: "12px", fontWeight: "bold" }}>¡Excelente! No hay alertas de stock crítico pendientes.</p>
                  <p style={{ fontSize: "0.85rem", color: "#888", marginTop: "4px" }}>Todos los productos están por encima del umbral mínimo configurado.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {alerts.map((alert) => (
                    <div key={alert.id} className="card" role="article" aria-label={`Alerta de stock crítico: ${alert.product?.name}`} style={{ borderLeft: "5px solid #ef4444", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", padding: "16px 20px" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "0.7rem", background: "#fef2f2", color: "#b91c1c", padding: "3px 8px", borderRadius: "12px", fontWeight: "bold", textTransform: "uppercase" }}>Stock Crítico</span>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: "bold", margin: "6px 0 2px 0" }}>{alert.product?.name}</h3>
                        <p style={{ fontSize: "0.8rem", color: "#666" }}>SKU: <strong>{alert.product?.sku}</strong> | Ubicación: <strong>{alert.location?.name}</strong></p>
                      </div>
                      <div style={{ textAlign: "right", paddingRight: "20px" }}>
                        <span style={{ fontSize: "0.85rem", color: "#777", display: "block" }}>Stock Mínimo: {alert.minStock}</span>
                        <span style={{ fontSize: "1.25rem", color: "#b91c1c", fontWeight: "bold" }}>Actual: {alert.currentStock} uds</span>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => openOrderModalForAlert(alert)} className="btn btn-primary" style={{ fontSize: "0.8rem", padding: "8px 16px" }} aria-label={`Reponer stock de ${alert.product?.name}`}>
                          📦 Reponer Stock
                        </button>
                        <button onClick={() => resolveAlertMutation.mutate(alert.id)} className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "8px 16px", background: "#f3f4f6" }} aria-label={`Archivar alerta de ${alert.product?.name}`} disabled={resolveAlertMutation.isPending}>
                          Archivar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: ORDENES */}
          {activeTab === "replenishments" && (
            <div id="tab-replenishments" role="tabpanel" className="card" style={{ overflowX: "auto", padding: "0px", borderRadius: "12px" }}>
              {replenishments.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>No se han registrado órdenes de reposición.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }} aria-label="Órdenes de reposición">
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                      <th scope="col" style={{ padding: "16px" }}>ID Orden</th>
                      <th scope="col" style={{ padding: "16px" }}>Producto</th>
                      <th scope="col" style={{ padding: "16px" }}>Ubicación</th>
                      <th scope="col" style={{ padding: "16px" }}>Proveedor</th>
                      <th scope="col" style={{ padding: "16px" }}>Cantidad</th>
                      <th scope="col" style={{ padding: "16px" }}>Estado</th>
                      <th scope="col" style={{ padding: "16px" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replenishments.map((order) => (
                      <tr key={order.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                        <td style={{ padding: "16px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#666" }}>{order.id.slice(0, 8)}...</span>
                          <span style={{ fontSize: "0.72rem", color: "#999", display: "block" }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td style={{ padding: "16px", fontWeight: "bold" }}>{order.product?.name}</td>
                        <td style={{ padding: "16px" }}>{order.location?.name}</td>
                        <td style={{ padding: "16px" }}>{order.supplier?.name}</td>
                        <td style={{ padding: "16px", fontWeight: "bold" }}>{order.quantity} uds</td>
                        <td style={{ padding: "16px" }}>
                          <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold", backgroundColor: order.status === "RECEIVED" ? "#d1fae5" : order.status === "ORDERED" ? "#dbeafe" : order.status === "CANCELLED" ? "#fee2e2" : "#f3f4f6", color: order.status === "RECEIVED" ? "#065f46" : order.status === "ORDERED" ? "#1e40af" : order.status === "CANCELLED" ? "#991b1b" : "#374151" }}>
                            {order.status === "ORDERED" && "SOLICITADO"}
                            {order.status === "RECEIVED" && "RECIBIDO"}
                            {order.status === "CANCELLED" && "CANCELADO"}
                            {order.status === "PENDING" && "PENDIENTE"}
                          </span>
                        </td>
                        <td style={{ padding: "16px" }}>
                          {order.status === "ORDERED" && (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => receiveOrderMutation.mutate(order.id)} className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.75rem" }} aria-label={`Marcar como recibida la orden ${order.id.slice(0, 8)}`} disabled={receiveOrderMutation.isPending}>
                                ✓ Recibido
                              </button>
                              <button onClick={() => handleCancelOrder(order.id)} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem", background: "#fee2e2", color: "#b91c1c" }} aria-label={`Cancelar la orden ${order.id.slice(0, 8)}`} disabled={cancelOrderMutation.isPending}>
                                Cancelar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB: PROVEEDORES */}
          {activeTab === "suppliers" && (
            <div id="tab-suppliers" role="tabpanel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
              <div className="card">
                <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "16px" }}>Agregar Nuevo Proveedor</h2>
                <form onSubmit={handleCreateSupplier} aria-label="Formulario de nuevo proveedor">
                  <div className="form-group">
                    <label htmlFor="supplier-name" className="form-label">Nombre del Proveedor *</label>
                    <input id="supplier-name" type="text" className="form-input" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Ej: Distribuidora Central" required aria-required="true" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="supplier-email" className="form-label">Correo Electrónico *</label>
                    <input id="supplier-email" type="email" className="form-input" value={newSupplierEmail} onChange={(e) => setNewSupplierEmail(e.target.value)} placeholder="Ej: contacto@prov.com" required aria-required="true" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="supplier-phone" className="form-label">Teléfono (opcional)</label>
                    <input id="supplier-phone" type="text" className="form-input" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder="Ej: +56 9 1234 5678" />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={createSupplierMutation.isPending} style={{ width: "100%", justifyContent: "center", marginTop: "8px" }} aria-busy={createSupplierMutation.isPending}>
                    {createSupplierMutation.isPending ? "Guardando..." : "Registrar Proveedor"}
                  </button>
                </form>
              </div>

              <div className="card" style={{ maxHeight: "420px", overflowY: "auto" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "16px" }}>Directorio de Proveedores</h2>
                {suppliers.length === 0 ? (
                  <p style={{ color: "#777", textAlign: "center", padding: "20px" }}>No hay proveedores registrados.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                    {suppliers.map((s) => (
                      <li key={s.id} style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc" }}>
                        <h3 style={{ fontWeight: "bold", fontSize: "0.95rem", margin: 0 }}>{s.name}</h3>
                        <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "2px" }}>📧 {s.email}{s.phone ? ` | 📞 ${s.phone}` : ""}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL ORDEN */}
      {isOrderModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "500px", padding: "28px" }}>
            <h2 id="modal-title" style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "16px" }}>📦 Solicitar Orden de Reposición</h2>
            <form onSubmit={handleCreateOrderSubmit}>
              <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", marginBottom: "18px" }}>
                <span style={{ fontSize: "0.8rem", color: "#666" }}>Detalles del destino:</span>
                <p style={{ fontWeight: "bold", fontSize: "0.95rem", marginTop: "4px" }}>{products.find(p => p.id === selectedProductId)?.name}</p>
                <p style={{ fontSize: "0.85rem", color: "#555" }}>Hacia: <strong>{locations.find(l => l.id === selectedLocationId)?.name}</strong></p>
              </div>

              <div className="form-group">
                <label htmlFor="modal-supplier" className="form-label">Seleccionar Proveedor *</label>
                {suppliers.length === 0 ? (
                  <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>⚠️ Registra al menos un proveedor primero.</p>
                ) : (
                  <select id="modal-supplier" className="form-input" value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} required aria-required="true">
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="modal-quantity" className="form-label">Cantidad a Pedir *</label>
                <input id="modal-quantity" type="number" className="form-input" min="1" value={orderQuantity} onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} required aria-required="true" />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button type="button" onClick={() => setIsOrderModalOpen(false)} className="btn btn-secondary" style={{ background: "#f3f4f6" }}>Cerrar</button>
                <button type="submit" disabled={createOrderMutation.isPending || suppliers.length === 0} className="btn btn-primary" aria-busy={createOrderMutation.isPending}>
                  {createOrderMutation.isPending ? "Procesando..." : "Confirmar Orden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
