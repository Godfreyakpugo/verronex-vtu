import { useState } from "react";
import { CheckCircle2, ReceiptText, X } from "lucide-react";
import GlassCard from "./GlassCard";

function ReceiptRow({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-800 text-right break-words min-w-0">
        {value}
      </span>
    </div>
  );
}

export default function PurchaseSuccessModal({ receipt, onClose }) {
  const [showReceipt, setShowReceipt] = useState(false);

  if (!receipt) return null;

  return (
    <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-6">
        {!showReceipt ? (
          <>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="font-bold text-xl">Purchase Successful</h2>
              <p className="text-slate-600 text-sm mt-1.5">{receipt.summary}</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowReceipt(true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold py-3 hover:opacity-90 transition-opacity"
              >
                <ReceiptText className="w-4 h-4" />
                View Receipt
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border-2 border-emerald-300 text-emerald-700 font-semibold py-3 hover:bg-emerald-50 transition-colors"
              >
                Alright
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-emerald-600" />
                Transaction Receipt
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close receipt"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Successful
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <ReceiptRow label="Network" value={receipt.network} />
              <ReceiptRow
                label={receipt.planLabel || "Data plan"}
                value={receipt.plan}
              />
              <ReceiptRow label="Recipient phone" value={receipt.phone} />
              <ReceiptRow label="Amount paid" value={receipt.amount} />
              <ReceiptRow label="Reference" value={receipt.reference} />
              <ReceiptRow label="Date / time" value={receipt.date} />
              <ReceiptRow label="Provider reference" value={receipt.providerRef} />
              <ReceiptRow label="Provider response" value={receipt.providerResponse} />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold py-3 hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </>
        )}
      </GlassCard>
    </div>
  );
}
