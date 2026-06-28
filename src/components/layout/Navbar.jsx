import { Menu, Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../ui/BrandLogo";

function Navbar({ onMenuClick }) {
  const { profile, wallet, signOut } = useAuth();

  const initials =
    profile?.full_name?.[0]?.toUpperCase() ??
    profile?.email?.[0]?.toUpperCase() ??
    "U";

  return (
    <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-fuchsia-100/70 flex items-center justify-between px-4 lg:px-6">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Brand on desktop */}
      <div className="hidden lg:block">
        <BrandLogo size="sm" />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Wallet balance pill */}
        <div className="hidden sm:flex items-center gap-2 bg-fuchsia-500/10 border border-fuchsia-200/80 rounded-xl px-3 py-1.5 backdrop-blur">
          <span className="text-xs text-gray-400">Balance</span>
          <span className="text-sm font-bold text-fuchsia-700">
            ₦
            {parseFloat(wallet?.balance ?? 0).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Bell */}
        <button className="p-2 rounded-xl hover:bg-fuchsia-50 text-gray-500">
          <Bell className="w-5 h-5" />
        </button>

        {/* Avatar + sign out */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-fuchsia-500 to-fuchsia-700 border border-fuchsia-400 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-fuchsia-200">
            {initials}
          </div>
          <button
            onClick={signOut}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
