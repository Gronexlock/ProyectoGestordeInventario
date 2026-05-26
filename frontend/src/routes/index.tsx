import { Routes, Route } from "react-router-dom";
import { CreateLocationPage } from "../pages/CreateLocationPage";
import { CreateMovementPage } from "../pages/CreateMovementPage";
import { ReservationsPage } from "../pages/ReservationsPage";
import { StockUbicationPage} from "../pages/StockUbicationPage";
import { DispachPage } from "../pages/DispatchPage";
 
export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<h1 style={{ textAlign: "center" }}>Proyecto Inventario</h1>} />
      <Route path="/RegistrarUbicaciones" element={<CreateLocationPage />} />
      <Route path="/RegistrarMovimientos" element={<CreateMovementPage />} />
      <Route path="/Reservas" element={<ReservationsPage />} />
      <Route path="/StockUbicaciones" element={<StockUbicationPage />} />
      <Route path="/Despacho" element={<DispachPage />} />
    </Routes>
  );
};
