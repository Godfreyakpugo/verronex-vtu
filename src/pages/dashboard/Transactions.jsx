import { useEffect, useRef, useState } from "react";
import { Search, Loader2, ReceiptText } from "lucide-react";
import supabase from "../../lib/supabaseClient";
import GlassCard from "../../components/ui/GlassCard";
import TransactionRow from "../../components/ui/TransactionRow";
import TransactionDetailModal from "../../components/ui/TransactionDetailModal";
import {
  buildTransactionView,
  sanitizeSearchTerm,
} from "../../lib/transactionView";
import SEO from "../../components/seo/SEO";

const PAGE_SIZE = 15;

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
];

export default function Transactions() {
  const [txs, setTxs] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const [selected, setSelected] = useState(null);

  const pageOffset = useRef(0);
  const latestReq = useRef(0);
  const debounceRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(sanitizeSearchTerm(searchInput));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  async function runQuery(offset, append, reqId) {
    const from = offset;
    const to = offset + PAGE_SIZE - 1;

    let query = supabase
      .from("transactions")
      .select("*", { count: "exact" });

    if (category) query = query.eq("category", category);

    if (status === "successful") {
      // wallet funding/debits are stored as 'completed'
      query = query.in("status", ["successful", "completed"]);
    } else if (status) {
      query = query.eq("status", status);
    }

    if (debouncedSearch) {
      const s = debouncedSearch;
      query = query.or(
        `reference.ilike.%${s}%,description.ilike.%${s}%,metadata->>phone_number.ilike.%${s}%`,
      );
    }

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, error: err, count: total } = await query;

    if (reqId !== latestReq.current) return; // stale response

    if (err) {
      setError("Could not load your transactions. Please try again.");
      if (!append) setTxs([]);
    } else {
      setTxs((prev) => (append ? [...prev, ...(data || [])] : data || []));
      setCount(total || 0);
    }

    if (append) setLoadingMore(false);
    else setLoading(false);
  }

  // Refetch on filter/search change
  useEffect(() => {
    const reqId = ++latestReq.current;
    pageOffset.current = 0;
    setLoading(true);
    setError("");
    runQuery(0, false, reqId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, status]);

  function handleLoadMore() {
    const nextOffset = pageOffset.current + PAGE_SIZE;
    const reqId = latestReq.current;
    pageOffset.current = nextOffset;
    setLoadingMore(true);
    runQuery(nextOffset, true, reqId);
  }

  const hasMore = txs.length < count;
  const views = txs.map(buildTransactionView);

  return (
    <div className="space-y-6">
      <SEO title="Transactions — Verronex VTU" robots="noindex, nofollow" canonical={null} />
      <header>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
          Transactions
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Your complete transaction history
        </p>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by reference, description or phone number"
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-200 bg-white text-sm outline-none transition-colors focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
        />
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORY_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
              category === key
                ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 border-transparent text-white shadow-[0_6px_18px_rgba(236,72,153,0.25)]"
                : "bg-white border-slate-200 text-slate-600 hover:border-fuchsia-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`shrink-0 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
              status === key
                ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 border-transparent text-white shadow-[0_6px_18px_rgba(236,72,153,0.25)]"
                : "bg-white border-slate-200 text-slate-600 hover:border-fuchsia-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <GlassCard className="p-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </GlassCard>
      ) : loading ? (
        <GlassCard className="divide-y divide-fuchsia-50/80">
          {[0, 1, 2, 3, 4].map((i) => (
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
      ) : views.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ReceiptText className="w-6 h-6 text-slate-400 stroke-[2.5]" />
          </div>
          <p className="text-base font-bold text-slate-700">
            {debouncedSearch || category || status
              ? "No transactions match your filters"
              : "No transactions yet"}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Your Airtime, Data and wallet activity will appear here.
          </p>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="divide-y divide-fuchsia-50/80">
            {views.map((view) => (
              <TransactionRow
                key={view.id}
                tx={view}
                onClick={() => setSelected(view)}
              />
            ))}
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
        view={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}