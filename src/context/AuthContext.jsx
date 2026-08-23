// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
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

  // Single-flight guard: only one hydration may run per user transition.
  const hydrationInFlightRef = useRef(null);

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
      let profileData = null;

      if (isNewSignIn) {
        let attempts = 0;

        while (!profileData && attempts < 10) {
          profileData = await fetchProfile(userId);
          if (!profileData) {
            attempts += 1;
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      } else {
        profileData = await fetchProfile(userId);
      }

      // Deactivated accounts must not get a working session. The profile is
      // read with the caller's own JWT through RLS, then the session is
      // actively revoked rather than just hidden in the UI.
      if (profileData?.deactivated_at) {
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          // A failed revoke request must never trap the app on the loader —
          // local state is cleared regardless below.
          console.error(
            "[AuthContext] sign-out for deactivated account failed:",
            signOutError?.message,
          );
        }
        setUser(null);
        setSession(null);
        setProfile(null);
        setWallet(null);
        return null;
      }

      const walletData = await fetchWallet(userId);
      setProfile(profileData);
      setWallet(walletData);
      return profileData;
    },
    [fetchProfile, fetchWallet],
  );

  // Single-flight hydration: concurrent triggers for the same user (startup
  // getSession + INITIAL_SESSION/SIGNED_IN event) share one running promise
  // instead of racing duplicates. The new-signup retry loop inside
  // hydrateUserData is untouched and still completes within that promise.
  const runHydration = useCallback(
    async (userId, isNewSignIn = false) => {
      const inFlight = hydrationInFlightRef.current;
      if (inFlight && inFlight.userId === userId) {
        return inFlight.promise;
      }

      const promise = hydrateUserData(userId, isNewSignIn).finally(() => {
        if (hydrationInFlightRef.current?.promise === promise) {
          hydrationInFlightRef.current = null;
        }
      });

      hydrationInFlightRef.current = { userId, promise };
      return promise;
    },
    [hydrateUserData],
  );

  // ── Core: Initialize + listen to auth state ──────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Check for an existing session on page load/refresh.
    // Every path below is guaranteed to clear `loading` — a rejected session
    // recovery or hydration failure falls back to signed-out so protected
    // routes redirect to login instead of spinning forever.
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            await runHydration(session.user.id, false);
          } catch (hydrationError) {
            console.error(
              "[AuthContext] initial hydration failed:",
              hydrationError?.message,
            );
          }
        }

        if (mounted) setLoading(false);
      })
      .catch((sessionError) => {
        // Session recovery itself failed (e.g. network during token refresh).
        console.error(
          "[AuthContext] session recovery failed:",
          sessionError?.message,
        );
        if (!mounted) return;
        setUser(null);
        setSession(null);
        setProfile(null);
        setWallet(null);
        setLoading(false);
      });

    // Real-time listener — fires on login, logout, token refresh, tab focus.
    // Wrapped so one failing event can neither throw an unhandled rejection
    // nor break subsequent auth events; loading always settles.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      try {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const isNewSignIn = event === "SIGNED_IN";
          await runHydration(session.user.id, isNewSignIn);
        } else {
          // User signed out — clear all personal state
          setProfile(null);
          setWallet(null);
        }
      } catch (eventError) {
        console.error(
          `[AuthContext] auth event "${event}" handling failed:`,
          eventError?.message,
        );
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [runHydration]);

  // ─── 3. Auth Actions ─────────────────────────────────────────────────────────

  const signUp = async ({ email, password, fullName, username, phone }) => {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName,
          username,
          phone,
        },
      },
    });

    console.log("SIGNUP RESULT:", result);

    if (result.error) {
      console.error("SUPABASE SIGNUP ERROR:", result.error);
      throw result.error;
    }

    return result.data;
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Reject deactivated accounts: read the profile with this user's own
    // authenticated session and refuse login if the account was deactivated.
    const profileData = await fetchProfile(data.user.id);
    if (profileData?.deactivated_at) {
      await supabase.auth.signOut();
      throw new Error(
        "This account has been deactivated. Please contact support.",
      );
    }

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
