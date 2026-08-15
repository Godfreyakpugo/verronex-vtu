// Shared transaction row used by the dashboard preview and the full history.
// `tx` must already be a normalized view from buildTransactionView().
function TransactionRow({ tx, onClick }) {
  if (!tx) return null;
  const Icon = tx.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-fuchsia-50/40 focus:outline-none focus-visible:bg-fuchsia-50/40"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.iconTheme}`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {tx.title}
        </p>
        {tx.subtitle && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{tx.subtitle}</p>
        )}
        <p className="text-[11px] text-slate-400 mt-0.5">
          {tx.smartDateLabel}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${tx.amountColor}`}>
          {tx.amountLabel}
        </p>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${tx.statusBadge}`}
        >
          {tx.statusLabel}
        </span>
      </div>
    </button>
  );
}

export default TransactionRow;