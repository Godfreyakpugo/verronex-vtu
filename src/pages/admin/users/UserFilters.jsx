import { Search } from "lucide-react";

export default function UserFilters({
  search,
  filter,
  onSearchChange,
  onFilterChange,
}) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, email or phone..."
          className="pl-10 pr-4 py-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 w-full md:w-72 outline-none focus:ring-2 focus:ring-fuchsia-500"
        />
      </div>

      <select
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 outline-none focus:ring-2 focus:ring-fuchsia-500"
      >
        <option value="all">All Users</option>
        <option value="basic">Basic Plan</option>
        <option value="agent">Agents</option>
        <option value="admin">Admins</option>
      </select>
    </div>
  );
}
