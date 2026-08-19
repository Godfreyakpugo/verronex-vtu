import { Info } from "lucide-react";

export default function PublicAlertModal({ alert, onDismiss }) {
  if (!alert) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alert.title}
      className="fixed inset-0 z-9999 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-[0_25px_60px_rgba(162,28,175,0.35)] overflow-hidden max-h-full">
        <div className="bg-linear-to-br from-indigo-600 to-fuchsia-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest font-bold text-fuchsia-100">
                Public Alert
              </p>
              <h2 className="text-lg font-black text-white leading-tight break-words">
                {alert.title}
              </h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 bg-white overflow-y-auto max-h-[60vh]">
          <p className="text-slate-800 leading-relaxed text-[15px] whitespace-pre-line break-words">
            {alert.message}
          </p>

          <button
            type="button"
            onClick={onDismiss}
            className="mt-6 w-full rounded-2xl bg-linear-to-r from-indigo-600 to-fuchsia-600 py-3.5 text-base font-bold text-white shadow-lg shadow-fuchsia-500/30 active:scale-95 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
