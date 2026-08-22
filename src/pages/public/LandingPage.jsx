import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  LogIn,
  LayoutGrid,
  Loader2,
  ChevronDown,
  BadgePercent,
} from "lucide-react";
import supabase from "../../lib/supabaseClient";
import BrandLogo from "../../components/ui/BrandLogo";
import ContinueWithGoogleButton from "../../components/ui/ContinueWithGoogleButton";
import { useAuth } from "../../context/AuthContext";
import { getNetworkStyle } from "../../lib/networkStyles";

const HIGHLIGHT_NETWORKS = ["MTN", "AIRTEL", "GLO", "9MOBILE"];
const PLANS_PER_NETWORK = 3;

function naira(value) {
  const v = Number(value) || 0;
  return `₦${v.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// One-page public landing:
//   hero -> pricing highlights (a few per network) -> view all prices.
export default function LandingPage() {
  const { user, profile } = useAuth();
  const [pricelist, setPricelist] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function load() {
      const { data, error } = await supabase.rpc("public_get_pricelist");
      if (ignore) return;
      if (error) {
        console.error("Landing pricelist load error:", error);
        setLoadError(true);
        return;
      }
      setPricelist(data || { plans: [], airtime: [] });
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  // Cheapest few plans per network — a taste of the prices, not the full list
  const highlights = useMemo(() => {
    if (!pricelist?.plans?.length) return [];
    return HIGHLIGHT_NETWORKS.map((network) => {
      const plans = pricelist.plans
        .filter((p) => p.network === network)
        .sort((a, b) => Number(a.selling_price) - Number(b.selling_price))
        .slice(0, PLANS_PER_NETWORK);
      return { network, plans };
    }).filter((g) => g.plans.length > 0);
  }, [pricelist]);

  const handleGoogleError = (message) =>
    console.warn("Google sign-in could not start:", message);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)]">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 pt-16 sm:pt-24 pb-12 text-center">
        <div className="flex justify-center mb-6">
          <BrandLogo size="lg" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
          Affordable VTU services,
          <br className="hidden sm:block" /> simple and convenient.
        </h1>
        <p className="mt-4 text-sm sm:text-base text-slate-500 max-w-md mx-auto">
          Buy data and airtime instantly at great prices — top up your wallet
          once and make purchases in seconds.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <ContinueWithGoogleButton onError={handleGoogleError} />
          {user ? (
            <Link
              to={profile?.is_admin ? "/admin/wallet" : "/dashboard"}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-opacity"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-opacity"
              >
                Sign Up <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-fuchsia-300 transition-colors"
              >
                <LogIn className="w-4 h-4" /> Login
              </Link>
            </>
          )}
        </div>

        <a
          href="#pricing"
          className="mt-10 inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-700 hover:text-fuchsia-800 transition-colors"
        >
          See our prices <ChevronDown className="w-4 h-4 animate-bounce" />
        </a>
      </section>

      {/* ── Pricing highlights ───────────────────────────────── */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 pb-16 scroll-mt-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Prices that speak for themselves
          </h2>
          <p className="mt-2 text-sm text-slate-500 inline-flex items-center gap-1.5">
            <BadgePercent className="w-4 h-4 text-fuchsia-600" />
            A taste of what you pay on each network
          </p>
        </div>

        {!pricelist && !loadError ? (
          <div className="flex items-center justify-center gap-2 py-14 text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading prices...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {highlights.map(({ network, plans }) => {
                const style = getNetworkStyle(network);
                return (
                  <div
                    key={network}
                    className="bg-white/80 backdrop-blur border border-white/70 rounded-2xl shadow-[0_10px_30px_rgba(99,102,246,0.10)] overflow-hidden"
                  >
                    {/* Branded network caption */}
                    <div
                      className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest ${style.header}`}
                    >
                      {network}
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {plans.map((p) => (
                        <li
                          key={`${network}-${p.plan_name}-${p.selling_price}`}
                          className="flex items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <span className="text-sm text-slate-600 truncate">
                            {p.plan_name}
                          </span>
                          <span className="shrink-0 text-sm font-bold text-slate-900">
                            {naira(p.selling_price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <Link
                to="/pricelist"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-opacity"
              >
                <LayoutGrid className="w-4 h-4" /> View all prices
              </Link>
            </div>
          </>
        )}
      </section>

      <footer className="pb-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Verronex VTU
      </footer>
    </div>
  );
}