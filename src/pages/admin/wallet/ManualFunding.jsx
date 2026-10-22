import FundingRequests from "./FundingRequests";
import ManualFundingSettings from "./ManualFundingSettings";

// Admin → Manual Funding.
// Lists only requests with `payment_reference IS NULL` — the bank-transfer
// requests customers submit from Fund Wallet — and keeps the approve/reject
// controls that settle them.
export default function ManualFunding() {
  return (
    <>
      <ManualFundingSettings />
      <FundingRequests mode="manual" />
    </>
  );
}
