import { Routes, Route, Navigate } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import SessionPage from "./pages/SessionPage";
import InsightsPage from "./pages/InsightsPage";
import SettingsPage from "./pages/SettingsPage";
import GrowthPage from "./pages/GrowthPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/session" element={<SessionPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/insights/new" element={<InsightsPage />} />
      <Route path="/insights/:id" element={<InsightsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/advanced" element={<SettingsPage />} />
      <Route path="/growth" element={<GrowthPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
