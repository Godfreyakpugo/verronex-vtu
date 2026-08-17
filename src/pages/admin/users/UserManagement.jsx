import { useEffect, useMemo, useState } from "react";
import { Users, Loader2, PieChart } from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import supabase from "../../../lib/supabaseClient";
import UserFilters from "./UserFilters";
import UserListItem from "./UserListItem";

const TIER_LABELS = {
  basic: "Basic",
  agent: "Agent",
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
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

  // Aggregated active-user counts by tier (excludes deactivated accounts)
  const fetchSummary = async () => {
    setSummaryLoading(true);

    const { data, error } = await supabase.rpc("admin_get_user_summary");

    if (error) {
      console.error("Error fetching user summary:", error);
    } else {
      setSummary(data || []);
    }
    setSummaryLoading(false);
  };

  useEffect(() => {
    let active = true;

    // Initial load — fully async so no setState runs synchronously inside
    // the effect body. The loading flags start as true via useState.
    const load = async () => {
      const [usersRes, summaryRes] = await Promise.all([
        supabase.rpc("admin_get_users"),
        supabase.rpc("admin_get_user_summary"),
      ]);
      if (!active) return;
      if (usersRes.error) {
        console.error("Error fetching users:", usersRes.error);
      } else {
        setUsers(usersRes.data || []);
      }
      if (summaryRes.error) {
        console.error("Error fetching user summary:", summaryRes.error);
      } else {
        setSummary(summaryRes.data || []);
      }
      setLoading(false);
      setSummaryLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const totalUsers = useMemo(
    () => summary.reduce((sum, row) => sum + Number(row.active_count || 0), 0),
    [summary],
  );

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

      {/* User Summary */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white shrink-0">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-slate-900">User Summary</h2>
            <p className="text-sm text-slate-500">
              Live counts of active users.
            </p>
          </div>
        </div>

        {summaryLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin w-6 h-6 text-fuchsia-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-linear-to-br from-indigo-600 to-fuchsia-600 text-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-white/80">
                Total Users
              </p>
              <p className="text-3xl font-black mt-1">
                {totalUsers.toLocaleString("en-NG")}
              </p>
            </div>

            {summary.map((row) => (
              <div
                key={row.user_tier || "unknown"}
                className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 p-5"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {TIER_LABELS[row.user_tier] || row.user_tier}
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {Number(row.active_count || 0).toLocaleString("en-NG")}
                </p>
              </div>
            ))}
          </div>
        )}
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
              onUserUpdated={() => {
                fetchUsers();
                fetchSummary();
              }}
            />
          ))
        )}
      </GlassCard>
    </div>
  );
}
