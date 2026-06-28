import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../../components/ui/BrandLogo";

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
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

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSignIn();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white/75 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-[0_25px_60px_rgba(99,102,246,0.18)] overflow-hidden">
          {/* Dark hero header */}
          <div className="bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-700 px-8 pt-10 pb-12 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-fuchsia-500 rounded-full filter blur-[70px] opacity-40 mix-blend-screen pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-400 rounded-full filter blur-[50px] opacity-30 mix-blend-screen pointer-events-none" />
            <div className="relative z-10">
              <BrandLogo
                size="md"
                textClassName="text-white"
                subTextClassName="text-purple-300"
              />
              <h1 className="mt-6 text-2xl font-black text-white tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-purple-200 font-medium mt-1">
                Sign in to your Verronex VTU account
              </p>
            </div>
          </div>

          {/* Form body */}
          <div className="px-8 pt-8 pb-8 space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 transition-all"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-red-500 text-xs font-semibold">⚠️ {error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSignIn}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 active:scale-95 text-white text-sm font-bold py-3.5 rounded-xl shadow-lg shadow-fuchsia-500/30 transition-all disabled:opacity-50 mt-2"
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {" "}
                  Sign In <ArrowRight className="w-4 h-4" />{" "}
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500 pt-2">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-fuchsia-600 font-bold hover:text-fuchsia-800 transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
