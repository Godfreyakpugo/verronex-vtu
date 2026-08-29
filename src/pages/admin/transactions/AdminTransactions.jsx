import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Users,
  History,
  Search,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import supabase from "../../../lib/supabaseClient";
import GlassCard from "../../../components/ui/GlassCard";
import TransactionDetailModal from "../../../components/ui/TransactionDetailModal";
import {
  buildTransactionView,
  sanitizeSearchTerm,
  formatNaira,
} from "../../../lib/transactionView";

const PAGE_SIZE = 20;

const CATEGORY_FILTERS = [
  { key: "", label: "All" },
  { key: "airtime_purchase", label: "Airtime" },
  { key: "data", label: "Data" },
  { key: "wallet_funding", label: "Funding" },
  { key: "wallet_debit", label: "Wallet" },
];

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "successful", label: "Successful" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
];

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function userFor(row) {
  return {
    full_name: row.user_full_name,
    email: row.user_email,
    username: row.user_username,
    phone: row.user_phone,
  };
}

export default function AdminTransactions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const [selected, setSelected] = useState(null);

  const offsetRef = useRef(0);
  const latestReq = useRef(0);
  const debounceRef = useRef(null);

  // Status change modal state
  const [statusChangeRow, setStatusChangeRow] = useState(null);
  const [targetStatus, setTargetStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [statusChanging, setStatusChanging] = useState(false);

  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(sanitizeSearchTerm(searchInput));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  async function runQuery(offset, append, reqId) {
    const { data, error: err } = await supabase.rpc("admin_get_transactions", {
      p_search: debouncedSearch || null,
      p_category: category || null,
      p_status: status || null,
      p_limit: PAGE_SIZE + 1,
      p_offset: offset,
    });

    if (reqId !== latestReq.current) return; // stale response

    if (err) {
      setError("Could not load transactions. Please try again.");
      if (!append) setRows([]);
      setHasMore(false);
    } else {
      const page = data || [];
      const more = page.length > PAGE_SIZE;
      const visible = more ? page.slice(0, PAGE_SIZE) : page;
      setRows((prev) => (append ? [...prev, ...visible] : visible));
      setHasMore(more);
      offsetRef.current = offset;
    }

    if (append) setLoadingMore(false);
    else setLoading(false);
  }

  useEffect(() => {
    const reqId = ++latestReq.current;
    offsetRef.current = 0;
    setLoading(true);
    setError("");
    runQuery(0, false, reqId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, status]);

  function handleLoadMore() {
    const next = offsetRef.current + PAGE_SIZE;
    const reqId = latestReq.current;
    setLoadingMore(true);
    runQuery(next, true, reqId);
  }

  const showRefundAction = (view) => view.category === "wallet_debit";

  const isStatusChangeEligible = (view) => {
    // Eligible: debit VTU transactions (data, airtime, wallet_debit) with status that can be toggled
    // Allow pending/successful/completed/failed to be set to successful/failed
    const eligibleCategories = ["data", "airtime_purchase", "wallet_debit"];
    const eligibleStatuses = ["successful", "completed", "failed", "pending"];
    return eligibleCategories.includes(view.category) && eligibleStatuses.includes(view.status);
  };

  async function showConfirmModal(title, onConfirm) {
    const reason = window.prompt("Enter reason for this action:");
    if (reason == null || reason.trim() === "") {
      // User cancelled or entered empty reason
      return;
    }
    onConfirm(reason.trim());
  }

  async function refundTransaction(row) {
    showConfirmModal("Refund Transaction", async (reason) => {
      setActionError("");
      try {
        const { error: err } = await supabase.rpc("admin_refund_transaction", {
          p_transaction_id: row.id,
          p_reason: reason,
        });

        if (err) throw err;

        // Refresh data
        await runQuery(0, false, ++latestReq.current);

        setSelected(null);
        setNotice(
          `Transaction refunded. ₹${row.amount} credited back to wallet.`,
        );
      } catch (err) {
        setActionError(
          err?.message || "Failed to refund transaction. Please try again.",
        );
      }
    });
  }

  function openStatusChange(row) {
    setActionError("");
    setStatusChangeRow(row);
    setTargetStatus("");
    setStatusReason("");
  }

  function closeStatusChange() {
    if (statusChanging) return;
    setStatusChangeRow(null);
    setTargetStatus("");
    setStatusReason("");
    setActionError("");
  }

  async function performStatusChange() {
    if (!statusChangeRow || statusChanging) return;
    if (!["successful", "failed"].includes(targetStatus)) {
      setActionError("Select a target status: successful or failed.");
      return;
    }

    // Warning confirmation for financial actions
    const amountLabel = formatNaira(statusChangeRow.amount);
    const currentView = buildTransactionView(statusChangeRow);
    const currentStatus = currentView?.status || statusChangeRow.status;

    // If same status, no financial action but still confirm
    if (currentStatus === targetStatus || (currentStatus === "completed" && targetStatus === "successful")) {
      setActionError("Transaction is already in that status.");
      return;
    }

    const trimmedReason = statusReason.trim();
    let confirmMsg;
    if (targetStatus === "failed") {
      confirmMsg = `Changing this transaction to Failed will refund ${amountLabel} to the customer's wallet.\n\nCurrent: ${currentStatus}\nNew: failed\nAmount: ${amountLabel}\n\nThis refund will happen ONLY ONCE. A second change to failed will not refund again.${trimmedReason ? `\n\nReason: ${trimmedReason}` : ""}\n\nConfirm?`;
    } else {
      confirmMsg = `Changing this transaction to Successful will NOT debit the customer's wallet again.\n\nCurrent: ${currentStatus}\nNew: successful\nAmount: ${amountLabel}\n\nNo additional charge will be made. Status will be set to successful.${trimmedReason ? `\n\nReason: ${trimmedReason}` : ""}\n\nConfirm?`;
    }

    if (!window.confirm(confirmMsg)) return;

    setStatusChanging(true);
    setActionError("");
    try {
      const { data, error: err } = await supabase.rpc(
        "admin_set_transaction_status",
        {
          p_transaction_id: statusChangeRow.id,
          p_new_status: targetStatus,
          p_reason: trimmedReason || null,
        },
      );

      if (err) throw err;

      // Refresh data
      await runQuery(0, false, ++latestReq.current);

      setSelected(null);
      closeStatusChange();

      const refunded = data?.refunded;
      const newBal = data?.new_balance;
      if (targetStatus === "failed" && refunded) {
        setNotice(
          `Transaction marked as failed. ${amountLabel} refunded to wallet.${newBal != null ? ` New balance: ${formatNaira(newBal)}.` : ""}`,
        );
      } else if (targetStatus === "failed") {
        setNotice(`Transaction marked as failed. No additional refund (already refunded).`);
      } else {
        setNotice(`Transaction marked as successful. No wallet debit.`);
      }
    } catch (err) {
      setActionError(
        err?.message || "Failed to update transaction status. Please try again.",
      );
    } finally {
      setStatusChanging(false);
    }
  }

  useEffect(() => {
    const noticeTimeout = setTimeout(() => {
      setNotice("");
    }, 5000);
    return () => clearTimeout(noticeTimeout);
  }, [notice]);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="p-7 rounded-3xl bg-linear-to-br from-indigo-900 via-purple-800 to-fuchsia-700 shadow-xl shadow-purple-900/20 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[80px] opacity-60 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center">
            <History className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-purple-200 uppercase tracking-widest font-semibold">
              Admin Console
            </p>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Transactions
            </h1>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by user, reference or phone number"
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-200 bg-white text-sm outline-none transition-colors focus:border-fuchsia-400 focus:ring-visible:ring-2 focus:ring-fuchsia-100"
        />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORY_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`shrink-0 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                category === key
                  ? "bg-linear-to-r from-indigo-600 to-fuchsia-600 border-transparent text-white shadow-[0_6px_18px_rgba(236,72,153,0.25)]"
                  : "bg-white border-slate-200 text-slate-600 hover:border-fuchsia-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={`shrink-0 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                status === key
                  ? "bg-linear-to-r from-indigo-600 to-fuchsia-600 border-transparent text-white shadow-[0_6px_18px_rgba(236,72,153,0.25)]"
                  : "bg-white border-slate-200 text-slate-600 hover:border-fuchsia-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <GlassCard className="p-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </GlassCard>
      ) : loading ? (
        <GlassCard className="divide-y divide-fuchsia-50/80">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="w-16 h-5 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </GlassCard>
      ) : rows.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Users className="w-6 h-6 text-slate-400 stroke-[2.5]" />
          </div>
          <p className="text-base font-bold text-slate-700">
            No transactions found
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Try a different search or filter combination.
          </p>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="divide-y divide-fuchsia-50/80">
            {rows.map((row) => {
              const view = buildTransactionView(row);
              const Icon = view.icon;
              const canRefund = showRefundAction(view);
              const canStatusChange = isStatusChangeEligible(view);

              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelected({ view, row })}
                  className="w-full text-left p-4 transition-colors hover:bg-fuchsia-50/40 focus:outline-none focus-visible:bg-fuchsia-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(row.user_full_name, row.user_email)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {row.user_full_name || "Unknown user"}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {row.user_email ||
                            (row.user_username
                              ? `@${row.user_username}`
                              : "") ||
                            row.user_phone ||
                            ""}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-sm font-bold shrink-0 ${view.amountColor}`}
                    >
                      {view.amountLabel}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-2.5 pl-13">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${view.iconTheme}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          {view.title}
                          {view.subtitle ? ` • ${view.subtitle}` : ""}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {view.smartDateLabel}
                          {" • "}
                          {view.reference}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${view.statusBadge}`}
                    >
                      {view.statusLabel}
                    </span>
                  </div>

                  {/* Action buttons — appear based on transaction category */}
                  {(canRefund || canStatusChange) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canRefund && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            refundTransaction(row);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              refundTransaction(row);
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold px-3 py-1.5 hover:brightness-110 transition-all cursor-pointer"
                        >
                          <XCircle className="w-3 h-3" />
                          Refund
                        </span>
                      )}
                      {canStatusChange && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            openStatusChange(row);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              openStatusChange(row);
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 hover:brightness-110 transition-all cursor-pointer"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          Change Status
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </GlassCard>

          {hasMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-fuchsia-200 bg-white text-fuchsia-700 font-semibold py-3 hover:border-fuchsia-400 hover:bg-fuchsia-50 transition-all disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </button>
          )}
        </>
      )}

      <TransactionDetailModal
        view={selected?.view}
        user={selected ? userFor(selected.row) : null}
        onClose={() => setSelected(null)}
      />

      {/* Status Change Modal */}
      {statusChangeRow && (
        <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-indigo-600" />
                Change Transaction Status
              </h2>
              <button
                type="button"
                onClick={closeStatusChange}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const view = buildTransactionView(statusChangeRow);
              return (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 mb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Current status</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${view.statusBadge}`}>
                      {view.statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Amount</span>
                    <span className="text-sm font-black text-slate-800">{formatNaira(statusChangeRow.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Reference</span>
                    <span className="text-xs font-mono text-slate-700 truncate max-w-[150px]">{statusChangeRow.reference}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">User</span>
                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">{statusChangeRow.user_full_name || statusChangeRow.user_email}</span>
                  </div>
                </div>
              );
            })()}

            <div className="mb-4">
              <label className="text-sm font-bold text-slate-700 block mb-2">New Status</label>
              <div className="grid grid-cols-2 gap-2">
                {["successful", "failed"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTargetStatus(s)}
                    className={`px-4 py-3 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                      targetStatus === s
                        ? s === "failed"
                          ? "bg-red-50 border-red-300 text-red-700 shadow-sm"
                          : "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-bold text-slate-700 block mb-2">Reason <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder={
                  targetStatus === "failed"
                    ? "e.g. Provider confirmed failure, refund required (optional)"
                    : targetStatus === "successful"
                      ? "e.g. Provider confirmed delivery, mark successful (optional)"
                      : "Enter reason for status change (optional)"
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            {/* Warning */}
            {targetStatus === "failed" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                  Changing to <span className="font-black">Failed</span> will refund{" "}
                  <span className="font-black">{formatNaira(statusChangeRow.amount)}</span> to the customer&apos;s wallet. This refund happens only once — a second change to failed will not refund again.
                </p>
              </div>
            )}
            {targetStatus === "successful" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-emerald-800 leading-relaxed">
                  Changing to <span className="font-black">Successful</span> will <span className="font-black">NOT</span> debit the wallet again. No new charge will be created.
                </p>
              </div>
            )}

            {actionError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 mb-4">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeStatusChange}
                disabled={statusChanging}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusChanging || !targetStatus}
                onClick={performStatusChange}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {statusChanging ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUpDown className="w-4 h-4" />
                )}
                Update Status
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Notification / action feedback area */}
      {notice && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-emerald-700">{notice}</p>
          </div>
        </div>
      )}

      {actionError && !statusChangeRow && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-600">{actionError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
