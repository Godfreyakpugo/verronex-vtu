import { useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

const DEFAULT_DURATION = {
  success: 5000,
  error: 6500,
};

export default function Toast({
  type = "success",
  title,
  message,
  duration,
  onDismiss,
}) {
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(
      onDismiss,
      duration ?? DEFAULT_DURATION[type] ?? 5000,
    );
    return () => clearTimeout(timeout);
  }, [message, duration, type, onDismiss]);

  if (!message) return null;

  const isError = type === "error";

  return (
    <div className="fixed inset-x-0 top-20 z-50 flex justify-center px-4 pointer-events-none">
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={`pointer-events-auto w-full max-w-md flex items-start gap-3 rounded-2xl border p-4 shadow-lg animate-[toast-in_0.3s_ease-out] ${
          isError
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}
      >
        {isError ? (
          <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          {title && <p className="text-sm font-bold">{title}</p>}
          <p className="text-sm mt-0.5">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
