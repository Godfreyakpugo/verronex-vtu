import { useEffect, useState, useRef } from "react";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { GlassCard, Button, Input, Select, Option } from "../../../components/ui";
import { CheckCircle2, XCircle, Info, AlertCircle, Shield, Users, Menu, Calendar } from "lucide-react";
import { formatNaira } from "../../../lib/transactionView";

function AdminNotifications() {
  const { profile, user } = useAuth();
  const [section, setSection] = useState("announcements");
  const [announcements, setAnnouncements] = useState([]);
  const [loginAlerts, setLoginAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    message: "",
    type: "important_announcement",
    audience: "all",
    target_user_id: "",
  });

  const [newLoginAlert, setNewLoginAlert] = useState({
    title: "",
    message: "",
    type: "welcome",
    audience: "all",
    target_user_id: "",
    delay: "immediately",
  });

  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [editingLoginAlert, setEditingLoginAlert] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch announcements (type = 'important_announcement' or 'system')
      const { data: anns, error: annError } = await supabase
        .from("notifications")
        .select("*")
        .eq("type", "important_announcement")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (annError) throw annError;

      // Fetch login alerts (type = 'login_alert')
      const { data: alerts, error: alertError } = await supabase
        .from("notifications")
        .select("*")
        .eq("type", "login_alert")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (alertError) throw alertError;

      setAnnouncements(anns || []);
      setLoginAlerts(alerts || []);
      setError(null);
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to load notifications.",
      );
      setAnnouncements([]);
      setLoginAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async () => {
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from("notifications")
        .insert({
          title: newAnnouncement.title,
          message: newAnnouncement.message,
          type: "important_announcement",
          audience: newAnnouncement.audience,
          target_user_id: newAnnouncement.audience === "specific" ? newAnnouncement.target_user_id : null,
          is_active: true,
          created_at: new Date(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setAnnouncements((prev) => [data, ...prev]);
      setNewAnnouncement({
        title: "",
        message: "",
        type: "important_announcement",
        audience: "all",
        target_user_id: "",
      });
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to create announcement.",
      );
    }
  };

  const updateAnnouncement = async (id) => {
    setError(null);
    try {
      const { error } = await supabase
        .from("notifications")
        .update({
          title: editingAnnouncement?.title,
          message: editingAnnouncement?.message,
          audience: editingAnnouncement?.audience,
          target_user_id: editingAnnouncement?.audience === "specific" ? editingAnnouncement.target_user_id : null,
        })
        .eq("id", id);

      if (error) throw error;

      setAnnouncements(
        (prev) =>
          prev.map((n) => (n.id === id ? { ...n, title: editingAnnouncement?.title, message: editingAnnouncement?.message } : n)),
      );
      setEditingAnnouncement(null);
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to update announcement.",
      );
    }
  };

  const deleteAnnouncement = async (id) => {
    setError(null);
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      setAnnouncements((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to delete announcement.",
      );
    }
  };

  const createLoginAlert = async () => {
    setError(null);
    try {
      const { error } = await supabase
        .from("notifications")
        .insert({
          title: newLoginAlert.title,
          message: newLoginAlert.message,
          type: "login_alert",
          audience: newLoginAlert.audience,
          target_user_id: newLoginAlert.audience === "specific" ? newLoginAlert.target_user_id : null,
          is_active: true,
          metadata: { delay: newLoginAlert.delay },
          created_at: new Date(),
        })
        .select()
        .single();

      if (error) throw error;

      setLoginAlerts((prev) => [data, ...prev]);
      setNewLoginAlert({
        title: "",
        message: "",
        type: "welcome",
        audience: "all",
        target_user_id: "",
        delay: "immediately",
      });
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to create login alert.",
      );
    }
  };

  const updateLoginAlert = async (id) => {
    setError(null);
    try {
      const { error } = await supabase
        .from("notifications")
        .update({
          title: editingLoginAlert?.title,
          message: editingLoginAlert?.message,
          audience: editingLoginAlert?.audience,
          target_user_id: editingLoginAlert?.audience === "specific" ? editingLoginAlert.target_user_id : null,
        })
        .eq("id", id);

      if (error) throw error;

      setLoginAlerts(
        (prev) =>
          prev.map((n) => (n.id === id ? { ...n, title: editingLoginAlert?.title, message: editingLoginAlert?.message } : n)),
      );
      setEditingLoginAlert(null);
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to update login alert.",
      );
    }
  };

  const deleteLoginAlert = async (id) => {
    setError(null);
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      setLoginAlerts((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to delete login alert.",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="p-7 rounded-3xl bg-linear-to-br from-indigo-900 via-purple-800 to-fuchsia-700 shadow-xl shadow-purple-900/20 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[80px] opacity-60 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-purple-200 uppercase tracking-widest font-semibold">
              Admin Console
            </p>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Admin Notifications
            </h1>
          </div>
        </div>
      </div>

      {error ? (
        <GlassCard className="p-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </GlassCard>
      ) : loading ? (
        <GlassCard className="divide-y divide-fuchsia-50/80">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="w-16 h-5 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </GlassCard>
      ) : (
        <>
          <div className="border-b border-fuchsia-100/50 pb-4 mb-6">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setSection("announcements")}
                className={`
                  flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    section === "announcements"
                      ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white"
                      : "text-slate-500 hover:text-fuchsia-600"
                  }`}
                >
                  Announcements
                </button>
              <button
                onClick={() => setSection("login-alerts")}
                className={`
                  flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    section === "login-alerts"
                      ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white"
                      : "text-slate-500 hover:text-fuchsia-600"
                  }`}
                >
                  Login Alerts
                </button>
              </div>
            </div>
          </div>

          {/* Announcements Section */}
          {section === "announcements" && (
            <GlassCard className="p-6 rounded-2xl mb-4">
              <h2 className="text font-bold text-slate-800 mb-4">Announcements</h2>

              <div className="space-y-4">
                {/* Create new announcement form */}
                {editingAnnouncement ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      updateAnnouncement(editingAnnouncement.id);
                    }}
                  >
                    <input
                      type="text"
                      value={editingAnnouncement.title}
                      onChange={(e) =>
                        setNewAnnouncement((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    />
                    <textarea
                      rows={3}
                      value={editingAnnouncement.message}
                      onChange={(e) =>
                        setNewAnnouncement((prev) => ({ ...prev, message: e.target.value }))
                      }
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    /></textarea>
                    <div className="flex gap-3 mt-3">
                      <select
                        value={newAnnouncement.audience}
                        onChange={(e) =>
                          setNewAnnouncement((prev) => ({ ...prev, audience: e.target.value }))
                        }
                        className="flex-1 bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                      >
                        <option value="all">All Users</option>
                        <option value="specific">Specific User</option>
                      </select>
                      {newAnnouncement.audience === "specific" && (
                        <input
                          type="text"
                          value={newAnnouncement.target_user_id || ""}
                          onChange={(e) =>
                            setNewAnnouncement((prev) => ({ ...prev, target_user_id: e.target.value }))
                          }
                          className="flex-1 bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                          placeholder="User ID"
                        />
                      )}
                      <button
                        type="submit"
                        className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAnnouncement(null)}
                        className="bg-white border border-fuchsia-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-fuchsia-50 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <button
                      onClick={() => setNewAnnouncement({
                        title: "",
                        message: "",
                        type: "important_announcement",
                        audience: "all",
                        target_user_id: "",
                      })}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all">
                      <Plus className="w-4 h-4" />
                      Create Announcement
                    </button>
                  </div>
                )}

                {announcements.length === 0 ? (
                  <p className="text-slate-500 mt-4">No announcements yet.</p>
                ) : (
                  <GlassCard className="divide-y divide-fuchsia-50/80 pt-4">
                    {announcements.map((a) => (
                      <div key={a.id} className="p-3 rounded-xl mb-2">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="font-medium truncate">{a.title}</p>
                          <span
                            className={`inline-flex items-center gap-1 text-[8px] font-semibold rounded-full ${a.audience === "all" ? "bg-emerald-100 text-emerald-700" : "bg-fuchsia-100 text-fuchsia-600"}`}
                          >
                            {a.audience}
                          </span>
                          {profile?.is_admin && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingAnnouncement(a)}
                                className="text-sm text-fuchsia-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteAnnouncement(a.id)}
                                className="text-sm text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{a.message}</p>
                        <p className="text-[10px] text-slate-400">
                          Created {new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(a.created_at))}
                        </p>
                      </div>
                    ))}
                  </GlassCard>
                )}
              </div>
            </GlassCard>
          )}

          {/* Login Alerts Section */}
          {section === "login-alerts" && (
            <GlassCard className="p-6 rounded-2xl mb-4">
              <h2 className="text font-bold text-slate-800 mb-4">Login Alerts</h2>

              <p className="text-sm text-slate-500 mb-4">
                Login alerts appear when users successfully log in. Configure below.
              </p>

              {/* Create new login alert form */}
              {editingLoginAlert ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  updateLoginAlert(editingLoginAlert.id);
                }}>
                  <input
                    type="text"
                    value={editingLoginAlert.title}
                    onChange={(e) =>
                      setNewLoginAlert((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                  />
                  <textarea
                    rows={3}
                    value={editingLoginAlert.message}
                    onChange={(e) =>
                      setNewLoginAlert((prev) => ({ ...prev, message: e.target.value }))
                    }
                    className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                  /></textarea>
                  <div className="flex gap-3 mt-3">
                    <select
                      value={newLoginAlert.audience}
                      onChange={(e) =>
                        setNewLoginAlert((prev) => ({ ...prev, audience: e.target.value }))
                      }
                      className="flex-1 bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    >
                      <option value="all">All Users</option>
                      <option value="specific">Specific User</option>
                    </select>
                    {newLoginAlert.audience === "specific" && (
                      <input
                        type="text"
                        value={newLoginAlert.target_user_id || ""}
                        onChange={(e) =>
                          setNewLoginAlert((prev) => ({ ...prev, target_user_id: e.target.value }))
                        }
                        className="flex-1 bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                        placeholder="User ID"
                      />
                    )}
                    <select
                      value={newLoginAlert.delay}
                      onChange={(e) =>
                        setNewLoginAlert((prev) => ({ ...prev, delay: e.target.value }))
                      }
                      className="flex-1 bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    >
                      <option value="immediately">Immediately</option>
                      <option value="3_seconds">3 seconds after login</option>
                    </select>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingLoginAlert(null)}
                      className="bg-white border border-fuchsia-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-fuchsia-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <button
                    onClick={() => setNewLoginAlert({
                      title: "",
                      message: "",
                      type: "welcome",
                      audience: "all",
                      target_user_id: "",
                      delay: "immediately",
                    })}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all">
                    <Plus className="w-4 h-4" />
                    Create Login Alert
                  </button>
                </div>
              )}

              {loginAlerts.length === 0 ? (
                <p className="text-slate-500 mt-4">No login alerts yet.</p>
              ) : (
                <GlassCard className="divide-y divide-fuchsia-50/80 pt-4">
                  {loginAlerts.map((a) => {
                    const delayMeta = a.metadata?.delay ? ` (${a.metadata.delay} delay)` : "";
                    return (
                      <div key={a.id} className="p-3 rounded-xl mb-2">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="font-medium truncate">{a.title}</p>
                          <span
                            className={`inline-flex items-center gap-1 text-[8px] font-semibold rounded-full bg-emerald-100 text-emerald-700`}
                          >
                            {a.audience}
                          </span>
                          {profile?.is_admin && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingLoginAlert(a)}
                                className="text-sm text-fuchsia-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteLoginAlert(a.id)}
                                className="text-sm text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{a.message}{metaData}</p>
                        <p className="text-[10px] text-slate-400">
                          Created {new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(a.created_at))}{delayMeta}
                        </p>
                      </div>
                    );
                  })}
                </GlassCard>
              )}
            </GlassCard>
          )}

          {/* Footer links */}
          <div className="mt-8 pt-8 border-t border-fuchsia-100/50 text-center text-sm text-slate-500">
            <a
              href="/admin/funding"
              className="hover:text-fuchsia-600 transition-colors"
            >
              Admin Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminNotifications;