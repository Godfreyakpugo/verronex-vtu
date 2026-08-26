import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Mail,
  X,
  Send,
  Phone,
  Sparkles,
  ChevronRight,
} from "lucide-react";

/**
 * Floating "Message Us" button — fixed bottom-right.
 * Identity: fuchsia gradient (from-fuchsia-600 via-fuchsia-500 to-pink-500),
 * rounded-full, shadow-lg hover:shadow-fuchsia-500/30, scale/hover transitions.
 * Toggles a sleek popup card with contact channels + minimal quick-form.
 */
export default function FloatingMessageButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const WHATSAPP_NUMBER =
    import.meta.env.VITE_WHATSAPP_NUMBER || "2349029073673";
  const SUPPORT_EMAIL =
    import.meta.env.VITE_SUPPORT_EMAIL || "support@verronex.com.ng";

  // Clean number for wa.me (digits only)
  const waNumber = String(WHATSAPP_NUMBER).replace(/\D/g, "");

  const whatsappHref = (text) =>
    `https://wa.me/${waNumber}?text=${encodeURIComponent(
      text || "Hello Verronex support, I need help with my VTU purchase."
    )}`;

  const emailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    "Support request — Verronex VTU"
  )}&body=${encodeURIComponent(
    "Hello Verronex team,\n\nI need help with:\n\n"
  )}`;

  // Close on outside click / Escape, restore focus to trigger
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onPointerDown(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Focus first actionable element when panel opens
  useEffect(() => {
    if (open) {
      // small delay to let render complete
      const id = setTimeout(() => {
        const first = panelRef.current?.querySelector(
          'button, a, input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        first?.focus?.();
      }, 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleQuickSend = (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    window.open(whatsappHref(text), "_blank", "noopener,noreferrer");
    setMessage("");
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3 pointer-events-none"
      // pointer-events-none on container lets clicks pass except children re-enable
    >
      {/* ── Popup card ── */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Contact options"
          aria-labelledby="fab-contact-title"
          className="pointer-events-auto w-[calc(100vw-2rem)] sm:w-[360px] max-w-[360px] max-h-[min(78vh,520px)] overflow-hidden rounded-[20px] bg-white/95 backdrop-blur-xl border border-fuchsia-200/60 shadow-[0_20px_60px_rgba(192,38,211,0.18),0_8px_24px_rgba(0,0,0,0.08)] flex flex-col animate-[fab-in_0.22s_cubic-bezier(0.16,1,0.3,1)] origin-bottom-right"
        >
          {/* Header — signature gradient */}
          <div className="relative bg-gradient-to-r from-fuchsia-600 via-fuchsia-500 to-pink-500 px-5 pt-5 pb-4 text-white overflow-hidden shrink-0">
            {/* subtle decorative blur */}
            <div
              aria-hidden="true"
              className="absolute -top-10 -right-10 w-32 h-32 bg-white/15 rounded-full blur-2xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/10 rounded-full blur-xl"
            />

            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
                  Online now
                </div>
                <h2
                  id="fab-contact-title"
                  className="mt-2.5 text-[17px] font-black tracking-tight leading-none"
                >
                  How can we help?
                </h2>
                <p className="mt-1 text-xs font-medium text-fuchsia-100 leading-relaxed">
                  We typically reply within minutes
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close contact menu"
                className="shrink-0 p-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-fuchsia-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="overflow-y-auto p-3 space-y-3 flex-1 min-h-0">
            {/* Quick channels */}
            <div className="space-y-2">
              <p className="px-1 text-[11px] font-bold tracking-widest uppercase text-slate-400">
                Quick channels
              </p>

              {/* Live Chat — opens WhatsApp with prefilled greeting */}
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 w-full rounded-2xl border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-pink-50 hover:from-fuchsia-100 hover:to-pink-100 hover:border-fuchsia-200 p-3.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-500 flex items-center justify-center shadow-md shadow-fuchsia-500/20 shrink-0">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Live Chat
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    Chat with support instantly
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-fuchsia-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </a>

              {/* WhatsApp */}
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 w-full rounded-2xl border border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/60 p-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">WhatsApp</p>
                  <p className="text-xs text-slate-500 truncate">
                    {waNumber ? `+${waNumber}` : "Chat on WhatsApp"} • Fastest
                    response
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </a>

              {/* Email */}
              <a
                href={emailHref}
                className="group flex items-center gap-3 w-full rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/60 p-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">Email Us</p>
                  <p className="text-xs text-slate-500 truncate">
                    {SUPPORT_EMAIL}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </a>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-fuchsia-400" /> or send a
                quick message
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            {/* Minimal form → WhatsApp */}
            <form onSubmit={handleQuickSend} className="space-y-2.5">
              <label htmlFor="fab-quick-message" className="sr-only">
                Your message
              </label>
              <div className="relative">
                <textarea
                  id="fab-quick-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi, I need help with..."
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 px-4 py-3 pr-12 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 focus:border-transparent focus:bg-white transition-colors"
                />
                <span className="absolute bottom-2.5 right-3 text-[10px] font-medium text-slate-400">
                  {message.length}/500
                </span>
              </div>

              <button
                type="submit"
                disabled={!message.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-fuchsia-500 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30 hover:brightness-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:active:scale-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2"
              >
                <Send className="w-4 h-4" />
                Send via WhatsApp
              </button>

              <p className="text-center text-[11px] leading-relaxed text-slate-400 px-2">
                This opens WhatsApp with your message — no data is stored on
                our servers.
              </p>
            </form>
          </div>

          {/* Footer hint */}
          <div className="shrink-0 px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-slate-500">
              Avg. response:{" "}
              <span className="font-bold text-slate-700">&lt; 2 mins</span> on
              WhatsApp
            </p>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-fuchsia-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Support online
            </span>
          </div>
        </div>
      )}

      {/* ── Floating trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close contact menu" : "Open contact menu — Message Us"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="fab-contact-panel"
        className="pointer-events-auto group relative inline-flex items-center gap-2.5 sm:gap-3 rounded-full bg-gradient-to-r from-fuchsia-600 via-fuchsia-500 to-pink-500 px-4 py-3 sm:px-5 sm:py-3.5 text-white shadow-lg hover:shadow-fuchsia-500/30 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {/* Icon bubble */}
        <span className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/15 border border-white/20 backdrop-blur shrink-0 group-hover:bg-white/20 transition-colors">
          {open ? (
            <X className="w-5 h-5 text-white" aria-hidden="true" />
          ) : (
            <MessageCircle className="w-5 h-5 text-white" aria-hidden="true" />
          )}
          {/* Online status dot — overlapping top-right of icon */}
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border-2 border-white shadow-sm" />
          </span>
        </span>

        {/* Label — hidden on very small screens to stay non-intrusive */}
        <span className="hidden sm:inline-flex flex-col items-start leading-none pr-1">
          <span className="text-[11px] font-bold tracking-widest uppercase text-fuchsia-100">
            {open ? "Close" : "Message Us"}
          </span>
          <span className="text-sm font-black tracking-tight -mt-0.5">
            {open ? "Hide options" : "We are online"}
          </span>
        </span>

        {/* Mobile condensed label — visible only on < sm */}
        <span className="sm:hidden text-sm font-bold tracking-tight pr-0.5">
          {open ? "Close" : "Message Us"}
        </span>

        {/* Subtle sheen on hover */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        />
      </button>

      {/* Local keyframes for popup */}
      <style>{`
        @keyframes fab-in {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
