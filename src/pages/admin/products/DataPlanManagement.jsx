import { useState, useEffect } from "react";
import {
  Wifi,
  Plus,
  Edit2,
  Power,
  PowerOff,
  Loader2,
  ChevronDown,
  ChevronRight,
  Percent,
  Search,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import Toast from "../../../components/ui/Toast";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import supabase from "../../../lib/supabaseClient";

// Shared editable price cell — used for both the cost and sell fields in
// each plan card so the edit/save/cancel logic only lives in one place.
function EditablePrice({
  plan,
  field,
  priceEditing,
  priceDraft,
  setPriceDraft,
  savePrice,
  handlePriceKeyDown,
  startEditPrice,
  formatMoney,
  valueClassName,
  inputClassName,
}) {
  const isEditingThis =
    priceEditing?.plan.id === plan.id && priceEditing?.field === field;

  if (isEditingThis) {
    return (
      <input
        autoFocus
        type="number"
        min="0"
        step="any"
        value={priceDraft}
        onChange={(e) => setPriceDraft(e.target.value)}
        onBlur={savePrice}
        onKeyDown={handlePriceKeyDown}
        className={inputClassName}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => startEditPrice(plan, field)}
      className={valueClassName}
      title={`Click to edit ${field === "cost_price" ? "cost" : "selling price"}`}
    >
      {formatMoney(plan[field])}
    </button>
  );
}

// Group plans by network in this fixed display order (recreating this array
// on every render was wasteful — it never changes, so it lives at module scope).
const NETWORK_ORDER = ["MTN", "Airtel", "Glo", "9Mobile", "Others"];

// Maps a provider's DB slug to a friendly label for display.
const PROVIDER_LABELS = { gladtidings: "GladTidings" };

// Providers the admin can pick when adding/editing plans. Add a new entry
// here (and a label in PROVIDER_LABELS) the day another VTU API is onboarded.
const PROVIDERS = [{ value: "gladtidings", label: "GladTidings" }];

// Gladtidings' numeric network ids, keyed by the display names used in the
// form. Used to keep network_id populated on every plan so purchases work.
const NETWORK_IDS = { MTN: 1, Glo: 2, Airtel: 3, "9Mobile": 6 };

// Matches DEFAULT_MARKUP in scripts/import-gladtidings-plans.cjs. Used when
// auto-adding brand-new plans pulled in by the Gladtidings price sync.
const DEFAULT_SELL_MARKUP = 20;

const getProfit = (plan) =>
  Number(plan.selling_price) - Number(plan.cost_price);

async function extractFunctionErrorMessage(error) {
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // context wasn't JSON — fall through
    }
  }
  return error?.message || "Something went wrong. Please try again.";
}

export default function DataPlanManagement() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [priceEditing, setPriceEditing] = useState(null); // {plan, field}
  const [priceDraft, setPriceDraft] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);
  const [marginPercent, setMarginPercent] = useState("");
  const [applyingMargin, setApplyingMargin] = useState(false);
  const [confirmMarginOpen, setConfirmMarginOpen] = useState(false);

  const [query, setQuery] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [applyingSync, setApplyingSync] = useState(false);
  // Track which updates are selected for apply (all checked by default)
  const [selectedUpdates, setSelectedUpdates] = useState(new Set());

  const [toast, setToast] = useState(null);

  // Form State
  const [currentPlan, setCurrentPlan] = useState(null);
  const [formData, setFormData] = useState({
    network: "MTN",
    plan_name: "",
    provider: "gladtidings",
    api_plan_id: "",
    cost_price: 0,
    selling_price: 0,
    validity: "",
    is_active: true,
  });

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("data_plans")
      .select("*")
      .order("network", { ascending: true })
      .order("cost_price", { ascending: true });

    if (error) {
      console.error("Error fetching data plans:", error);
    } else {
      setPlans(data || []);
    }
    setLoading(false);
  };

  const patchPlan = (id, patch) =>
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );

  const removePlan = (id) =>
    setPlans((prev) => prev.filter((p) => p.id !== id));

  // Group plans by network, preserving deterministic network order
  const q = query.trim().toLowerCase();
  const filteredPlans = q
    ? plans.filter((p) =>
        [
          p.plan_name,
          p.network,
          p.provider,
          p.api_plan_id,
          p.plan_type,
          p.validity,
          p.network_id,
        ].some(
          (field) => field != null && String(field).toLowerCase().includes(q),
        ),
      )
    : plans;

  const grouped = filteredPlans.reduce((acc, plan) => {
    const key = plan.network || "Others";
    (acc[key] = acc[key] || []).push(plan);
    return acc;
  }, {});

  const groups = Object.keys(grouped)
    .sort(
      (a, b) =>
        NETWORK_ORDER.indexOf(a) - NETWORK_ORDER.indexOf(b) ||
        a.localeCompare(b),
    )
    .map((network) => ({
      network,
      plans: grouped[network],
    }));

  const toggleGroup = (network) =>
    setCollapsed((prev) => ({
      ...prev,
      [network]: !(prev[network] ?? true),
    }));

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleOpenModal = (plan = null) => {
    if (plan) {
      setCurrentPlan(plan);
      setFormData({
        network: plan.network,
        plan_name: plan.plan_name,
        provider: plan.provider,
        api_plan_id: plan.api_plan_id,
        cost_price: plan.cost_price,
        selling_price: plan.selling_price,
        validity: plan.validity ?? "",
        is_active: plan.is_active,
      });
    } else {
      setCurrentPlan(null);
      setFormData({
        network: "MTN",
        plan_name: "",
        provider: "gladtidings",
        api_plan_id: "",
        cost_price: 0,
        selling_price: 0,
        validity: "",
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const cost = parseFloat(formData.cost_price) || 0;
    const selling = parseFloat(formData.selling_price) || 0;

    if (selling < cost) {
      setToast({
        type: "error",
        title: "Invalid pricing",
        message: "Selling price can't be less than cost price.",
      });
      return;
    }

    const networkId =
      NETWORK_IDS[formData.network] ?? (currentPlan?.network_id ?? null);

    setSaving(true);

    const payload = {
      ...formData,
      cost_price: cost,
      selling_price: selling,
      validity: formData.validity || null,
      network_id: networkId,
    };

    if (currentPlan) {
      const { error } = await supabase
        .from("data_plans")
        .update(payload)
        .eq("id", currentPlan.id);

      if (error) {
        setToast({ type: "error", title: "Update failed", message: error.message });
      } else {
        setToast({
          type: "success",
          title: "Plan updated",
          message: `"${payload.plan_name}" was saved.`,
        });
      }
    } else {
      const { error } = await supabase.from("data_plans").insert([payload]);

      if (error) {
        setToast({ type: "error", title: "Create failed", message: error.message });
      } else {
        setToast({
          type: "success",
          title: "Plan created",
          message: `"${payload.plan_name}" was added.`,
        });
      }
    }

    setSaving(false);
    setIsModalOpen(false);
    fetchPlans(); // Refresh the list
  };

  const handleToggleActive = async (plan) => {
    const next = !plan.is_active;
    patchPlan(plan.id, { is_active: next });

    const { error } = await supabase
      .from("data_plans")
      .update({ is_active: next })
      .eq("id", plan.id);

    if (error) {
      patchPlan(plan.id, { is_active: plan.is_active });
      setToast({
        type: "error",
        title: "Couldn't update status",
        message: error.message,
      });
    }
  };

  const startEditPrice = (plan, field) => {
    setPriceEditing({ plan, field });
    setPriceDraft(String(plan[field] ?? ""));
  };

  const cancelEditPrice = () => {
    setPriceEditing(null);
    setPriceDraft("");
  };

  const savePrice = async () => {
    if (!priceEditing) return;

    const { plan, field } = priceEditing;
    const value = parseFloat(priceDraft);

    if (isNaN(value) || value < 0) {
      cancelEditPrice();
      return;
    }

    const newCost = field === "cost_price" ? value : Number(plan.cost_price);
    const newSell =
      field === "selling_price" ? value : Number(plan.selling_price);

    if (newSell < newCost) {
      setToast({
        type: "error",
        title: "Invalid pricing",
        message: "Selling price can't be less than cost price.",
      });
      cancelEditPrice();
      return;
    }

    setPriceSaving(true);

    const { error } = await supabase
      .from("data_plans")
      .update({ [field]: value })
      .eq("id", plan.id);

    setPriceSaving(false);

    if (error) {
      setToast({ type: "error", title: "Price not saved", message: error.message });
    } else {
      patchPlan(plan.id, { [field]: value });
    }

    cancelEditPrice();
  };

  const handlePriceKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      savePrice();
    } else if (e.key === "Escape") {
      cancelEditPrice();
    }
  };

  // Opens the confirm dialog. The actual bulk update runs in a single DB
  // function (apply_margin_to_all) instead of one UPDATE per plan.
  const handleApplyMarginToAll = () => {
    const pct = parseFloat(marginPercent);
    if (isNaN(pct) || plans.length === 0 || applyingMargin) return;
    setConfirmMarginOpen(true);
  };

  const confirmApplyMargin = async () => {
    const pct = parseFloat(marginPercent);
    if (isNaN(pct)) return;

    setApplyingMargin(true);
    const { data, error } = await supabase.rpc("apply_margin_to_all", { pct });
    setApplyingMargin(false);
    setConfirmMarginOpen(false);

    if (error) {
      setToast({ type: "error", title: "Margin not applied", message: error.message });
      return;
    }

    setToast({
      type: "success",
      title: "Margin applied",
      message: `${data ?? 0} plan(s) set to cost + ${pct}%.`,
    });
    fetchPlans();
  };

  const handleMarginKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyMarginToAll();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    const { error } = await supabase
      .from("data_plans")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      setToast({ type: "error", title: "Delete failed", message: error.message });
    } else {
      removePlan(deleteTarget.id);
      setToast({
        type: "success",
        title: "Plan deleted",
        message: `"${deleteTarget.plan_name}" was removed.`,
      });
    }
    setDeleteTarget(null);
  };

  // Pulls the latest Gladtidings catalog (via the gladtidings-plans edge
  // function) and diffs it against the local plans so cost increases are
  // never missed. Returns grouped changes for the review modal.
  const handleSync = async () => {
    setSyncing(true);
    setToast(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "gladtidings-plans",
      );

      if (error) {
        throw new Error(await extractFunctionErrorMessage(error));
      }
      if (data?.error) throw new Error(data.error);

      const providerPlans = data.plans || [];

      const dbMap = new Map(
        plans
          .filter((p) => p.provider === "gladtidings")
          .map((p) => [p.api_plan_id, p]),
      );
      const providerMap = new Map(
        providerPlans.map((p) => [p.api_plan_id, p]),
      );

      const priceChanges = [];
      const newPlans = [];

      for (const pp of providerPlans) {
        const existing = dbMap.get(pp.api_plan_id);
        if (!existing) {
          newPlans.push(pp);
          continue;
        }

        const oldCost = Number(existing.cost_price);
        const newCost = Number(pp.cost_price);
        const nameChanged = existing.plan_name !== pp.plan_name;
        const validityChanged = (existing.validity || "") !== pp.validity;

        if (oldCost !== newCost || nameChanged || validityChanged) {
          priceChanges.push({
            existing,
            provider: pp,
            oldCost,
            newCost,
            sellingPrice: Number(existing.selling_price),
            atLoss: newCost > Number(existing.selling_price),
          });
        }
      }

      const removed = plans.filter(
        (p) => p.provider === "gladtidings" && !providerMap.has(p.api_plan_id),
      );

      const hasChanges =
        priceChanges.length > 0 || newPlans.length > 0 || removed.length > 0;

      if (!hasChanges) {
        setToast({
          type: "success",
          title: "All caught up",
          message: "Gladtidings prices match your current plans.",
        });
        return;
      }

      setSyncResult({ priceChanges, newPlans, removed });
      // Initialize all updates as selected (checked by default)
      const initialSelection = new Set([
        ...priceChanges.map(({ existing }) => `price:${existing.id}`),
        ...newPlans.map((pp) => `new:${pp.api_plan_id}`),
        ...removed.map((plan) => `removed:${plan.id}`),
      ]);
      setSelectedUpdates(initialSelection);
      setSyncOpen(true);
    } catch (err) {
      setToast({
        type: "error",
        title: "Price check failed",
        message: err.message,
      });
    } finally {
      setSyncing(false);
    }
  };

  // Selection handlers for sync review modal
  const handleSelectUpdate = (key, checked) => {
    setSelectedUpdates((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleCheckAll = () => {
    if (!syncResult) return;
    const allKeys = new Set([
      ...syncResult.priceChanges.map(({ existing }) => `price:${existing.id}`),
      ...syncResult.newPlans.map((pp) => `new:${pp.api_plan_id}`),
      ...syncResult.removed.map((plan) => `removed:${plan.id}`),
    ]);
    setSelectedUpdates(allKeys);
  };

  const handleUncheckAll = () => {
    setSelectedUpdates(new Set());
  };

const confirmApplySync = async () => {
    if (!syncResult) return;
    setApplyingSync(true);

    const updates = [];

    for (const { existing, provider: pp, newCost, sellingPrice } of syncResult.priceChanges) {
      if (!selectedUpdates.has(`price:${existing.id}`)) continue;
      const patch = { cost_price: newCost, plan_name: pp.plan_name, validity: pp.validity };
      if (newCost > sellingPrice) patch.selling_price = newCost;
      updates.push(
        supabase.from("data_plans").update(patch).eq("id", existing.id),
      );
    }

    for (const pp of syncResult.newPlans) {
      if (!selectedUpdates.has(`new:${pp.api_plan_id}`)) continue;
      updates.push(
        supabase.from("data_plans").insert([
          {
            provider: pp.provider,
            network: pp.network,
            network_id: pp.network_id,
            plan_name: pp.plan_name,
            api_plan_id: pp.api_plan_id,
            cost_price: pp.cost_price,
            selling_price: Math.round(pp.cost_price + DEFAULT_SELL_MARKUP),
            plan_type: pp.plan_type || null,
            validity: pp.validity || null,
            is_active: true,
          },
        ]),
      );
    }

    for (const plan of syncResult.removed) {
      if (!selectedUpdates.has(`removed:${plan.id}`)) continue;
      updates.push(
        supabase.from("data_plans").update({ is_active: false }).eq("id", plan.id),
      );
    }

    const results = await Promise.all(updates);
    const failed = results.filter((r) => r.error).length;

    setApplyingSync(false);
    setSyncOpen(false);

    if (failed === 0) {
      setToast({
        type: "success",
        title: "Prices synced",
        message: `${updates.length} change(s) applied from Gladtidings.`,
      });
    } else {
      setToast({
        type: "error",
        title: "Sync partially failed",
        message: `${failed} of ${updates.length} change(s) could not be applied.`,
      });
    }
    fetchPlans();
  };

  const formatMoney = (value) =>
    Number(value).toLocaleString("en-NG", { minimumFractionDigits: 2 });

  const syncTotal = syncResult
    ? syncResult.priceChanges.length +
      syncResult.newPlans.length +
      syncResult.removed.length
    : 0;

  return (
    <div className="space-y-6">
      <Toast
        type={toast?.type}
        title={toast?.title}
        message={toast?.message}
        onDismiss={() => setToast(null)}
      />

      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white shrink-0">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Data Plans</h1>
              <p className="text-sm text-slate-500">
                Manage VTU networks, pricing, and API routing.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-fuchsia-700 transition"
          >
            <Plus className="w-4 h-4" /> Add New Plan
          </button>
        </div>
      </GlassCard>

      {/* Search + price check toolbar */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search plans by name, network, validity or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
            />
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 border border-fuchsia-200 text-fuchsia-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-fuchsia-50 disabled:opacity-50 transition whitespace-nowrap"
            title="Pull the latest cost prices from Gladtidings and flag any plan we'd be selling at a loss."
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Check Prices
          </button>
        </div>
      </GlassCard>

      {/* Bulk margin control */}
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                Bulk Margin
              </h2>
              <p className="text-xs text-slate-500">
                Sets every plan's selling price to cost + margin%. You can still
                edit any price individually after.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <input
                type="number"
                step="any"
                placeholder="5"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                onKeyDown={handleMarginKeyDown}
                className="w-24 pl-3 pr-7 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                %
              </span>
            </div>
            <button
              onClick={handleApplyMarginToAll}
              disabled={
                applyingMargin || marginPercent === "" || plans.length === 0
              }
              className="flex items-center gap-2 bg-fuchsia-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-fuchsia-700 disabled:opacity-50 transition whitespace-nowrap"
            >
              {applyingMargin ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Apply to All"
              )}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Plans grouped by network */}
      <div className="space-y-4">
        {loading ? (
          <GlassCard className="p-16">
            <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600 mx-auto" />
          </GlassCard>
        ) : groups.length === 0 ? (
          <GlassCard className="p-16 text-center text-slate-400">
            {q ? "No plans match your search." : "No data plans found. Add one above."}
          </GlassCard>
        ) : (
          groups.map(({ network, plans: groupPlans }) => {
            const activeCount = groupPlans.filter((p) => p.is_active).length;
            const isCollapsed = q ? false : (collapsed[network] ?? true);

            return (
              <GlassCard key={network} className="overflow-hidden">
                {/* Network header (click to fold) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(network)}
                  className="w-full flex items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 text-left hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-slate-500 shrink-0">
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm sm:text-base">
                        {network}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-500">
                        {groupPlans.length} plans · {activeCount} active
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap inline-block px-2 sm:px-2.5 py-1 rounded-full bg-fuchsia-50 text-fuchsia-600 text-[11px] sm:text-xs font-bold">
                    ₦
                    {formatMoney(
                      groupPlans.reduce(
                        (sum, p) => sum + (Number(p.selling_price) || 0),
                        0,
                      ),
                    )}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-slate-100 divide-y divide-fuchsia-100">
                    {groupPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="p-4 hover:bg-fuchsia-50/40 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-sm break-words">
                              {plan.plan_name}
                            </div>
                            <div className="flex items-center flex-wrap gap-1.5 mt-1">
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-slate-600">
                                {PROVIDER_LABELS[plan.provider] ||
                                  plan.provider}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ID: {plan.api_plan_id}
                              </span>
                              {plan.validity && (
                                <span className="inline-block px-2 py-0.5 rounded bg-fuchsia-50 text-[11px] font-semibold text-fuchsia-600">
                                  {plan.validity}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleToggleActive(plan)}
                              className={`p-2 rounded-full transition ${plan.is_active ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}
                              title={
                                plan.is_active
                                  ? "Click to Disable"
                                  : "Click to Enable"
                              }
                              aria-label={
                                plan.is_active ? "Disable plan" : "Enable plan"
                              }
                            >
                              {plan.is_active ? (
                                <Power className="w-4 h-4" />
                              ) : (
                                <PowerOff className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleOpenModal(plan)}
                              className="p-2 text-slate-400 hover:text-fuchsia-600 transition"
                              title="Edit plan"
                              aria-label="Edit plan"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(plan)}
                              className="p-2 text-slate-400 hover:text-red-600 transition"
                              title="Delete plan"
                              aria-label="Delete plan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-1">
                              Cost
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ₦
                              </span>
                              <EditablePrice
                                plan={plan}
                                field="cost_price"
                                priceEditing={priceEditing}
                                priceDraft={priceDraft}
                                setPriceDraft={setPriceDraft}
                                savePrice={savePrice}
                                handlePriceKeyDown={handlePriceKeyDown}
                                startEditPrice={startEditPrice}
                                formatMoney={formatMoney}
                                valueClassName="text-xs text-slate-500 hover:text-fuchsia-600 transition"
                                inputClassName="flex-1 min-w-0 p-1 text-xs font-semibold text-slate-600 rounded-lg border border-fuchsia-400 outline-hidden focus:border-fuchsia-500"
                              />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-1">
                              Sell
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ₦
                              </span>
                              <EditablePrice
                                plan={plan}
                                field="selling_price"
                                priceEditing={priceEditing}
                                priceDraft={priceDraft}
                                setPriceDraft={setPriceDraft}
                                savePrice={savePrice}
                                handlePriceKeyDown={handlePriceKeyDown}
                                startEditPrice={startEditPrice}
                                formatMoney={formatMoney}
                                valueClassName="text-xs font-bold text-fuchsia-600 hover:text-fuchsia-800 transition"
                                inputClassName="flex-1 min-w-0 p-1 text-xs font-bold text-fuchsia-600 rounded-lg border border-fuchsia-400 outline-hidden focus:border-fuchsia-500"
                              />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-1">
                              Profit
                            </div>
                            <div
                              className={`font-bold text-xs ${getProfit(plan) < 0 ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              {getProfit(plan) < 0 ? "-" : "+"}₦
                              {formatMoney(Math.abs(getProfit(plan)))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Inline price save indicator */}
      {priceSaving && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg">
            <Loader2 className="w-4 h-4 animate-spin" /> Saving price...
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <GlassCard className="w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {currentPlan ? "Edit Data Plan" : "Add New Data Plan"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Network
                  </label>
                  <select
                    required
                    value={formData.network}
                    onChange={(e) =>
                      setFormData({ ...formData, network: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
                  >
                    <option value="MTN">MTN</option>
                    <option value="Airtel">Airtel</option>
                    <option value="Glo">Glo</option>
                    <option value="9Mobile">9Mobile</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Plan Name (e.g. 1GB SME)
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.plan_name}
                    onChange={(e) =>
                      setFormData({ ...formData, plan_name: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Provider API
                  </label>
                  <select
                    required
                    value={formData.provider}
                    onChange={(e) =>
                      setFormData({ ...formData, provider: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    API Plan ID
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.api_plan_id}
                    onChange={(e) =>
                      setFormData({ ...formData, api_plan_id: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Your Cost (₦)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) =>
                      setFormData({ ...formData, cost_price: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Selling Price (₦)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        selling_price: e.target.value,
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Validity (e.g. 30 days)
                  </label>
                  <input
                    type="text"
                    placeholder="30 days"
                    value={formData.validity}
                    onChange={(e) =>
                      setFormData({ ...formData, validity: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 pb-2.5">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({ ...formData, is_active: e.target.checked })
                      }
                      className="w-4 h-4 accent-fuchsia-600"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-fuchsia-600 rounded-xl hover:bg-fuchsia-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Save Plan"
                  )}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Bulk margin confirm */}
      <ConfirmModal
        open={confirmMarginOpen}
        title="Apply margin to all plans?"
        message={`Set every plan's selling price to cost + ${marginPercent || "0"}%.\n\nThis overwrites any custom selling prices across all ${plans.length} plans.`}
        confirmText="Apply"
        loading={applyingMargin}
        onConfirm={confirmApplyMargin}
        onCancel={() => !applyingMargin && setConfirmMarginOpen(false)}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete plan?"
        message={`"${deleteTarget?.plan_name ?? ""}" (${deleteTarget?.network ?? ""}) will be permanently removed. This cannot be undone.`}
        confirmText="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      {/* Gladtidings price sync review */}
      {syncOpen && syncResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <GlassCard className="w-full max-w-2xl flex flex-col max-h-[85vh] p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Gladtidings price check
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {syncTotal} change(s) found. Review and apply the updates
                  below.
                </p>
              </div>
              <button
                onClick={() => setSyncOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Check All / Uncheck All */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <button
                type="button"
                onClick={handleCheckAll}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Check All
              </button>
              <button
                type="button"
                onClick={handleUncheckAll}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Uncheck All
              </button>
              <span className="ml-auto text-xs text-slate-500">
                {selectedUpdates.size} of {syncTotal} selected
              </span>
            </div>

            <div className="overflow-y-auto min-h-0 space-y-5 pr-1">
              {syncResult.priceChanges.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                    Cost / plan updates ({syncResult.priceChanges.length})
                  </h3>
                  <div className="space-y-2">
                    {syncResult.priceChanges.map(
                      ({ existing, provider: pp, oldCost, newCost, sellingPrice, atLoss }) => {
                        const key = `price:${existing.id}`;
                        const checked = selectedUpdates.has(key);
                        return (
                          <div
                            key={existing.id}
                            className="rounded-xl border border-slate-100 p-3 flex items-start gap-3"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => handleSelectUpdate(key, e.target.checked)}
                              className="mt-1 w-4 h-4 text-fuchsia-600 border-slate-300 rounded focus:ring-fuchsia-500 focus:ring-2"
                              aria-label={`Apply update for ${pp.plan_name}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-800 text-sm">
                                {pp.plan_name}
                              </div>
                              <div className="flex items-center flex-wrap gap-2 mt-1 text-xs">
                                <span className="text-slate-400 line-through">
                                  ₦{formatMoney(oldCost)}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-700 font-semibold">
                                  ₦{formatMoney(newCost)}
                                </span>
                                {pp.validity && (
                                  <span className="text-slate-400">
                                    · validity: {pp.validity}
                                  </span>
                                )}
                              </div>
                              {atLoss && (
                                <p className="mt-1.5 text-[11px] font-semibold text-red-600">
                                  Selling price (₦{formatMoney(sellingPrice)}) is
                                  below the new cost — it will be raised to ₦
                                  {formatMoney(newCost)}.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {syncResult.newPlans.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                    New plans not in your catalog ({syncResult.newPlans.length})
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    They will be added as active with selling price = cost + ₦
                    {DEFAULT_SELL_MARKUP}.
                  </p>
                  <div className="space-y-1.5">
                    {syncResult.newPlans.map((pp) => {
                      const key = `new:${pp.api_plan_id}`;
                      const checked = selectedUpdates.has(key);
                      return (
                        <div
                          key={pp.api_plan_id}
                          className="rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700 flex items-center gap-3"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleSelectUpdate(key, e.target.checked)}
                            className="w-4 h-4 text-fuchsia-600 border-slate-300 rounded focus:ring-fuchsia-500 focus:ring-2"
                            aria-label={`Add new plan ${pp.plan_name}`}
                          />
                          <span className="font-semibold">{pp.plan_name}</span>{" "}
                          <span className="text-slate-400 text-xs">
                            ({pp.network} · ₦{formatMoney(pp.cost_price)})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {syncResult.removed.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                    No longer on Gladtidings ({syncResult.removed.length})
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    They will be deactivated (kept for history) so they stop
                    being sold.
                  </p>
                  <div className="space-y-1.5">
                    {syncResult.removed.map((plan) => {
                      const key = `removed:${plan.id}`;
                      const checked = selectedUpdates.has(key);
                      return (
                        <div
                          key={plan.id}
                          className="rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700 flex items-center gap-3"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleSelectUpdate(key, e.target.checked)}
                            className="w-4 h-4 text-fuchsia-600 border-slate-300 rounded focus:ring-fuchsia-500 focus:ring-2"
                            aria-label={`Deactivate ${plan.plan_name}`}
                          />
                          <span className="font-semibold">{plan.plan_name}</span>{" "}
                          <span className="text-slate-400 text-xs">
                            ({plan.network})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSyncOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
              <button
                onClick={confirmApplySync}
                disabled={applyingSync}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-fuchsia-600 rounded-xl hover:bg-fuchsia-700 disabled:opacity-50"
              >
                {applyingSync ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Apply Changes"
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
