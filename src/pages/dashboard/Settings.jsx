import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useSearchParams } from "react-router-dom";
import {
  Users,
  Lock,
  Camera,
  Edit,
} from "lucide-react";
import supabase from "../../lib/supabaseClient";
import { getTransactionPinStatus, invokeTransactionPin } from "../../lib/transactionPin";
import GlassCard from "../../components/ui/GlassCard";
import SEO from "../../components/seo/SEO";

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();

  const requestedSection = searchParams.get("section");
  const [section, setSection] = useState(() =>
    ["account", "security", "profile"].includes(requestedSection)
      ? requestedSection
      : "account",
  );
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    username: profile?.username || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pinStatus, setPinStatus] = useState({ loading: true, hasPin: false, error: "" });
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinRecovery, setPinRecovery] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");

  async function refreshPinStatus() {
    setPinStatus((current) => ({ ...current, loading: true, error: "" }));
    try {
      const status = await getTransactionPinStatus();
      setPinStatus({ loading: false, hasPin: status?.hasPin === true, error: "" });
    } catch (statusError) {
      setPinStatus({
        loading: false,
        hasPin: false,
        error: statusError.message || "PIN status could not be loaded.",
      });
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPinStatus();
  }, [user?.id]);

  async function handleTransactionPinSave(event) {
    event.preventDefault();
    setPinError("");
    setPinSuccess("");

    if (!/^\d{4}$/.test(pinNew)) {
      setPinError("Transaction PIN must contain exactly four digits.");
      setPinCurrent("");
      setPinNew("");
      setPinConfirm("");
      return;
    }
    if (pinNew !== pinConfirm) {
      setPinError("The transaction PINs do not match.");
      setPinCurrent("");
      setPinNew("");
      setPinConfirm("");
      return;
    }
    if (pinStatus.hasPin && !pinRecovery && !/^\d{4}$/.test(pinCurrent)) {
      setPinError("Enter your current transaction PIN to change it.");
      return;
    }
    if (pinRecovery && (!recoveryPassword || !user?.email)) {
      setPinError("Enter your account password to verify your identity.");
      return;
    }

    setPinBusy(true);
    try {
      const action = pinRecovery
        ? "recover"
        : pinStatus.hasPin
        ? "change"
        : "setup";
      const result = await invokeTransactionPin({
        action,
        currentPin: action === "change" ? pinCurrent : null,
        newPin: pinNew,
        accountPassword: action === "recover" ? recoveryPassword : null,
      });

      if (result?.pinError) throw new Error(result.error || "Could not update transaction PIN.");
      if (result?.error || !result?.success) {
        throw new Error(result?.error || "Could not update transaction PIN.");
      }

      setPinSuccess(pinStatus.hasPin ? "Transaction PIN updated." : "Transaction PIN set up.");
      setPinRecovery(false);
      await refreshPinStatus();
    } catch (err) {
      setPinError(err.message || "Could not update transaction PIN.");
    } finally {
      setPinCurrent("");
      setPinNew("");
      setPinConfirm("");
      setRecoveryPassword("");
      setPinBusy(false);
    }
  }

  useEffect(() => {
    if (profile) {
      // The profile is fetched asynchronously after Settings has first rendered.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        full_name: profile.full_name || "",
        username: profile.username || "",
        email: profile.email || "",
        phone: profile.phone || "",
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (form.current_password && (!form.new_password || form.new_password.length < 6)) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (form.new_password && form.new_password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    try {
      if (form.current_password || form.new_password) {
        // Change password
        const { error } = await supabase.auth.updateUser({
          password: form.new_password,
        });
        if (error) throw error;
        setSuccess("Password updated successfully.");
        setForm({
          ...form,
          current_password: "",
          new_password: "",
          confirm_password: "",
        });
      } else {
        // Profile update - persist the edited fields to the profiles table
        const full_name = (form.full_name || "").trim();
        const username = (form.username || "").trim();
        const phone = (form.phone || "").trim();

        if (!full_name) {
          setError("Full name is required.");
          return;
        }
        if (!/^[a-z0-9_]{3,20}$/.test(username)) {
          setError(
            "Username must be 3-20 characters and contain only lowercase letters, numbers and underscores.",
          );
          return;
        }

        const { error } = await supabase
          .from("profiles")
          .update({ full_name, username, phone })
          .eq("id", user.id);

        if (error) throw error;

        await refreshProfile();
        setEditing(false);
        setSuccess("Profile updated successfully.");
      }
    } catch (err) {
      setError(
        err?.message || err?.error_description || "Failed to update settings.",
      );
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]:
        name === "username"
          ? value.toLowerCase().replace(/\s/g, "")
          : value,
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)] p-4 lg:p-6">
      <SEO title="Settings — Verronex VTU" robots="noindex, nofollow" canonical={null} />
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="border-b border-fuchsia-100/80 pb-6 mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-slate-500">
            Manage your account, security, and profile
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-fuchsia-100/50 mb-6">
          {["account", "security", "profile"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`
                flex-1 py-3 text-sm font-semibold transition-colors $
                ${
                  section === key
                    ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white"
                    : "text-slate-500 hover:text-fuchsia-600"
                }
              `}
            >
              {{
                account: "Account",
                security: "Security",
                profile: "Profile",
              }[key]}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600">
            {success}
          </div>
        )}

        {/* Account Section */}
        {section === "account" && (
          <GlassCard className="p-6 rounded-2xl mb-4">
            <h2 className="text font-bold text-slate-800 mb-4">Account</h2>

            {editing ? (
              <form onSubmit={e => {
                e.preventDefault();
                handleSave();
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={form.full_name}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                      disabled
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/30 transition-all"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="flex-1 bg-white border border-fuchsia-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-fuchsia-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <p className="text-slate-600">Full Name</p>
                  <p className="font-bold text-slate-800">{profile?.full_name || "—not set—"}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-slate-600">Username</p>
                  <p className="font-bold text-slate-800">{profile?.username || "—not set—"}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-slate-600">Email</p>
                  <p className="font-bold text-slate-800">{profile?.email || "—not set—"}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-slate-600">Phone</p>
                  <p className="font-bold text-slate-800">{profile?.phone || "—not set—"}</p>
                </div>

                <button
                  onClick={() => setEditing(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/30 transition-all"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>
            )}
          </GlassCard>
        )}

        {/* Security Section */}
        {section === "security" && (
          <>
          <GlassCard className="p-6 rounded-2xl mb-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-bold text-slate-800">Transaction PIN</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {pinStatus.loading
                    ? "Checking PIN status…"
                    : pinStatus.hasPin
                    ? "A PIN is required for data and airtime purchases."
                    : "Optional. Set a four-digit PIN to protect wallet purchases."}
                </p>
                {/* The status fetch and the save action report the same service-unavailable
                    message from the same source. Rendering both leaves the identical
                    sentence on screen twice, so the status banner yields to the
                    action error (which is the one carrying role="alert"). */}
                {pinStatus.error && pinError !== pinStatus.error && (
                  <p className="text-xs text-amber-700 mt-1">{pinStatus.error}</p>
                )}
              </div>
              <Lock className="w-5 h-5 text-fuchsia-600 shrink-0 mt-1" />
            </div>

            {pinError && (
              <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {pinError}
              </p>
            )}
            {pinSuccess && (
              <p role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {pinSuccess}
              </p>
            )}

            <form onSubmit={handleTransactionPinSave} className="space-y-4">
              {pinStatus.hasPin && !pinRecovery && (
                <div>
                  <label htmlFor="current-transaction-pin" className="block text-sm font-medium text-slate-600 mb-1">
                    Current transaction PIN
                  </label>
                  <input
                    id="current-transaction-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    value={pinCurrent}
                    disabled={pinBusy}
                    onChange={(event) => setPinCurrent(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 px-3 py-2.5 text-sm tracking-[0.4em] focus:border-fuchsia-400 focus:bg-white"
                  />
                </div>
              )}

              {pinRecovery && (
                <div>
                  <label htmlFor="transaction-pin-account-password" className="block text-sm font-medium text-slate-600 mb-1">
                    Account password
                  </label>
                  <input
                    id="transaction-pin-account-password"
                    type="password"
                    autoComplete="current-password"
                    value={recoveryPassword}
                    disabled={pinBusy}
                    onChange={(event) => setRecoveryPassword(event.target.value)}
                    className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 px-3 py-2.5 text-sm focus:border-fuchsia-400 focus:bg-white"
                    placeholder="Verify your account password"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    A recent password sign-in is required to reset a forgotten PIN.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="new-transaction-pin" className="block text-sm font-medium text-slate-600 mb-1">
                  {pinStatus.hasPin ? "New transaction PIN" : "Transaction PIN"}
                </label>
                <input
                  id="new-transaction-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={4}
                  value={pinNew}
                  disabled={pinBusy}
                  onChange={(event) => setPinNew(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 px-3 py-2.5 text-sm tracking-[0.4em] focus:border-fuchsia-400 focus:bg-white"
                  placeholder="Four digits"
                  required
                />
              </div>

              <div>
                <label htmlFor="confirm-transaction-pin" className="block text-sm font-medium text-slate-600 mb-1">
                  Confirm transaction PIN
                </label>
                <input
                  id="confirm-transaction-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={4}
                  value={pinConfirm}
                  disabled={pinBusy}
                  onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 px-3 py-2.5 text-sm tracking-[0.4em] focus:border-fuchsia-400 focus:bg-white"
                  placeholder="Re-enter four digits"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={pinBusy || pinStatus.loading}
                  className="flex-1 min-w-40 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/20 transition-all disabled:opacity-50"
                >
                  {pinBusy
                    ? "Saving…"
                    : pinRecovery
                    ? "Verify & reset PIN"
                    : pinStatus.hasPin
                    ? "Change transaction PIN"
                    : "Set transaction PIN"}
                </button>
                {(pinStatus.hasPin || pinStatus.error) && !pinRecovery && (
                  <button
                    type="button"
                    onClick={() => { setPinRecovery(true); setPinError(""); setPinSuccess(""); }}
                    className="px-3 py-2.5 rounded-xl border border-fuchsia-200 text-sm font-semibold text-fuchsia-700 hover:bg-fuchsia-50"
                  >
                    Forgot PIN?
                  </button>
                )}
                {pinRecovery && (
                  <button
                    type="button"
                    onClick={() => { setPinRecovery(false); setPinError(""); setRecoveryPassword(""); }}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel recovery
                  </button>
                )}
              </div>
            </form>
          </GlassCard>

          <GlassCard className="p-6 rounded-2xl mb-4">
            <h2 className="text font-bold text-slate-800 mb-4">Security</h2>

            {editing ? (
              <form onSubmit={e => {
                e.preventDefault();
                handleSave();
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      name="current_password"
                      value={form.current_password}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      name="new_password"
                      value={form.new_password}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                      placeholder="New password (min 6 chars)"
                      minlength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      name="confirm_password"
                      value={form.confirm_password}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/30 transition-all"
                    >
                      Update Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="flex-1 bg-white border border-fuchsia-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-fuchsia-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div>
                <p className="text-slate-500 text-sm mb-4">
                  Keep your account secure. You can change your password below.
                </p>

                <button
                  onClick={() => setEditing(true)}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/30 transition-all">
                  <Lock className="w-4 h-4" />
                  Change Password
                </button>
              </div>
            )}
          </GlassCard>
          </>
        )}

        {/* Profile Section */}
        {section === "profile" && (
          <GlassCard className="p-6 rounded-2xl mb-4">
            <h2 className="text font-bold text-slate-800 mb-4">Profile</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Profile Picture
                </label>
                {profile?.full_name ? (
                  <div className="w-20 h-20 rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold">
                    {profile.full_name.split(" ")[0][0]}
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-fuchsia-600 transition-colon"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      Add profile picture
                    </button>
                    <p className="text-xs text-slate-500">Upload or capture a profile picture</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Full Name
                </label>
                <p className="font-bold text-slate-800">{profile?.full_name || "—not set—"}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Username
                </label>
                <p className="font-bold text-slate-800">{profile?.username || "—not set—"}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Email
                </label>
                <p className="font-bold text-slate-800">{profile?.email || "—not set—"}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Phone
                </label>
                <p className="font-bold text-slate-800">{profile?.phone || "—not set—"}</p>
              </div>
            </div>

            {editing ? (
              <form onSubmit={e => {
                e.preventDefault();
                handleSave();
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={form.full_name}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white pl-3 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/30 transition-all">
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="flex-1 bg-white border border-fuchsia-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-fuchsia-50 transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full flex items-center justify-center gap-2 mt-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/30 transition-all">
                <Users className="w-4 h-4 shrink-0" />
                Edit Profile
              </button>
            )}
          </GlassCard>
        )}

        {/* Footer links */}
        <div className="mt-8 pt-8 border-t border-fuchsia-100/50 text-center text-sm text-slate-500">
          <Link to="/fund-wallet" className="hover:text-fuchsia-600 transition-colors">
            Fund Wallet
          </Link> |
          <Link to="/transactions" className="hover:text-fuchsia-600 transition-colors">
            Transaction History
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
