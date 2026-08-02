import { useState, useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import supabase from "../../../lib/supabaseClient";
import UserSearch from "./UserSearch";
import UserCard from "./UserCard";
import RecentWalletAdjustments from "./RecentWalletAdjustments";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import WalletAdjustment from "./WalletAdjustment";

function WalletManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const [targetUser, setTargetUser] = useState(null);
  const [targetWallet, setTargetWallet] = useState(null);

  const [searching, setSearching] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);

  const [searchError, setSearchError] = useState(null);
  const [creditError, setCreditError] = useState(null);
  const [creditSuccess, setCreditSuccess] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCredit, setPendingCredit] = useState(null);

  const [recentActions, setRecentActions] = useState([]);

  const latestSearch = useRef(0);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchRecentActions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, profiles(full_name, email)")
        .in("category", ["wallet_funding", "wallet_debit"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setRecentActions(data || []);
    } catch (err) {
      console.error("Failed to fetch recent wallet adjustments:", err);

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

  const clearSearchState = () => {
    setSearchResults([]);
    setShowResults(false);
    setSearchError(null);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);

    clearTimeout(debounceRef.current);

    if (targetUser && value !== searchTerm) {
      setTargetUser(null);
      setTargetWallet(null);
      setCreditError(null);
      setCreditSuccess(null);
    }

    clearSearchState();

    debounceRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  const normalizeSearchResults = (rows = []) =>
    rows.slice(0, 10).map((row) => ({
      id: row.id,
      full_name: row.full_name ?? row.fullName ?? row.name ?? "",
      username: row.username ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      balance: row.balance ?? row.wallet_balance ?? 0,
    }));

  const getUpdatedBalanceFromResult = (result) => {
    const possibleFields = [
      result?.updated_balance,
      result?.new_balance,
      result?.balance,
      result?.wallet_balance,
      result?.current_balance,
    ];

    const match = possibleFields.find(
      (value) => typeof value === "number" && Number.isFinite(value),
    );

    return match ?? null;
  };

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const searchUsers = async (value) => {
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

      setSearchResults(normalizeSearchResults(data || []));
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
    setWalletLoading(true);

    try {
      const { data: wallet, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Failed to fetch wallet for selected user:", error);
        setCreditError(error.message || "Could not load the user's wallet.");
        setTargetWallet(null);
        return;
      }

      setTargetWallet(wallet ?? { balance: user.balance });
    } finally {
      setWalletLoading(false);
    }
  };

  const performWalletAdjustment = async () => {
    if (!targetUser || !pendingCredit) return;

    setConfirmOpen(false);
    setCreditError(null);
    setCrediting(true);

    try {
      const isCredit = pendingCredit.mode === "credit";
      const rpc = isCredit ? "admin_credit_wallet" : "admin_debit_wallet";
      const amountKey = isCredit ? "credit_amount" : "debit_amount";
      const description =
        pendingCredit.reason?.trim() ||
        `Manual wallet ${pendingCredit.mode} by admin`;

      const { data: creditResult, error } = await supabase.rpc(rpc, {
        target_user_id: targetUser.id,
        [amountKey]: pendingCredit.amount,
        payment_reference: pendingCredit.reference,
        payment_description: description,
      });

      console.log("RPC:", rpc);
      console.log("Result:", creditResult);
      console.log("Error object:", error);
      console.log("Error message:", error?.message);
      console.log("Error details:", error?.details);
      console.log("Error hint:", error?.hint);
      console.log("Error code:", error?.code);

      if (error) throw error;

      const updatedBalance = getUpdatedBalanceFromResult(creditResult);
      const resolvedBalance =
        updatedBalance ?? creditResult?.new_balance ?? creditResult?.balance;

      if (resolvedBalance !== null && resolvedBalance !== undefined) {
        setTargetWallet((currentWallet) => ({
          ...(currentWallet || {}),
          balance: resolvedBalance,
        }));

        setCreditSuccess({
          mode: pendingCredit.mode,
          amount: pendingCredit.amount,
          newBalance: resolvedBalance,
        });
      } else {
        const { data: updatedWallet, error: walletError } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", targetUser.id)
          .single();

        if (walletError) throw walletError;

        setTargetWallet(updatedWallet);

        setCreditSuccess({
          mode: pendingCredit.mode,
          amount: pendingCredit.amount,
          newBalance: updatedWallet.balance,
        });
      }

      setPendingCredit(null);
      await fetchRecentActions();

      setTimeout(() => {
        setTargetUser(null);
        setTargetWallet(null);
        setSearchTerm("");
      }, 1500);
    } catch (err) {
      setCreditError(err?.message || "Adjustment failed. Please try again.");
    } finally {
      setCrediting(false);
    }
  };

  const handleWalletAdjustment = ({ mode, amount, reference, reason }) => {
    if (!targetUser) return;
    if (crediting) return;

    if (!amount || amount <= 0) {
      setCreditError("Enter a valid amount.");
      return;
    }
    if (!reference.trim()) {
      setCreditError("Enter the transfer reference.");
      return;
    }

    setPendingCredit({
      mode,
      amount,
      reference: reference.trim(),
      reason: reason.trim(),
    });
    setConfirmOpen(true);
  };

  const isSearching = searchTerm.trim() !== "" && showResults;

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

      <UserSearch
        searchTerm={searchTerm}
        searching={searching}
        searchError={searchError}
        showResults={showResults}
        searchResults={searchResults}
        targetUser={targetUser}
        disabled={crediting}
        searchRef={searchRef}
        onSearchChange={handleSearch}
        onClearSearch={() => {
          setSearchResults([]);
          setShowResults(false);
        }}
        onSelectUser={selectUser}
      />

      {!isSearching && targetUser && (
        <UserCard
          targetUser={targetUser}
          targetWallet={targetWallet}
          walletLoading={walletLoading}
        />
      )}

      {!isSearching && targetUser && (
        <WalletAdjustment
          targetUser={targetUser}
          targetWallet={targetWallet}
          loading={crediting}
          onSubmit={handleWalletAdjustment}
        />
      )}

      {creditSuccess && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {creditSuccess.mode === "credit"
            ? "Wallet credited successfully."
            : "Wallet debited successfully."}
        </div>
      )}

      {!isSearching && (
        <RecentWalletAdjustments recentActions={recentActions} />
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Wallet Adjustment"
        message={`You are about to apply a ${pendingCredit?.mode === "credit" ? "credit" : "debit"} adjustment to:\n\nUser: ${targetUser?.full_name || "Selected user"}\n\nEmail: ${targetUser?.email || ""}\n\nCurrent Balance: ₦${formatMoney(targetWallet?.balance || 0)}\n\n${pendingCredit?.mode === "credit" ? "Credit" : "Debit"} Amount: ₦${formatMoney(pendingCredit?.amount || 0)}\n\nReference: ${pendingCredit?.reference || ""}\n\nPlease confirm this action.`}
        confirmText="Apply Adjustment"
        cancelText="Cancel"
        loading={crediting}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingCredit(null);
        }}
        onConfirm={performWalletAdjustment}
      />
    </div>
  );
}

export default WalletManagement;
