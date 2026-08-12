import { useEffect, useMemo, useState } from "react";
import {
  Wifi,
  Smartphone,
  Loader2,
  ChevronRight,
  Sun,
  Calendar,
  CalendarDays,
  CalendarRange,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabaseClient";
import GlassCard from "../../components/ui/GlassCard";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Toast from "../../components/ui/Toast";
import PurchaseSuccessModal from "../../components/ui/PurchaseSuccessModal";

const NETWORK_THEME = {
  mtn: { badge: "bg-yellow-400 text-slate-900", initials: "MTN" },
  glo: { badge: "bg-green-500 text-white", initials: "GLO" },
  airtel: { badge: "bg-red-500 text-white", initials: "AIR" },
  "9mobile": { badge: "bg-emerald-600 text-white", initials: "9M" },
  etisalat: { badge: "bg-emerald-600 text-white", initials: "ETI" },
};

const DEFAULT_THEME = { badge: "bg-fuchsia-500 text-white", initials: null };

function getNetworkTheme(network) {
  const key = Object.keys(NETWORK_THEME).find((k) =>
    network?.toLowerCase().includes(k),
  );
  return key ? NETWORK_THEME[key] : DEFAULT_THEME;
}

function getNetworkInitials(network) {
  const theme = getNetworkTheme(network);
  if (theme.initials) return theme.initials;
  return (network || "").slice(0, 3).toUpperCase();
}

const EXCLUDED_PLAN_TYPES = ["talkmore"];

const CATEGORY_META = {
  daily: { label: "Daily", icon: Sun },
  weekly: { label: "Weekly", icon: CalendarDays },
  monthly: { label: "Monthly", icon: Calendar },
  yearly: { label: "Yearly", icon: CalendarRange },
  other: { label: "Other", icon: Sparkles },
};

const CATEGORY_ORDER = ["daily", "weekly", "monthly", "yearly", "other"];

function parseValidityDays(validity) {
  if (!validity) return null;
  const match = validity.match(/(\d+)\s*-?\s*days?\b/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseValidityKeyword(validity) {
  if (!validity) return null;
  const lower = validity.toLowerCase();
  if (lower.includes("daily")) return "daily";
  if (lower.includes("weekly")) return "weekly";
  if (lower.includes("monthly")) return "monthly";
  if (lower.includes("yearly") || lower.includes("annual")) return "yearly";
  return null;
}

function getValidityCategory(validity) {
  const days = parseValidityDays(validity);
  if (days !== null) {
    if (days <= 3) return "daily";
    if (days <= 13) return "weekly";
    if (days <= 45) return "monthly";
    return "yearly";
  }
  return parseValidityKeyword(validity) || "other";
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

function extractProviderReference(provider) {
  if (!provider || typeof provider !== "object") return null;
  const preferred = [
    "reference",
    "ref",
    "ident",
    "transaction_id",
    "transactionId",
    "transaction_ref",
    "order_id",
    "id",
  ];
  for (const key of preferred) {
    const value = provider[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  for (const [key, value] of Object.entries(provider)) {
    if (/ref|ident|transaction/i.test(key) && value) return String(value);
  }
  return null;
}

export default function BuyData() {
  const { refreshWallet } = useAuth();

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [viewAll, setViewAll] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const [toast, setToast] = useState(null);
  const [successReceipt, setSuccessReceipt] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadPlans() {
      setPlansLoading(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("data_plans")
        .select(
          `
          id,
          network,
          plan_name,
          selling_price,
          validity,
          plan_type
        `,
        )
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

  // Exclude non-data plan types (e.g. TALKMORE minute bundles) and drop
  // exact duplicates (same network + plan_name + selling_price).
  const dataPlans = useMemo(() => {
    const filtered = plans.filter(
      (plan) =>
        !EXCLUDED_PLAN_TYPES.includes(
          (plan.plan_type || "").trim().toLowerCase(),
        ),
    );

    const seen = new Set();
    const deduped = [];
    for (const plan of filtered) {
      const key = `${plan.network}|${plan.plan_name}|${plan.selling_price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(plan);
    }
    return deduped;
  }, [plans]);

  const networks = useMemo(() => {
    const seen = [];
    for (const plan of dataPlans) {
      if (plan.network && !seen.includes(plan.network)) seen.push(plan.network);
    }
    return seen;
  }, [dataPlans]);

  const plansForNetwork = useMemo(
    () => dataPlans.filter((plan) => plan.network === selectedNetwork),
    [dataPlans, selectedNetwork],
  );

  const categorizedPlans = useMemo(() => {
    const map = {};
    for (const plan of plansForNetwork) {
      const cat = getValidityCategory(plan.validity);
      if (!map[cat]) map[cat] = [];
      map[cat].push(plan);
    }
    return map;
  }, [plansForNetwork]);

  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter((cat) => categorizedPlans[cat]?.length > 0),
    [categorizedPlans],
  );

  const visiblePlans = useMemo(() => {
    if (viewAll) return plansForNetwork;
    if (!selectedCategory) return [];
    return categorizedPlans[selectedCategory] || [];
  }, [viewAll, selectedCategory, categorizedPlans, plansForNetwork]);

  const selectedPlan = useMemo(
    () => dataPlans.find((plan) => plan.id === selectedPlanId) || null,
    [dataPlans, selectedPlanId],
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

  function clearMessages() {
    setToast(null);
  }

  function handleSelectNetwork(network) {
    setSelectedNetwork((prev) => (prev === network ? null : network));
    setSelectedCategory(null);
    setViewAll(false);
    setSelectedPlanId(null);
    clearMessages();
  }

  function handleSelectCategory(cat) {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
    setViewAll(false);
    setSelectedPlanId(null);
    clearMessages();
  }

  function handleToggleViewAll() {
    setViewAll((prev) => !prev);
    setSelectedCategory(null);
    setSelectedPlanId(null);
    clearMessages();
  }

  function handleSelectPlan(planId) {
    setSelectedPlanId(planId);
    clearMessages();
  }

  function handleOpenConfirm() {
    setPhoneTouched(true);
    clearMessages();

    if (!selectedNetwork || !selectedPlan) {
      setToast({
        type: "error",
        title: "Cannot proceed",
        message: "Please select a network and a plan.",
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
    setConfirmOpen(true);
  }

  async function handleConfirmPurchase() {
    if (!selectedPlan) return;

    setPurchasing(true);
    setToast(null);

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

      if (data?.success === false) {
        throw new Error(data.error || "Purchase failed. Please try again.");
      }

      const providerMessage = data?.provider?.api_response;
      setSuccessReceipt({
        status: "Successful",
        network: selectedNetwork,
        plan: selectedPlan.plan_name,
        phone: normalizedPhone,
        amount: formatNaira(selectedPlan.selling_price),
        reference: data?.reference || "N/A",
        date: new Date().toLocaleString("en-NG", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        providerRef: extractProviderReference(data?.provider),
        providerResponse: providerMessage,
        summary:
          providerMessage ||
          `${selectedPlan.plan_name} sent to ${normalizedPhone} successfully.`,
      });
      setConfirmOpen(false);
      setSelectedPlanId(null);
      setPhoneNumber("");
      setPhoneTouched(false);
      refreshWallet();
    } catch (err) {
      setConfirmOpen(false);
      setToast({
        type: "error",
        title: "Purchase Failed",
        message: err.message || "Purchase failed. Please try again.",
      });
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

      <Toast
        type={toast?.type}
        title={toast?.title}
        message={toast?.message}
        onDismiss={() => setToast(null)}
      />

      <GlassCard className="p-5 lg:p-6 space-y-1">
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
                  className="h-[76px] w-[76px] rounded-2xl bg-slate-200 animate-pulse"
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
            <div className="flex flex-wrap gap-2.5">
              {networks.map((network) => {
                const active = selectedNetwork === network;
                return (
                  <button
                    key={network}
                    type="button"
                    onClick={() => handleSelectNetwork(network)}
                    className={`flex flex-col items-center gap-1.5 min-w-[76px] rounded-2xl border-2 px-4 py-3 transition-all ${
                      active
                        ? "border-fuchsia-500 bg-gradient-to-br from-indigo-50 to-fuchsia-50 shadow-[0_6px_20px_rgba(236,72,153,0.18)]"
                        : "border-slate-200 bg-white hover:border-fuchsia-300"
                    }`}
                  >
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[11px] ${
                        getNetworkTheme(network).badge
                      }`}
                    >
                      {getNetworkInitials(network)}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {network}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Phone number */}
        <div className="pt-5">
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
          {phoneError ? (
            <p className="text-xs text-red-600 mt-1.5">{phoneError}</p>
          ) : (
            <p className="text-xs text-slate-400 mt-1.5">
              Data will be sent to this number.
            </p>
          )}
        </div>

        {/* Category unfold */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            selectedNetwork ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            {selectedNetwork && (
              <div className="pt-5">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Plan Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const Icon = meta.icon;
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleSelectCategory(cat)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                          active
                            ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 border-transparent text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-fuchsia-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleToggleViewAll}
                  className={`mt-2.5 flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    viewAll
                      ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 border-transparent text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-fuchsia-300"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  View all plans
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Plan grid unfold */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            selectedCategory || viewAll ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            {(selectedCategory || viewAll) && (
              <div className="pt-5">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Plan
                </label>
                {visiblePlans.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No plans found in this category.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {visiblePlans.map((plan) => {
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
          </div>
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
                <Wifi className="w-4 h-4" />
                Buy Data
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </GlassCard>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Data Purchase"
        message={
          selectedPlan
            ? `Network: ${selectedNetwork}\nPlan: ${
                selectedPlan.plan_name
              }\nPrice: ${formatNaira(
                selectedPlan.selling_price,
              )}\nPhone: ${normalizeNigerianPhone(
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

      <PurchaseSuccessModal
        receipt={successReceipt}
        onClose={() => setSuccessReceipt(null)}
      />
    </div>
  );
}
