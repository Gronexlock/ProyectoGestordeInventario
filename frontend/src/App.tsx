import { BrowserRouter, NavLink } from "react-router-dom";
import { AppRouter } from "./routes";
import { Sidebar } from "./components/Sidebar";
import "./index.css";

const NAV_LINKS = [
  { to: "/Stock", label: "📊 Stock" },
  { to: "/HistorialMovimientos", label: "📋 Historial" },
  { to: "/RegistrarMovimientos", label: "➕ Registrar Movimiento" },
  { to: "/RegistrarUbicaciones", label: "📍 Ubicaciones" },
  { to: "/Reservas", label: "🔖 Reservas" },
];

function App() {
  return (
    <BrowserRouter>
      <div>
        <nav
          style={{
            padding: "12px 24px",
            background: "#1a237e",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexWrap: "wrap",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}
        >
          <span style={{ color: "#90caf9", fontWeight: 700, fontSize: "15px", marginRight: "12px", letterSpacing: "0.3px" }}>
            🏭 Inventario
          </span>
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "#1a237e" : "#e8eaf6",
                backgroundColor: isActive ? "#ffffff" : "transparent",
                textDecoration: "none",
                transition: "background 0.15s, color 0.15s",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <AppRouter />
      </div>
    </BrowserRouter>
  );
}

export default App;