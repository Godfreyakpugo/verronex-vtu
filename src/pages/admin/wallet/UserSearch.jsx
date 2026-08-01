import { Search, Loader2 } from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function UserSearch({
  searchTerm,
  searching,
  searchError,
  showResults,
  searchResults,
  targetUser,
  disabled,
  searchRef,
  onSearchChange,
  onClearSearch,
  onSelectUser,
}) {
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClearSearch?.();
      return;
    }

    if (e.key === "Enter" && searchResults.length > 0 && !targetUser) {
      e.preventDefault();
      onSelectUser?.(searchResults[0]);
    }
  };

  return (
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
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
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
                      onClick={() => onSelectUser?.(user)}
                      className="w-full text-left p-4 hover:bg-fuchsia-50 transition"
                    >
                      <div className="font-bold text-slate-800">
                        {user.full_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        @{user.username || "no-username"}
                      </div>
                      <div className="text-xs text-slate-400">{user.email}</div>
                      <div className="text-xs text-slate-400">{user.phone}</div>
                      <div className="mt-2 text-sm font-semibold text-fuchsia-600">
                        ₦{formatMoney(user.balance)}
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
          <p className="text-red-500 text-xs font-semibold">⚠️ {searchError}</p>
        </div>
      )}
    </GlassCard>
  );
}

export default UserSearch;
