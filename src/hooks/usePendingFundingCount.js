import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

/**
 * Admin-only pending funding request counts, split by funding type.
 *
 * The discriminator is `payment_reference`:
 *   - automatic requests get a non-null `payment_reference` when created by the
 *     init-monnify-funding edge function
 *   - manual requests created from Fund Wallet omit it entirely (column default
 *     NULL), and only ever carry a customer-supplied bank `reference`
 *
 * - Head-count queries (no rows) for performance
 * - Polling 30s + realtime + visibility/focus refetch
 * - Only runs for is_admin
 */
export default function usePendingFundingCount() {
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  const [counts, setCounts] = useState({ manual: 0, automatic: 0 });
  const intervalRef = useRef(null);
  const channelRef = useRef(null);

  const fetchCount = useCallback(async () => {
    if (!isAdmin) {
      setCounts({ manual: 0, automatic: 0 });
      return;
    }
    try {
      const [manual, automatic] = await Promise.all([
        supabase
          .from("funding_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .is("payment_reference", null),
        supabase
          .from("funding_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .not("payment_reference", "is", null),
      ]);

      setCounts({
        manual: manual.error ? 0 : manual.count || 0,
        automatic: automatic.error ? 0 : automatic.count || 0,
      });
    } catch (_e) {
      void _e;
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounts({ manual: 0, automatic: 0 });
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

  return counts;
}