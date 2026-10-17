import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

// Automatic funding requests cannot be approved or rejected by an admin — they
// settle through the Monnify webhook. Showing a live pending count for them is
// therefore an alert nobody can act on, and it never clears on its own.
//
// Instead the automatic count means "requests created since you last opened the
// Automatic Funding page". Manual keeps a true pending count, because those DO
// need an admin decision.
const AUTOMATIC_SEEN_KEY = "verronex.admin.funding.automaticSeenAt";
const AUTOMATIC_SEEN_EVENT = "verronex:funding-automatic-seen";

function readSeenAt() {
  try {
    return window.localStorage.getItem(AUTOMATIC_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeenAt(value) {
  try {
    window.localStorage.setItem(AUTOMATIC_SEEN_KEY, value);
  } catch {
    /* private mode / storage disabled — badge falls back to plain pending */
  }
}

/**
 * Admin-only pending funding counts, split by funding type.
 *
 * The discriminator is `payment_reference`:
 *   - automatic requests get a non-null `payment_reference` when created by the
 *     init-monnify-funding edge function
 *   - manual requests created from Fund Wallet omit it entirely (column default
 *     NULL), and only ever carry a customer-supplied bank `reference`
 *
 * Returns `{ manual, automatic, total }` where:
 *   - `manual`    — pending requests awaiting an approve/reject decision
 *   - `automatic` — automatic requests created since the admin last viewed them
 *   - `total`     — sum, used for the mobile menu dot
 *
 * Head-count queries (no rows) for performance. Polling 30s + realtime +
 * visibility/focus refetch. Only runs for is_admin.
 */
export default function usePendingFundingCount() {
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  const [counts, setCounts] = useState({ manual: 0, automatic: 0, total: 0 });
  const intervalRef = useRef(null);
  const channelRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!isAdmin) {
      setCounts({ manual: 0, automatic: 0, total: 0 });
      return;
    }

    const seenAt = readSeenAt();

    const manualQuery = supabase
      .from("funding_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("payment_reference", null);

    let automaticQuery = supabase
      .from("funding_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .not("payment_reference", "is", null);

    // Only count what the admin has not already seen. Until they open the
    // page once, everything pending is unseen.
    if (seenAt) automaticQuery = automaticQuery.gt("created_at", seenAt);

    const [manual, automatic] = await Promise.all([manualQuery, automaticQuery]);

    const manualCount = manual.error ? 0 : manual.count || 0;
    const automaticCount = automatic.error ? 0 : automatic.count || 0;

    setCounts({
      manual: manualCount,
      automatic: automaticCount,
      total: manualCount + automaticCount,
    });
  }, [isAdmin]);

  // The Automatic Funding page dispatches this on mount. Clearing here rather
  // than in the page keeps the count state in one place, and the badge updates
  // immediately instead of waiting for the next poll.
  useEffect(() => {
    if (!isAdmin) return undefined;

    const onSeen = () => {
      writeSeenAt(new Date().toISOString());
      setCounts((prev) => ({ ...prev, automatic: 0, total: prev.manual }));
    };

    window.addEventListener(AUTOMATIC_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(AUTOMATIC_SEEN_EVENT, onSeen);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounts({ manual: 0, automatic: 0, total: 0 });
      return;
    }

    fetchCounts();

    intervalRef.current = setInterval(fetchCounts, 30000);

    // Realtime: any change to funding_requests triggers recount (debounced)
    try {
      channelRef.current = supabase
        .channel("funding-pending-notifier")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "funding_requests" },
          () => {
            // small debounce to coalesce rapid changes
            setTimeout(fetchCounts, 300);
          },
        )
        .subscribe();
    } catch (_e) {
      void _e;
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCounts();
    };
    const onFocus = () => fetchCounts();

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
  }, [isAdmin, fetchCounts]);

  return counts;
}

export { AUTOMATIC_SEEN_EVENT };