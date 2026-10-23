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
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import GlassCard from "../../components/ui/GlassCard";
import { formatNaira, smartDate } from "../../lib/transactionView";
import SEO from "../../components/seo/SEO";
import {
  getFallbackManualFundingSettings,
  MANUAL_FUNDING_SETTINGS_COLUMNS,
  mapManualFundingSettings,
} from "../../lib/manualFundingSettings";

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

  const MONNIFY_ENABLED = import.meta.env.VITE_MONNIFY_ENABLED === "true";

  const [manualFundingSettings, setManualFundingSettings] = useState(
    getFallbackManualFundingSettings,
  );
  const [manualSettingsLoading, setManualSettingsLoading] = useState(true);
  const bankName = manualFundingSettings.bank_name;
  const accountName = manualFundingSettings.account_name;
  const accountNumber = manualFundingSettings.account_number;
  const whatsappNumber = manualFundingSettings.whatsapp_number;
  const manualFundingAvailable = Boolean(
    bankName.trim() && accountName.trim() && accountNumber.trim(),
  );

  const [amount, setAmount] = useState("");
  // Manual funding keeps its own amount. It used to share `amount` with the
  // Monnify card, which made typing in one field fill the other and left the
  // manual form pre-filled with an amount the customer had not transferred.
  const [manualAmount, setManualAmount] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
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
  const [reservedAccount, setReservedAccount] = useState(null);
  const [reservedAccountLoading, setReservedAccountLoading] = useState(true);
  const [reservedAccountCreating, setReservedAccountCreating] = useState(false);
  const [reservedAccountError, setReservedAccountError] = useState("");
  const [reservedIdentityType, setReservedIdentityType] = useState("BVN");
  const [reservedIdentityNumber, setReservedIdentityNumber] = useState("");
  const [reservedIdentityConsent, setReservedIdentityConsent] = useState(false);
  const [reservedAccountCopied, setReservedAccountCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadManualFundingSettings() {
      try {
        const { data, error: settingsError } = await supabase
          .from("manual_funding_settings")
          .select(MANUAL_FUNDING_SETTINGS_COLUMNS)
          .eq("id", 1)
          .maybeSingle();

        if (settingsError) throw settingsError;
        if (cancelled) return;

        if (data?.configured) {
          setManualFundingSettings(mapManualFundingSettings(data));
        }
      } catch (settingsError) {
        // Until the settings table is installed, retain the build-time values.
        console.warn("Could not load saved manual funding settings:", settingsError);
      } finally {
        if (!cancelled) setManualSettingsLoading(false);
      }
    }

    loadManualFundingSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReservedAccount() {
      if (!user?.id || !MONNIFY_ENABLED) {
        setReservedAccountLoading(false);
        setReservedAccount(null);
        return;
      }

      setReservedAccountLoading(true);
      try {
        const { data, error: accountError } = await supabase
          .from("monnify_reserved_accounts")
          .select("account_reference, reservation_reference, account_name, account_number, bank_code, bank_name, status, kyc_type, consented_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (accountError) throw accountError;
        if (!cancelled) setReservedAccount(data || null);
      } catch (accountError) {
        // Keep the one-time Monnify funding flow available if this feature's
        // schema has not been applied to the connected Supabase project yet.
        console.warn("Could not load Monnify reserved account:", accountError);
        if (!cancelled) setReservedAccount(null);
      } finally {
        if (!cancelled) setReservedAccountLoading(false);
      }
    }

    loadReservedAccount();
    return () => {
      cancelled = true;
    };
  }, [user?.id, MONNIFY_ENABLED]);

  const parsedAmount = Number(amount || 0);
  const amountValid =
    Number.isFinite(parsedAmount) &&
    Number.isInteger(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= MAX_AMOUNT;

  const parsedManualAmount = Number(manualAmount || 0);
  const manualAmountValid =
    Number.isFinite(parsedManualAmount) &&
    Number.isInteger(parsedManualAmount) &&
    parsedManualAmount > 0 &&
    parsedManualAmount <= MAX_AMOUNT;

  // A live Monnify account means the customer is already on the automatic path.
  // Filing a manual request on top of it strands a real payment: the manual
  // request and the Monnify request are settled independently, so admins end up
  // crediting one and leaving the other hanging.
  const manualBlockedByActiveAccount = Boolean(monnifyData);

  const fetchRecentRequests = async () => {
    if (!user?.id) {
      setRequestsLoading(false);
      return;
    }
    try {
      // Scoped to the signed-in user. RLS is the real boundary here (see
      // supabase/sql/funding_requests_rls_audit.sql); this filter keeps the
      // UI from ever rendering another customer's rows.
      const { data, error: err } = await supabase
        .from("funding_requests")
        .select("id, amount, reference, payment_reference, transaction_reference, status, rejection_reason, created_at")
        .eq("user_id", user.id)
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
    if (!user?.id) return;
    fetchRecentRequests();
    refreshWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (typeof supabase.channel !== "function") return;

    const channel = supabase
      .channel(`funding-requests-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "funding_requests",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchRecentRequests();
          refreshWallet();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        () => refreshWallet(),
      )
      .subscribe();

    return () => {
      try {
        if (typeof supabase.removeChannel === "function") {
          supabase.removeChannel(channel);
        } else if (typeof channel.unsubscribe === "function") {
          channel.unsubscribe();
        }
      } catch {
        // cleanup best-effort
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function copyAccount() {
    if (!accountNumber) return;
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — account number is still visible
    }
  }

  async function handleFundingRequest() {
    // The guard is kept (a funding request needs a profile to build the
    // notification), but it now reports back instead of silently returning.
    if (!user) {
      setError(
        "You need to be signed in to submit a funding request. Please sign in and try again.",
      );
      return;
    }
    if (!profile) {
      setError(
        "Your profile is still loading, so we cannot submit this request yet. Please wait a moment and try again — if it persists, refresh the page.",
      );
      return;
    }
    if (manualBlockedByActiveAccount) {
      setError(
        "You already have an automatic funding account waiting for payment. Pay that one, or generate a new account first.",
      );
      return;
    }
    if (!manualAmountValid) {
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
          amount: parsedManualAmount,
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

Amount: ₦${parsedManualAmount.toLocaleString("en-NG")}

Reference: ${finalReference || "Not Provided"}

I have submitted a funding request of ₦${parsedManualAmount.toLocaleString(
        "en-NG",
      )} for verification. Please verify my transfer and credit my wallet.

Thank you.`;

      if (whatsappNumber) {
        window.open(
          `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
          "_blank",
        );
      }

      setSubmitted(data);
      setManualAmount("");
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

  async function copyReservedAccount() {
    if (!reservedAccount?.account_number) return;
    try {
      await navigator.clipboard.writeText(reservedAccount.account_number);
      setReservedAccountCopied(true);
      setTimeout(() => setReservedAccountCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  async function handleCreateReservedAccount() {
    const identityNumber = reservedIdentityNumber.replace(/\s/g, "");
    if (!/^\d{11}$/.test(identityNumber)) {
      setReservedAccountError(`${reservedIdentityType} must contain 11 digits.`);
      return;
    }
    if (!reservedIdentityConsent) {
      setReservedAccountError("Please consent before sending your identity number to Monnify.");
      return;
    }
    if (reservedAccountCreating) return;

    setReservedAccountError("");
    setReservedAccountCreating(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        "create-monnify-reserved-account",
        {
          body: {
            identityType: reservedIdentityType,
            identityNumber,
            consentToProcess: true,
          },
        },
      );

      if (functionError) {
        let message = functionError.message || "Could not create your permanent account.";
        if (functionError.context && typeof functionError.context.json === "function") {
          try {
            const responseBody = await functionError.context.json();
            if (responseBody?.error) message = responseBody.error;
          } catch {
            // Keep the function error message when no JSON response is present.
          }
        }
        throw new Error(message);
      }
      if (!data?.success || !data?.account) {
        throw new Error(data?.error || "Could not create your permanent account.");
      }

      setReservedAccount(data.account);
      setReservedIdentityNumber("");
      setReservedIdentityConsent(false);
    } catch (createError) {
      setReservedAccountError(createError.message || "Could not create your permanent account. Please try again.");
    } finally {
      setReservedIdentityNumber("");
      setReservedIdentityConsent(false);
      setReservedAccountCreating(false);
    }
  }

  async function handleMonnifyFunding() {
    if (!user) {
      setMonnifyError(
        "You need to be signed in to generate a payment account. Please sign in and try again.",
      );
      return;
    }
    if (!profile) {
      setMonnifyError(
        "Your profile is still loading, so a payment account cannot be created yet. Please wait a moment and try again — if it persists, refresh the page.",
      );
      return;
    }
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

  // Settled state of the payment account currently on screen, resolved from the
  // database row for that exact request id — never from the webhook payload or
  // the local timer. `process_monnify_funding` flips status to 'processed' only
  // after it has credited the wallet in the same transaction, so that is the
  // single trustworthy "money landed" signal.
  //
  // Everything that is not 'processed' stays in a waiting/review state,
  // including amount mismatches: both the mismatch branch of
  // process_monnify_funding and append_funding_verify_mismatch record their
  // verdict on monnify_status and deliberately leave status = 'pending', so a
  // mismatch can never be mistaken for a credit here.
  const monnifyRequest = monnifyData?.fundingRequestId
    ? recentRequests.find((req) => req.id === monnifyData.fundingRequestId) || null
    : null;

  const monnifySettled =
    monnifyRequest?.status === "processed"
      ? "credited"
      : monnifyRequest?.status === "rejected"
        ? "review"
        : "waiting";

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
        <GlassCard className="p-4 border-indigo-200">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Permanent funding account</h2>
              <p className="text-xs text-slate-500">A dedicated account linked to your wallet</p>
            </div>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
              Monnify
            </span>
          </div>

          {reservedAccountLoading ? (
            <div className="flex items-center gap-2 py-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your account...
            </div>
          ) : reservedAccount?.status === "active" && reservedAccount.account_number ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Transfer any amount to this account. Your wallet will be credited automatically after Monnify confirms the payment.
              </p>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Bank</span>
                  <span className="text-sm font-semibold text-right text-slate-800">{reservedAccount.bank_name || "—"}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Account Name</span>
                  <span className="text-sm font-semibold text-right text-slate-800">{reservedAccount.account_name || "—"}</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-slate-400">Account Number</p>
                  <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2.5">
                    <span className="text-base sm:text-lg font-black tracking-[0.15em] text-slate-900">{reservedAccount.account_number}</span>
                    <button
                      type="button"
                      onClick={copyReservedAccount}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      {reservedAccountCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {reservedAccountCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Create a one-time permanent bank account for your wallet. Monnify requires your BVN or NIN to reserve it.
              </p>
              {reservedAccount?.status && reservedAccount.status !== "active" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
                  Your account setup may still be processing. Retry below to recover its status.
                </div>
              )}
              {reservedAccountError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600">
                  {reservedAccountError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-2">
                <label className="text-xs font-bold text-slate-700">
                  ID type
                  <select
                    value={reservedIdentityType}
                    onChange={(event) => {
                      setReservedIdentityType(event.target.value);
                      setReservedIdentityConsent(false);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="BVN">BVN</option>
                    <option value="NIN">NIN</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">
                  {reservedIdentityType} (11 digits)
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={11}
                    value={reservedIdentityNumber}
                    onChange={(event) => {
                      setReservedIdentityNumber(event.target.value.replace(/\D/g, "").slice(0, 11));
                      setReservedIdentityConsent(false);
                    }}
                    placeholder={`Enter your ${reservedIdentityType}`}
                    className="mt-1.5 w-full rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </label>
              </div>
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
                <input
                  type="checkbox"
                  checked={reservedIdentityConsent}
                  onChange={(event) => setReservedIdentityConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                />
                <span>I consent to Verronex sending this {reservedIdentityType} to Monnify to create my permanent account. Verronex does not save the ID number in its database.</span>
              </label>
              <button
                type="button"
                onClick={handleCreateReservedAccount}
                disabled={reservedAccountCreating || !reservedIdentityConsent || reservedIdentityNumber.length !== 11}
                className="w-full rounded-xl bg-[linear-gradient(135deg,#4f46e5,#9333ea)] py-3 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:brightness-110 transition-all disabled:opacity-50 text-sm"
              >
                {reservedAccountCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                {reservedAccountCreating ? "Creating permanent account..." : reservedAccount?.status ? "Check account status" : "Create permanent account"}
              </button>
            </div>
          )}
        </GlassCard>
      )}

      {MONNIFY_ENABLED && (
        <GlassCard className="p-4 border-fuchsia-200">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Automatic Funding</h2>
              <p className="text-xs text-slate-500">Instant bank transfer via Monnify</p>
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

              <div
                className={`rounded-xl border px-3 py-2.5 ${
                  monnifySettled === "credited"
                    ? "border-emerald-200 bg-emerald-50"
                    : monnifySettled === "review"
                      ? "border-amber-200 bg-amber-50"
                      : "border-amber-200 bg-amber-50"
                }`}
              >
                {monnifySettled === "credited" ? (
                  <>
                    <p className="text-xs font-semibold text-emerald-800">
                      Payment confirmed — your wallet has been credited.
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-1">
                      You no longer need to send to this account number.
                    </p>
                  </>
                ) : monnifySettled === "review" ? (
                  <>
                    <p className="text-xs font-semibold text-amber-800">
                      This request was not approved and needs review.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1">
                      No credit was applied. Please contact support with your
                      payment reference.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-amber-800">
                      Waiting for your transfer — your wallet will be credited
                      automatically after payment is confirmed.
                    </p>
                    <p className="text-[11px] text-amber-600 mt-1">
                      Do not close this page. Keep the account number until
                      transfer succeeds. If Monnify reports a mismatch, this
                      request stays pending and support will review it.
                    </p>
                  </>
                )}
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

      {/* Manual funding — deliberately secondary.
          Bank transfer is the fallback for customers who cannot or will not use
          the automatic path. It is verified by a person rather than a webhook,
          so it is collapsed by default to keep one obvious way to fund. */}
      <GlassCard className="p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          aria-expanded={manualOpen}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-fuchsia-50/60 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Building2 className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-700 text-sm">
              Fund manually instead
            </h2>
            <p className="text-[11px] text-slate-500">
              Bank transfer, checked by a person
            </p>
          </div>
          <ChevronDown
            className={`ml-auto w-5 h-5 text-slate-400 shrink-0 transition-transform ${
              manualOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {manualOpen && (
          <div className="px-4 pb-4 space-y-3">
            {/* The one thing customers most need to know before choosing this */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-amber-800">
                Needs a manual check, so it is not instant. For urgent top-ups use
                Automatic Funding above — it credits as soon as Monnify confirms
                your transfer.
              </p>
            </div>

      {manualSettingsLoading ? (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bank transfer details...
          </div>
        </GlassCard>
      ) : manualFundingAvailable ? (
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
              <p className="text-sm font-semibold text-right">{bankName}</p>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-bold uppercase text-slate-400 shrink-0">
                Account Name
              </p>
              <p className="text-sm font-semibold text-right">{accountName}</p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase text-slate-400">
                Account Number
              </p>
              <div className="flex items-center justify-between rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-3 py-2">
                <span className="text-base sm:text-lg font-black tracking-[0.15em]">
                  {accountNumber}
                </span>
                <button
                  type="button"
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

            {manualFundingSettings.payment_instructions && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase text-indigo-500">
                  Transfer instructions
                </p>
                <p className="mt-1 whitespace-pre-line text-xs font-medium text-slate-700">
                  {manualFundingSettings.payment_instructions}
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
          Manual bank transfer details are not available right now. Please use Automatic Funding or contact support.
        </div>
      )}

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
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            placeholder="5,000"
            className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 pl-8 pr-4 py-2.5 font-semibold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
          />
        </div>

        {!manualAmountValid && manualAmount.trim() !== "" && (
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
              onClick={() => setManualAmount(String(value))}
              className={`flex-1 min-w-0 whitespace-nowrap text-center rounded-lg border px-0.5 py-1.5 text-[11px] sm:text-sm font-semibold transition-all ${
                Number(manualAmount) === value
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

        {/* Explains why the button below is inert, rather than leaving a dead
            control. */}
        {manualBlockedByActiveAccount && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold text-amber-800">
            You already have an automatic funding account waiting for payment. Pay
            that one, or use “Generate New Account” first.
          </div>
        )}

        <button
          onClick={handleFundingRequest}
          disabled={
            loading ||
            manualSettingsLoading ||
            !manualFundingAvailable ||
            manualBlockedByActiveAccount
          }
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
          </div>
        )}
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
