import { AlertTriangle } from "lucide-react";
import GlassCard from "./GlassCard";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
            <AlertTriangle className="text-red-600" />
          </div>

          <div>
            <h2 className="font-bold text-lg">{title}</h2>
          </div>
        </div>

        <div className="text-slate-600 whitespace-pre-line">{message}</div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {cancelText}
          </button>

          <button
            disabled={loading}
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
