import { useEffect, useRef, useState } from "react";
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

function normalizeNigerianPhone(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.startsWith("234") ? "0" + digits.slice(3) : digits;
}

function isValidNigerianPhone(raw) {
  return /^0[7-9]\d{9}$/.test(normalizeNigerianPhone(raw));
}

async function extractFunctionErrorMessage(error) {
  // supabase-js v2: FunctionsHttpError carries the real message in
  // error.context (a Response) when the edge function returns non-2xx.
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch (_jsonErr) {
      // context wasn't JSON (or already consumed) — fall through
    }
  }
  return error?.message || "Something went wrong. Please try again.";
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
          <h2 className="font-bold text-xl">Purchase Being Verified</h2>
          <p className="text-slate-600 text-sm mt-1.5">
            Your request was sent but the final provider result is still being
            confirmed. Please check your transaction history before trying
            again.
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
  const [discounts, setDiscounts] = useState({});

  const [network, setNetwork] = useState("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneInputRef = useRef(null);
  const [amount, setAmount] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const [toast, setToast] = useState(null);
  const [pending, setPending] = useState(null);
  const [successReceipt, setSuccessReceipt] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadAirtimeSettings() {
      const { data, error } = await supabase
        .from("airtime_settings")
        .select("network, user_discount")
        .eq("is_active", true);

      if (ignore || error) return;

      const map = {};
      for (const row of data || []) {
        map[row.network] = Number(row.user_discount) || 0;
      }
      setDiscounts(map);
    }

    loadAirtimeSettings();
    return () => {
      ignore = true;
    };
  }, []);

  const walletBalance = Number(wallet?.balance) || 0;
  const parsedAmount = parseInt(amount, 10) || 0;
  const amountIsValid =
    amount !== "" && parsedAmount > 0 && parsedAmount <= MAX_AMOUNT;

  const phoneIsValid = isValidNigerianPhone(phoneNumber);
  const phoneError =
    phoneTouched && phoneNumber && !phoneIsValid
      ? "Enter a valid Nigerian phone number (e.g. 080XXXXXXXX)."
      : "";

  const userDiscount = discounts[network] || 0;
  const charge =
    parsedAmount > 0
      ? Math.round(parsedAmount * (1 - userDiscount / 100) * 100) / 100
      : 0;
  const sufficient = charge <= walletBalance;

  const networkLabel =
    NETWORKS.find((n) => n.value === network)?.label || network;

  const canSubmit = phoneIsValid && amountIsValid && sufficient && !purchasing;

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

  // Normalize on change so the input never retains an unnormalized value
  // (e.g. "+234 703 740 8580" -> "07037408580"), while preserving the caret
  // so normal digit typing is unaffected.
  function handlePhoneChange(e) {
    const input = e.target;
    const raw = input.value;
    const normalized = normalizeNigerianPhone(raw);
    const caret = input.selectionStart ?? raw.length;

    setPhoneNumber(normalized);

    if (normalized === raw) return;

    requestAnimationFrame(() => {
      const el = phoneInputRef.current;
      if (!el) return;
      const removedBeforeCaret = (raw.slice(0, caret).match(/\D/g) || []).length;
      const pos = Math.max(0, caret - removedBeforeCaret);
      el.setSelectionRange(pos, pos);
    });
  }

  function handleOpenConfirm() {
    setPhoneTouched(true);
    setToast(null);

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
    if (purchasing) return;

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
      if (data?.success === false && !data?.pending) {
        throw new Error(data.error || "Airtime purchase failed. Please try again.");
      }

      setConfirmOpen(false);

      if (data?.pending) {
        setPending({
          message:
            data.message ||
            "Your airtime purchase is being verified and will be confirmed shortly.",
          reference: data.reference,
        });
        refreshWallet();
        return;
      }

      if (data?.success) {
        const receipt = await buildReceipt(data, normalizedPhone);
        setSuccessReceipt(receipt);
        refreshWallet();
        setPhoneNumber("");
        setPhoneTouched(false);
        setAmount("");
      }
    } catch (err) {
      setConfirmOpen(false);
      setToast({
        type: "error",
        title: "Purchase Failed",
        message:
          err.message ||
          "We could not complete the airtime purchase. Your wallet was not charged.",
      });
    } finally {
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
    } catch (_err) {
      // receipt still works without the extra provider detail
    }

    return {
      status: "Successful",
      planLabel: "Airtime",
      network: networkLabel,
      plan: `${formatNaira(parsedAmount)} · ${networkLabel}`,
      phone: normalizedPhone,
      amount: formatNaira(charge),
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
              onBlur={() => setPhoneTouched(true)}
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
              value={parsedAmount > 0 ? formatNaira(charge) : "—"}
              highlight
            />
            <SummaryRow
              label="Wallet balance"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" />
                  {formatNaira(walletBalance)}
                </span>
              }
            />
          </div>
          {parsedAmount > 0 && !sufficient && (
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
          `Amount to pay: ${formatNaira(charge)}`,
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