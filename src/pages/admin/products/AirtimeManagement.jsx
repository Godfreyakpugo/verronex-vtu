import { useState, useEffect } from "react";
import {
  Smartphone,
  Edit2,
  Power,
  PowerOff,
  Loader2,
  Plus,
} from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import supabase from "../../../lib/supabaseClient";

const PROVIDER_LABELS = {
  gladtidings: "GladTidingsData",
  wazobianet: "WazobiaNet",
};

// Only Gladtidings routes live Airtime purchases. WazobiaNet is preserved as
// a dormant fallback (value kept for any future reactivation), StrongMB was
// never implemented so it is not offered as a selectable option.
const PROVIDERS = [
  { value: "gladtidings", label: "GladTidingsData (Active)" },
  { value: "wazobianet", label: "WazobiaNet (Dormant fallback)" },
];

export default function AirtimeManagement() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [formData, setFormData] = useState({
    network: "MTN",
    provider: "gladtidings",
    api_network_id: "",
    admin_discount: 0,
    user_discount: 0,
    is_active: true,
  });

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("airtime_settings")
      .select("*")
      .order("network", { ascending: true });

    if (error) {
      console.error("Error fetching airtime settings:", error);
    } else {
      setSettings(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleOpenModal = (networkObj = null) => {
    if (networkObj) {
      setCurrentNetwork(networkObj);
      setFormData({
        network: networkObj.network,
        provider: networkObj.provider,
        api_network_id: networkObj.api_network_id,
        admin_discount: networkObj.admin_discount,
        user_discount: networkObj.user_discount,
        is_active: networkObj.is_active,
      });
    } else {
      setCurrentNetwork(null);
      setFormData({
        network: "MTN",
        provider: "gladtidings",
        api_network_id: "",
        admin_discount: 0,
        user_discount: 0,
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (currentNetwork) {
      // Update existing
      const { error } = await supabase
        .from("airtime_settings")
        .update(formData)
        .eq("id", currentNetwork.id);

      if (error) alert("Error updating network: " + error.message);
    } else {
      // Insert new
      const { error } = await supabase
        .from("airtime_settings")
        .insert([formData]);

      if (error) alert("Error adding network: " + error.message);
    }

    setSaving(false);
    setIsModalOpen(false);
    fetchSettings(); // Refresh the list
  };

  const handleToggleActive = async (networkObj) => {
    const { error } = await supabase
      .from("airtime_settings")
      .update({ is_active: !networkObj.is_active })
      .eq("id", networkObj.id);

    if (error) {
      alert("Error toggling status: " + error.message);
    } else {
      fetchSettings();
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
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Airtime Settings
              </h1>
              <p className="text-sm text-slate-500">
                Manage network routing and discount margins.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-fuchsia-700 transition"
          >
            <Plus className="w-4 h-4" /> Add Network
          </button>
        </div>
      </GlassCard>

      {/* Active provider notice */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-bold whitespace-nowrap">
            Active provider: GladtidingsData
          </span>
          <p className="text-xs text-slate-500">
            All live Airtime purchases route through Gladtidings. WazobiaNet is
            retained only as a dormant fallback and is not used by the purchase
            flow.
          </p>
        </div>
      </GlassCard>

      {/* Networks Table */}
      <GlassCard className="overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-[10px] md:text-xs uppercase font-bold tracking-wider text-slate-500">
              <th className="p-4 md:p-6">Network</th>
              <th className="p-4 md:p-6">Provider (API)</th>
              <th className="p-4 md:p-6">Admin Discount</th>
              <th className="p-4 md:p-6">User Discount</th>
              <th className="p-4 md:p-6">Profit (per ₦1k)</th>
              <th className="p-4 md:p-6 text-center">Status</th>
              <th className="p-4 md:p-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fuchsia-50">
            {loading ? (
              <tr>
                <td colSpan="7" className="p-10 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600 mx-auto" />
                </td>
              </tr>
            ) : settings.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-10 text-center text-slate-400">
                  No airtime settings found.
                </td>
              </tr>
            ) : (
              settings.map((net) => {
                // Calculate example profit on a ₦1,000 purchase
                const adminMargin = parseFloat(net.admin_discount) || 0;
                const userMargin = parseFloat(net.user_discount) || 0;
                const profitPer1k = 1000 * ((adminMargin - userMargin) / 100);

                return (
                  <tr
                    key={net.id}
                    className="hover:bg-fuchsia-50/50 transition"
                  >
                    <td className="p-4 md:p-6">
                      <div className="font-bold text-slate-800 text-sm">
                        {net.network}
                      </div>
                    </td>
                    <td className="p-4 md:p-6">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-1 rounded bg-slate-100 text-xs font-semibold text-slate-600">
                          {PROVIDER_LABELS[net.provider] || net.provider}
                        </span>
                        {net.provider === "gladtidings" ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                            Dormant
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        ID: {net.api_network_id}
                      </div>
                    </td>
                    <td className="p-4 md:p-6 font-semibold text-slate-600">
                      {net.admin_discount}%
                    </td>
                    <td className="p-4 md:p-6 font-bold text-fuchsia-600">
                      {net.user_discount}%
                    </td>
                    <td className="p-4 md:p-6">
                      <span className="font-bold text-emerald-600 text-sm">
                        +₦{formatMoney(profitPer1k)}
                      </span>
                    </td>
                    <td className="p-4 md:p-6 text-center">
                      <button
                        onClick={() => handleToggleActive(net)}
                        className={`p-2 rounded-full transition ${net.is_active ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}
                        title={
                          net.is_active ? "Click to Disable" : "Click to Enable"
                        }
                      >
                        {net.is_active ? (
                          <Power className="w-4 h-4" />
                        ) : (
                          <PowerOff className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="p-4 md:p-6 text-right">
                      <button
                        onClick={() => handleOpenModal(net)}
                        className="p-2 text-slate-400 hover:text-fuchsia-600 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </GlassCard>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {currentNetwork
                ? `Edit ${currentNetwork.network} Settings`
                : "Add Airtime Network"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              {!currentNetwork && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Network Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Smile or Spectranet"
                    value={formData.network}
                    onChange={(e) =>
                      setFormData({ ...formData, network: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-fuchsia-500"
                  />
                </div>
              )}

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
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-fuchsia-500"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Only Gladtidings is used by the live purchase flow. WazobiaNet
                    stays as a dormant fallback.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    API Network ID
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.api_network_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        api_network_id: e.target.value,
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-fuchsia-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Legacy/reference only — not used by Gladtidings routing.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Your API Discount (%)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.admin_discount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        admin_discount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-fuchsia-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    What the API gives you.
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-fuchsia-600 uppercase tracking-wider mb-1">
                    User Discount (%)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.user_discount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        user_discount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    What the customer gets.
                  </p>
                </div>
              </div>

              {/* Profit Preview */}
              <div className="text-center py-2">
                <span className="text-xs text-slate-500 font-semibold">
                  Profit on ₦1,000 sale:
                </span>
                <span className="ml-2 font-bold text-emerald-600">
                  ₦
                  {formatMoney(
                    1000 *
                      ((formData.admin_discount - formData.user_discount) /
                        100),
                  )}
                </span>
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
                    "Save Settings"
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
