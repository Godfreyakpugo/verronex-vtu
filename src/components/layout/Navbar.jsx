import { useState, useEffect } from "react";
import { Menu, Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../ui/BrandLogo";

function Navbar({ onMenuClick }) {
  const { profile, wallet, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);

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

        {/* Brand — mobile only */}
        <div className="lg:hidden">
          <BrandLogo size="sm" showText={false} />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
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

        {/* Bell */}
        <button className="p-2 rounded-xl hover:bg-fuchsia-50 text-slate-400 transition-colors relative">
          <Bell className="w-5 h-5" />
        </button>

        {/* Avatar + sign out */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-600 shadow-md shadow-fuchsia-500/30 flex items-center justify-center text-white text-sm font-black">
            {initials}
          </div>
          <button
            onClick={signOut}
            className="hidden sm:block text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
