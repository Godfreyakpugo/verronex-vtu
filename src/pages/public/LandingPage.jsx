import { Link } from "react-router-dom";
import { ArrowRight, LogIn, Tag } from "lucide-react";
import BrandLogo from "../../components/ui/BrandLogo";

// Extremely simple public landing: one screen, no scrolling.
// Logo -> headline -> Sign Up / Login -> View Pricelist.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)] flex items-center justify-center px-4">
      <main className="w-full max-w-md text-center py-10">
        <div className="flex justify-center mb-6">
          <BrandLogo size="lg" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
          Affordable VTU services,
          <br className="hidden sm:block" /> simple and convenient.
        </h1>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/signup"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-opacity"
          >
            Sign Up <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-fuchsia-300 transition-colors"
          >
            <LogIn className="w-4 h-4" /> Login
          </Link>
        </div>

        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-700 hover:text-fuchsia-800 transition-colors"
          >
            <Tag className="w-4 h-4" />
            View product prices
          </Link>
        </div>
      </main>
    </div>
  );
}