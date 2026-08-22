import { Link, NavLink } from "react-router-dom";
import BrandLogo from "../ui/BrandLogo";
import { useAuth } from "../../context/AuthContext";

const linkClass = ({ isActive }) =>
  `px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
    isActive ? "text-fuchsia-700 bg-fuchsia-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
  }`;

// Minimal public navigation: Verronex | Home | Pricelist | Login | Sign Up.
// Signed-in visitors get a Dashboard shortcut instead of auth buttons.
export default function PublicNav() {
  const { user, profile } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to="/" className="mr-auto" aria-label="Verronex home">
          <BrandLogo size="sm" />
        </Link>

        <nav className="flex items-center gap-1 flex-wrap">
          <NavLink to="/home" className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/" end className={linkClass}>
            Pricelist
          </NavLink>

          {user ? (
            <Link
              to={profile?.is_admin ? "/admin/wallet" : "/dashboard"}
              className="ml-1 px-4 py-1.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-600 to-fuchsia-600 hover:opacity-90 transition-opacity"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                Login
              </NavLink>
              <Link
                to="/signup"
                className="ml-1 px-4 py-1.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-600 to-fuchsia-600 hover:opacity-90 transition-opacity"
              >
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}