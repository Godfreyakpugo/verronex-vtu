import { useEffect, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import supabase from "../../../lib/supabaseClient";
import GlassCard from "../../../components/ui/GlassCard";
import Toast from "../../../components/ui/Toast";

const PERIOD_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "custom", label: "Custom Range" },
];

function formatNaira(amount) {
  const value = Number(amount) || 0;
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateForInput(date) {
  return date.toISOString().split("T")[0];
}

function getTodayLagos() {
  const now = new Date();
  const lagosOffset = 60;
  const lagosTime = new Date(now.getTime() + lagosOffset * 60 * 1000);
  return new Date(lagosTime.getFullYear(), lagosTime.getMonth(), lagosTime.getDate());
}

export default function AccountingPage() {
  const [period, setPeriod] = useState("30d");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = getTodayLagos();
    d.setDate(d.getDate() - 29);
    return formatDateForInput(d);
  });
  const [customTo, setCustomTo] = useState(() => formatDateForInput(getTodayLagos()));

  const [summary, setSummary] = useState({
    sales: 0,
    profit: 0,
    transactions: 0,
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const computeDateRange = () => {
    const today = getTodayLagos();
    const to = new Date(today);

    switch (period) {
      case "today":
        return { from: formatDateForInput(today), to: formatDateForInput(today) };
      case "yesterday": {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        return { from: formatDateForInput(y), to: formatDateForInput(y) };
      }
      case "7d": {
        const f = new Date(today);
        f.setDate(f.getDate() - 6);
        return { from: formatDateForInput(f), to: formatDateForInput(to) };
      }
      case "30d": {
        const f = new Date(today);
        f.setDate(f.getDate() - 29);
        return { from: formatDateForInput(f), to: formatDateForInput(to) };
      }
      case "custom":
        return { from: customFrom, to: customTo };
      default:
        return { from: formatDateForInput(today), to: formatDateForInput(today) };
    }
  };

  const loadAccounting = async () => {
    setLoading(true);
    setError("");

    const { from, to } = computeDateRange();

    try {
      const { data, error: err } = await supabase.rpc("admin_get_daily_accounting", {
        p_from_date: from,
        p_to_date: to,
      });

      if (err) throw err;

      const rowsData = data || [];
      setRows(rowsData);

      const totals = rowsData.reduce(
        (acc, r) => ({
          sales: acc.sales + Number(r.sales || 0),
          profit: acc.profit + Number(r.profit || 0),
          transactions: acc.transactions + Number(r.successful_transactions || 0),
        }),
        { sales: 0, profit: 0, transactions: 0 }
      );

      setSummary(totals);
    } catch (err) {
      console.error("Accounting load error:", err);
      setError("Could not load accounting data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounting();
  }, [period, customFrom, customTo, loadAccounting]);

  const handlePeriodChange = (key) => {
    setPeriod(key);
  };

  const handleCustomFromChange = (e) => {
    setCustomFrom(e.target.value);
    if (period !== "custom") setPeriod("custom");
  };

  const handleCustomToChange = (e) => {
    setCustomTo(e.target.value);
    if (period !== "custom") setPeriod("custom");
  };

  const totalSales = summary.sales;
  const totalProfit = summary.profit;
  const totalTransactions = summary.transactions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-7 rounded-3xl bg-linear-to-br from-indigo-900 via-purple-800 to-fuchsia-700 shadow-xl shadow-purple-900/20 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[80px] opacity-60 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-purple-200 uppercase tracking-widest font-semibold">
              Admin Console
            </p>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Accounting
            </h1>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast
        type={error ? "error" : null}
        title={error ? "Error" : null}
        message={error}
        onDismiss={() => setError("")}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Today's Sales</p>
              <p className="text-xl font-black text-slate-900">{formatNaira(totalSales)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Today's Profit</p>
              <p className="text-xl font-black text-slate-900">{formatNaira(totalProfit)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Successful Txns</p>
              <p className="text-xl font-black text-slate-900">{totalTransactions.toLocaleString()}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Date Filter */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700 shrink-0">Period:</span>
          <div className="flex flex-wrap gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handlePeriodChange(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  period === opt.key
                    ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-[0_4px_12px_rgba(236,72,153,0.3)]"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-fuchsia-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-3">
              <label className="text-xs text-slate-500">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={handleCustomFromChange}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-fuchsia-400"
                max={formatDateForInput(getTodayLagos())}
              />
              <label className="text-xs text-slate-500">To</label>
              <input
                type="date"
                value={customTo}
                onChange={handleCustomToChange}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-fuchsia-400"
                max={formatDateForInput(getTodayLagos())}
              />
            </div>
          )}
        </div>
      </GlassCard>

      {/* Daily Accounting Table */}
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Successful Txns</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => {
                if (loading) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (rows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No accounting data for the selected period.
                      </td>
                    </tr>
                  );
                }

                return rows.map((r) => (
                  <tr key={r.day} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {new Date(r.day + "T00:00:00").toLocaleDateString("en-NG", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">
                      {Number(r.successful_transactions || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">
                      {formatNaira(r.sales)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {formatNaira(r.cost)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">
                      {formatNaira(r.profit)}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-3 border-t border-slate-200">Total</td>
                <td className="px-4 py-3 text-right border-t border-slate-200">
                  {totalTransactions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right border-t border-slate-200">
                  {formatNaira(totalSales)}
                </td>
                <td className="px-4 py-3 text-right border-t border-slate-200 text-slate-600">
                  {formatNaira(totalSales - totalProfit)}
                </td>
                <td className="px-4 py-3 text-right border-t border-slate-200 text-emerald-700">
                  {formatNaira(totalProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}