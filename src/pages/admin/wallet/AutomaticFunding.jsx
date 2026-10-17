import FundingRequests from "./FundingRequests";

// Admin → Automatic Funding.
// Lists only requests with a non-null `payment_reference` — every Monnify
// reserved-account payment — and shows its settlement state and references.
// Approval is intentionally unavailable: crediting here would bypass the webhook
// that verifies the payment against Monnify. Rejection stays available because
// it moves no money.
export default function AutomaticFunding() {
  return <FundingRequests mode="automatic" />;
}