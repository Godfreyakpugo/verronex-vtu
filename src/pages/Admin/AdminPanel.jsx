import { useState, useEffect } from "react";
import { Search, Wallet, Clock, ArrowRight, ShieldCheck } from "lucide-react";
import supabase from "../../lib/supabaseClient";
import GlassCard from "../../components/ui/GlassCard";

function AdminPanel() {
  const [searchEmail, setSearchEmail] = useState("");
  const [targetUser, setTargetUser] = useState(null);
  const [targetWallet, setTargetWallet] = useState(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [searching, setSearching] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [creditError, setCreditError] = useState(null);
  const [creditSuccess, setCreditSuccess] = useState(null);
  const [recentActions, setRecentActions] = useState([]);

  const fetchRecentActions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*, profiles(full_name, email)")
      .eq("category", "wallet_funding")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setRecentActions(data);
  };

  useEffect(() => {
    fetchRecentActions();
  }, []);

  const handleSearch = async () => {
    if (!searchEmail) return;
    setSearching(true);
    setSearchError(null);
    setTargetUser(null);
    setTargetWallet(null);
    setCreditSuccess(null);
    setCreditError(null);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", searchEmail.trim().toLowerCase())
        .single();

      if (profileError || !profile) {
        setSearchError("No user found with that email address.");
        return;
      }

      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", profile.id)
        .single();

      if (walletError || !wallet) {
        setSearchError("User found but wallet is missing.");
        return;
      }

      setTargetUser(profile);
      setTargetWallet(wallet);
    } catch {
      setSearchError("Something went wrong. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleCredit = async () => {
    if (crediting) return;

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setCreditError("Enter a valid amount.");
      return;
    }
    if (!reference.trim()) {
      setCreditError("Enter the transfer reference.");
      return;
    }

    if (
      !window.confirm(
        `Credit ₦${parsed.toLocaleString("en-NG")} to ${targetUser.full_name || targetUser.email}?`,
      )
    ) {
      return;
    }

    setCreditError(null);
    setCrediting(true);

    try {
      const { data, error } = await supabase.rpc("admin_credit_wallet", {
        target_user_id: targetUser.id,
        credit_amount: parsed,
        payment_reference: reference.trim(),
        payment_description: "Manual wallet credit by admin",
      });

      if (error) throw error;

      setCreditSuccess({ amount: parsed, newBalance: data.new_balance });

      const { data: updatedWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", targetUser.id)
        .single();

      if (updatedWallet) {
        setTargetWallet(updatedWallet);
      }

      setAmount("");
      setReference("");
      await fetchRecentActions();
    } catch (err) {
      setCreditError(err?.message || "Credit failed. Please try again.");
    } finally {
      setCrediting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="p-7 rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-700 shadow-xl shadow-purple-900/20 relative overflow-hidden">
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
              Wallet Management
            </h1>
          </div>
        </div>
      </div>

      {/* Search */}
      <GlassCard className="p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4">Find User</h2>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              placeholder="Search by email address"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 active:scale-95 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-md shadow-fuchsia-500/30 transition-all disabled:opacity-50"
          >
            {searching ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {" "}
                Search <ArrowRight className="w-4 h-4" />{" "}
              </>
            )}
          </button>
        </div>
        {searchError && (
          <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-red-500 text-xs font-semibold">
              ⚠️ {searchError}
            </p>
          </div>
        )}
      </GlassCard>

      {/* User + Credit Card */}
      {targetUser && targetWallet && (
        <GlassCard className="p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                User Found
              </p>
              <p className="text-lg font-black text-slate-900">
                {targetUser.full_name ?? "—"}
              </p>
              <p className="text-sm text-slate-500">{targetUser.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Balance
              </p>
              <p className="text-2xl font-black text-fuchsia-600">
                ₦
                {parseFloat(targetWallet.balance).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          <div className="border-t border-fuchsia-100 pt-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Credit Wallet</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Amount (₦)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white px-4 py-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Transfer Reference
                </label>
                <input
                  type="text"
                  placeholder="Bank alert ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white px-4 py-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 transition-all"
                />
              </div>
            </div>

            {creditError && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-red-500 text-xs font-semibold">
                  ⚠️ {creditError}
                </p>
              </div>
            )}

            {creditSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-green-700 text-xs font-semibold">
                  ✅ ₦
                  {creditSuccess.amount.toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  credited successfully. New balance: ₦
                  {parseFloat(creditSuccess.newBalance).toLocaleString(
                    "en-NG",
                    { minimumFractionDigits: 2 },
                  )}
                </p>
              </div>
            )}

            <button
              onClick={handleCredit}
              disabled={crediting || !targetUser || !targetWallet}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 active:scale-95 text-white text-sm font-bold py-3.5 rounded-xl shadow-lg shadow-fuchsia-500/30 transition-all disabled:opacity-50"
            >
              {crediting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {" "}
                  <Wallet className="w-4 h-4" /> Credit Wallet{" "}
                </>
              )}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Recent Credits */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-slate-400" />
          <h2 className="text-base font-bold text-slate-900">Recent Credits</h2>
        </div>
        <GlassCard className="divide-y divide-fuchsia-50/80">
          {recentActions.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-400">No credits recorded yet</p>
            </div>
          ) : (
            recentActions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {tx.profiles?.full_name ?? tx.profiles?.email ?? "Unknown"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">
                    Ref: {tx.reference}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(tx.created_at).toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="text-base font-black text-green-600">
                  +₦
                  {parseFloat(tx.amount).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))
          )}
        </GlassCard>
      </div>
    </div>
  );
}

export default AdminPanel;
