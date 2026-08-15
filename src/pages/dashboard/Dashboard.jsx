import { useEffect, useState } from "react";
import { Wifi, Phone, Plus, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabaseClient";
import GlassCard from "../../components/ui/GlassCard";
import TransactionRow from "../../components/ui/TransactionRow";
import TransactionDetailModal from "../../components/ui/TransactionDetailModal";
import { buildTransactionView } from "../../lib/transactionView";
import { ROUTES } from "../../routes";

const quickActions = [
  {
    to: ROUTES.BUY_DATA,
    icon: Wifi,
    label: "Buy Data",
    sub: "SME & Corporate bundles",
    iconColor: "text-white",
    iconBg:
      "bg-linear-to-br from-fuchsia-600 to-purple-600 shadow-md shadow-fuchsia-500/30 border-0",
  },
  {
    to: ROUTES.BUY_AIRTIME,
    icon: Phone,
    label: "Buy Airtime",
    sub: "All networks supported",
    iconColor: "text-white",
    iconBg:
      "bg-linear-to-br from-fuchsia-600 to-purple-600 shadow-md shadow-fuchsia-500/30 border-0",
  },
];

const RECENT_LIMIT = 5;

function Dashboard() {
  const { profile, wallet } = useAuth();
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  useEffect(() => {
    let ignore = false;

    async function loadRecent() {
      setRecentLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(RECENT_LIMIT);

      if (ignore) return;
      if (!error) setRecent(data || []);
      setRecentLoading(false);
    }

    loadRecent();
    return () => {
      ignore = true;
    };
  }, []);

  const recentViews = recent.map(buildTransactionView);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Welcome back{firstName ? `, ${firstName}` : ""}! 👋
        </h1>
        <p className="text-sm text-slate-600 mt-1 font-medium">
          Manage your wallet and services
        </p>
      </div>

      {/* Wallet Card - Made Vivid */}
      <div className="p-7 rounded-3xl bg-linear-to-br from-indigo-900 via-purple-800 to-fuchsia-700 shadow-xl shadow-purple-900/20 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[80px] opacity-60"></div>

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-purple-200 uppercase tracking-widest font-semibold mb-2">
              Available Balance
            </p>
            <p className="text-4xl font-black text-white tracking-tight">
              <span className="text-fuchsia-300 mr-1 opacity-80">₦</span>
              {parseFloat(wallet?.balance ?? 0).toLocaleString("en-NG", {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-white/10 text-white border border-white/20 px-3 py-1 rounded-full backdrop-blur-md">
              {profile?.user_tier === "verified"
                ? "✓ Verified Account"
                : "⬡ Basic Account"}
              <span className="opacity-60">• {wallet?.currency || "NGN"}</span>
            </span>
          </div>

          <Link
            to="/fund-wallet"
            className="shrink-0 flex items-center gap-2 bg-white hover:bg-slate-50 active:scale-95 text-purple-700 text-sm font-bold px-5 py-3 rounded-2xl shadow-lg transition-all"
          >
            <Plus className="w-4 h-4 stroke-3" />
            Fund Wallet
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map(
            ({ to, icon: Icon, label, sub, iconColor, iconBg }) => (
              <Link to={to} key={label}>
                <GlassCard className="p-5 cursor-pointer active:scale-95 hover:shadow-xl hover:shadow-purple-500/10 transition-all border-slate-200/60">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${iconBg}`}
                  >
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                  </div>
                  <p className="text-base font-bold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500 mt-1">{sub}</p>
                </GlassCard>
              </Link>
            ),
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Recent Transactions
          </h2>
          <Link
            to={ROUTES.TRANSACTIONS}
            className="text-sm text-fuchsia-600 hover:text-fuchsia-800 font-bold transition-colors inline-flex items-center gap-1"
          >
            View All Transactions
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {recentLoading ? (
          <GlassCard className="divide-y divide-fuchsia-50/80">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
                  <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </GlassCard>
        ) : recentViews.length === 0 ? (
          <GlassCard className="p-12 text-center border-slate-200/60">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ArrowUpRight className="w-6 h-6 text-slate-400 stroke-[2.5]" />
            </div>
            <p className="text-base font-bold text-slate-700">
              No transactions yet
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Your Airtime, Data and wallet activity will appear here.
            </p>
          </GlassCard>
        ) : (
          <GlassCard className="divide-y divide-fuchsia-50/80">
            {recentViews.map((view) => (
              <TransactionRow
                key={view.id}
                tx={view}
                onClick={() => setSelected(view)}
              />
            ))}
          </GlassCard>
        )}
      </div>

      <TransactionDetailModal
        view={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

export default Dashboard;
