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

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-50
          bg-fuchsia-200 backdrop-blur-2xl border-r border-fuchsia-300
          shadow-[0_20px_50px_rgba(236,72,153,0.10)]
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-fuchsia-100 rounded-xl">
          <BrandLogo className="text-slate-900" size="sm" />

          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-medium transition-all duration-150
                ${
                  isActive
                    ? "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                    : "text-slate-700 hover:bg-fuchsia-50/80 hover:text-fuchsia-800"
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
