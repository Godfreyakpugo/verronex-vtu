import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wifi,
  Phone,
  Wallet,
  History,
  Settings,
  X,
} from "lucide-react";
import BrandLogo from "../ui/BrandLogo";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/buy-data", icon: Wifi, label: "Buy Data" },
  { to: "/buy-airtime", icon: Phone, label: "Buy Airtime" },
  { to: "/fund-wallet", icon: Wallet, label: "Fund Wallet" },
  { to: "/transactions", icon: History, label: "Transactions" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-50
          bg-white/80 backdrop-blur-2xl
          border-r border-fuchsia-100
          shadow-[4px_0_30px_rgba(139,92,246,0.08)]
          transform transition-transform duration-300 ease-in-out
          flex flex-col overflow-hidden
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-fuchsia-100/80 shrink-0">
          <BrandLogo size="sm" />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-fuchsia-50 text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-semibold transition-all duration-150
                ${
                  isActive
                    ? "bg-linear-to-r from-fuchsia-600 to-purple-600 text-white shadow-md shadow-fuchsia-500/25"
                    : "text-slate-500 hover:bg-fuchsia-50 hover:text-fuchsia-700"
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom decorative depth */}
        <div className="relative h-40 shrink-0 overflow-hidden pointer-events-none">
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-fuchsia-400 rounded-full filter blur-[60px] opacity-20" />
          <div className="absolute -bottom-10 left-16 w-32 h-32 bg-purple-500 rounded-full filter blur-[60px] opacity-15" />
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
