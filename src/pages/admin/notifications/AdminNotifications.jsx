import { useEffect, useState } from "react";
import { Megaphone, Search, Send, Loader2, X, CheckCircle2 } from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import supabase from "../../../lib/supabaseClient";

export default function AdminNotifications() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      const { data, error: err } = await supabase.rpc("admin_get_users");
      if (!active) return;
      if (err) {
        console.error("Error fetching users:", err);
      } else {
        setUsers(data || []);
      }
      setLoadingUsers(false);
    };
    loadUsers();
    return () => {
      active = false;
    };
  }, []);

  const q = search.trim().toLowerCase();
  const matches = q
    ? users.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q),
      )
    : [];

  const sendNotification = async () => {
    if (!selectedUser || !title.trim() || !message.trim()) return;
    setSending(true);
    setError("");
    setSent(false);

    const { error: err } = await supabase.from("notifications").insert({
      user_id: selectedUser.id,
      title: title.trim(),
      message: message.trim(),
    });

    setSending(false);
    if (err) {
      setError(err?.message || "Failed to send notification.");
      return;
    }

    setSent(true);
    setTitle("");
    setMessage("");
    setSelectedUser(null);
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white shrink-0">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500">
              Send a notification to one user.
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {sent && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Notification sent.
          </div>
        )}

        <div className="space-y-5">
          {/* User selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              User
            </label>

            {selectedUser ? (
              <div className="flex items-center justify-between rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3">
                <div>
                  <p className="font-bold text-slate-800">
                    {selectedUser.full_name || selectedUser.username || "User"}
                  </p>
                  <p className="text-sm text-slate-500">{selectedUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setSearch("");
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Change user"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Search by name, username, email or phone..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 outline-none focus:ring-2 focus:ring-fuchsia-500"
                />

                {showResults && search.trim() && (
                  <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-fuchsia-100 bg-white shadow-xl">
                    {loadingUsers ? (
                      <div className="p-4 flex justify-center">
                        <Loader2 className="animate-spin w-5 h-5 text-fuchsia-600" />
                      </div>
                    ) : matches.length === 0 ? (
                      <div className="p-4 text-sm text-slate-400 text-center">
                        No users found.
                      </div>
                    ) : (
                      matches.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setSearch("");
                            setShowResults(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-fuchsia-50 transition-colors"
                        >
                          <p className="text-sm font-bold text-slate-800">
                            {u.full_name || u.username || "User"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {u.email}
                            {u.phone ? ` • ${u.phone}` : ""}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Welcome to Verronex"
              className="w-full px-4 py-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 outline-none focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none"
            />
          </div>

          {/* Send */}
          <button
            type="button"
            onClick={sendNotification}
            disabled={!selectedUser || !title.trim() || !message.trim() || sending}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-linear-to-r from-indigo-600 to-fuchsia-600 text-white font-bold shadow-lg shadow-fuchsia-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Notification
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
