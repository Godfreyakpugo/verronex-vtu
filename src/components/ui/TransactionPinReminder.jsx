import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, LockKeyhole, X } from "lucide-react";
import GlassCard from "./GlassCard";
import { invokeTransactionPin } from "../../lib/transactionPin";

export default function TransactionPinReminder({ open, onClose }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function saveChoice(action) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await invokeTransactionPin({ action });
      if (result?.error) throw new Error(result.error);
      onClose();
    } catch (err) {
      setError(err.message || "Could not save this reminder choice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-9999 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="transaction-pin-reminder-title" className="w-full max-w-md">
      <GlassCard className="relative w-full p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reminder"
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-fuchsia-100 flex items-center justify-center mb-4">
          <LockKeyhole className="w-6 h-6 text-fuchsia-700" />
        </div>
        <h2 id="transaction-pin-reminder-title" className="text-lg font-bold text-slate-900">
          Add a transaction PIN
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          A four-digit PIN adds an extra check before a wallet purchase. It is optional, and you can still buy data or airtime without setting one.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="space-y-2 mt-5">
          <Link
            to="/settings?section=security&setupPin=1"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20"
          >
            <LockKeyhole className="w-4 h-4" />
            Set up now
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveChoice("remind_later")}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-fuchsia-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-fuchsia-50 disabled:opacity-50"
          >
            <Clock3 className="w-4 h-4" />
            Set up later
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveChoice("dont_remind")}
            className="w-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            Don’t remind me again
          </button>
        </div>
      </GlassCard>
      </div>
    </div>
  );
}
