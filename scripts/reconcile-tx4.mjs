#!/usr/bin/env node
/**
 * Reconcile tx4 (AIRTIME-1787739279706-eb6a3548) by calling
 * complete_airtime_purchase with the provider details from Gladtidings.
 *
 * Required env vars:
 *   TEST_USER_EMAIL     – email of the test user
 *   TEST_USER_PASSWORD  – password of the test user
 *   SUPABASE_URL        – project URL
 *   SUPABASE_ANON_KEY   – project anon key
 *
 * Provider fields to fill in (from Gladtidings dashboard):
 *   PROVIDER_ID         – the "id" field from Gladtidings response
 *   PROVIDER_IDENT      – the "ident" field from Gladtidings response
 *   PROVIDER_RESPONSE   – full JSON string of the Gladtidings response
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────
const REFERENCE = "AIRTIME-1787739279706-eb6a3548";

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY;
const EMAIL         = process.env.TEST_USER_EMAIL;
const PASSWORD      = process.env.TEST_USER_PASSWORD;

const PROVIDER_ID       = process.env.PROVIDER_ID;
const PROVIDER_IDENT    = process.env.PROVIDER_IDENT;
const PROVIDER_RESPONSE = process.env.PROVIDER_RESPONSE;

// ── Validate env ────────────────────────────────────────────────────
const missing = [];
if (!SUPABASE_URL)  missing.push("SUPABASE_URL");
if (!SUPABASE_KEY)  missing.push("SUPABASE_ANON_KEY");
if (!EMAIL)         missing.push("TEST_USER_EMAIL");
if (!PASSWORD)      missing.push("TEST_USER_PASSWORD");
if (!PROVIDER_ID)   missing.push("PROVIDER_ID");
if (!PROVIDER_IDENT) missing.push("PROVIDER_IDENT");
if (!PROVIDER_RESPONSE) missing.push("PROVIDER_RESPONSE");

if (missing.length > 0) {
  console.error("Missing required env vars:", missing.join(", "));
  process.exit(1);
}

// ── Main ────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // 1. Sign in
  console.log(`Signing in as ${EMAIL}...`);
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (authError || !auth.session) {
    console.error("Auth failed:", authError?.message ?? "no session");
    process.exit(1);
  }
  console.log("Auth OK. User ID:", auth.user.id);

  // 2. Check current transaction state
  console.log(`\nFetching transaction ${REFERENCE}...`);
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("id, status, amount, reference")
    .eq("reference", REFERENCE)
    .single();

  if (txError || !tx) {
    console.error("Transaction not found:", txError?.message ?? "none");
    process.exit(1);
  }
  console.log("Current status:", tx.status);

  if (tx.status === "successful") {
    console.log("Already successful — nothing to do.");
    process.exit(0);
  }

  if (tx.status !== "pending") {
    console.error("Unexpected status:", tx.status, "— aborting.");
    process.exit(1);
  }

  // 3. Build metadata
  let providerResponse;
  try {
    providerResponse = JSON.parse(PROVIDER_RESPONSE);
  } catch {
    console.error("PROVIDER_RESPONSE is not valid JSON");
    process.exit(1);
  }

  const metadata = {
    provider: "gladtidings",
    provider_transaction_id: Number(PROVIDER_ID),
    provider_ident: PROVIDER_IDENT,
    provider_response: providerResponse,
  };

  console.log("\nCalling complete_airtime_purchase with metadata:");
  console.log(JSON.stringify(metadata, null, 2));

  // 4. Call the RPC
  const { data: result, error: rpcError } = await supabase.rpc(
    "complete_airtime_purchase",
    {
      p_reference: REFERENCE,
      p_metadata: metadata,
    }
  );

  if (rpcError) {
    console.error("RPC failed:", rpcError.message);
    process.exit(1);
  }

  console.log("RPC returned:", result);

  // 5. Verify
  const { data: updated, error: verifyError } = await supabase
    .from("transactions")
    .select("reference, status, amount, metadata")
    .eq("reference", REFERENCE)
    .single();

  if (verifyError || !updated) {
    console.error("Verification query failed:", verifyError?.message ?? "none");
    process.exit(1);
  }

  console.log("\nVerification — full row:");
  console.log(JSON.stringify(updated, null, 2));

  if (updated.status === "successful") {
    console.log("\nReconciliation complete.");
  } else {
    console.error("Unexpected final status:", updated.status);
    process.exit(1);
  }
}

main();
