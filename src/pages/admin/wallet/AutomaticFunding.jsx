import { useEffect } from "react";
import FundingRequests from "./FundingRequests";
import { AUTOMATIC_SEEN_EVENT } from "../../../hooks/usePendingFundingCount";

// Admin → Automatic Funding.
// Lists only requests with a non-null `payment_reference` — every Monnify
// reserved-account payment — and shows its settlement state and references.
// Approval is intentionally unavailable: crediting here would bypass the webhook
// that verifies the payment against Monnify. Rejection stays unavailable too,
// because it takes a request out of `pending` and would strand a payment that
// is still in flight.
//
// Opening this page marks the automatic requests as seen, which clears the
// sidebar badge. Nothing here needs an admin decision, so a count that can
// never be actioned should not sit on the screen permanently.
export default function AutomaticFunding() {
  useEffect(() => {
    window.dispatchEvent(new Event(AUTOMATIC_SEEN_EVENT));
  }, []);

  return <FundingRequests mode="automatic" />;
}
