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
} from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
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

  // Form State
  const [currentPlan, setCurrentPlan] = useState(null);
  const [formData, setFormData] = useState({
    network: "MTN",
    plan_name: "",
    provider: "wazobianet",
    api_plan_id: "",
    cost_price: 0,
    selling_price: 0,
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

  // Group plans by network, preserving deterministic network order
  const NETWORK_ORDER = ["MTN", "Airtel", "Glo", "9Mobile", "Others"];
  const grouped = plans.reduce((acc, plan) => {
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
        is_active: plan.is_active,
      });
    } else {
      setCurrentPlan(null);
      setFormData({
        network: "MTN",
        plan_name: "",
        provider: "wazobianet",
        api_plan_id: "",
        cost_price: 0,
        selling_price: 0,
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (currentPlan) {
      // Update existing
      const { error } = await supabase
        .from("data_plans")
        .update(formData)
        .eq("id", currentPlan.id);

      if (error) alert("Error updating plan: " + error.message);
    } else {
      // Insert new
      const { error } = await supabase.from("data_plans").insert([formData]);

      if (error) alert("Error creating plan: " + error.message);
    }

    setSaving(false);
    setIsModalOpen(false);
    fetchPlans(); // Refresh the list
  };

  const handleToggleActive = async (plan) => {
    const { error } = await supabase
      .from("data_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);

    if (error) {
      alert("Error toggling status: " + error.message);
    } else {
      fetchPlans();
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

    setPriceSaving(true);

    const { error } = await supabase
      .from("data_plans")
      .update({ [field]: value })
      .eq("id", plan.id);

    setPriceSaving(false);

    if (error) {
      alert("Error updating price: " + error.message);
    } else {
      fetchPlans();
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

  // Recalculates every plan's selling price as cost + margin%, in one pass.
  // Individual prices can still be edited by hand afterward via EditablePrice.
  const handleApplyMarginToAll = async () => {
    const pct = parseFloat(marginPercent);
    if (isNaN(pct) || plans.length === 0 || applyingMargin) return;

    setApplyingMargin(true);

    const results = await Promise.all(
      plans.map((plan) =>
        supabase
          .from("data_plans")
          .update({
            selling_price: Math.round(
              Number(plan.cost_price) * (1 + pct / 100),
            ),
          })
          .eq("id", plan.id),
      ),
    );

    setApplyingMargin(false);

    const failedCount = results.filter((r) => r.error).length;
    if (failedCount > 0) {
      alert(`Margin applied, but ${failedCount} plan(s) failed to update.`);
    }

    fetchPlans();
  };

  const handleMarginKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyMarginToAll();
    }
  };

  const formatMoney = (value) =>
    Number(value).toLocaleString("en-NG", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
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
            No data plans found. Add one above.
          </GlassCard>
        ) : (
          groups.map(({ network, plans: groupPlans }) => {
            const activeCount = groupPlans.filter((p) => p.is_active).length;
            const isCollapsed = collapsed[network] ?? true;

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
                            <div className="font-bold text-slate-800 text-sm wrap-break-words">
                              {plan.plan_name}
                            </div>
                            <div className="flex items-center flex-wrap gap-1.5 mt-1">
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-slate-600">
                                {plan.provider}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ID: {plan.api_plan_id}
                              </span>
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
                            >
                              <Edit2 className="w-4 h-4" />
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
                            <div className="font-bold text-emerald-600 text-xs">
                              +₦
                              {formatMoney(
                                Number(plan.selling_price) -
                                  Number(plan.cost_price),
                              )}
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
                    <option value="wazobianet">WazobiaNet</option>
                    <option value="gladtidings">GladTidingsData</option>
                    <option value="strongmb">StrongMB</option>
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
                      setFormData({
                        ...formData,
                        cost_price: parseFloat(e.target.value) || 0,
                      })
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
                        selling_price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-hidden focus:border-fuchsia-500"
                  />
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
    </div>
  );
}
