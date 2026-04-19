import { BrowserRouter, Route, Routes } from "react-router-dom";
import { GameProvider } from "./context/game-context";
import { Admin } from "./pages/Admin";
import { Dashboard } from "./pages/Dashboard";

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}
