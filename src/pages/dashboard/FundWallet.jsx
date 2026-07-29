import { useState } from "react";
import {
  Building2,
  Copy,
  CheckCircle2,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

export default function FundWallet() {
  const { user, profile } = useAuth();

  const BANK_NAME = import.meta.env.VITE_BANK_NAME;
  const ACCOUNT_NAME = import.meta.env.VITE_ACCOUNT_NAME;
  const ACCOUNT_NUMBER = import.meta.env.VITE_ACCOUNT_NUMBER;
  const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER;

  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyAccount() {
    await navigator.clipboard.writeText(ACCOUNT_NUMBER);
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  }

  async function handleFundingRequest() {
    if (!user || !profile) return;

    setLoading(true);

    try {
      const { error } = await supabase.from("funding_requests").insert({
        user_id: user.id,
        reference: reference || null,
      });

      if (error) throw error;

      const message = `*=== VERRONEX WALLET FUNDING REQUEST ===*

Username: ${profile.username ?? "N/A"}

Name: ${profile.full_name}

Phone: ${profile.phone}

Email: ${profile.email}

Reference: ${reference || "Not Provided"}

Please verify my transfer and credit my wallet.

Thank you.`;

      window.open(
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
        "_blank",
      );

      setReference("");
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-700 text-white p-8 shadow-xl">
        <h1 className="text-3xl font-black">Fund Wallet</h1>

        <p className="mt-2 text-purple-200">
          Transfer to the account below then tap
          <span className="font-semibold text-white"> I've Made Payment</span>.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-fuchsia-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-fuchsia-600" />
          </div>

          <div>
            <h2 className="font-bold text-slate-800">Bank Transfer</h2>

            <p className="text-sm text-slate-500">
              Make a transfer using your banking app.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Bank</p>

            <p className="text-lg font-semibold">{BANK_NAME}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Account Name
            </p>

            <p className="text-lg font-semibold">{ACCOUNT_NAME}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              Account Number
            </p>

            <div className="flex items-center justify-between rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-5 py-4">
              <span className="text-2xl font-black tracking-widest">
                {ACCOUNT_NUMBER}
              </span>

              <button
                onClick={copyAccount}
                className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-white font-semibold hover:bg-fuchsia-700"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-fuchsia-100 p-6 shadow-sm">
        <label className="text-sm font-bold text-slate-700 block mb-2">
          Payment Reference (Optional)
        </label>

        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Bank reference (if available)"
          className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
        />
      </div>

      <button
        onClick={handleFundingRequest}
        disabled={loading}
        className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 py-4 text-white font-bold flex items-center justify-center gap-3 shadow-lg shadow-fuchsia-500/30 hover:from-fuchsia-700 hover:to-purple-700 disabled:opacity-50"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <MessageCircle className="w-5 h-5" />
            I've Made Payment
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm text-amber-700">
          Once you've made payment, click the button above. A funding request
          will be created automatically and WhatsApp will open with a pre-filled
          message for you to send.
        </p>
      </div>
    </div>
  );
}
