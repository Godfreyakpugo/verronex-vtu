import { useState } from "react";
import {
  ShieldCheck,
  UserCheck,
  User,
  Wallet,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import supabase from "../../../lib/supabaseClient";

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function UserListItem({
  user,
  expanded,
  onToggleExpand,
  onUserUpdated,
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  const role = user.is_admin
    ? "Admin"
    : user.user_tier === "agent"
      ? "Agent"
      : "Basic";

  const handleToggleAgent = async (currentTier) => {
    setIsUpdating(true);
    const newTier = currentTier === "agent" ? "basic" : "agent";

    const { error } = await supabase
      .from("profiles")
      .update({ user_tier: newTier })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating user tier:", error);
      alert("Failed to update user. Check console.");
    } else {
      onUserUpdated();
    }
    setIsUpdating(false);
  };

  return (
    <div className="border-t border-fuchsia-50">
      <button
        onClick={onToggleExpand}
        className="w-full grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:grid-cols-5 gap-2 md:gap-4 items-center px-4 md:px-6 py-4 hover:bg-fuchsia-50 transition text-left"
      >
        {/* min-w-0 is the secret sauce that allows truncate to work inside CSS grid */}
        <div className="min-w-0 pr-2">
          <p className="font-bold text-slate-800 text-xs md:text-sm truncate">
            {user.full_name || "Unknown User"}
          </p>
          <p className="text-[10px] md:text-xs text-slate-500 truncate">
            {user.email}
          </p>
        </div>

        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold whitespace-nowrap ${
              role === "Admin"
                ? "bg-purple-100 text-purple-700"
                : role === "Agent"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {role === "Admin" ? (
              <ShieldCheck className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
            ) : role === "Agent" ? (
              <UserCheck className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
            ) : (
              <User className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
            )}
            <span className="truncate">{role}</span>
          </span>
        </div>

        <div className="font-bold text-fuchsia-600 text-[11px] md:text-sm whitespace-nowrap">
          ₦{formatMoney(user.wallet_balance || user.balance || 0)}
        </div>

        <div className="text-[10px] md:text-sm text-slate-500 whitespace-nowrap">
          {new Date(user.created_at).toLocaleDateString()}
        </div>

        <div className="flex justify-end text-slate-400">
          {expanded ? (
            <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
          ) : (
            <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 bg-slate-50 border-t border-slate-100 pt-4">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-fuchsia-600" />
                <span className="font-semibold">Phone:</span>{" "}
                {user.phone || "N/A"}
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-fuchsia-600" />
                <span className="font-semibold">Joined:</span>{" "}
                {new Date(user.created_at).toLocaleString()}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Wallet className="w-4 h-4 text-fuchsia-600" />
                <span className="font-semibold">Balance:</span> ₦
                {formatMoney(user.wallet_balance || user.balance || 0)}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-xl bg-linear-to-r from-fuchsia-600 to-purple-600 text-white px-5 py-2 text-sm font-semibold hover:opacity-90 transition">
              Adjust Wallet
            </button>

            {!user.is_admin && (
              <button
                onClick={() => handleToggleAgent(user.user_tier)}
                disabled={isUpdating}
                className={`rounded-xl px-5 py-2 text-sm font-semibold text-white transition flex items-center gap-2 ${
                  user.user_tier === "agent"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-emerald-500 hover:bg-emerald-600"
                } disabled:opacity-50`}
              >
                {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                {user.user_tier === "agent"
                  ? "Remove Agent Status"
                  : "Promote to Agent"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
