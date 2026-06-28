import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Phone, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../../components/ui/BrandLogo";

// Reusable input field
function Field({
  label,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  onKeyDown,
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 transition-all"
        />
      </div>
    </div>
  );
}

function SignupPage() {
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    if (!fullName || !phone || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await signUp({ email, password, fullName, phone });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pageWrapper = (content) => (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white/75 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-[0_25px_60px_rgba(99,102,246,0.18)] overflow-hidden">
          {content}
        </div>
      </div>
    </div>
  );

  const darkHeader = (title, sub) => (
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
          {title}
        </h1>
        <p className="text-sm text-purple-200 font-medium mt-1">{sub}</p>
      </div>
    </div>
  );

  // ── Success state ──────────────────────────────────────────
  if (success) {
    return pageWrapper(
      <>
        <div className="bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-700 px-8 py-10 relative overflow-hidden text-center">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-fuchsia-500 rounded-full filter blur-[70px] opacity-40 mix-blend-screen pointer-events-none" />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Check your email
            </h1>
            <p className="text-sm text-purple-200 font-medium mt-2">
              We sent a confirmation link to{" "}
              <span className="text-white font-bold">{email}</span>
            </p>
          </div>
        </div>
        <div className="px-8 py-8 text-center space-y-4">
          <p className="text-sm text-slate-500">
            Click the link in your email to activate your account, then sign in
            below.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-center text-xs text-amber-700">
            <p>
              <span className="font-semibold">Didn't receive the email?</span>{" "}
              Check your Spam or Junk folder.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 active:scale-95 text-white text-sm font-bold px-6 py-3 rounded-xl shadow-lg shadow-fuchsia-500/30 transition-all"
          >
            Go to Sign In <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </>,
    );
  }

  // ── Signup form ────────────────────────────────────────────
  return pageWrapper(
    <>
      {darkHeader("Create account", "Get started with Verronex VTU today")}

      <div className="px-8 pt-8 pb-8 space-y-4">
        <Field
          label="Full Name"
          icon={User}
          placeholder="e.g. Godfrey Akpugo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Field
          label="Phone Number"
          icon={Phone}
          type="tel"
          placeholder="08012345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Field
          label="Email Address"
          icon={Mail}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          icon={Lock}
          type="password"
          placeholder="Min. 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Confirm Password"
          icon={Lock}
          type="password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-red-500 text-xs font-semibold">⚠️ {error}</p>
          </div>
        )}

        <button
          onClick={handleSignUp}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 active:scale-95 text-white text-sm font-bold py-3.5 rounded-xl shadow-lg shadow-fuchsia-500/30 transition-all disabled:opacity-50 mt-2"
        >
          {busy ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {" "}
              Create Account <ArrowRight className="w-4 h-4" />{" "}
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500 pt-2">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-fuchsia-600 font-bold hover:text-fuchsia-800 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </>,
  );
}

export default SignupPage;
