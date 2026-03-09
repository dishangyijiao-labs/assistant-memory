import { Routes, Route, Navigate } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import SessionPage from "./pages/SessionPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/session" element={<SessionPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/advanced" element={<Navigate to="/settings" replace />} />
      <Route path="/integrations" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
