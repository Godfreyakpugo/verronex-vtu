import { useState, useEffect, useRef } from "react";
import {
  Search,
  Wallet,
  Clock,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import supabase from "../../lib/supabaseClient";
import GlassCard from "../../components/ui/GlassCard";

function AdminPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

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

  const latestSearch = useRef(0);
  const searchRef = useRef(null);

  const fetchRecentActions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, profiles(full_name, email)")
        .eq("category", "wallet_funding")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setRecentActions(data || []);
    } catch (err) {
      console.error("Failed to fetch recent credits:", err);

      setRecentActions([]);
    }
  };

  useEffect(() => {
    fetchRecentActions();
  }, []);

  // Click outside closes search dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchResults([]);
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchUsers = async (value) => {
    setSearchTerm(value);
    setSearchError(null);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setTargetUser(null);
      setTargetWallet(null);
      return;
    }

    const requestId = ++latestSearch.current;

    setSearching(true);

    try {
      const { data, error } = await supabase.rpc("search_users", {
        search_term: value.trim(),
      });

      // Ignore stale responses
      if (requestId !== latestSearch.current) return;

      if (error) throw error;

      setSearchResults(data || []);
      setShowResults(true);
    } catch (err) {
      if (requestId !== latestSearch.current) return;

      setSearchError(err.message);
      setSearchResults([]);
      setShowResults(false);
    } finally {
      if (requestId === latestSearch.current) {
        setSearching(false);
      }
    }
  };

  const selectUser = async (user) => {
    setTargetUser(user);
    setSearchTerm(user.username || user.full_name || user.email);
    setShowResults(false);
    setSearchResults([]);

    setSearchError(null);
    setCreditError(null);
    setCreditSuccess(null);

    // PATCH 11: Fetch the full wallet row instead of relying on search balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setTargetWallet(wallet ?? { balance: user.balance });
  };

  const handleCredit = async () => {
    // PATCH 10: Guard against null targetUser
    if (!targetUser) return;
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

      const { data: updatedWallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", targetUser.id)
        .single();

      if (walletError) throw walletError;

      setTargetWallet(updatedWallet);

      setCreditSuccess({
        amount: parsed,
        newBalance: updatedWallet.balance,
      });

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
              Wallet Management
            </h1>
          </div>
        </div>
      </div>

      {/* Search */}
      <GlassCard className="p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4">Find User</h2>
        <div className="flex gap-3" ref={searchRef}>
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            {searching && (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-600 animate-spin" />
            )}
            <input
              type="text"
              placeholder="Search by name, username, phone or email"
              value={searchTerm}
              onChange={(e) => searchUsers(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchResults([]);
                  setShowResults(false);
                }
                if (
                  e.key === "Enter" &&
                  searchResults.length > 0 &&
                  !targetUser
                ) {
                  e.preventDefault();
                  selectUser(searchResults[0]);
                }
              }}
              disabled={crediting}
              className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-10 pr-10 py-3 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {searchTerm.trim() !== "" &&
              showResults &&
              (searchResults.length > 0 || searching) && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-fuchsia-100 max-h-80 overflow-y-auto z-50">
                  {searching && (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </div>
                  )}

                  {!searching &&
                    searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => selectUser(user)}
                        className="w-full text-left p-4 hover:bg-fuchsia-50 transition"
                      >
                        <div className="font-bold text-slate-800">
                          {user.full_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          @{user.username || "no-username"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {user.email}
                        </div>
                        <div className="text-xs text-slate-400">
                          {user.phone}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-fuchsia-600">
                          ₦{Number(user.balance).toLocaleString("en-NG")}
                        </div>
                      </button>
                    ))}

                  {!searching &&
                    searchTerm.trim() !== "" &&
                    searchResults.length === 0 &&
                    !searchError && (
                      <div className="py-6 text-center text-sm text-slate-500">
                        No matching users found.
                      </div>
                    )}
                </div>
              )}
          </div>
        </div>
        {searchError && (
          <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-red-500 text-xs font-semibold">
              ⚠️ {searchError}
            </p>
          </div>
        )}
      </GlassCard>

      {targetUser && (
        <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-slate-800">
                {targetUser.full_name}
              </p>

              <p className="text-sm text-slate-500">
                @{targetUser.username || "no-username"}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Wallet Balance
              </p>

              <p className="text-xl font-black text-fuchsia-600">
                ₦{Number(targetWallet?.balance || 0).toLocaleString("en-NG")}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-semibold text-slate-700">Email</span>
              <p className="text-slate-500 break-all">{targetUser.email}</p>
            </div>

            <div>
              <span className="font-semibold text-slate-700">Phone</span>
              <p className="text-slate-500">{targetUser.phone || "—"}</p>
            </div>
          </div>
        </div>
      )}

      {targetUser && (
        <GlassCard className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-fuchsia-600" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Credit Wallet
              </h2>

              <p className="text-sm text-slate-500">
                Credit the selected user's wallet.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-600">
                Amount
              </label>

              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={crediting}
                placeholder="5000"
                className="mt-2 w-full bg-fuchsia-50 border border-fuchsia-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-600">
                Reference
              </label>

              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={crediting}
                placeholder="Bank reference"
                className="mt-2 w-full bg-fuchsia-50 border border-fuchsia-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {creditError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {creditError}
            </div>
          )}

          {creditSuccess && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Wallet credited successfully.
              <br />
              New Balance: ₦
              {Number(creditSuccess.newBalance).toLocaleString("en-NG")}
            </div>
          )}

          <button
            onClick={handleCredit}
            disabled={
              crediting ||
              !targetUser ||
              !amount ||
              Number(amount) <= 0 ||
              !reference.trim()
            }
            className="w-full rounded-2xl bg-linear-to-r from-fuchsia-600 to-purple-600 text-white font-bold py-4 shadow-lg shadow-fuchsia-500/25 hover:from-fuchsia-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {crediting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Crediting Wallet...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Credit Wallet
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </GlassCard>
      )}

      {/* PATCH 9: Recent credits always visible, not hidden when searchTerm is set */}
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
                    {new Intl.DateTimeFormat("en-NG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(tx.created_at))}
                  </p>
                </div>
                {/* PATCH 8: Safer number parsing to avoid NaN */}
                <p className="text-base font-black text-green-600">
                  +₦
                  {Number(tx.amount || 0).toLocaleString("en-NG", {
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
