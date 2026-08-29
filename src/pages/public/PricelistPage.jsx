import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wifi, Smartphone, Search, ArrowRight, Loader2 } from "lucide-react";
import supabase from "../../lib/supabaseClient";
import PublicNav from "../../components/layout/PublicNav";
import { getNetworkStyle } from "../../lib/networkStyles";
import SEO from "../../components/seo/SEO";
import logoUrl from "../../assets/vtu-verronex-logo.png";

const NETWORK_ORDER = ["MTN", "GLO", "AIRTEL", "9MOBILE"];

function naira(value) {
  const v = Number(value) || 0;
  return `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Primary public page: current data & airtime prices, no sign-in required.
export default function PricelistPage() {
  const pageTitle = "Verronex VTU Pricelist — Data & Airtime Prices in Nigeria";
  const pageDescription =
    "View Verronex VTU data and airtime prices for Nigerian networks — MTN, Airtel, Glo and 9mobile. Compare affordable bundles and face-value discounts before you buy.";
  const canonicalUrl = "https://verronex.com/pricelist";
  const absoluteImage = `https://verronex.com${logoUrl}`;
  const [pricelist, setPricelist] = useState({ plans: [], airtime: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      const { data, error: err } = await supabase.rpc("public_get_pricelist");

      if (ignore) return;
      if (err) {
        console.error("Pricelist load error:", err);
        setError("Could not load prices right now. Please refresh to try again.");
      } else {
        setPricelist({ plans: data?.plans || [], airtime: data?.airtime || [] });
      }
      setLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  // Group active plans by network; optional search narrows by name/network.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matched = q
      ? pricelist.plans.filter(
          (p) =>
            p.plan_name?.toLowerCase().includes(q) ||
            p.network?.toLowerCase().includes(q),
        )
      : pricelist.plans;

    const map = new Map();
    for (const plan of matched) {
      const key = plan.network || "Others";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(plan);
    }

    return [...map.entries()]
      .sort(
        (a, b) =>
          NETWORK_ORDER.indexOf(a[0]) - NETWORK_ORDER.indexOf(b[0]) ||
          a[0].localeCompare(b[0]),
      )
      .map(([network, plans]) => ({ network, plans }));
  }, [pricelist.plans, query]);

  const totalPlans = pricelist.plans.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)]">
      <SEO
        title={pageTitle}
        description={pageDescription}
        canonical={canonicalUrl}
        robots="index, follow"
        ogTitle={pageTitle}
        ogDescription={pageDescription}
        ogUrl={canonicalUrl}
        ogImage={absoluteImage}
        twitterTitle={pageTitle}
        twitterDescription={pageDescription}
        twitterImage={absoluteImage}
      />
      <PublicNav />

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        {/* Intro + primary CTA */}
        <section className="text-center">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
            Verronex VTU Pricelist — Data &amp; Airtime Prices in Nigeria
          </h1>
          <p className="mt-3 text-sm text-slate-600 max-w-2xl mx-auto">
            Verronex provides affordable data and airtime for Nigerian networks
            including MTN, Airtel, Glo and 9mobile. Browse live prices below —
            what you see is what you pay.
          </p>
          <Link
            to="/signup"
            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-opacity"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        {error && (
          <p className="text-center text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading prices...
          </div>
        ) : (
          <>
            {/* Data */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <Wifi className="w-5 h-5 text-indigo-600" /> Data
                </h2>
                {totalPlans > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search plans..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-fuchsia-400 transition-colors"
                    />
                  </div>
                )}
              </div>

              {totalPlans === 0 ? (
                <p className="text-sm text-slate-500 bg-white/70 border border-slate-100 rounded-xl px-4 py-6 text-center">
                  No data plans are available at the moment.
                </p>
              ) : (
                <div className="space-y-5">
                  {groups.map(({ network, plans }) => {
                    const style = getNetworkStyle(network);
                    return (
                      <div
                        key={network}
                        className="bg-white/75 backdrop-blur border border-white/60 rounded-2xl shadow-[0_10px_30px_rgba(99,102,246,0.08)] overflow-hidden"
                      >
                        <h3
                          className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest ${style.header}`}
                        >
                          {network} · {plans.length} plan{plans.length !== 1 ? "s" : ""}
                        </h3>
                      <ul className="divide-y divide-slate-100">
                        {plans.map((p, i) => (
                          <li
                            key={`${p.plan_name}-${i}`}
                            className="flex items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {p.plan_name}
                              </p>
                              {p.validity && (
                                <p className="text-[11px] text-slate-400">{p.validity}</p>
                              )}
                            </div>
                            <p className="shrink-0 text-sm font-bold text-fuchsia-700">
                              {naira(p.selling_price)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    );
                  })}

                  {groups.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-6">
                      No plans match "{query}".
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Airtime */}
            {pricelist.airtime.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-3">
                  <Smartphone className="w-5 h-5 text-fuchsia-600" /> Airtime
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pricelist.airtime.map((a) => {
                    const d = Number(a.user_discount) || 0;
                    return (
                      <div
                        key={a.network}
                        className="bg-white/75 backdrop-blur border border-white/60 rounded-2xl shadow-[0_10px_30px_rgba(99,102,246,0.08)] p-4"
                      >
                        <p className="font-bold text-slate-800">{a.network}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {d > 0
                            ? `${d}% off face value`
                            : "Face value"}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {[100, 500, 1000].map((face) => (
                            <li key={face} className="flex justify-between text-slate-600">
                              <span>{naira(face)} airtime</span>
                              <span className="font-semibold text-slate-800">
                                {naira(Math.round(face * (1 - d / 100) * 100) / 100)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Discount is applied automatically when you buy.
                </p>
              </section>
            )}

            {/* Closing CTA */}
            <section className="text-center pt-2 pb-4">
              <p className="text-sm text-slate-600">Ready to buy?</p>
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-opacity"
                >
                  Create free account <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-fuchsia-300 transition-colors text-center"
                >
                  Login
                </Link>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="pb-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Verronex VTU
      </footer>
    </div>
  );
}