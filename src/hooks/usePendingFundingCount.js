import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

/**
 * Admin-only pending funding requests count.
 * - Head-count query (no rows) for performance
 * - Polling 30s + realtime + visibility/focus refetch
 * - Only runs for is_admin
 */
export default function usePendingFundingCount() {
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);
  const channelRef = useRef(null);

  const fetchCount = useCallback(async () => {
    if (!isAdmin) {
      setCount(0);
      return;
    }
    try {
      const { count: c, error } = await supabase
        .from("funding_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!error) setCount(c || 0);
    } catch (_e) {
      void _e;
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(0);
      return;
    }

    fetchCount();

    intervalRef.current = setInterval(fetchCount, 30000);

    // Realtime: any change to funding_requests triggers recount (debounced)
    try {
      channelRef.current = supabase
        .channel("funding-pending-notifier")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "funding_requests" },
          () => {
            // small debounce to coalesce rapid changes
            setTimeout(fetchCount, 300);
          },
        )
        .subscribe();
    } catch (_e) {
      void _e;
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    const onFocus = () => fetchCount();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (_e) {
          void _e;
          try {
            channelRef.current.unsubscribe();
          } catch (_e2) {
            void _e2;
          }
        }
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [isAdmin, fetchCount]);

  return count;
}
