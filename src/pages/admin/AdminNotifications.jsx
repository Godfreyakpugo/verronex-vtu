import { useEffect, useState, useRef } from "react";
import supabase from "../../lib/supabaseClient";
import GlassCard from "../../components/ui/GlassCard";
import { Plus, ShieldCheck, Megaphone, AlertTriangle, X } from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ color: [] }, { background: [] }],
    ["link"],
    ["clean"],
  ],
};

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "bullet",
  "color",
  "background",
  "link",
];

function AdminNotifications() {
  const [section, setSection] = useState("announcements");
  const [announcements, setAnnouncements] = useState([]);
  const [loginAlerts, setLoginAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    message: "",
    audience: "all",
    target_user_id: "",
  });

  const scrollRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [annsResult, alertsResult] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("type", "important_announcement")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("notifications")
          .select("*")
          .eq("type", "login_alert")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (annsResult.error) throw annsResult.error;
      if (alertsResult.error) throw alertsResult.error;

      setAnnouncements(annsResult.data || []);
      setLoginAlerts(alertsResult.data || []);
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

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", message: "", audience: "all", target_user_id: "" });
    setShowForm(true);
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openEdit = (announcement) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      message: announcement.message,
      audience: announcement.audience,
      target_user_id: announcement.target_user_id || "",
    });
    setShowForm(true);
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const save = async () => {
    setError(null);
    if (!form.title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (!form.message || form.message.replace(/<[^>]*>/g, "").trim() === "") {
      setError("Please write a message.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message,
        type: "important_announcement",
        audience: form.audience,
        target_user_id:
          form.audience === "specific" && form.target_user_id.trim()
            ? form.target_user_id.trim()
            : null,
        is_active: true,
      };

      if (editing) {
        const { error: updateError } = await supabase
          .from("notifications")
          .update(payload)
          .eq("id", editing.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("notifications")
          .insert(payload)
          .select()
          .single();
        if (insertError) throw insertError;
        setAnnouncements((prev) => [data, ...prev]);
      }

      closeForm();
      if (editing) fetchData();
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to save announcement.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setError(null);
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to delete announcement.",
      );
    }
  };

  const inputCls =
    "w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white px-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all";

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
              Announcements
            </h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4">
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

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {section === "announcements" && (
        <GlassCard className="p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text font-bold text-slate-800">Announcements</h2>
            {!showForm && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                New Announcement
              </button>
            )}
          </div>

          {showForm && (
            <div ref={scrollRef} className="mb-6 p-5 rounded-2xl bg-fuchsia-50/40 border border-fuchsia-100">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-slate-800">
                  {editing ? "Edit Announcement" : "New Announcement"}
                </p>
                <button
                  onClick={closeForm}
                  className="p-1.5 rounded-lg hover:bg-fuchsia-100 text-slate-400 transition-colors"
                  aria-label="Close form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Announcement title"
                  className={inputCls}
                />

                <div>
                  <ReactQuill
                    theme="snow"
                    value={form.message}
                    onChange={(content) => setForm((prev) => ({ ...prev, message: content }))}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Write your announcement..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={form.audience}
                    onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
                    className={`${inputCls} flex-1`}
                  >
                    <option value="all">All Users</option>
                    <option value="specific">Specific User</option>
                  </select>
                  {form.audience === "specific" && (
                    <input
                      type="text"
                      value={form.target_user_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, target_user_id: e.target.value }))}
                      placeholder="User ID"
                      className={`${inputCls} flex-1`}
                    />
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/30 transition-all disabled:opacity-60"
                  >
                    {saving ? "Saving..." : editing ? "Save Changes" : "Publish Announcement"}
                  </button>
                  <button
                    onClick={closeForm}
                    className="bg-white border border-fuchsia-200 text-slate-600 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-fuchsia-50 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <GlassCard className="divide-y divide-fuchsia-50/80">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
                    <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </GlassCard>
          ) : announcements.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-6 h-6 text-fuchsia-500" />
              </div>
              <p className="font-bold text-slate-700">No announcements yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Create your first announcement to notify users.
              </p>
            </GlassCard>
          ) : (
            <GlassCard className="divide-y divide-fuchsia-50/80">
              {announcements.map((a) => (
                <div key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex-1">
                      <p className="font-bold text-slate-800">{a.title}</p>
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold rounded-full mt-1 px-2 py-0.5 ${
                          a.audience === "all"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-fuchsia-100 text-fuchsia-600"
                        }`}
                      >
                        {a.audience === "all" ? "All Users" : "Specific User"}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(a)}
                        className="text-sm text-fuchsia-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(a.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div
                    className="text-sm text-slate-500 mt-1 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: a.message }}
                  />
                  <p className="text-[10px] text-slate-400 mt-2">
                    {new Intl.DateTimeFormat("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(a.created_at))}
                  </p>
                </div>
              ))}
            </GlassCard>
          )}
        </GlassCard>
      )}

      {section === "login-alerts" && (
        <GlassCard className="p-6 rounded-2xl">
          <h2 className="text font-bold text-slate-800 mb-4">Login Alerts</h2>
          <p className="text-sm text-slate-500 mb-4">
            Login alert templates appear to users after they sign in. Configuration
            will be wired to the auth flow in a future update.
          </p>
          {loginAlerts.length === 0 ? (
            <p className="text-slate-500">No login alerts yet.</p>
          ) : (
            <GlassCard className="divide-y divide-fuchsia-50/80">
              {loginAlerts.map((a) => (
                <div key={a.id} className="p-3">
                  <p className="font-medium truncate">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{a.message}</p>
                </div>
              ))}
            </GlassCard>
          )}
        </GlassCard>
      )}
    </div>
  );
}

export default AdminNotifications;