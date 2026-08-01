import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import UserFilters from "./UserFilters";
import UsersTable from "./UsersTable";

const sampleUsers = [
  {
    id: 1,
    full_name: "Amina Yusuf",
    email: "amina@example.com",
    username: "amina",
    phone: "08012345678",
    created_at: "2024-01-15T10:30:00.000Z",
    wallet_balance: 250000,
    status: "active",
  },
  {
    id: 2,
    full_name: "Bola Johnson",
    email: "bola@example.com",
    username: "bola",
    phone: "09087654321",
    created_at: "2024-02-20T09:10:00.000Z",
    wallet_balance: 0,
    status: "inactive",
  },
];

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filteredUsers = useMemo(() => {
    return sampleUsers.filter((user) => {
      const matchesSearch =
        `${user.full_name} ${user.email} ${user.username}`
          .toLowerCase()
          .includes(search.toLowerCase()) || !search;

      const matchesStatus = status === "all" ? true : user.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
          <Users className="w-5 h-5 text-fuchsia-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">User Management</h2>
          <p className="text-xs text-slate-500">
            Search and review registered users.
          </p>
        </div>
      </div>

      <UserFilters
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
      />

      <UsersTable users={filteredUsers} />
    </GlassCard>
  );
}
