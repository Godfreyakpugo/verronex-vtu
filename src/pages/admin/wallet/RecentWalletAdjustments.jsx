import { Clock } from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function RecentWalletAdjustments({ recentActions }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-slate-400" />
        <h2 className="text-base font-bold text-slate-900">
          Recent Wallet Adjustments
        </h2>
      </div>
      <GlassCard className="divide-y divide-fuchsia-50/80">
        {recentActions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-400">
              No wallet adjustments recorded yet
            </p>
          </div>
        ) : (
          recentActions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {tx.profiles?.full_name ?? tx.profiles?.email ?? "Unknown"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Ref: {tx.reference}
                </p>
                <p className="text-xs text-slate-400">
                  {new Intl.DateTimeFormat("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(tx.created_at))}
                </p>
              </div>
              <p
                className={`text-base font-black ${
                  tx.type === "credit" ? "text-green-600" : "text-red-500"
                }`}
              >
                {tx.type === "credit" ? "+" : "-"}₦{formatMoney(tx.amount)}
              </p>
            </div>
          ))
        )}
      </GlassCard>
    </div>
  );
}

export default RecentWalletAdjustments;
