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

  // Id of the user whose profile/wallet are currently loaded. `null` means no
  // identity is hydrated, so no personal data is exposed. Combined with the
  // auth session this is what decides whether the app is ready to render —
  // see `ready` below.
  const [hydratedUserId, setHydratedUserId] = useState(null);

  // Single-flight guard: only one hydration may run per user transition.
  // Stores whether the in-flight attempt is a new sign-in, because only a new
  // sign-in is allowed the bounded profile retry.
  const hydrationInFlightRef = useRef(null);

  // Mirrors `hydratedUserId` so the auth event listener can synchronously tell
  // whether an incoming identity is the one already loaded.
  const hydratedUserIdRef = useRef(null);

  // When the authenticated user changes, drop the previous identity's profile
  // and wallet immediately and put the app back into its not-ready state.
  // Without this, a sign-out/sign-in transition rendered children immediately
  // with `profile === null`, which bounced admins out of /admin/* (App.jsx
  // AdminRoute) and briefly showed a false zero wallet balance.
  const prepareForIdentity = useCallback((nextUserId) => {
    const next = nextUserId ?? null;
    if (hydratedUserIdRef.current === next) return;

    hydratedUserIdRef.current = null;
    setHydratedUserId(null);
    setProfile(null);
    setWallet(null);
    setLoading(true);
  }, []);

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
        hydratedUserIdRef.current = null;
        setHydratedUserId(null);
        setUser(null);
        setSession(null);
        setProfile(null);
        setWallet(null);
        return null;
      }

      const walletData = await fetchWallet(userId);
      // Hydration has settled for this identity. This is recorded even when
      // the profile read came back empty (e.g. a transient PostgREST error):
      // that is a settled "not an admin / no profile" state the routes
      // already handle, and it must not strand the app on a loader.
      hydratedUserIdRef.current = userId;
      setHydratedUserId(userId);
      setProfile(profileData);
      setWallet(walletData);
      return profileData;
    },
    [fetchProfile, fetchWallet],
  );

  // Starts a hydration pass and records it as the in-flight one. Kept separate
  // from `runHydration` so that function can re-invoke it without referencing
  // its own const binding.
  const startHydration = useCallback(
    (userId, isNewSignIn) => {
      const promise = hydrateUserData(userId, isNewSignIn).finally(() => {
        if (hydrationInFlightRef.current?.promise === promise) {
          hydrationInFlightRef.current = null;
        }
      });

      hydrationInFlightRef.current = { userId, isNewSignIn, promise };
      return promise;
    },
    [hydrateUserData],
  );

  // Single-flight hydration: concurrent triggers for the same user (startup
  // getSession + INITIAL_SESSION/SIGNED_IN event) share one running promise
  // instead of racing duplicates.
  //
  // The one exception is a new sign-in arriving while an *ordinary* hydration
  // for the same user is already running. Previously that new sign-in simply
  // joined the ordinary attempt and its bounded profile retry was lost, so a
  // freshly created `profiles` row could never be picked up and the user was
  // left with `profile === null` until a full page reload. In that case we
  // join the in-flight attempt and then run one more hydration *with* the
  // retry enabled. The retry is bounded (10 attempts) and the second pass
  // only starts after the first has settled, so this cannot loop.
  const runHydration = useCallback(
    async (userId, isNewSignIn = false) => {
      const inFlight = hydrationInFlightRef.current;

      if (inFlight && inFlight.userId === userId) {
        if (!isNewSignIn || inFlight.isNewSignIn) {
          return inFlight.promise;
        }
        return inFlight.promise.then(() => startHydration(userId, true));
      }

      return startHydration(userId, isNewSignIn);
    },
    [startHydration],
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

        prepareForIdentity(session?.user?.id ?? null);
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
        hydratedUserIdRef.current = null;
        setHydratedUserId(null);
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
        prepareForIdentity(session?.user?.id ?? null);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const isHydrating = event === "SIGNED_IN" || event === "INITIAL_SESSION";
          if (isHydrating) {
            const isNewSignIn = event === "SIGNED_IN";
            await runHydration(session.user.id, isNewSignIn);
          }
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
  }, [runHydration, prepareForIdentity]);

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
    // This lookup is bounded so a hanging PostgREST request cannot hold the
    // login spinner indefinitely (see production hang diagnosis). Successful
    // auth is not invalidated by a profile timeout — hydration will retry.
    let profileData = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    try {
      const { data: fetchedProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .abortSignal(controller.signal)
        .single();

      if (profileError) {
        if (controller.signal.aborted) {
          console.warn(
            "[AuthContext] profile fetch timed out after 7s, proceeding with login",
          );
        } else {
          console.error("[AuthContext] fetchProfile error:", profileError.message);
        }
      } else {
        profileData = fetchedProfile;
      }
    } catch (err) {
      if (
        controller.signal.aborted ||
        err?.name === "AbortError" ||
        err?.message?.toLowerCase().includes("abort")
      ) {
        console.warn(
          "[AuthContext] profile fetch aborted/timed out, proceeding with login:",
          err?.message,
        );
      } else {
        console.error("[AuthContext] profile fetch failed:", err?.message);
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (profileData?.deactivated_at) {
      try {
        await supabase.auth.signOut();
      } catch {
        // signOut may fail if session is already invalid — that's acceptable
      }
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

  // Ready only when the auth check has settled AND the data currently in
  // context belongs to the currently signed-in user. Previously `loading` was
  // a one-way latch that never returned to true, so route guards rendered
  // children mid-transition with `profile === null`. Exposed as `loading`
  // because that is what App.jsx already renders a full-screen loader for.
  const ready = user
    ? !loading && user.id === hydratedUserId
    : !loading && hydratedUserId === null;

  const value = {
    // State
    user,
    session,
    profile,
    wallet,
    loading: !ready,
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
