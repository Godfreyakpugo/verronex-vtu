import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../ui/BrandLogo";
import NotificationBell from "../ui/NotificationBell";

function Navbar({ onMenuClick }) {
  const { profile, wallet, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  // Sticky shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials =
    profile?.full_name?.[0]?.toUpperCase() ??
    profile?.email?.[0]?.toUpperCase() ??
    "U";

  const avatarUrl =
    profile?.avatar_url &&
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/avatars/${profile.id}?width=500`;

  return (
    <header
      className={`
        sticky top-0 z-30 h-16
        bg-white/75 backdrop-blur-2xl
        border-b border-white/60
        flex items-center justify-between px-4 lg:px-6
        transition-shadow duration-200
        ${scrolled ? "shadow-[0_4px_24px_rgba(139,92,246,0.10)]" : ""}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-fuchsia-50 text-slate-500 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand — mobile only; tap returns to dashboard */}
        <div className="lg:hidden">
          <Link to="/dashboard" aria-label="Return to dashboard">
            <BrandLogo size="sm" showText={false} />
          </Link>
        </div>

        {/* Avatar — click opens profile menu */}
        <button
          onClick={() => setAvatarModalOpen(true)}
          className="relative p-2 rounded-xl hover:bg-fuchsia-50 text-slate-400 transition-colors"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border-2 border-white/20"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
          )}
          {avatarModalOpen && (
            <X className="absolute -top-1 -right-1 w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <NotificationBell />

        {/* Balance pill — dark vivid */}
        <div className="hidden sm:flex items-center gap-2 bg-linear-to-r from-indigo-900 via-purple-800 to-fuchsia-700 px-4 py-1.5 rounded-xl shadow-md shadow-purple-900/20">
          <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-widest">
            Balance
          </span>
          <span className="text-sm font-black text-white tracking-tight">
            ₦
            {parseFloat(wallet?.balance ?? 0).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Sign out — icon on mobile, text from sm up */}
        <button
          onClick={signOut}
          aria-label="Sign out"
          className="sm:hidden p-2 rounded-xl hover:bg-fuchsia-50 text-slate-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
        <button
          onClick={signOut}
          className="hidden sm:block text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

export default Navbar;