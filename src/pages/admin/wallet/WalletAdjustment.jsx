import { useMemo, useState } from "react";
import {
  Wallet,
  ArrowRight,
  ArrowDown,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function WalletAdjustment({
  targetUser,
  targetWallet,
  loading,
  onSubmit,
}) {
  const [mode, setMode] = useState("credit");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  const currentBalance = Number(targetWallet?.balance || 0);
  const parsedAmount = Number(amount || 0);

  const newBalance = useMemo(() => {
    return mode === "credit"
      ? currentBalance + parsedAmount
      : currentBalance - parsedAmount;
  }, [mode, parsedAmount, currentBalance]);

  const disabled =
    !targetUser ||
    parsedAmount <= 0 ||
    loading ||
    (mode === "debit" && parsedAmount > currentBalance);

  const handleSubmit = () => {
    if (disabled) return;

    onSubmit({
      mode,
      amount: parsedAmount,
      reference: reference.trim(),
      reason: reason.trim(),
    });
  };

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-fuchsia-600" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Wallet Adjustment
          </h2>
          <p className="text-xs text-slate-500">
            Credit or debit a customer's wallet.
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-xl bg-slate-100 p-1 flex">
        <button
          onClick={() => setMode("credit")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition ${
            mode === "credit"
              ? "bg-linear-to-r from-fuchsia-600 to-purple-600 text-white shadow"
              : "text-slate-600 hover:bg-white"
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          Credit
        </button>

        <button
          onClick={() => setMode("debit")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition ${
            mode === "debit"
              ? "bg-red-500 text-white shadow"
              : "text-slate-600 hover:bg-white"
          }`}
        >
          <MinusCircle className="w-4 h-4" />
          Debit
        </button>
      </div>

      <div className="rounded-xl bg-fuchsia-50 border border-fuchsia-100 p-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-bold text-slate-800">{targetUser?.full_name}</p>
            <p className="text-xs text-slate-500">
              @{targetUser?.username || "no-username"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] uppercase font-bold tracking-wide text-slate-500">
              Balance
            </p>
            <p className="text-lg font-black text-fuchsia-600">
              ₦{formatMoney(currentBalance)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] uppercase font-bold tracking-wide text-slate-500">
            Amount
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            className="mt-1 w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-2.5 focus:ring-2 focus:ring-fuchsia-500 outline-none"
          />
        </div>

        <div>
          <label className="text-[11px] uppercase font-bold tracking-wide text-slate-500">
            Reference (Optional)
          </label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Leave blank to auto-generate"
            className="mt-1 w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-2.5 focus:ring-2 focus:ring-fuchsia-500 outline-none"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="text-[11px] uppercase font-bold tracking-wide text-slate-500">
          Reason (Optional)
        </label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for this adjustment..."
          className="mt-1 w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-2.5 resize-none focus:ring-2 focus:ring-fuchsia-500 outline-none"
        />
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Current Balance</span>
          <span className="font-semibold">₦{formatMoney(currentBalance)}</span>
        </div>

        <div className="flex justify-center py-2">
          {mode === "credit" ? (
            <ArrowRight className="text-fuchsia-600 w-5 h-5" />
          ) : (
            <ArrowDown className="text-red-500 w-5 h-5" />
          )}
        </div>

        <div className="flex justify-between">
          <span className="text-sm text-slate-500">New Balance</span>
          <span
            className={`font-black text-lg ${
              mode === "credit"
                ? "text-green-600"
                : newBalance < 0
                  ? "text-red-600"
                  : "text-red-500"
            }`}
          >
            ₦{formatMoney(newBalance)}
          </span>
        </div>

        {newBalance < 0 && (
          <p className="mt-2 text-xs text-red-500 font-semibold">
            Insufficient balance.
          </p>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className={`mt-5 w-full rounded-2xl py-3.5 font-bold text-white flex items-center justify-center gap-2 transition ${
          mode === "credit"
            ? "bg-linear-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700"
            : "bg-red-500 hover:bg-red-600"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Wallet className="w-5 h-5" />
        Apply Adjustment
        <ArrowRight className="w-5 h-5" />
      </button>
    </GlassCard>
  );
}
