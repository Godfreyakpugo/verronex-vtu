import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Shell from "./components/layout/Shell";
import Dashboard from "./pages/Dashboard";
import logo from "./assets/vtu-verronex-logo.png";

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

// ── Temporary Login Page (replaced in Milestone 3) ────────────
function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn({ email, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.22),transparent_30%),linear-gradient(135deg,#fdf2f8_0%,#fff7ed_50%,#fdf2f8_100%)] px-4">
      <div className="w-full max-w-sm bg-white/70 border border-fuchsia-200/70 rounded-3xl shadow-[0_20px_60px_rgba(217,70,239,0.16)] backdrop-blur-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <img
            src={logo}
            alt="Verronex VTU logo"
            className="w-10 h-10 object-contain rounded-xl"
          />
          <h1 className="font-bold text-slate-800">
            Verronex <span className="text-fuchsia-500">VTU</span>
          </h1>
        </div>

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-fuchsia-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-fuchsia-400"
        />

        {error && <p className="text-red-500 text-xs">⚠️ {error}</p>}

        <button
          onClick={handleSignIn}
          disabled={busy}
          className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 active:scale-95 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-fuchsia-200 transition-all disabled:opacity-50"
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ── App Router ────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
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
