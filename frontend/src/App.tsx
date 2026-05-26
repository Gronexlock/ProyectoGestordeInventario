
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./routes";
import { Sidebar } from "./components/Sidebar";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <AppRouter />
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;