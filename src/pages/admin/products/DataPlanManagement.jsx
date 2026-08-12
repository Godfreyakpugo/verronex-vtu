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
} from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import supabase from "../../../lib/supabaseClient";

export default function DataPlanManagement() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [priceEditing, setPriceEditing] = useState(null); // {plan, field}
  const [priceDraft, setPriceDraft] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);

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
        a.localeCompare(b)
    )
    .map((network) => ({
      network,
      plans: grouped[network],
    }));

  const toggleGroup = (network) =>
    setCollapsed((prev) => ({ ...prev, [network]: !prev[network] }));

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
            const isCollapsed = collapsed[network];
            const isEditingPrice =
              priceEditing &&
              priceEditing.plan.network === network &&
              !isCollapsed;

            return (
              <GlassCard
                key={network}
                className={`overflow-hidden ${isCollapsed ? "" : "overflow-x-auto"}`}
              >
                {/* Network header (click to fold) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(network)}
                  className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">
                        {network}
                      </div>
                      <div className="text-xs text-slate-500">
                        {groupPlans.length} plans · {activeCount} active
                      </div>
                    </div>
                  </div>
                  <span className="inline-block px-2.5 py-1 rounded-full bg-fuchsia-50 text-fuchsia-600 text-xs font-bold">
                    ₦{formatMoney(
                      groupPlans.reduce(
                        (sum, p) => sum + (Number(p.selling_price) || 0),
                        0
                      )
                    )}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] md:text-xs uppercase font-bold tracking-wider text-slate-500">
                          <th className="p-4 md:p-6">Plan</th>
                          <th className="p-4 md:p-6">Provider (API)</th>
                          <th className="p-4 md:p-6">Cost / Price</th>
                          <th className="p-4 md:p-6">Profit</th>
                          <th className="p-4 md:p-6 text-center">Status</th>
                          <th className="p-4 md:p-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-fuchsia-50">
                        {groupPlans.map((plan) => (
                          <tr
                            key={plan.id}
                            className="hover:bg-fuchsia-50/50 transition"
                          >
                            <td className="p-4 md:p-6">
                              <div className="font-bold text-slate-800 text-sm whitespace-nowrap">
                                {plan.plan_name}
                              </div>
                            </td>
                            <td className="p-4 md:p-6">
                              <span className="inline-block px-2 py-1 rounded bg-slate-100 text-xs font-semibold text-slate-600">
                                {plan.provider}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-1">
                                ID: {plan.api_plan_id}
                              </div>
                            </td>
                            <td className="p-4 md:p-6">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-400">
                                  ₦
                                </span>
                                {isEditingPrice &&
                                priceEditing.plan.id === plan.id &&
                                priceEditing.field === "cost_price" ? (
                                  <input
                                    autoFocus
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={priceDraft}
                                    onChange={(e) =>
                                      setPriceDraft(e.target.value)
                                    }
                                    onBlur={savePrice}
                                    onKeyDown={handlePriceKeyDown}
                                    className="w-24 p-1 text-sm font-semibold text-slate-600 rounded-lg border border-fuchsia-400 outline-hidden focus:border-fuchsia-500"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditPrice(plan, "cost_price")
                                    }
                                    className="text-xs text-slate-500 hover:text-fuchsia-600 transition"
                                    title="Click to edit cost"
                                  >
                                    {formatMoney(plan.cost_price)}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-400">
                                  ₦
                                </span>
                                {isEditingPrice &&
                                priceEditing.plan.id === plan.id &&
                                priceEditing.field === "selling_price" ? (
                                  <input
                                    autoFocus
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={priceDraft}
                                    onChange={(e) =>
                                      setPriceDraft(e.target.value)
                                    }
                                    onBlur={savePrice}
                                    onKeyDown={handlePriceKeyDown}
                                    className="w-24 p-1 text-sm font-bold text-fuchsia-600 rounded-lg border border-fuchsia-400 outline-hidden focus:border-fuchsia-500"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditPrice(plan, "selling_price")
                                    }
                                    className="text-sm font-bold text-fuchsia-600 hover:text-fuchsia-800 transition"
                                    title="Click to edit selling price"
                                  >
                                    {formatMoney(plan.selling_price)}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-4 md:p-6">
                              <span className="font-bold text-emerald-600 text-sm">
                                +₦
                                {formatMoney(
                                  Number(plan.selling_price) -
                                    Number(plan.cost_price)
                                )}
                              </span>
                            </td>
                            <td className="p-4 md:p-6 text-center">
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
                            </td>
                            <td className="p-4 md:p-6 text-right">
                              <button
                                onClick={() => handleOpenModal(plan)}
                                className="p-2 text-slate-400 hover:text-fuchsia-600 transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
