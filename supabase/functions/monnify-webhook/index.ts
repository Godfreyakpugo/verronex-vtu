import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, monnify-signature, x-monnify-signature",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sha512Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-512", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  // Use service_role for all DB operations (webhook has no user JWT)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const monnifySecret = Deno.env.get("MONNIFY_SECRET_KEY") || "";
  const monnifyEnv = (Deno.env.get("MONNIFY_ENV") || "sandbox").toLowerCase();
  const isLive = monnifyEnv === "live" || monnifyEnv === "production";

  // Get raw body for signature verification (must be exact string Monnify sent)
  const rawBody = await req.text();
  let body: {
    eventType?: string;
    eventData?: {
      paymentReference?: string;
      transactionReference?: string;
      paymentStatus?: string;
      amountPaid?: string | number;
      paidOn?: string;
      transactionHash?: string;
      customer?: { email?: string };
      amount?: string | number;
    };
    // Monnify sometimes sends eventData at top level
    paymentReference?: string;
    transactionReference?: string;
    paymentStatus?: string;
    amountPaid?: string | number;
  } | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    console.warn("[monnify-webhook] malformed JSON");
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  if (!body) {
    return Response.json({ error: "Empty body" }, { status: 400, headers: corsHeaders });
  }

  // 1. Optional IP defense (additional, not sole) — Monnify documents 35.242.133.146
  const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  if (forwardedFor && !forwardedFor.includes("35.242.133.146")) {
    console.log("[monnify-webhook] IP not in whitelist (logged, not blocking)", { forwardedFor });
  }

  // 1b. Signature validation (production only, per Monnify docs: sandbox has no monnify-signature)
  const signatureHeader = req.headers.get("monnify-signature") || req.headers.get("x-monnify-signature") || req.headers.get("Monnify-Signature");
  if (isLive) {
    if (!signatureHeader) {
      console.warn("[monnify-webhook] missing signature in live mode");
      return Response.json({ error: "Missing signature" }, { status: 401, headers: corsHeaders });
    }
    if (!monnifySecret) {
      console.error("[monnify-webhook] MONNIFY_SECRET_KEY not configured");
      return Response.json({ error: "Server misconfigured" }, { status: 500, headers: corsHeaders });
    }

    // Production signature: HMAC-SHA512(rawBody, secret) per current Monnify docs
    // Use exact rawBody as received (do not re-stringify)
    const computed = await hmacSha512Hex(monnifySecret, rawBody);
    const provided = signatureHeader.trim().toLowerCase();
    if (!timingSafeEqual(computed.toLowerCase(), provided)) {
      console.warn("[monnify-webhook] signature mismatch", { provided: provided.slice(0, 8) + "..." });
      return Response.json({ error: "Invalid signature" }, { status: 401, headers: corsHeaders });
    }
  } else {
    if (signatureHeader) {
      console.log("[monnify-webhook] sandbox: signature header present but not enforced");
    } else {
      console.log("[monnify-webhook] sandbox: no signature header (expected)");
    }
  }

  // 2. Extract event type and data (handle both nesting styles)
  const eventType: string | undefined = (body as { eventType?: string })?.eventType;
  const eventData = (body as { eventData?: Record<string, unknown> })?.eventData as Record<string, unknown> | undefined;

  // Monnify sends SUCCESSFUL_TRANSACTION for collections (docs) — also handle SUCCESSFUL_COLLECTION
  const normalizedEventType = (eventType || "").toUpperCase();
  const isSuccessEvent = normalizedEventType === "SUCCESSFUL_TRANSACTION" || normalizedEventType === "SUCCESSFUL_COLLECTION";

  // If not a success event, do not credit but return 200 so Monnify stops retrying intentionally rejected statuses
  if (!isSuccessEvent) {
    console.log("[monnify-webhook] non-success event, ignoring", { eventType });
    return Response.json({ received: true, ignored: true, reason: `Event ${eventType} not processed` }, { headers: corsHeaders });
  }

  // Extract fields — support both eventData nested and top-level for robustness
  const data = (eventData || body) as Record<string, unknown>;
  const paymentReference = (data.paymentReference as string) || (data.payment_reference as string) || "";
  const transactionReference = (data.transactionReference as string) || (data.transaction_reference as string) || "";
  const paymentStatus = (data.paymentStatus as string) || (data.payment_status as string) || "";
  const amountPaidRaw = data.amountPaid ?? data.amount ?? data.paidAmount;
  const transactionHash = (data.transactionHash as string) || "";

  if (!paymentReference || !transactionReference) {
    console.warn("[monnify-webhook] missing references", { paymentReference, transactionReference });
    return Response.json({ error: "Missing paymentReference or transactionReference" }, { status: 400, headers: corsHeaders });
  }

  // Only process PAID status (Monnify collections use PAID for success)
  const normalizedStatus = String(paymentStatus).toUpperCase();
  if (normalizedStatus !== "PAID") {
    console.log("[monnify-webhook] non-PAID status, ignoring", { paymentStatus, paymentReference });
    return Response.json({ received: true, ignored: true, reason: `Status ${paymentStatus} not PAID` }, { headers: corsHeaders });
  }

  const amountPaid = Number(amountPaidRaw);
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    console.warn("[monnify-webhook] invalid amountPaid", { amountPaidRaw });
    return Response.json({ error: "Invalid amountPaid" }, { status: 400, headers: corsHeaders });
  }

  // Currency validation — must be NGN where supplied
  const currency = (data.currency as string) || (data.currencyCode as string) || "";
  if (currency && currency.toUpperCase() !== "NGN") {
    console.warn("[monnify-webhook] currency mismatch", { currency, paymentReference });
    return Response.json({ error: "Invalid currency" }, { status: 400, headers: corsHeaders });
  }

  // Optional: validate transactionHash if present (Monnify docs: transactionHash validation)
  // We log it but do not fail if missing — not all events include it
  if (transactionHash) {
    console.log("[monnify-webhook] transactionHash present", transactionHash.slice(0, 8) + "...");
  }

  // 3. Call atomic Monnify processing RPC (single transaction: funding_request lock + amount/trx validation + monnify_events insert + wallet credit)
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("process_monnify_funding", {
    p_payment_reference: paymentReference,
    p_transaction_reference: transactionReference,
    p_amount_paid: amountPaid,
    p_event_type: eventType || "SUCCESSFUL_TRANSACTION",
    p_payload: body as unknown as Record<string, unknown>,
  });

  if (rpcError) {
    console.error("[monnify-webhook] process_monnify_funding failed", rpcError.message);
    // RPC raises with specific codes for amount mismatch etc., but we treat all as 500 unless it's a known mismatch
    return Response.json({ error: "Failed to process funding" }, { status: 500, headers: corsHeaders });
  }

  const result = rpcData as {
    success?: boolean;
    credited?: boolean;
    duplicate?: boolean;
    already_processed?: boolean;
    orphan?: boolean;
    mismatch?: boolean;
    code?: string;
    error?: string;
    new_balance?: number;
  };

  if (result?.orphan) {
    console.warn("[monnify-webhook] orphan", { paymentReference });
    return Response.json({ received: true, orphan: true }, { headers: corsHeaders });
  }
  if (result?.mismatch) {
    console.warn("[monnify-webhook] amount mismatch", result);
    return Response.json({ received: true, ignored: true, reason: "Amount mismatch" }, { headers: corsHeaders });
  }
  if (result?.duplicate) {
    console.log("[monnify-webhook] duplicate", { transactionReference });
    return Response.json({ received: true, duplicate: true }, { headers: corsHeaders });
  }
  if (result?.already_processed) {
    console.log("[monnify-webhook] already processed", { paymentReference });
    return Response.json({ received: true, alreadyProcessed: true }, { headers: corsHeaders });
  }
  if (result?.code === "trx_mismatch") {
    console.warn("[monnify-webhook] transaction reference mismatch", result);
    return Response.json({ error: "Transaction reference mismatch" }, { status: 400, headers: corsHeaders });
  }
  if (result?.success && result?.credited) {
    console.log("[monnify-webhook] credited", { paymentReference, transactionReference, amountPaid, new_balance: result.new_balance });
    return Response.json({ received: true, credited: true, new_balance: result.new_balance }, { headers: corsHeaders });
  }

  // Fallback: treat as already processed to avoid retry loop on transient
  console.log("[monnify-webhook] unhandled result, treating as success", result);
  return Response.json({ received: true }, { headers: corsHeaders });
});
