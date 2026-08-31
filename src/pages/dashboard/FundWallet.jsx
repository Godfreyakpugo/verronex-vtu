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
import SEO from "../../components/seo/SEO";

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
  const MONNIFY_ENABLED = import.meta.env.VITE_MONNIFY_ENABLED === "true";

  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [monnifyLoading, setMonnifyLoading] = useState(false);
  const [monnifyData, setMonnifyData] = useState(null);
  const [monnifyError, setMonnifyError] = useState("");
  const [monnifyCopied, setMonnifyCopied] = useState(false);

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
        .select("id, amount, reference, payment_reference, transaction_reference, status, rejection_reason, created_at")
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

  async function copyMonnifyAccount() {
    if (!monnifyData?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(monnifyData.accountNumber);
      setMonnifyCopied(true);
      setTimeout(() => setMonnifyCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  async function handleMonnifyFunding() {
    if (!user || !profile) return;
    if (!amountValid) {
      setMonnifyError("Enter a valid whole Naira amount above zero.");
      return;
    }
    if (monnifyLoading) return;

    setMonnifyError("");
    setMonnifyLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("init-monnify-funding", {
        body: { amount: parsedAmount },
      });

      if (error) {
        // supabase-js wraps function errors; try to extract message
        let msg = error.message || "Could not initialize payment";
        // error.context is a Response with JSON body
        if (error.context && typeof error.context.json === "function") {
          try {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          } catch {
            // ignore
          }
        }
        throw new Error(msg);
      }

      if (!data?.success) {
        throw new Error(data?.error || "Could not initialize payment");
      }

      setMonnifyData(data);
      await fetchRecentRequests();
    } catch (err) {
      console.error("[Monnify] init failed", err);
      setMonnifyError(err.message || "Could not initialize payment. Please try again.");
    } finally {
      setMonnifyLoading(false);
    }
  }

  const statusMeta = (status) =>
    REQUEST_STATUS_META[status] || {
      label: status || "Pending",
      badge: "bg-slate-100 text-slate-600",
    };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <SEO title="Fund Wallet — Verronex VTU" robots="noindex, nofollow" canonical={null} />
      {/* Hero — compact banner, not a quarter of the page */}
      <div className="rounded-2xl bg-[linear-gradient(135deg,#312e81,#7c3aed,#d946ef)] text-white px-5 py-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Fund Wallet
            </h1>
            <p className="text-xs sm:text-sm text-purple-200">
              Add money to your Verronex wallet
            </p>
          </div>
        </div>
      </div>

      {/* Monnify Automatic Funding (Feature Flag) */}
      {MONNIFY_ENABLED && (
        <GlassCard className="p-4 border-fuchsia-200">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Automatic Funding</h2>
              <p className="text-xs text-slate-500">Instant bank transfer via Monnify (sandbox)</p>
            </div>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
              Recommended
            </span>
          </div>

          {!monnifyData ? (
            <>
              <p className="text-xs text-slate-600 mb-3">
                Enter amount and generate a one-time account to fund your wallet. Your wallet will be credited automatically after payment is confirmed.
              </p>
              {monnifyError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600">
                  {monnifyError}
                </div>
              )}
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Amount (₦)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
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
                  className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 pl-8 pr-4 py-2.5 font-semibold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
                />
              </div>

              {!amountValid && amount.trim() !== "" && (
                <p className="mt-1.5 text-xs font-semibold text-red-500">
                  Enter a whole Naira amount above zero (max ₦
                  {MAX_AMOUNT.toLocaleString("en-NG")}).
                </p>
              )}

              <div className="mt-2.5 mb-3 flex flex-nowrap gap-1.5">
                {QUICK_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(String(value))}
                    className={`flex-1 min-w-0 whitespace-nowrap text-center rounded-lg border px-0.5 py-1.5 text-[11px] sm:text-sm font-semibold transition-all ${
                      Number(amount) === value
                        ? "bg-linear-to-r from-fuchsia-600 to-purple-600 border-transparent text-white shadow"
                        : "bg-white border-fuchsia-200 text-slate-600 hover:border-fuchsia-400"
                    }`}
                  >
                    ₦{value.toLocaleString("en-NG")}
                  </button>
                ))}
              </div>
              <button
                onClick={handleMonnifyFunding}
                disabled={monnifyLoading || !amountValid}
                className="w-full rounded-xl bg-[linear-gradient(135deg,#4f46e5,#9333ea)] py-3 text-white font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/30 hover:brightness-110 transition-all disabled:opacity-50 text-sm sm:text-base"
              >
                {monnifyLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    Generate Payment Account
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </>
                )}
              </button>
              {!amountValid && amount.trim() !== "" && (
                <p className="mt-2 text-xs font-semibold text-red-500 text-center">
                  Enter a whole Naira amount above zero (max ₦{MAX_AMOUNT.toLocaleString("en-NG")}).
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 border border-fuchsia-200 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Amount to Pay</p>
                <p className="text-2xl font-black text-slate-900">{formatNaira(monnifyData.amount)}</p>
                <p className="text-xs text-slate-500 mt-1">Transfer exactly this amount</p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase text-slate-400 shrink-0">Bank</p>
                  <p className="text-sm font-semibold text-right">{monnifyData.bankName || "—"}</p>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase text-slate-400 shrink-0">Account Name</p>
                  <p className="text-sm font-semibold text-right">{monnifyData.accountName || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-slate-400">Account Number</p>
                  <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-white px-3 py-2.5 mt-1">
                    <span className="text-base sm:text-lg font-black tracking-[0.15em]">{monnifyData.accountNumber}</span>
                    <button
                      onClick={copyMonnifyAccount}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      {monnifyCopied ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {(monnifyData.accountDurationSeconds || monnifyData.expiresAt) && (
                  <p className="text-xs text-amber-600 font-semibold text-center">
                    {monnifyData.expiresAt
                      ? `Expires: ${new Date(monnifyData.expiresAt).toLocaleString()}`
                      : `Expires in ${Math.ceil((monnifyData.accountDurationSeconds || 600) / 60)} minutes`}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">Payment ref: <span className="font-mono font-semibold">{monnifyData.paymentReference}</span></p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-800">Waiting for your transfer — your wallet will be credited automatically after payment is confirmed.</p>
                <p className="text-[11px] text-amber-600 mt-1">Do not close this page. Keep the account number until transfer succeeds.</p>
              </div>

              <button
                onClick={() => setMonnifyData(null)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Generate New Account
              </button>
            </div>
          )}
        </GlassCard>
      )}

      {/* Bank details */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-fuchsia-100 flex items-center justify-center shrink-0">
            <Building2 className="w-4.5 h-4.5 text-fuchsia-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Bank Transfer</h2>
            <p className="text-xs text-slate-500">
              Make a transfer using your banking app.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase text-slate-400 shrink-0">
              Bank
            </p>
            <p className="text-sm font-semibold text-right">{BANK_NAME}</p>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase text-slate-400 shrink-0">
              Account Name
            </p>
            <p className="text-sm font-semibold text-right">{ACCOUNT_NAME}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase text-slate-400">
              Account Number
            </p>
            <div className="flex items-center justify-between rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-3 py-2">
              <span className="text-base sm:text-lg font-black tracking-[0.15em]">
                {ACCOUNT_NUMBER}
              </span>
              <button
                onClick={copyAccount}
                className="flex items-center gap-1.5 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs text-white font-semibold hover:bg-fuchsia-700 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Funding form */}
      <GlassCard className="p-4">
        <div className="mb-3">
          <h2 className="font-bold text-slate-800">Funding Details</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter the amount you transferred.
          </p>
        </div>

        <label className="text-xs font-bold text-slate-700 block mb-1.5">
          Amount (₦)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
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
            className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 pl-8 pr-4 py-2.5 font-semibold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
          />
        </div>

        {!amountValid && amount.trim() !== "" && (
          <p className="mt-1.5 text-xs font-semibold text-red-500">
            Enter a whole Naira amount above zero (max ₦
            {MAX_AMOUNT.toLocaleString("en-NG")}).
          </p>
        )}

        {/* One shrinking line — never wraps, never truncates */}
        <div className="mt-2.5 flex flex-nowrap gap-1.5">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(String(value))}
              className={`flex-1 min-w-0 whitespace-nowrap text-center rounded-lg border px-0.5 py-1.5 text-[11px] sm:text-sm font-semibold transition-all ${
                Number(amount) === value
                  ? "bg-linear-to-r from-fuchsia-600 to-purple-600 border-transparent text-white shadow"
                  : "bg-white border-fuchsia-200 text-slate-600 hover:border-fuchsia-400"
              }`}
            >
              ₦{value.toLocaleString("en-NG")}
            </button>
          ))}
        </div>

        <div className="mt-3.5">
          <label className="text-xs font-bold text-slate-700 block mb-1.5">
            Payment Reference (Optional)
          </label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank reference (if available)"
            className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
          />
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleFundingRequest}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-[linear-gradient(135deg,#d946ef,#7c3aed)] py-3 text-white font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-fuchsia-500/30 hover:brightness-110 transition-all disabled:opacity-50 text-sm sm:text-base"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              I've Made Payment
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </>
          )}
        </button>
      </GlassCard>

      {/* Confirmation */}
      {submitted && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <h3 className="text-lg font-black text-slate-900">
              Funding Request Submitted
            </h3>
          </div>
          <p className="text-xl font-black text-emerald-600">
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
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
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
                      {(req.payment_reference || req.reference) ? ` • ${req.payment_reference || req.reference}` : ""}
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