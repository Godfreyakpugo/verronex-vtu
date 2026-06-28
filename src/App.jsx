import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Shell from "./components/layout/Shell";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import AuthCallback from "./pages/auth/AuthCallback";

// ── Protected Route Guard ─────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ── App Router ────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Shell>
                <Dashboard />
              </Shell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
