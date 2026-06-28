import { Wifi, Phone, Plus, ArrowUpRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GlassCard from "../components/ui/GlassCard";

const quickActions = [
  {
    icon: Wifi,
    label: "Buy Data",
    sub: "SME & Corporate bundles",
    color: "text-fuchsia-700",
    bg: "bg-fuchsia-300",
    border: "border-fuchsia-200",
  },
  {
    icon: Phone,
    label: "Buy Airtime",
    sub: "All networks supported",
    color: "text-fuchsia-700",
    bg: "bg-fuchsia-300",
    border: "border-fuchsia-200",
  },
];

function Dashboard() {
  const { profile, wallet } = useAuth();

  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  return (
    <div className="space-y-6 bg-white/30 backdrop-blur-2xl border border-fuchsia-200 shadow-[0_15px_45px_rgba(236,72,153,0.12)] p-6 lg:p-8 rounded-3xl">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Welcome back!{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your wallet and services
        </p>
      </div>

      {/* Wallet Card */}
      <GlassCard className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Wallet Balance
            </p>
            <p className="text-3xl font-bold text-slate-800">
              ₦
              {parseFloat(wallet?.balance ?? 0).toLocaleString("en-NG", {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs bg-fuchsia-500/10 text-fuchsia-700 border border-fuchsia-200 px-2.5 py-0.5 rounded-full backdrop-blur">
              {profile?.user_tier === "verified"
                ? "✓ Verified Account"
                : "⬡ Basic Account"}
            </span>
          </div>

          <button className="shrink-0 flex items-center gap-2 bg-linear-to-r from-fuchsia-700 to-fuchsia-700 border border-fuchsia-400 hover:from-fuchsia-700 hover:to-pink-600 active:scale-95 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-fuchsia-200/70 transition-all">
            <Plus className="w-4 h-4" />
            Fund Wallet
          </button>
        </div>
      </GlassCard>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ icon: Icon, label, sub, color, bg, border }) => (
            <GlassCard
              key={label}
              className={`p-4 cursor-pointer active:scale-95 ${bg}`}
            >
              <div
                className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center mb-3`}
              >
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Recent Transactions
          </h2>
          <button className="text-xs text-fuchsia-700 hover:text-fuchsia-900 font-medium">
            View all
          </button>
        </div>

        <GlassCard className="p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 border border-fuchsia-100 flex items-center justify-center mx-auto mb-3">
            <ArrowUpRight className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm text-slate-500">No transactions yet</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Fund your wallet to get started
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

export default Dashboard;
