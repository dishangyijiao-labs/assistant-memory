import { Routes, Route, Navigate } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import SessionPage from "./pages/SessionPage";

export default function App() {
  return (
    <>
      {/* Real DOM element for Tauri overlay title bar drag region.
          A CSS pseudo-element (::before) is not reliable in WKWebView;
          a real element with data-tauri-drag-region is required. */}
      <div data-tauri-drag-region style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 28,
        zIndex: 9999,
        pointerEvents: "auto",
      }} />
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
    </>
  );
}
