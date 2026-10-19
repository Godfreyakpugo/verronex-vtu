import { useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, ReceiptText } from "lucide-react";
import GlassCard from "./GlassCard";

export default function TransactionConfirmModal({
  open,
  title,
  details,
  pinRequired,
  pinError,
  pinErrorCode,
  loading = false,
  onClearPinError,
  onConfirm,
  onCancel,
}) {
  const [step, setStep] = useState("details");
  const [pin, setPin] = useState("");

  if (!open) return null;

  const activeStep = pinErrorCode === "pin_required" ? "pin" : step;

  function submit(value) {
    const enteredPin = value;
    setPin("");
    onConfirm(enteredPin);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    submit(pin);
  }

  return (
    <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="transaction-confirm-title" className="w-full max-w-md">
      <GlassCard className="w-full p-6">
        {activeStep === "details" ? (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-fuchsia-100 flex items-center justify-center">
                <ReceiptText className="text-fuchsia-700" />
              </div>
              <h2 id="transaction-confirm-title" className="font-bold text-lg">{title}</h2>
            </div>
            <div className="text-slate-600 whitespace-pre-line">{details}</div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => pinRequired ? setStep("pin") : submit(null)}
                className="px-5 py-2 rounded-xl text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 disabled:opacity-50"
              >
                {pinRequired ? "Continue to PIN" : "Confirm & Pay"}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <LockKeyhole className="text-indigo-700" />
              </div>
              <div>
                <h2 id="transaction-confirm-title" className="font-bold text-lg">Enter transaction PIN</h2>
                <p className="text-xs text-slate-500">Four digits to approve this purchase</p>
              </div>
            </div>

            <label htmlFor="transaction-pin-entry" className="block text-sm font-semibold text-slate-700 mb-2">
              Transaction PIN
            </label>
            <input
              id="transaction-pin-entry"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              pattern="[0-9]{4}"
              value={pin}
              onChange={(event) => {
                onClearPinError?.();
                setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
              }}
              className="w-full rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-fuchsia-500 focus:bg-white"
              aria-describedby={pinError ? "transaction-pin-error" : undefined}
              autoFocus
              required
            />

            {pinError && (
              <p id="transaction-pin-error" role="alert" className="mt-2 text-sm text-red-600">
                {pinError}
              </p>
            )}

            <div className="flex items-center justify-between mt-3">
              <Link
                to="/settings?section=security"
                onClick={onCancel}
                className="text-xs font-semibold text-fuchsia-700 hover:text-fuchsia-900"
              >
                Forgot PIN?
              </Link>
              <button
                type="button"
                onClick={() => { onClearPinError?.(); setStep("details"); setPin(""); }}
                disabled={loading}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
              >
                Back to details
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || pin.length !== 4}
                className="px-5 py-2 rounded-xl text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 disabled:opacity-50"
              >
                {loading ? "Checking…" : "Approve purchase"}
              </button>
            </div>
          </form>
        )}
      </GlassCard>
      </div>
    </div>
  );
}
