import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabaseClient";
import BrandLogo from "../../components/ui/BrandLogo";
import SEO from "../../components/seo/SEO";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

// Reusable input field
function Field({
  label,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  onKeyDown,
  showToggle = false,
}) {
  const [show, setShow] = useState(false);
  const inputType = showToggle ? (show ? "text" : "password") : type;

  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-10 pr-10 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 transition-all"
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow((prev) => !prev)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-fuchsia-600 transition-colors"
          >
            {show ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SignupPage() {
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleGoogleSignIn = async () => {
    if (googleBusy) return;
    setError(null);
    setGoogleBusy(true);

    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (err) throw err;
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Could not start Google sign-in. Please try again.");
      setGoogleBusy(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (
      !fullName ||
      !username ||
      !phone ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setError(
        "Username must be 3-20 characters and contain only lowercase letters, numbers and underscores.",
      );
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
      await signUp({
        email,
        password,
        fullName,
        username,
        phone,
      });
      setSuccess(true);
    } catch (err) {
      console.error("Signup failed:", err);

      setError(
        err?.message ||
          err?.error_description ||
          err?.error?.message ||
          JSON.stringify(err, null, 2) ||
          "Signup failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pageWrapper = (content) => (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)] px-4 py-6">
      <div className="w-full max-w-sm">
        <div className="bg-white/75 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-[0_25px_60px_rgba(99,102,246,0.18)] overflow-hidden">
          {content}
        </div>
      </div>
    </div>
  );

  const darkHeader = (title, sub) => (
    <div className="bg-linear-to-br from-indigo-900 via-purple-800 to-fuchsia-700 px-8 pt-5 pb-5 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-fuchsia-500 rounded-full filter blur-[70px] opacity-40 mix-blend-screen pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-400 rounded-full filter blur-[50px] opacity-30 mix-blend-screen pointer-events-none" />
      <div className="relative z-10">
        <BrandLogo
          size="md"
          textClassName="text-white"
          subTextClassName="text-purple-300"
        />
        <h1 className="mt-2 text-2xl font-black text-white tracking-tight">
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
        <SEO title="Create account — Verronex VTU" robots="noindex, nofollow" canonical={null} />
        <div className="bg-linear-to-br from-indigo-900 via-purple-800 to-fuchsia-700 px-8 py-10 relative overflow-hidden text-center">
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
              <span className="font-semibold">Didn't receive it?</span> Check
              your Spam or Junk folder.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-linear-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 active:scale-95 text-white text-sm font-bold px-6 py-3 rounded-xl shadow-lg shadow-fuchsia-500/30 transition-all"
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
      <SEO title="Sign Up — Verronex VTU" robots="noindex, nofollow" canonical={null} />
      {darkHeader("Create account", "Get started with Verronex VTU today")}

      <div className="px-8 pt-5 pb-6 space-y-2.5">
        <Field
          label="Full Name"
          icon={User}
          placeholder="e.g. Godfrey Akpugo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Field
          label="Username"
          icon={User}
          placeholder="e.g. godfrey"
          value={username}
          onChange={(e) =>
            setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
          }
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
          placeholder="Min. 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          showToggle
        />
        <Field
          label="Confirm Password"
          icon={Lock}
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          showToggle
        />

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-red-500 text-xs font-semibold">⚠️ {error}</p>
          </div>
        )}

        <button
          onClick={handleSignUp}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 active:scale-95 text-white text-sm font-bold py-3 rounded-xl shadow-lg shadow-fuchsia-500/30 transition-all disabled:opacity-50 mt-1"
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

        {/* Divider */}
        <div className="flex items-center gap-3 pt-1">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            or
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Continue with Google */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleBusy || busy}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-sm font-bold py-3 rounded-xl text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          {googleBusy ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <p className="text-center text-xs text-slate-500 pt-1">
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
