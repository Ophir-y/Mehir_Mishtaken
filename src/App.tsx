import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Nav } from "@/components/Nav";
import { SandboxPage } from "@/pages/SandboxPage";
import { CitySelectionPage } from "@/pages/CitySelectionPage";

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="min-h-full bg-background pb-16">
        <Nav />
        <Routes>
          <Route path="/" element={<Navigate to="/city-selection" replace />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          <Route path="/city-selection" element={<CitySelectionPage />} />
          <Route
            path="*"
            element={<Navigate to="/city-selection" replace />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
