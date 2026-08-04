import { useEffect, useMemo, useState } from "react";
import {
  Wifi,
  Smartphone,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabaseClient";
import GlassCard from "../../components/ui/GlassCard";
import ConfirmModal from "../../components/ui/ConfirmModal";

const NETWORK_THEME = {
  mtn: {
    chipActive: "bg-yellow-400 border-yellow-400 text-slate-900",
    chipInactive: "border-yellow-300 text-yellow-700 hover:bg-yellow-50",
    dot: "bg-yellow-400",
  },
  glo: {
    chipActive: "bg-green-500 border-green-500 text-white",
    chipInactive: "border-green-300 text-green-700 hover:bg-green-50",
    dot: "bg-green-500",
  },
  airtel: {
    chipActive: "bg-red-500 border-red-500 text-white",
    chipInactive: "border-red-300 text-red-700 hover:bg-red-50",
    dot: "bg-red-500",
  },
  "9mobile": {
    chipActive: "bg-emerald-600 border-emerald-600 text-white",
    chipInactive: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
    dot: "bg-emerald-600",
  },
  etisalat: {
    chipActive: "bg-emerald-600 border-emerald-600 text-white",
    chipInactive: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
    dot: "bg-emerald-600",
  },
};

const DEFAULT_THEME = {
  chipActive: "bg-fuchsia-600 border-fuchsia-600 text-white",
  chipInactive: "border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50",
  dot: "bg-fuchsia-500",
};

function getNetworkTheme(network) {
  const key = Object.keys(NETWORK_THEME).find((k) =>
    network?.toLowerCase().includes(k),
  );
  return key ? NETWORK_THEME[key] : DEFAULT_THEME;
}

function isValidNigerianPhone(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  const normalized = digits.startsWith("234") ? "0" + digits.slice(3) : digits;
  return /^0[7-9]\d{9}$/.test(normalized);
}

function normalizeNigerianPhone(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.startsWith("234") ? "0" + digits.slice(3) : digits;
}

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
    } catch (_jsonErr) {
      // context wasn't JSON (or already consumed) — fall through
    }
  }
  return error?.message || "Something went wrong. Please try again.";
}

function Banner({ type, message, onDismiss }) {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        isError
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-700"
      }`}
    >
      {isError ? (
        <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
      )}
      <p className="text-sm flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-medium opacity-70 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}

export default function BuyData() {
  const { refreshWallet } = useAuth();

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const [bannerError, setBannerError] = useState("");
  const [bannerSuccess, setBannerSuccess] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadPlans() {
      setPlansLoading(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("data_plans")
        .select("*")
        .eq("is_active", true)
        .order("network", { ascending: true })
        .order("selling_price", { ascending: true });

      if (ignore) return;

      if (error) {
        setLoadError("Couldn't load data plans. Please refresh and try again.");
        setPlans([]);
      } else {
        setPlans(data || []);
      }
      setPlansLoading(false);
    }

    loadPlans();
    return () => {
      ignore = true;
    };
  }, []);

  const networks = useMemo(() => {
    const seen = [];
    for (const plan of plans) {
      if (plan.network && !seen.includes(plan.network)) seen.push(plan.network);
    }
    return seen;
  }, [plans]);

  const plansForNetwork = useMemo(
    () => plans.filter((plan) => plan.network === selectedNetwork),
    [plans, selectedNetwork],
  );

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId],
  );

  const phoneIsValid = isValidNigerianPhone(phoneNumber);
  const phoneError =
    phoneTouched && phoneNumber && !phoneIsValid
      ? "Enter a valid Nigerian phone number (e.g. 080XXXXXXXX)."
      : "";

  const canSubmit =
    Boolean(selectedNetwork) &&
    Boolean(selectedPlan) &&
    phoneIsValid &&
    !purchasing;

  function handleSelectNetwork(network) {
    setSelectedNetwork(network);
    setSelectedPlanId(null);
    setBannerError("");
    setBannerSuccess("");
  }

  function handleSelectPlan(planId) {
    setSelectedPlanId(planId);
    setBannerError("");
    setBannerSuccess("");
  }

  function handleOpenConfirm() {
    setPhoneTouched(true);
    setBannerError("");
    setBannerSuccess("");

    if (!selectedNetwork || !selectedPlan) {
      setBannerError("Please select a network and a plan.");
      return;
    }
    if (!phoneIsValid) {
      setBannerError("Please enter a valid Nigerian phone number.");
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirmPurchase() {
    if (!selectedPlan) return;

    setPurchasing(true);
    setBannerError("");

    const normalizedPhone = normalizeNigerianPhone(phoneNumber);

    try {
      const { data, error } = await supabase.functions.invoke("purchase-data", {
        body: {
          planId: selectedPlan.id,
          phoneNumber: normalizedPhone,
        },
      });

      if (error) {
        const message = await extractFunctionErrorMessage(error);
        throw new Error(message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setBannerSuccess(
        data?.message ||
          `${selectedPlan.plan_name} sent to ${normalizedPhone} successfully.`,
      );
      setConfirmOpen(false);
      setSelectedPlanId(null);
      setPhoneNumber("");
      setPhoneTouched(false);
      refreshWallet();
    } catch (err) {
      setConfirmOpen(false);
      setBannerError(err.message || "Purchase failed. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
          Buy Data
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Instant data delivery, straight to any Nigerian number.
        </p>
      </header>

      <Banner
        type="error"
        message={bannerError}
        onDismiss={() => setBannerError("")}
      />
      <Banner
        type="success"
        message={bannerSuccess}
        onDismiss={() => setBannerSuccess("")}
      />

      <GlassCard className="p-5 lg:p-6 space-y-6">
        {/* Network */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Network
          </label>

          {plansLoading ? (
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 w-20 rounded-xl bg-slate-200 animate-pulse"
                />
              ))}
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : networks.length === 0 ? (
            <p className="text-sm text-slate-500">
              No data plans are available right now.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {networks.map((network) => {
                const theme = getNetworkTheme(network);
                const active = selectedNetwork === network;
                return (
                  <button
                    key={network}
                    type="button"
                    onClick={() => handleSelectNetwork(network)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                      active
                        ? theme.chipActive
                        : `bg-white ${theme.chipInactive}`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                    {network}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Plans */}
        {selectedNetwork && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Plan
            </label>

            {plansForNetwork.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active plans found for {selectedNetwork}.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {plansForNetwork.map((plan) => {
                  const active = selectedPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`text-left rounded-2xl border-2 p-3.5 transition-all ${
                        active
                          ? "border-fuchsia-500 bg-gradient-to-br from-indigo-50 to-fuchsia-50 shadow-[0_6px_20px_rgba(236,72,153,0.18)]"
                          : "border-slate-200 bg-white hover:border-fuchsia-300"
                      }`}
                    >
                      <p className="font-semibold text-slate-800 text-sm">
                        {plan.plan_name}
                        {plan.plan_type ? ` (${plan.plan_type})` : ""}
                      </p>
                      <p className="text-fuchsia-600 font-bold mt-1">
                        {formatNaira(plan.selling_price)}
                      </p>
                      {plan.validity && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {plan.validity}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Phone number */}
        <div>
          <label
            htmlFor="phoneNumber"
            className="block text-sm font-semibold text-slate-700 mb-3"
          >
            Phone Number
          </label>
          <div className="relative">
            <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="phoneNumber"
              type="tel"
              inputMode="numeric"
              placeholder="080XXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onBlur={() => setPhoneTouched(true)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border-2 bg-white text-sm outline-none transition-colors ${
                phoneError
                  ? "border-red-300 focus:border-red-400"
                  : "border-slate-200 focus:border-fuchsia-400"
              }`}
            />
          </div>
          {phoneError && (
            <p className="text-xs text-red-600 mt-1.5">{phoneError}</p>
          )}
        </div>

        {/* Buy button */}
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
              <Wifi className="w-4 h-4" />
              Buy Data
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </GlassCard>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Data Purchase"
        message={
          selectedPlan
            ? `Network: ${selectedNetwork}\nPlan: ${selectedPlan.plan_name}${
                selectedPlan.plan_type ? ` (${selectedPlan.plan_type})` : ""
              }\nPrice: ${formatNaira(selectedPlan.selling_price)}\nPhone: ${normalizeNigerianPhone(
                phoneNumber,
              )}\n\nThis amount will be deducted from your wallet.`
            : ""
        }
        confirmText="Confirm & Pay"
        cancelText="Cancel"
        loading={purchasing}
        onConfirm={handleConfirmPurchase}
        onCancel={() => !purchasing && setConfirmOpen(false)}
      />
    </div>
  );
}
