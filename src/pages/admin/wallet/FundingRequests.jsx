import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  Check,
  X,
} from "lucide-react";
import supabase from "../../../lib/supabaseClient";
import GlassCard from "../../../components/ui/GlassCard";
import { formatNaira, smartDate } from "../../../lib/transactionView";

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processed", label: "Processed" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_META = {
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-700" },
  processed: { label: "Processed", badge: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", badge: "bg-red-100 text-red-600" },
};

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function moneyOrDash(value) {
  if (value === null || value === undefined || value === "") return "—";
  return formatNaira(value);
}

function StatusIcon({ status }) {
  if (status === "processed") {
    return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
  }
  if (status === "rejected") {
    return <XCircle className="w-4 h-4 text-red-500" />;
  }
  return <Clock className="w-4 h-4 text-amber-500" />;
}

function Avatar({ row }) {
  const p = row.profiles || {};
  return (
    <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
      {initials(p.full_name, p.email)}
    </div>
  );
}

function UserInfo({ row }) {
  const p = row.profiles || {};
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-slate-800 truncate">
        {p.full_name || "Unknown user"}
      </p>
      <p className="text-xs text-slate-500 truncate">
        {p.email || (p.username ? `@${p.username}` : "") || ""}
      </p>
    </div>
  );
}

export default function FundingRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef(null);

  const [pendingCount, setPendingCount] = useState(0);

  const [approveTarget, setApproveTarget] = useState(null);
  const [creditedAmount, setCreditedAmount] = useState("");
  const [approveRef, setApproveRef] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchRequests = async () => {
    try {
      const { data, error: err } = await supabase
        .from("funding_requests")
        .select(
          "id, user_id, amount, reference, status, rejection_reason, processed_at, created_at, profiles!funding_requests_user_id_fkey(full_name, email, username, phone)",
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (err) throw err;
      setRows(data || []);
    } catch (err) {
      console.error("Failed to fetch funding requests:", err);
      setError("Could not load funding requests. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const { count, error: err } = await supabase
        .from("funding_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (err) throw err;
      setPendingCount(count || 0);
    } catch {
      setPendingCount(0);
    }
  };

  const loadAll = () => {
    fetchRequests();
    fetchPendingCount();
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch((searchInput || "").trim().toLowerCase());
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const visibleRows = useMemo(() => {
    let list = rows;
    if (filter) list = list.filter((r) => r.status === filter);
    if (debouncedSearch) {
      list = list.filter((r) => {
        const p = r.profiles || {};
        const userBits = [p.full_name, p.email, p.username, p.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          userBits.includes(debouncedSearch) ||
          (r.reference || "").toLowerCase().includes(debouncedSearch)
        );
      });
    }
    return list;
  }, [rows, filter, debouncedSearch]);

  const openApprove = (row) => {
    setApproveTarget(row);
    setCreditedAmount(row.amount ?? "");
    setApproveRef(row.reference || "");
    setActionError("");
  };

  const openReject = (row) => {
    setRejectTarget(row);
    setRejectReason("");
    setActionError("");
  };

  const closeModals = () => {
    setApproveTarget(null);
    setRejectTarget(null);
    setActing(false);
    setActionError("");
  };

  const performApprove = async () => {
    if (!approveTarget || acting) return;

    const parsedAmount = Number(creditedAmount || 0);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setActionError("Enter a valid amount to credit.");
      return;
    }
    if (!approveRef.trim()) {
      setActionError("Enter a payment reference for the transaction.");
      return;
    }

    setActing(true);
    setActionError("");

    try {
      const { data, error: err } = await supabase.rpc(
        "admin_process_funding_request",
        {
          p_funding_request_id: approveTarget.id,
          p_credited_amount: parsedAmount,
          p_reference: approveRef.trim(),
          p_description: "Wallet funding",
        },
      );

      if (err) throw err;

      const newBalance = data?.new_balance;
      setNotice(
        `Request approved. ${formatNaira(parsedAmount)} credited and the transaction was recorded.${
          newBalance != null ? ` New balance: ${formatNaira(newBalance)}.` : ""
        }`,
      );
      closeModals();
      loadAll();
    } catch (err) {
      setActionError(
        err?.message || "Approval failed. Please try again.",
      );
    } finally {
      setActing(false);
    }
  };

  const performReject = async () => {
    if (!rejectTarget || acting) return;

    if (!rejectReason.trim()) {
      setActionError("Enter a reason for the rejection.");
      return;
    }

    setActing(true);
    setActionError("");

    try {
      const { error: err } = await supabase.rpc("admin_reject_funding_request", {
        p_funding_request_id: rejectTarget.id,
        p_reason: rejectReason.trim(),
      });

      if (err) throw err;

      setNotice("Request rejected. No wallet credit was made.");
      closeModals();
      loadAll();
    } catch (err) {
      setActionError(err?.message || "Rejection failed. Please try again.");
    } finally {
      setActing(false);
    }
  };

  const statusMeta = (status) =>
    STATUS_META[status] || {
      label: status || "Pending",
      badge: "bg-slate-100 text-slate-600",
    };

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="p-7 rounded-3xl bg-linear-to-br from-indigo-900 via-purple-800 to-fuchsia-700 shadow-xl shadow-purple-900/20 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[80px] opacity-60 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-purple-200 uppercase tracking-widest font-semibold">
              Admin Console
            </p>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Funding Requests
            </h1>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold px-4 py-1.5 backdrop-blur">
            <Wallet className="w-4 h-4" />
            {pendingCount} pending
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by user or reference"
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-200 bg-white text-sm outline-none transition-colors focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
        />
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`shrink-0 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
              filter === key
                ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 border-transparent text-white shadow-[0_6px_18px_rgba(236,72,153,0.25)]"
                : "bg-white border-slate-200 text-slate-600 hover:border-fuchsia-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
        </div>
      )}

      {error ? (
        <GlassCard className="p-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </GlassCard>
      ) : loading ? (
        <GlassCard className="divide-y divide-fuchsia-50/80">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="w-16 h-5 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </GlassCard>
      ) : visibleRows.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Wallet className="w-6 h-6 text-slate-400 stroke-[2.5]" />
          </div>
          <p className="text-base font-bold text-slate-700">
            No funding requests found
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Try a different status or search combination.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="divide-y divide-fuchsia-50/80">
          {visibleRows.map((row) => {
            const meta = statusMeta(row.status);
            const isPending = row.status === "pending";
            return (
              <div key={row.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar row={row} />
                    <UserInfo row={row} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-800">
                      {moneyOrDash(row.amount)}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}
                    >
                      <StatusIcon status={row.status} />
                      {meta.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2.5 pl-[52px]">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">
                      Submitted {smartDate(row.created_at)}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Reference:{" "}
                      <span className="font-semibold text-slate-600">
                        {row.reference || "—"}
                      </span>
                    </p>
                    {row.status === "rejected" && row.rejection_reason && (
                      <p className="text-[11px] text-red-500 truncate">
                        Reason: {row.rejection_reason}
                      </p>
                    )}
                  </div>

                  {isPending && (
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openApprove(row)}
                        className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-emerald-600 to-emerald-500 text-white text-xs font-bold px-4 py-2 hover:brightness-110 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => openReject(row)}
                        className="flex items-center gap-1.5 rounded-xl bg-red-500 text-white text-xs font-bold px-4 py-2 hover:bg-red-600 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </GlassCard>
      )}

      {/* Approve modal */}
      {approveTarget && (
        <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Approve Funding Request</h2>
              <button
                type="button"
                onClick={closeModals}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/50 p-4 mb-4 space-y-1">
              <p className="text-sm font-bold text-slate-800">
                {approveTarget.profiles?.full_name || "Unknown user"}
              </p>
              <p className="text-xs text-slate-500">
                {approveTarget.profiles?.email || ""}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  Amount requested
                </span>
                <span className="text-sm font-black text-slate-800">
                  {moneyOrDash(approveTarget.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Reference</span>
                <span className="text-sm font-semibold text-slate-700">
                  {approveTarget.reference || "—"}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-bold text-slate-700 block mb-2">
                Amount to credit
              </label>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={creditedAmount}
                onChange={(e) => setCreditedAmount(e.target.value)}
                className="w-full rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              />
            </div>

            <div className="mb-4">
              <label className="text-sm font-bold text-slate-700 block mb-2">
                Payment reference (transaction)
              </label>
              <input
                value={approveRef}
                onChange={(e) => setApproveRef(e.target.value)}
                placeholder="Bank reference or unique identifier"
                className="w-full rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              />
            </div>

            {actionError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 mb-4">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModals}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={performApprove}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-emerald-500 text-white font-bold hover:brightness-110 disabled:opacity-50"
              >
                {acting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve & Credit
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Reject Funding Request</h2>
              <button
                type="button"
                onClick={closeModals}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/50 p-4 mb-4 space-y-1">
              <p className="text-sm font-bold text-slate-800">
                {rejectTarget.profiles?.full_name || "Unknown user"}
              </p>
              <p className="text-xs text-slate-500">
                {rejectTarget.profiles?.email || ""}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  Amount requested
                </span>
                <span className="text-sm font-black text-slate-800">
                  {moneyOrDash(rejectTarget.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Reference</span>
                <span className="text-sm font-semibold text-slate-700">
                  {rejectTarget.reference || "—"}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-bold text-slate-700 block mb-2">
                Reason for rejection
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Payment not received"
                className="w-full rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              />
            </div>

            {actionError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 mb-4">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModals}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={performReject}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {acting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Reject Request
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}