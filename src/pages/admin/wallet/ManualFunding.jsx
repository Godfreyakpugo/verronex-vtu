import FundingRequests from "./FundingRequests";

// Admin → Manual Funding.
// Lists only requests with `payment_reference IS NULL` — the bank-transfer
// requests customers submit from Fund Wallet — and keeps the approve/reject
// controls that settle them.
export default function ManualFunding() {
  return <FundingRequests mode="manual" />;
}