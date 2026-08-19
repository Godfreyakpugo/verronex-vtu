import { useEffect, useState } from "react";
import {
  Megaphone,
  Search,
  Send,
  Loader2,
  X,
  CheckCircle2,
  Users,
  User,
  Radio,
  Pencil,
} from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import supabase from "../../../lib/supabaseClient";

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : "";

export default function AdminNotifications() {
  const [target, setTarget] = useState("all");
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
  const [sentText, setSentText] = useState("");

  const [alerts, setAlerts] = useState([]);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

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

  useEffect(() => {
    let active = true;
    const loadAlerts = async () => {
      const { data, error: err } = await supabase
        .from("public_alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (err) {
        console.error("Error fetching public alerts:", err);
      } else {
        setAlerts(data || []);
      }
    };
    loadAlerts();
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

  const activeAlert = alerts.find((a) => a.is_active) || null;
  const previousAlerts = alerts.filter((a) => !a.is_active);

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) return;
    if (target === "specific" && !selectedUser) return;

    setSending(true);
    setError("");
    setSent(false);

    const { data, error: err } = await supabase.rpc("admin_send_notification", {
      p_user_id: target === "specific" ? selectedUser.id : null,
      p_send_to_all: target === "all",
      p_title: title.trim(),
      p_message: message.trim(),
    });

    setSending(false);
    if (err) {
      setError(err?.message || "Failed to send notification.");
      return;
    }

    const count = Number(data || 0);
    setSent(true);
    setSentText(
      target === "all"
        ? `Notification sent to ${count} active user${count === 1 ? "" : "s"}.`
        : `Notification sent to ${selectedUser.full_name || selectedUser.email}.`,
    );
    setTitle("");
    setMessage("");
    setSelectedUser(null);
    setSearch("");
  };

  const confirmPublish = async () => {
    setSending(true);
    setError("");
    setSent(false);

    const { data, error: err } = await supabase.rpc(
      "admin_publish_public_alert",
      {
        p_title: title.trim(),
        p_message: message.trim(),
      },
    );

    setSending(false);
    if (err) {
      setError(err?.message || "Failed to publish public alert.");
      return;
    }

    setPublishConfirm(false);
    setSent(true);
    setSentText(
      data?.title
        ? `Public alert published: "${data.title}".`
        : "Public alert published.",
    );
    setTitle("");
    setMessage("");

    const { data: refreshed } = await supabase
      .from("public_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (refreshed) setAlerts(refreshed);
  };

  const confirmDeactivate = async () => {
    setSending(true);
    setError("");
    setSent(false);

    const { error: err } = await supabase.rpc(
      "admin_deactivate_public_alert",
      {},
    );

    setSending(false);
    if (err) {
      setError(err?.message || "Failed to deactivate public alert.");
      return;
    }

    setDeactivateConfirm(false);
    setSent(true);
    setSentText("Public alert deactivated.");

    const { data: refreshed } = await supabase
      .from("public_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (refreshed) setAlerts(refreshed);
  };

  const openEdit = () => {
    if (!activeAlert) return;
    setEditTitle(activeAlert.title);
    setEditMessage(activeAlert.message);
    setEditError("");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!activeAlert || savingEdit) return;
    if (!editTitle.trim() || !editMessage.trim()) {
      setEditError("Title and message are required.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    setSent(false);

    const { error: err } = await supabase.rpc(
      "admin_update_public_alert",
      {
        p_alert_id: activeAlert.id,
        p_title: editTitle.trim(),
        p_message: editMessage.trim(),
      },
    );

    setSavingEdit(false);
    if (err) {
      setEditError(err?.message || "Failed to update public alert.");
      return;
    }

    setEditOpen(false);
    setSent(true);
    setSentText("Public alert updated successfully.");

    const { data: refreshed } = await supabase
      .from("public_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (refreshed) setAlerts(refreshed);
  };

  const isPublic = target === "public";

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
              Send a notification to all active users, one user, or publish a
              public alert.
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
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {sentText}
          </div>
        )}

        <div className="space-y-5">
          {/* Send-to segmented control */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Send To
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTarget("all")}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                  target === "all"
                    ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 ring-2 ring-fuchsia-200"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                All Users
              </button>
              <button
                type="button"
                onClick={() => setTarget("specific")}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                  target === "specific"
                    ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 ring-2 ring-fuchsia-200"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                Specific User
              </button>
              <button
                type="button"
                onClick={() => setTarget("public")}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                  target === "public"
                    ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 ring-2 ring-fuchsia-200"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Radio className="w-4 h-4 shrink-0" />
                Public Alert
              </button>
            </div>
          </div>

          {/* All users confirmation */}
          {target === "all" && (
            <div className="flex items-center gap-2 rounded-xl border border-fuchsia-100 bg-slate-50 px-4 py-3">
              <Users className="w-4 h-4 text-fuchsia-500 shrink-0" />
              <p className="text-sm font-bold text-slate-800">
                Send to: All active users
              </p>
            </div>
          )}

          {/* Public alert target confirmation */}
          {isPublic && (
            <div className="flex items-center gap-2 rounded-xl border border-fuchsia-100 bg-slate-50 px-4 py-3">
              <Radio className="w-4 h-4 text-fuchsia-500 shrink-0" />
              <p className="text-sm font-bold text-slate-800">
                Send to: All users who access the dashboard
              </p>
            </div>
          )}

          {/* Specific user selection */}
          {target === "specific" && (
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
          )}

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

          {/* Send / Publish */}
          {isPublic ? (
            <button
              type="button"
              onClick={() => setPublishConfirm(true)}
              disabled={
                !title.trim() || !message.trim() || sending
              }
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-linear-to-r from-indigo-600 to-fuchsia-600 text-white font-bold shadow-lg shadow-fuchsia-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {sending ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <Radio className="w-4 h-4" />
              )}
              Publish Public Alert
            </button>
          ) : (
            <button
              type="button"
              onClick={sendNotification}
              disabled={
                !title.trim() ||
                !message.trim() ||
                (target === "specific" && !selectedUser) ||
                sending
              }
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-linear-to-r from-indigo-600 to-fuchsia-600 text-white font-bold shadow-lg shadow-fuchsia-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {sending ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Notification
            </button>
          )}
        </div>
      </GlassCard>

      {/* Public Alerts admin section */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
            <Radio className="w-5 h-5 text-fuchsia-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Public Alerts</h2>
            <p className="text-xs text-slate-500">
              Manage the current public alert shown on user dashboards.
            </p>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Current Public Alert
        </h3>
        {activeAlert ? (
          <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900">
                    {activeAlert.title}
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">
                  {activeAlert.message}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Published {formatDate(activeAlert.created_at)}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center shrink-0">
                <button
                  type="button"
                  onClick={openEdit}
                  className="px-4 py-2 rounded-xl border border-fuchsia-200 bg-white text-fuchsia-700 text-sm font-bold hover:bg-fuchsia-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeactivateConfirm(true)}
                  className="px-4 py-2 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-bold hover:bg-red-50 transition-colors"
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No active public alert.
          </div>
        )}

        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-6 mb-2">
          Previous Public Alerts
        </h3>
        {previousAlerts.length === 0 ? (
          <p className="text-sm text-slate-400">No previous alerts.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {previousAlerts.map((a) => (
              <div key={a.id} className="bg-white px-4 py-3">
                <p className="text-sm font-bold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">
                  {a.message}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Deactivated — {formatDate(a.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Publish confirmation */}
      {publishConfirm && (
        <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-fuchsia-100 flex items-center justify-center">
                <Radio className="w-6 h-6 text-fuchsia-600" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Publish Public Alert?</h2>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Title
                </p>
                <p className="font-bold text-slate-900">{title.trim()}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Message
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-line">
                  {message.trim()}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                This alert will be shown to users when they enter the Dashboard.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPublishConfirm(false)}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPublish}
                disabled={sending}
                className="px-5 py-2 rounded-xl bg-linear-to-r from-indigo-600 to-fuchsia-600 text-white font-bold shadow-lg shadow-fuchsia-500/30 disabled:opacity-50"
              >
                {sending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" /> Publishing...
                  </span>
                ) : (
                  "Publish Alert"
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Edit active public alert */}
      {editOpen && (
        <div className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-fuchsia-100 flex items-center justify-center">
                <Pencil className="w-6 h-6 text-fuchsia-600" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Edit Public Alert</h2>
              </div>
            </div>

            {editError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Title
                </label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Alert title"
                  className="w-full px-4 py-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Message
                </label>
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  placeholder="Alert message"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={savingEdit}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="px-5 py-2 rounded-xl bg-linear-to-r from-indigo-600 to-fuchsia-600 text-white font-bold shadow-lg shadow-fuchsia-500/30 disabled:opacity-50"
              >
                {savingEdit ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" /> Saving...
                  </span>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      <ConfirmModal
        open={deactivateConfirm}
        title="Deactivate Public Alert?"
        message={`This will deactivate the current public alert "${activeAlert?.title || ""}" and it will no longer be shown to users.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        danger
        loading={sending}
        onCancel={() => setDeactivateConfirm(false)}
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}
