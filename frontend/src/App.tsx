import { Routes, Route, Navigate } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import SessionPage from "./pages/SessionPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />}>
        <Route index element={<></>} />
        <Route path="settings" element={<></>} />
      </Route>
      <Route path="/session" element={<SessionPage />} />
      <Route path="/advanced" element={<Navigate to="/settings" replace />} />
      <Route path="/integrations" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
