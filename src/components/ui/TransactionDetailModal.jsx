import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import GlassCard from "./GlassCard";
import { formatNaira } from "../../lib/transactionView";

function Row({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-800 text-right wrap-break-word min-w-0">
        {value}
      </span>
    </div>
  );
}

function ReferenceRow({ value }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — reference is still visible for manual copy
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">Reference</span>
      <span className="min-w-0 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 text-right break-all min-w-0">
          {value}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy reference"
          className="p-1 rounded-md text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-colors shrink-0"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </span>
    </div>
  );
}

// Generic transaction detail / receipt modal. Works for every category that
// exists in `transactions` today (airtime_purchase, data, wallet_funding,
// wallet_debit). `view` is a normalized model from buildTransactionView();
// `user` is optional and only rendered in admin contexts.
export default function TransactionDetailModal({ view, user, onClose }) {
  if (!view) return null;

  const Icon = view.icon;

  const showNetwork = Boolean(view.network);
  const showPlan = Boolean(view.plan);
  const showPhone = Boolean(view.phone);
  const showProviderRef = Boolean(view.providerRef);

  return (
    <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2.5">
            <span
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${view.iconTheme}`}
            >
              <Icon className="w-5 h-5" />
            </span>
            Transaction Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User — only in admin contexts */}
        {user && (
          <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/50 p-4 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              User
            </p>
            {user.full_name && (
              <p className="text-sm font-bold text-slate-800">
                {user.full_name}
              </p>
            )}
            <div className="text-xs text-slate-500 mt-1 space-y-0.5">
              {user.email && <p>{user.email}</p>}
              {user.username && <p>@{user.username}</p>}
              {user.phone && <p>{user.phone}</p>}
            </div>
          </div>
        )}

        {/* Amount + status */}
        <div className="flex flex-col items-center text-center mb-4">
          <p
            className={`text-3xl font-black tracking-tight ${view.amountColor}`}
          >
            {view.amountLabel}
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold mt-2 ${view.statusBadge}`}
          >
            {view.statusLabel}
          </span>
          <p className="text-xs text-slate-400 mt-2">{view.dateLabel}</p>
        </div>

        {/* Receipt rows */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <Row label="Type" value={view.title} />
          {showNetwork && <Row label="Network" value={view.network} />}
          {showPlan && (
            <Row
              label={view.category === "data" ? "Data plan" : "Plan"}
              value={view.plan}
            />
          )}
          {showPhone && <Row label="Recipient phone" value={view.phone} />}
          {view.category === "airtime_purchase" && view.faceValue != null && (
            <Row label="Airtime" value={formatNaira(view.faceValue)} />
          )}
          <Row
            label={view.credit ? "Amount credited" : "Amount paid"}
            value={formatNaira(view.amount)}
          />
          {view.balanceBefore != null && (
            <Row
              label="Balance before"
              value={formatNaira(view.balanceBefore)}
            />
          )}
          {view.balanceAfter != null && (
            <Row label="Balance after" value={formatNaira(view.balanceAfter)} />
          )}
          {view.description && <Row label="Details" value={view.description} />}
          <ReferenceRow value={view.reference} />
          {showProviderRef && (
            <Row label="Provider reference" value={String(view.providerRef)} />
          )}
        </div>

        {/* Provider response — kept low-level and collapsible, never the default */}
        {view.providerResponse && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Provider response
            </p>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-500 break-word">
              {view.providerResponse}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-linear-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold py-3 hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </GlassCard>
    </div>
  );
}
