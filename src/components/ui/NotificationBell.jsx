import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabaseClient";
import GlassCard from "./GlassCard";

function formatDate(ts) {
  if (!ts) return "just now";
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function NotificationBell() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    if (!error) setNotifications(data || []);
    setLoading(false);
  };

  // Fetch unread count on mount.
  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    const loadCount = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .is("read_at", null);
      if (!active) return;
      if (!error) setUnreadCount(count || 0);
    };
    loadCount();
    return () => {
      active = false;
    };
  }, [profile?.id]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await fetchNotifications();
  };

  const markRead = async (n) => {
    if (n.read_at) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", n.id)
      .eq("user_id", profile.id);
    if (error) return;
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell */}
      <button
        onClick={toggle}
        className="p-2 rounded-xl hover:bg-fuchsia-50 text-slate-400 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-fuchsia-600 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-[20rem] z-40">
          <GlassCard className="p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800">Notifications</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No notifications yet
              </p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => {
                  const isRead = Boolean(n.read_at);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markRead(n)}
                      className={`w-full text-left px-3 py-3 rounded-xl border transition-colors ${
                        isRead
                          ? "border-slate-100 bg-white/50"
                          : "border-fuchsia-200 bg-fuchsia-50/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            isRead
                              ? "font-medium text-slate-600"
                              : "font-bold text-slate-800"
                          }`}
                        >
                          {n.title}
                        </p>
                        {!isRead && (
                          <span className="mt-1 w-2 h-2 rounded-full bg-fuchsia-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 break-words">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {formatDate(n.created_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
