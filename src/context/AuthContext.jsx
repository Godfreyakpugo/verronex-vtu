// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import supabase from "../lib/supabaseClient";

// ─── 1. Create the context ────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── 2. The Provider (wraps the entire app) ───────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // row from `profiles` table
  const [wallet, setWallet] = useState(null); // row from `wallets` table
  const [loading, setLoading] = useState(true); // true until first auth check completes

  // ── Fetch helpers ────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[AuthContext] fetchProfile error:", error.message);
      return null;
    }
    return data;
  }, []);

  const fetchWallet = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("[AuthContext] fetchWallet error:", error.message);
      return null;
    }
    return data;
  }, []);

  // ── Shared hydration logic ───────────────────────────────────────────────────
  const hydrateUserData = useCallback(
    async (userId, isNewSignIn = false) => {
      // Wait for handle_new_user() DB trigger to finish on fresh sign-ups
      if (isNewSignIn) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      const [profileData, walletData] = await Promise.all([
        fetchProfile(userId),
        fetchWallet(userId),
      ]);

      setProfile(profileData);
      setWallet(walletData);
    },
    [fetchProfile, fetchWallet],
  );

  // ── Core: Initialize + listen to auth state ──────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Check for an existing session on page load/refresh
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await hydrateUserData(session.user.id, false);
      }

      setLoading(false);
    });

    // Real-time listener — fires on login, logout, token refresh, tab focus
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const isNewSignIn = event === "SIGNED_IN";
        await hydrateUserData(session.user.id, isNewSignIn);
      } else {
        // User signed out — clear all personal state
        setProfile(null);
        setWallet(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateUserData]);

  // ─── 3. Auth Actions ─────────────────────────────────────────────────────────

  const signUp = async ({ email, password, fullName, phone }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName, // stored in auth.users.raw_user_meta_data
          phone: phone,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // ─── 4. Manual Refresh Actions (call after transactions) ─────────────────────

  const refreshWallet = useCallback(async () => {
    if (!user) return;
    const walletData = await fetchWallet(user.id);
    setWallet(walletData);
  }, [user, fetchWallet]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    setProfile(profileData);
  }, [user, fetchProfile]);

  // ─── 5. Context Value ─────────────────────────────────────────────────────────
  const value = {
    // State
    user,
    session,
    profile,
    wallet,
    loading,
    // Auth actions
    signUp,
    signIn,
    signOut,
    // Refresh actions
    refreshWallet,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── 6. Custom hook ───────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuth() must be used within <AuthProvider>. Wrap your app in main.jsx.",
    );
  }
  return context;
}
