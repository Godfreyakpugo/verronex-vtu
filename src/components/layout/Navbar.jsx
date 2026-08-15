import { useState, useEffect } from "react";
import { Menu, Bell, Image, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import GlassCard from "../../components/ui/GlassCard";
import BrandLogo from "../ui/BrandLogo";

function Navbar({ onMenuClick }) {
  const { profile, wallet, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Sticky shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials =
    profile?.full_name?.[0]?.toUpperCase() ??
    profile?.email?.[0]?.toUpperCase() ??
    "U";

  const avatarUrl =
    profile?.avatar_url &&
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/avatars/${profile.id}?width=500`;

  return (
    <header
      className={`
        sticky top-0 z-30 h-16
        bg-white/75 backdrop-blur-2xl
        border-b border-white/60
        flex items-center justify-between px-4 lg:px-6
        transition-shadow duration-200
        ${scrolled ? "shadow-[0_4px_24px_rgba(139,92,246,0.10)]" : ""}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-fuchsia-50 text-slate-500 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand — mobile only */}
        <div className="lg:hidden">
          <BrandLogo size="sm" showText={false} />
        </div>

        {/* Avatar — click opens profile menu */}
        <button
          onClick={() => setAvatarModalOpen(true)}
          className="relative p-2 rounded-xl hover:bg-fuchsia-50 text-slate-400 transition-colors"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border-2 border-white/20"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
          )}
          {avatarModalOpen && (
            <X className="absolute -top-1 -right-1 w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Balance pill — dark vivid */}
        <div className="hidden sm:flex items-center gap-2 bg-linear-to-r from-indigo-900 via-purple-800 to-fuchsia-700 px-4 py-1.5 rounded-xl shadow-md shadow-purple-900/20">
          <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-widest">
            Balance
          </span>
          <span className="text-sm font-black text-white tracking-tight">
            ₦
            {parseFloat(wallet?.balance ?? 0).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Bell */}
        <button className="p-2 rounded-xl hover:bg-fuchsia-50 text-slate-400 transition-colors relative">
          <Bell className="w-5 h-5" />
        </button>

        {/* Avatar modal */}
        {avatarModalOpen && (
          <GlassCard className="absolute inset-0 bg-black/40 backdrop-blur-sm fixed top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-sm p-6 rounded-2xl flex flex-col items-center gap-4">
              <h3 className="text font-bold text-slate-800">Profile Picture</h3>
              {imageUri ? (
                <img
                  src={imageUri}
                  className="w-20 h-20 rounded-full object-cover mb-4"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-200 mb-4"></div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (e) => setImageUri(e.target.result);
                  reader.readAsDataURL(file);
                }}
                className="mt-2 w-full bg-fuchsia-50/50 border border-fuchsia-100 focus:border-fuchsia-400 focus:bg-white rounded-xl py-2 text-sm text-slate-700 cursor-pointer"
              /></GlassCard>
          </GlassCard>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          className="hidden sm:block text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

export default Navbar;