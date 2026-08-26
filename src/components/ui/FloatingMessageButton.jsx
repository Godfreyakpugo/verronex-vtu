import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X, ExternalLink } from "lucide-react";

/**
 * Floating "Message Us" — minimal & compact.
 * - Matches dashboard accent: from-indigo-600 to-fuchsia-600 (AGENTS.md + Dashboard quickActions)
 * - Compact sizing: px-4 py-2, text-sm, w-4 h-4 icon
 * - Single WhatsApp popup card
 * - Fixed bottom-6 right-6, viewport-safe on mobile
 */
export default function FloatingMessageButton() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const WHATSAPP_NUMBER =
    import.meta.env.VITE_WHATSAPP_NUMBER || "2349029073673";
  const waNumber = String(WHATSAPP_NUMBER).replace(/\D/g, "");
  const whatsappHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    "Hello Verronex support, I need help with my VTU purchase."
  )}`;

  // Close on outside click / Escape
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

  // Focus panel on open
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      panelRef.current?.querySelector("a,button")?.focus?.();
    }, 30);
    return () => clearTimeout(id);
  }, [open]);

  // Close popup when navigating (esp. to hidden pages)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [location.pathname]);

  // Hide on buy-data and buy-airtime pages per requirement
  if (
    location.pathname === "/buy-data" ||
    location.pathname === "/buy-airtime"
  ) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 pointer-events-none"
    >
      {/* ── Popup — WhatsApp only ── */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="WhatsApp contact"
          aria-labelledby="fab-wa-title"
          className="pointer-events-auto w-[calc(100vw-3rem)] sm:w-72 max-w-[320px] overflow-hidden rounded-2xl bg-white border border-fuchsia-200/60 shadow-[0_16px_40px_rgba(192,38,211,0.14),0_4px_12px_rgba(0,0,0,0.06)] animate-[fab-in_0.18s_cubic-bezier(0.16,1,0.3,1)] origin-bottom-right"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* WhatsApp icon — emerald for brand, card matches dashboard palette */}
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20 shrink-0">
                <MessageCircle className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="fab-wa-title"
                  className="text-sm font-bold tracking-tight text-slate-900 leading-tight"
                >
                  Chat with us on WhatsApp
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Fast replies — typically within minutes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close contact popup"
                className="shrink-0 p-1.5 rounded-full hover:bg-fuchsia-50 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30 hover:brightness-[1.04] active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2"
            >
              Open WhatsApp
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>

            <p className="mt-2.5 text-center text-[11px] text-slate-400">
              Opens WhatsApp directly
            </p>
          </div>
        </div>
      )}

      {/* ── Compact trigger — matches dashboard QuickActions (from-fuchsia-600 to-purple-600) & AGENTS gradient (from-indigo-600 to-fuchsia-600) ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close contact menu" : "Open contact menu — Message Us"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="pointer-events-auto group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-fuchsia-500/30 hover:scale-[1.03] active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {/* Subtle online dot — emerald, matching app's verified/online cues */}
        <span className="relative flex items-center justify-center shrink-0">
          {open ? (
            <X className="w-4 h-4 text-white" aria-hidden="true" />
          ) : (
            <MessageCircle className="w-4 h-4 text-white" aria-hidden="true" />
          )}
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border-2 border-white shadow-sm" />
          </span>
        </span>
        <span className="tracking-tight">
          {open ? "Close" : "Message Us"}
        </span>
      </button>

      <style>{`
        @keyframes fab-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
