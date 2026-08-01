import { Search } from "lucide-react";

export default function UserFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}) {
  return (
    <div className="flex flex-col md:flex-row gap-3 mb-4">
      <label className="flex-1 relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, email or username"
          className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50 pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500"
        />
      </label>

      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500"
      >
        <option value="all">All status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  );
}
