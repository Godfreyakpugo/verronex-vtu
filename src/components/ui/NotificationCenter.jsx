import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabaseClient";
import { Bell, Check, X } from "lucide-react";
import GlassCard from "../../components/ui/GlassCard";
import { formatNaira } from "../../lib/transactionView";

function NotificationCenter() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountRef = useRef(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      setError(null);
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to load notifications.",
      );
      setNotifications([]);
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date() })
        .eq("id", notificationId)
        .eq("user_id", profile?.id);

      if (error) throw error;
      setNotifications(
        (prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read_at: new Date() } : n,
          ),
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Mark as read error:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date() })
        .eq("user_id", profile?.id)
        .eq("read_at", null);

      if (error) throw error;
      setUnreadCount(0);
      setNotifications(
        (prev) =>
          prev.map((n) => ({ ...n, read_at: new Date() })),
      );
    } catch (err) {
      console.error("Mark all as read error:", err);
    }
  };

  useEffect(() => {
    // Count unread notifications
    const unread = (notifications || []).filter(
      (n) => !n.read_at,
    ).length;
    setUnreadCount(unread);

    // Subscribe to real-time changes
    const { data: subscription } = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile?.id}`,
        },
        (payload) => {
          const newNotification = payload.new;
            setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => {
            const isUnread = !newNotification.read_at;
            return prev + (isUnread ? 1 : 0);
          });
        },
      )
      .subscribe();

    return () => {
      mountRef.current = false;
      subscription.unsubscribe();
    };
  }, [profile?.id, notifications]);

  const typeColor = {
    wallet_funding: "bg-emerald-100 text-emerald-700",
    funding_rejected: "bg-red-100 text-red-600",
    transaction_delivered: "bg-emerald-100 text-emerald-700",
    transaction_refunded: "bg-amber-100 text-amber-700",
    important_announcement: "bg-fuchsia-100 text-fuchsia-600",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto rounded-2xl border border-fuchsia-100/60 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text font-bold text-slate-800">
            Notifications
            <span className="text-sm font-medium">
              {unreadCount}
              {unreadCount > 0 && (
                <span className="ml-2 bg-fuchsia-600 text-white rounded-full w-4 h-4 text-xs font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setUnreadCount(0)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Mark all as read"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="h-24 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        ) : error ? (
          <GlassCard className="p-4 text-center text-red-600">
            <p>{error}</p>
            <button
              onClick={fetchNotifications}
              className="mt-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white py-1.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
            >
              Retry
            </button>
          </GlassCard>
        ) : notifications.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto mb-4"></div>
            <p className="text-slate-500">No notifications yet</p>
            <p className="text-xs text-slate-400 mt-1">
              You'll see notifications here for important account events.
            </p>
          </GlassCard>
        ) : (
          <GlassCard className="divide-y divide-fuchsia-50/80">
            {notifications.map((n) => {
              const typeMeta = typeColor[n.type] || "bg-slate-100 text-slate-600";
              const isRead = Boolean(n.read_at);
              const date = n.created_at
                ? new Intl.DateTimeFormat("en-NG", {
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(n.created_at))
                : "";

              return (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl ${
                    isRead ? "bg-slate-50" : "bg-fuchsia-50/50"
                  } transition-colors ${isRead ? "text-slate-600" : "text-slate-800"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium truncate">{n.title}</p>
                      <p className="text-xs truncate">{n.message}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[8px] font-semibold rounded-full ${typeMeta}`}
                    >
                      {n.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[10px] truncate">
                    {date || "just now"}
                  </p>
                </div>
              );
            })}
          </GlassCard>
        )}
      </GlassCard>
    </div>
  );
}

export default NotificationCenter;