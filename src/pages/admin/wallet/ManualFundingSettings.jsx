import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, Save } from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import supabase from "../../../lib/supabaseClient";
import {
  getFallbackManualFundingSettings,
  MANUAL_FUNDING_SETTINGS_COLUMNS,
  mapManualFundingSettings,
  normalizeWhatsappNumber,
} from "../../../lib/manualFundingSettings";

const INPUT_CLASS =
  "w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-fuchsia-400";

function SettingsField({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export default function ManualFundingSettings() {
  const [settings, setSettings] = useState(getFallbackManualFundingSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("manual_funding_settings")
          .select(MANUAL_FUNDING_SETTINGS_COLUMNS)
          .eq("id", 1)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        if (data?.configured) {
          setSettings(mapManualFundingSettings(data));
          setConfigured(true);
        } else {
          setSettings(getFallbackManualFundingSettings());
          setConfigured(false);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load manual funding settings:", error);
        setLoadError(
          "Could not load saved settings. Confirm the SQL setup is applied and your admin access is active.",
        );
        setSettings(getFallbackManualFundingSettings());
        setConfigured(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
    setSaved(false);
    setSaveError("");
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving || loading) return;

    const whatsappNumber = normalizeWhatsappNumber(settings.whatsapp_number);
    setSaving(true);
    setSaved(false);
    setSaveError("");

    try {
      const { data, error } = await supabase.rpc(
        "admin_update_manual_funding_settings",
        {
          p_bank_name: settings.bank_name.trim(),
          p_account_name: settings.account_name.trim(),
          p_account_number: settings.account_number.trim(),
          p_payment_instructions: settings.payment_instructions.trim(),
          p_whatsapp_number: whatsappNumber,
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Could not save manual funding settings.");
      }

      setSettings((current) => ({
        ...current,
        bank_name: current.bank_name.trim(),
        account_name: current.account_name.trim(),
        account_number: current.account_number.trim(),
        payment_instructions: current.payment_instructions.trim(),
        whatsapp_number: whatsappNumber,
      }));
      setConfigured(true);
      setLoadError("");
      setSaved(true);
    } catch (error) {
      console.error("Failed to save manual funding settings:", error);
      if (error?.code === "PGRST202") {
        setSaveError(
          "This Supabase project cannot find the manual funding settings RPC. Run supabase/sql/manual_funding_settings.sql in the SQL Editor for the same project used by this app. If it was just applied, run NOTIFY pgrst, 'reload schema' and try again.",
        );
      } else {
        setSaveError(error.message || "Could not save manual funding settings.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto mb-6">
      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">Manual funding details</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              These details appear on the customer Fund Wallet page and update without a redeploy.
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              configured
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {configured ? "Saved settings" : "Build-time defaults"}
          </span>
        </div>

        {loadError && (
          <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
            {loadError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField label="Bank name">
              <input
                required
                maxLength={100}
                value={settings.bank_name}
                onChange={(event) => updateField("bank_name", event.target.value)}
                placeholder="Bank name"
                className={INPUT_CLASS}
              />
            </SettingsField>

            <SettingsField label="Account name">
              <input
                required
                maxLength={150}
                value={settings.account_name}
                onChange={(event) => updateField("account_name", event.target.value)}
                placeholder="Account holder name"
                className={INPUT_CLASS}
              />
            </SettingsField>

            <SettingsField label="Account number" hint="Enter the 10 digit Nigerian bank account number.">
              <input
                required
                inputMode="numeric"
                maxLength={10}
                pattern="[0-9]{10}"
                value={settings.account_number}
                onChange={(event) => updateField("account_number", event.target.value)}
                placeholder="0123456789"
                className={INPUT_CLASS}
              />
            </SettingsField>

            <SettingsField
              label="WhatsApp number (optional)"
              hint="Use the country code, digits only, for example 2348012345678. Customers can still submit a request without this."
            >
              <input
                inputMode="tel"
                maxLength={20}
                value={settings.whatsapp_number}
                onChange={(event) => updateField("whatsapp_number", event.target.value)}
                placeholder="2348012345678"
                className={INPUT_CLASS}
              />
            </SettingsField>
          </div>

          <SettingsField label="Transfer instructions for customers" hint="Shown with the bank details on Fund Wallet.">
            <textarea
              rows={3}
              maxLength={1000}
              value={settings.payment_instructions}
              onChange={(event) => updateField("payment_instructions", event.target.value)}
              placeholder="For example: transfer the exact amount, then submit the payment reference below."
              className={`${INPUT_CLASS} resize-y`}
            />
          </SettingsField>

          {saveError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
              {saveError}
            </div>
          )}
          {saved && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Saved. Customers will see the updated funding details.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving || loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {loading ? "Loading settings..." : saving ? "Saving..." : "Save funding details"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
