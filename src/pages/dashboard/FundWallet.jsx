import { useEffect, useState } from "react";
import {
  Building2,
  Copy,
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  Wallet,
  Loader2,
  Clock,
  XCircle,
  CheckCircle,
} from "lucide-react";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import GlassCard from "../../components/ui/GlassCard";
import { formatNaira, smartDate } from "../../lib/transactionView";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];
const MAX_AMOUNT = 5000000;

const REQUEST_STATUS_META = {
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-700" },
  processed: { label: "Processed", badge: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", badge: "bg-red-100 text-red-600" },
};

function RequestStatusIcon({ status }) {
  if (status === "processed") {
    return <CheckCircle className="w-4 h-4 text-emerald-600" />;
  }
  if (status === "rejected") {
    return <XCircle className="w-4 h-4 text-red-500" />;
  }
  return <Clock className="w-4 h-4 text-amber-500" />;
}

export default function FundWallet() {
  const { user, profile, refreshWallet } = useAuth();

  const BANK_NAME = import.meta.env.VITE_BANK_NAME;
  const ACCOUNT_NAME = import.meta.env.VITE_ACCOUNT_NAME;
  const ACCOUNT_NUMBER = import.meta.env.VITE_ACCOUNT_NUMBER;
  const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER;

  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const parsedAmount = Number(amount || 0);
  const amountValid =
    Number.isFinite(parsedAmount) &&
    Number.isInteger(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= MAX_AMOUNT;

  const fetchRecentRequests = async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from("funding_requests")
        .select("id, amount, reference, status, rejection_reason, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (err) throw err;
      setRecentRequests(data || []);
    } catch (err) {
      console.error("Failed to fetch funding requests:", err);
      setRecentRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentRequests();
    refreshWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(ACCOUNT_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — account number is still visible
    }
  }

  async function handleFundingRequest() {
    if (!user || !profile) return;
    if (!amountValid) {
      setError("Enter a valid whole Naira amount above zero.");
      return;
    }
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const finalReference = reference.trim() || null;

      const { data, error: insertError } = await supabase
        .from("funding_requests")
        .insert({
          user_id: user.id,
          amount: parsedAmount,
          reference: finalReference,
        })
        .select("id, amount, reference, status, created_at")
        .single();

      if (insertError) throw insertError;

      const message = `*=== VERRONEX WALLET FUNDING REQUEST ===*

Username: ${profile.username ?? "N/A"}

Name: ${profile.full_name}

Phone: ${profile.phone}

Email: ${profile.email}

Amount: ₦${parsedAmount.toLocaleString("en-NG")}

Reference: ${finalReference || "Not Provided"}

I have submitted a funding request of ₦${parsedAmount.toLocaleString(
        "en-NG",
      )} for verification. Please verify my transfer and credit my wallet.

Thank you.`;

      window.open(
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
        "_blank",
      );

      setSubmitted(data);
      setAmount("");
      setReference("");
      await fetchRecentRequests();
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not submit your funding request.");
    } finally {
      setLoading(false);
    }
  }

  const statusMeta = (status) =>
    REQUEST_STATUS_META[status] || {
      label: status || "Pending",
      badge: "bg-slate-100 text-slate-600",
    };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Hero */}
      <div className="rounded-3xl bg-[linear-gradient(135deg,#312e81,#7c3aed,#d946ef)] text-white p-8 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Fund Wallet</h1>
            <p className="mt-1 text-purple-200">
              Add money to your Verronex wallet
            </p>
          </div>
        </div>
      </div>

      {/* Bank details */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-fuchsia-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Bank Transfer</h2>
            <p className="text-sm text-slate-500">
              Make a transfer using your banking app.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Bank</p>
            <p className="text-lg font-semibold">{BANK_NAME}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Account Name
            </p>
            <p className="text-lg font-semibold">{ACCOUNT_NAME}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Account Number
            </p>
            <div className="flex items-center justify-between rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-5 py-4">
              <span className="text-2xl font-black tracking-widest">
                {ACCOUNT_NUMBER}
              </span>
              <button
                onClick={copyAccount}
                className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-white font-semibold hover:bg-fuchsia-700 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Funding form */}
      <GlassCard className="p-6">
        <div className="mb-5">
          <h2 className="font-bold text-slate-800">Funding Details</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Enter the amount you transferred.
          </p>
        </div>

        <label className="text-sm font-bold text-slate-700 block mb-2">
          Amount (₦)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
            ₦
          </span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5,000"
            className="w-full rounded-2xl border border-fuchsia-100 bg-fuchsia-50 pl-9 pr-4 py-3.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
          />
        </div>

        {!amountValid && amount.trim() !== "" && (
          <p className="mt-2 text-xs font-semibold text-red-500">
            Enter a whole Naira amount above zero (max ₦
            {MAX_AMOUNT.toLocaleString("en-NG")}).
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(String(value))}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                Number(amount) === value
                  ? "bg-linear-to-r from-fuchsia-600 to-purple-600 border-transparent text-white shadow"
                  : "bg-white border-fuchsia-200 text-slate-600 hover:border-fuchsia-400"
              }`}
            >
              ₦{value.toLocaleString("en-NG")}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <label className="text-sm font-bold text-slate-700 block mb-2">
            Payment Reference (Optional)
          </label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank reference (if available)"
            className="w-full rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleFundingRequest}
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-[linear-gradient(135deg,#d946ef,#7c3aed)] py-4 text-white font-bold flex items-center justify-center gap-3 shadow-lg shadow-fuchsia-500/30 hover:brightness-110 transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <MessageCircle className="w-5 h-5" />
              I've Made Payment
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </GlassCard>

      {/* Confirmation */}
      {submitted && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <h3 className="text-lg font-black text-slate-900">
              Funding Request Submitted
            </h3>
          </div>
          <p className="text-3xl font-black text-emerald-600">
            {formatNaira(submitted.amount)}
          </p>
          <p className="mt-2 text-sm text-emerald-800">
            Your payment is awaiting verification. We will update your wallet
            once payment is confirmed.
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            Submitted {smartDate(submitted.created_at)}. Keep an eye on this
            page — your request will update to{" "}
            <span className="font-bold">Processed</span> once verified.
          </p>
        </div>
      )}

      {/* Recent funding requests */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">Recent Funding Requests</h2>
          {!requestsLoading && recentRequests.length > 0 && (
            <span className="text-xs font-bold text-slate-400">
              {recentRequests.length} recent
            </span>
          )}
        </div>

        {requestsLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : recentRequests.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            No funding requests yet.
          </p>
        ) : (
          <div className="divide-y divide-fuchsia-50/80">
            {recentRequests.map((req) => {
              const meta = statusMeta(req.status);
              return (
                <div key={req.id} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-xl bg-fuchsia-100 flex items-center justify-center shrink-0">
                    <RequestStatusIcon status={req.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">
                      {formatNaira(req.amount)}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {smartDate(req.created_at)}
                      {req.reference ? ` • ${req.reference}` : ""}
                    </p>
                    {req.status === "rejected" && req.rejection_reason && (
                      <p className="text-[11px] text-red-500 truncate">
                        {req.rejection_reason}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}