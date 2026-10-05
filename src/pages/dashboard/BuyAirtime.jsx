import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Smartphone,
  ChevronRight,
  Phone,
  Wallet,
  Clock3,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabaseClient";
import GlassCard from "../../components/ui/GlassCard";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Toast from "../../components/ui/Toast";
import PurchaseSuccessModal from "../../components/ui/PurchaseSuccessModal";
import SEO from "../../components/seo/SEO";
import {
  isValidNigerianPhone,
  normalizeNigerianPhone,
  normalizeNigerianPhoneOnComplete,
} from "../../lib/nigerianPhone";

const NETWORKS = [
  { value: "MTN", label: "MTN", short: "MTN", theme: "bg-yellow-400 text-slate-900" },
  { value: "GLO", label: "GLO", short: "GLO", theme: "bg-green-500 text-white" },
  { value: "AIRTEL", label: "Airtel", short: "AIR", theme: "bg-red-500 text-white" },
  { value: "9MOBILE", label: "9Mobile", short: "9M", theme: "bg-emerald-600 text-white" },
];

const PRESET_AMOUNTS = [50, 100, 200, 300, 500, 1000];

const MAX_AMOUNT = 10000;

function formatNaira(amount) {
  const value = Number(amount) || 0;
  return `₦${value.toLocaleString("en-NG")}`;
}

async function extractFunctionErrorMessage(error) {
  // supabase-js v2: FunctionsHttpError carries the real message in
  // error.context (a Response) when the edge function returns non-2xx.
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // context wasn't JSON (or already consumed) — fall through
    }
  }
  return error?.message || "Something went wrong. Please try again.";
}

// Reads the active per-network user discounts. Returns the parsed map, or null
// when the read failed. Pure data access with no state involved, so the effect
// that calls it does not setState synchronously.
async function fetchAirtimeDiscounts() {
  const { data, error } = await supabase
    .from("airtime_settings")
    .select("network, user_discount")
    .eq("is_active", true);

  if (error) {
    console.error("[BuyAirtime] airtime_settings read failed:", error.message);
    return null;
  }

  const map = {};
  for (const row of data || []) {
    map[row.network] = Number(row.user_discount) || 0;
  }
  return map;
}

function SummaryRow({ label, value, highlight = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-fuchsia-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span
        className={`text-sm text-right break-words min-w-0 ${
          highlight
            ? "font-bold text-fuchsia-600"
            : "font-semibold text-slate-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function PendingModal({ pending, onClose }) {
  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-6">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-3">
            <Clock3 className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="font-bold text-xl">Request Being Verified</h2>
          <p className="text-slate-600 text-sm mt-1.5">
            Kindly check your balance, or report to admin.
          </p>
        </div>
        {pending.reference && (
          <p className="text-xs text-slate-400 text-center mb-5 break-all">
            Reference: {pending.reference}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold py-3 hover:opacity-90 transition-opacity"
        >
          Alright
        </button>
      </GlassCard>
    </div>
  );
}

export default function BuyAirtime() {
  const { wallet, refreshWallet } = useAuth();

  // Per-network user discount (%) from admin Airtime settings. Used only to
  // show the exact wallet charge; the backend remains authoritative.
  // `settingsState` gates purchasing: while the discounts are unknown we must
  // not display a guessed charge or let the user buy against one.
  const [discounts, setDiscounts] = useState({});
  const [settingsState, setSettingsState] = useState("loading");

  const [network, setNetwork] = useState("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneInputRef = useRef(null);
  const [amount, setAmount] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const purchaseInFlightRef = useRef(false);

  const [toast, setToast] = useState(null);
  const [pending, setPending] = useState(null);
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Retry path only (event handler, not an effect).
  const refreshAirtimeSettings = useCallback(async () => {
    const map = await fetchAirtimeDiscounts();
    if (map === null) {
      // The backend always applies the discount, so an unreadable row means
      // the displayed charge would be wrong. Fail closed.
      setDiscounts({});
      setSettingsState("error");
      return;
    }
    setDiscounts(map);
    setSettingsState("ready");
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadAirtimeSettings() {
      const map = await fetchAirtimeDiscounts();
      if (ignore) return;

      if (map === null) {
        setDiscounts({});
        setSettingsState("error");
        return;
      }
      setDiscounts(map);
      setSettingsState("ready");
    }

    loadAirtimeSettings();
    return () => {
      ignore = true;
    };
  }, []);

  function handleRetrySettings() {
    if (settingsState === "loading") return;
    setSettingsState("loading");
    refreshAirtimeSettings();
  }

  // A missing wallet row means "not loaded yet", not a zero balance. Treating
  // it as 0 previously showed "insufficient funds" to funded users.
  const walletBalance = wallet ? Number(wallet.balance) || 0 : null;
  const walletUnavailable = walletBalance === null;
  const settingsReady = settingsState === "ready";
  const parsedAmount = parseInt(amount, 10) || 0;
  const amountIsValid =
    amount !== "" && parsedAmount > 0 && parsedAmount <= MAX_AMOUNT;

  const phoneIsValid = isValidNigerianPhone(phoneNumber);
  const phoneError =
    phoneTouched && phoneNumber && !phoneIsValid
      ? "Enter a valid Nigerian phone number (e.g. 080XXXXXXXX)."
      : "";

  const userDiscount = discounts[network] ?? null;
  // Only compute a charge once the discount for the selected network is known.
  const chargeKnown = userDiscount !== null;
  const charge =
    parsedAmount > 0 && chargeKnown
      ? Math.round(parsedAmount * (1 - userDiscount / 100) * 100) / 100
      : null;
  // With an unknown wallet or unknown charge we cannot assert sufficiency.
  const sufficient =
    charge !== null && walletBalance !== null ? charge <= walletBalance : false;

  const networkLabel =
    NETWORKS.find((n) => n.value === network)?.label || network;

  const canSubmit =
    phoneIsValid &&
    amountIsValid &&
    settingsReady &&
    !walletUnavailable &&
    sufficient &&
    !purchasing;

  function handleSelectNetwork(value) {
    if (purchasing) return;
    setNetwork(value);
    setToast(null);
  }

  function handlePreset(value) {
    if (purchasing) return;
    setAmount(String(value));
    setToast(null);
  }

  function handleAmountChange(value) {
    if (purchasing) return;
    setAmount(value.replace(/\D/g, "").slice(0, 6));
    setToast(null);
  }

  // Keep the raw text while typing so a half-entered international prefix
  // ("2", "23", "234") is never rewritten to "0" and the caret never jumps.
  // A complete valid number is canonicalised straight away, so pasting
  // "+234 803 740 8580" snaps to "08037408580"; an incomplete value is
  // normalised on blur instead.
  function handlePhoneChange(e) {
    const input = e.target;
    const raw = input.value;
    const next = normalizeNigerianPhoneOnComplete(raw);

    setPhoneNumber(next);

    if (next === raw) return;

    // Only reached when a whole number was entered and got canonicalised, so
    // the caret belongs at the end for any further typing.
    requestAnimationFrame(() => {
      const el = phoneInputRef.current;
      if (!el) return;
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }

  function handlePhoneBlur() {
    setPhoneTouched(true);
    setPhoneNumber((prev) => normalizeNigerianPhone(prev));
  }

  function handleOpenConfirm() {
    setPhoneTouched(true);
    setToast(null);

    if (!settingsReady) {
      setToast({
        type: "error",
        title: "Pricing unavailable",
        message:
          "We could not load airtime pricing, so the exact amount to pay is unknown. Please retry before buying.",
      });
      return;
    }
    if (walletUnavailable) {
      setToast({
        type: "error",
        title: "Wallet unavailable",
        message:
          "Your wallet balance could not be loaded. Please refresh the page before buying airtime.",
      });
      return;
    }
    if (!phoneIsValid) {
      setToast({
        type: "error",
        title: "Invalid phone number",
        message: "Please enter a valid Nigerian phone number.",
      });
      return;
    }
    if (!amountIsValid) {
      setToast({
        type: "error",
        title: "Invalid amount",
        message: `Enter a whole Naira amount up to ${formatNaira(MAX_AMOUNT)}.`,
      });
      return;
    }
    if (!sufficient) {
      setToast({
        type: "error",
        title: "Insufficient balance",
        message: `Your wallet balance (${formatNaira(
          walletBalance,
        )}) is below the amount to pay (${formatNaira(charge)}).`,
      });
      return;
    }

    setConfirmOpen(true);
  }

  async function handleConfirmPurchase() {
    // Synchronous in-flight latch: `purchasing` state is only committed on the
    // next render, so it cannot by itself stop a second invocation arriving in
    // the same tick. Reduces duplicate submissions only — not a substitute for
    // server-side idempotency.
    if (purchaseInFlightRef.current) return;
    if (!settingsReady || walletUnavailable) return;

    purchaseInFlightRef.current = true;
    setPurchasing(true);
    setToast(null);

    const normalizedPhone = normalizeNigerianPhone(phoneNumber);

    try {
      const { data, error } = await supabase.functions.invoke(
        "purchase-airtime",
        {
          body: {
            network,
            phoneNumber: normalizedPhone,
            amount: parsedAmount,
          },
        },
      );

      if (error) {
        throw new Error(await extractFunctionErrorMessage(error));
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      // Unknown provider outcome — wallet stays debited, transaction stays
      // pending. Never reported as a failure (see BuyData for the same rule).
      if (data?.pending) {
        setConfirmOpen(false);
        setPending({
          message:
            data.message ||
            "Your airtime purchase is being verified and will be confirmed shortly.",
          reference: data.reference,
        });
        refreshWallet();
        return;
      }
      if (data?.success === false) {
        throw new Error(data.error || "Airtime purchase failed. Please try again.");
      }
      // A 2xx with no recognisable outcome must never be shown as success and
      // must never silently close the confirmation. No auto-retry, no
      // auto-refund from the client.
      if (!data?.success) {
        throw new Error(
          "We could not confirm the result of this purchase. Please check your transactions before trying again — an unconfirmed purchase is refunded automatically, never charged twice.",
        );
      }

      const receipt = await buildReceipt(data, normalizedPhone);
      setConfirmOpen(false);
      setSuccessReceipt(receipt);
      refreshWallet();
      setPhoneNumber("");
      setPhoneTouched(false);
      setAmount("");
    } catch (err) {
      setConfirmOpen(false);
      // The wallet may already have been debited before the failure, so always
      // re-read it. Refresh only: no auto-retry, no auto-refund.
      refreshWallet();
      setToast({
        type: "error",
        title: "Purchase Failed",
        message:
          err.message ||
          "We could not complete the airtime purchase. Check your transactions — an unconfirmed purchase is refunded automatically.",
      });
    } finally {
      purchaseInFlightRef.current = false;
      setPurchasing(false);
    }
  }

  async function buildReceipt(data, normalizedPhone) {
    const reference = data?.reference || "N/A";
    const providerRef = data?.providerReference || "";
    let providerResponse = data?.message || "Airtime purchase successful";

    try {
      const { data: tx } = await supabase
        .from("transactions")
        .select("metadata")
        .eq("reference", reference)
        .maybeSingle();

      const providerResponseBody = tx?.metadata?.provider_response?.api_response;
      if (providerResponseBody) {
        providerResponse = providerResponseBody;
      }
    } catch {
      // receipt still works without the extra provider detail
    }

    return {
      status: "Successful",
      planLabel: "Airtime",
      network: networkLabel,
      plan: `${formatNaira(parsedAmount)} · ${networkLabel}`,
      phone: normalizedPhone,
      amount: formatNaira(charge ?? parsedAmount),
      reference,
      date: new Date().toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      providerRef: providerRef ? String(providerRef) : "N/A",
      providerResponse,
    };
  }

  return (
    <div className="space-y-6">
      <SEO title="Buy Airtime — Verronex VTU" robots="noindex, nofollow" canonical={null} />
      <header>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
          Buy Airtime
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Top up any Nigerian mobile number instantly.
        </p>
      </header>

      <Toast
        type={toast?.type}
        title={toast?.title}
        message={toast?.message}
        onDismiss={() => setToast(null)}
      />

      <GlassCard className="p-5 lg:p-6 space-y-1">
        {/* Pricing availability — the displayed charge depends on the
            per-network discount, so this must resolve before buying. */}
        {settingsState === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-red-700">
              We could not load airtime pricing.
            </p>
            <p className="text-xs text-red-600 mt-1">
              The exact amount to pay is unknown, so buying is paused. Your
              wallet is unaffected.
            </p>
            <button
              type="button"
              onClick={handleRetrySettings}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {walletUnavailable && settingsState !== "error" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-amber-800">
              Loading your wallet balance…
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Buying is paused until your balance is known, so you are never
              shown a false "insufficient funds" message.
            </p>
          </div>
        )}

        {/* Network selector */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Network
          </label>
          <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
            {NETWORKS.map((n) => {
              const active = network === n.value;
              return (
                <button
                  key={n.value}
                  type="button"
                  disabled={purchasing}
                  onClick={() => handleSelectNetwork(n.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1.5 py-3 transition-all disabled:opacity-60 ${
                    active
                      ? "border-fuchsia-500 bg-gradient-to-br from-indigo-50 to-fuchsia-50 shadow-[0_6px_20px_rgba(236,72,153,0.18)]"
                      : "border-slate-200 bg-white hover:border-fuchsia-300"
                  }`}
                >
                  <span
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-[11px] ${n.theme}`}
                  >
                    {n.short}
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-700">
                    {n.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phone number */}
        <div className="pt-5">
          <label
            htmlFor="airtimePhone"
            className="block text-sm font-semibold text-slate-700 mb-3"
          >
            Phone Number
          </label>
          <div className="relative">
            <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={phoneInputRef}
              id="airtimePhone"
              type="tel"
              inputMode="numeric"
              placeholder="080XXXXXXXX"
              value={phoneNumber}
              disabled={purchasing}
              onChange={handlePhoneChange}
              onBlur={handlePhoneBlur}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border-2 bg-white text-sm outline-none transition-colors disabled:opacity-60 ${
                phoneError
                  ? "border-red-300 focus:border-red-400"
                  : "border-slate-200 focus:border-fuchsia-400"
              }`}
            />
          </div>
          {phoneError ? (
            <p className="text-xs text-red-600 mt-1.5">{phoneError}</p>
          ) : (
            <p className="text-xs text-slate-400 mt-1.5">
              Airtime will be sent to this number.
            </p>
          )}
        </div>

        {/* Preset amounts */}
        <div className="pt-5">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Quick Amount
          </label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
            {PRESET_AMOUNTS.map((preset) => {
              const active = amount === String(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={purchasing}
                  onClick={() => handlePreset(preset)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-all disabled:opacity-60 ${
                    active
                      ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 border-transparent text-white shadow-[0_6px_18px_rgba(236,72,153,0.25)]"
                      : "bg-white border-slate-200 text-slate-600 hover:border-fuchsia-300"
                  }`}
                >
                  {formatNaira(preset)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom amount */}
        <div className="pt-5">
          <label
            htmlFor="airtimeAmount"
            className="block text-sm font-semibold text-slate-700 mb-3"
          >
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              ₦
            </span>
            <input
              id="airtimeAmount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              disabled={purchasing}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 bg-white text-sm outline-none border-slate-200 focus:border-fuchsia-400 transition-colors disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          {amount && !amountIsValid ? (
            <p className="text-xs text-red-600 mt-1.5">
              {parsedAmount > MAX_AMOUNT
                ? `Maximum amount is ${formatNaira(MAX_AMOUNT)}.`
                : "Enter an amount greater than 0."}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1.5">
              Enter any whole Naira amount up to {formatNaira(MAX_AMOUNT)}.
            </p>
          )}
        </div>

        {/* Price / wallet summary */}
        <div className="pt-5">
          <div className="rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-indigo-50/60 to-fuchsia-50/60 px-4 py-3">
            <SummaryRow label="Network" value={networkLabel} />
            <SummaryRow
              label="Phone"
              value={phoneNumber ? normalizeNigerianPhone(phoneNumber) : "—"}
            />
            <SummaryRow
              label="Airtime"
              value={parsedAmount > 0 ? formatNaira(parsedAmount) : "—"}
            />
            <SummaryRow
              label="Amount to pay"
              value={
                parsedAmount > 0
                  ? charge !== null
                    ? formatNaira(charge)
                    : "Unavailable"
                  : "—"
              }
              highlight
            />
            <SummaryRow
              label="Wallet balance"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" />
                  {walletBalance !== null
                    ? formatNaira(walletBalance)
                    : "Loading…"}
                </span>
              }
            />
          </div>
          {settingsState === "error" && parsedAmount > 0 && (
            <p className="text-xs text-red-600 mt-2">
              The amount to pay could not be determined. Please retry loading
              pricing before buying.
            </p>
          )}
          {walletUnavailable && parsedAmount > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              Your wallet balance is still loading. Buying will unlock once it
              is available.
            </p>
          )}
          {parsedAmount > 0 && !sufficient && settingsReady && !walletUnavailable && (
            <p className="text-xs text-red-600 mt-2">
              Your wallet balance is lower than the amount to pay. Please top up
              your wallet first.
            </p>
          )}
        </div>

        {/* Buy button */}
        <div className="pt-5">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleOpenConfirm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold py-3 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            {purchasing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                Buy Airtime
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </GlassCard>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Airtime Purchase"
        message={[
          `Network: ${networkLabel}`,
          `Phone: ${normalizeNigerianPhone(phoneNumber)}`,
          `Airtime: ${formatNaira(parsedAmount)}`,
          `Amount to pay: ${charge !== null ? formatNaira(charge) : "Unavailable"}`,
          "",
          "This amount will be deducted from your wallet.",
        ].join("\n")}
        confirmText="Confirm & Pay"
        cancelText="Cancel"
        loading={purchasing}
        onConfirm={handleConfirmPurchase}
        onCancel={() => !purchasing && setConfirmOpen(false)}
      />

      <PendingModal pending={pending} onClose={() => setPending(null)} />

      <PurchaseSuccessModal
        receipt={successReceipt}
        onClose={() => setSuccessReceipt(null)}
      />
    </div>
  );
}