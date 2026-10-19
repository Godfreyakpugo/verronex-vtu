import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  LogOut,
  LayoutDashboard,
  History,
  Wallet,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../routes";
import BrandLogo from "../ui/BrandLogo";
import NotificationBell from "../ui/NotificationBell";

function Navbar({ onMenuClick, pendingFundingCount = 0 }) {
  const { profile, wallet, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isAdmin = profile?.is_admin === true;

  // Sticky shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the profile menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onDocPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const initials =
    profile?.full_name?.[0]?.toUpperCase() ??
    profile?.email?.[0]?.toUpperCase() ??
    "U";

  const displayName =
    profile?.full_name || profile?.username || profile?.email || "Your account";

  const closeMenu = () => setMenuOpen(false);

  const linkClass =
    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 transition-colors hover:bg-fuchsia-50 hover:text-fuchsia-700 text-left";

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
          className="lg:hidden relative p-2 rounded-xl hover:bg-fuchsia-50 text-slate-500 transition-colors"
          aria-label={
            pendingFundingCount > 0
              ? `Open menu, ${pendingFundingCount} pending funding requests`
              : "Open menu"
          }
        >
          <Menu className="w-5 h-5" />
          {pendingFundingCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 border-2 border-white shadow-sm"
              aria-hidden="true"
            />
          )}
        </button>

        {/* Brand — mobile only; tap returns to dashboard */}
        <div className="lg:hidden">
          <Link to={ROUTES.DASHBOARD} aria-label="Return to dashboard">
            <BrandLogo size="sm" showText={false} />
          </Link>
        </div>

        {/* Profile menu — the avatar opens the account menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-xl hover:bg-fuchsia-50 transition-colors"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Account"
              className="absolute left-0 mt-2 w-64 max-w-[calc(100vw-2rem)] z-40"
            >
              <div className="rounded-2xl border border-fuchsia-200/80 bg-white/95 backdrop-blur-2xl shadow-[0_10px_35px_rgba(236,72,153,0.18)] p-2">
                {/* Identity */}
                <div className="px-3 py-2.5 border-b border-fuchsia-100/80 mb-1.5">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {displayName}
                  </p>
                  {profile?.email && (
                    <p className="text-xs text-slate-500 truncate">
                      {profile.email}
                    </p>
                  )}
                </div>

                <Link to={ROUTES.DASHBOARD} onClick={closeMenu} className={linkClass} role="menuitem">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  Dashboard
                </Link>
                <Link to={ROUTES.TRANSACTIONS} onClick={closeMenu} className={linkClass} role="menuitem">
                  <History className="w-4 h-4 shrink-0" />
                  Transactions
                </Link>
                <Link to={ROUTES.FUND_WALLET} onClick={closeMenu} className={linkClass} role="menuitem">
                  <Wallet className="w-4 h-4 shrink-0" />
                  Fund Wallet
                </Link>
                <Link to={ROUTES.SETTINGS} onClick={closeMenu} className={linkClass} role="menuitem">
                  <Settings className="w-4 h-4 shrink-0" />
                  Settings
                </Link>

                {/* Admin destinations are only reachable from the sidebar on
                    desktop, and the sidebar is hidden on mobile — so the admin
                    routes are surfaced here too. */}
                {isAdmin && (
                  <>
                    <div className="mt-1.5 mb-1.5 border-t border-fuchsia-100/80" />
                    <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Admin
                    </p>
                    <Link to="/admin/funding/manual" onClick={closeMenu} className={linkClass} role="menuitem">
                      <Wallet className="w-4 h-4 shrink-0" />
                      Manual Funding
                    </Link>
                    <Link to="/admin/funding/automatic" onClick={closeMenu} className={linkClass} role="menuitem">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      Automatic Funding
                    </Link>
                  </>
                )}

                <div className="mt-1.5 mb-1.5 border-t border-fuchsia-100/80" />
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 text-left"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
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