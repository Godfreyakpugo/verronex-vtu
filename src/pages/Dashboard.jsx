import { Wifi, Phone, Plus, ArrowUpRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GlassCard from "../components/ui/GlassCard";

const quickActions = [
  {
    icon: Wifi,
    label: "Buy Data",
    sub: "SME & Corporate bundles",
    iconColor: "text-white",
    iconBg:
      "bg-gradient-to-br from-fuchsia-600 to-purple-600 shadow-md shadow-fuchsia-500/30 border-0",
  },
  {
    icon: Phone,
    label: "Buy Airtime",
    sub: "All networks supported",
    iconColor: "text-white",
    iconBg:
      "bg-gradient-to-br from-fuchsia-600 to-purple-600 shadow-md shadow-fuchsia-500/30 border-0",
  },
];

function Dashboard() {
  const { profile, wallet } = useAuth();

  const firstName = profile?.full_name?.split(" ")[0] ?? null;

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
      <div className="p-7 rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-700 shadow-xl shadow-purple-900/20 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[80px] opacity-60"></div>

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-purple-200 uppercase tracking-widest font-semibold mb-2">
              Wallet Balance
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
            </span>
          </div>

          <button className="shrink-0 flex items-center gap-2 bg-white hover:bg-slate-50 active:scale-95 text-purple-700 text-sm font-bold px-5 py-3 rounded-2xl shadow-lg transition-all">
            <Plus className="w-4 h-4 stroke-[3]" />
            Fund Wallet
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map(({ icon: Icon, label, sub, iconColor, iconBg }) => (
            <GlassCard
              key={label}
              className="p-5 cursor-pointer active:scale-95 hover:shadow-xl hover:shadow-purple-500/10 transition-all border-slate-200/60"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${iconBg}`}
              >
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
              <p className="text-base font-bold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500 mt-1">{sub}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Recent Transactions
          </h2>
          <button className="text-sm text-fuchsia-600 hover:text-fuchsia-800 font-bold transition-colors">
            View all
          </button>
        </div>

        <GlassCard className="p-12 text-center border-slate-200/60">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ArrowUpRight className="w-6 h-6 text-slate-400 stroke-[2.5]" />
          </div>
          <p className="text-base font-bold text-slate-700">
            No transactions yet
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Fund your wallet to get started
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

export default Dashboard;
