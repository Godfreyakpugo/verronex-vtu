import { useEffect, useMemo, useState } from "react";
import { Users, Loader2 } from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import supabase from "../../../lib/supabaseClient";
import UserFilters from "./UserFilters";
import UserListItem from "./UserListItem";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  // REAL SUPABASE FETCH: Using your RPC to get profiles + wallets
  const fetchUsers = async () => {
    setLoading(true);

    const { data, error } = await supabase.rpc("admin_get_users");

    if (error) {
      console.error("Error fetching users:", error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const role = user.is_admin
        ? "admin"
        : user.user_tier?.toLowerCase() || "basic";
      const matchesFilter = filter === "all" ? true : role === filter;

      const q = search.toLowerCase();
      const matchesSearch =
        user.full_name?.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q) ||
        user.phone?.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [users, search, filter]);

  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                User Management
              </h1>
              <p className="text-sm text-slate-500">
                View, search, and promote users.
              </p>
            </div>
          </div>

          <UserFilters
            search={search}
            filter={filter}
            onSearchChange={setSearch}
            onFilterChange={setFilter}
          />
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {/* Responsive Table Headers */}
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:grid-cols-5 gap-2 md:gap-4 bg-slate-100 px-4 md:px-6 py-4 text-[9px] md:text-xs uppercase font-bold tracking-wider text-slate-500">
          <div>User</div>
          <div>Role / Plan</div>
          <div>Balance</div>
          <div>Joined</div>
          <div></div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="animate-spin w-8 h-8 text-fuchsia-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            No users match your criteria.
          </div>
        ) : (
          filteredUsers.map((user) => (
            <UserListItem
              key={user.id}
              user={user}
              expanded={expandedId === user.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === user.id ? null : user.id)
              }
              onUserUpdated={fetchUsers}
            />
          ))
        )}
      </GlassCard>
    </div>
  );
}
