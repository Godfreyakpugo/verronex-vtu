import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

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

// Fail closed: only trimmed "sandbox" or "live" are accepted. Missing or
// unknown values must never silently select an environment. Same mapping as
// init-monnify-funding.
function resolveMonnifyEnv(): { mode: "sandbox" | "live"; baseUrl: string } | null {
  const mode = (Deno.env.get("MONNIFY_ENV") || "").trim().toLowerCase();
  if (mode === "sandbox") return { mode, baseUrl: "https://sandbox.monnify.com" };
  if (mode === "live") return { mode, baseUrl: "https://api.monnify.com" };
  return null;
}

type VerifyResult =
  | { ok: true; amountPaid: number }
  | { ok: false; reason: string }
  | { transient: true };

// Minimal database shape for the audit RPC — mirrors the parameters and json
// return of supabase/sql/monnify_verify_mismatch_audit.sql. The project has
// no generated Database types, so the client's generic rpc() cannot resolve
// this function's signature without it.
type VerifyMismatchDatabase = {
  public: {
    Tables: {
      // Only ever written through the service-role client inside this function,
      // purely as an audit trail. Typed so the insert resolves without casts.
      monnify_events: {
        Row: {
          transaction_reference: string;
          payment_reference: string;
          event_type: string;
          payload: Record<string, unknown>;
          created_at?: string;
        };
        Insert: {
          transaction_reference: string;
          payment_reference: string;
          event_type: string;
          payload: Record<string, unknown>;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      append_funding_verify_mismatch: {
        Args: {
          p_payment_reference: string;
          p_transaction_reference: string;
          p_webhook_amount: number;
          p_verified_amount: number | null;
          p_reason: string;
        };
        Returns: {
          success?: boolean;
          audited?: boolean;
          code?: string;
          funding_request_id?: string;
        };
      };
      // Atomic credit path (supabase/sql/monnify_process_funding.sql) — same
      // minimal-typing treatment so both rpc() calls resolve exactly.
      process_monnify_funding: {
        Args: {
          p_payment_reference: string;
          p_transaction_reference: string;
          p_amount_paid: number;
          p_event_type: string;
          p_payload: Record<string, unknown>;
        };
        Returns: {
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
      };
    };
  };
};

type AdminClient = SupabaseClient<VerifyMismatchDatabase>;

function toFiniteAmount(value: unknown): number | null {
  const n = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Server-to-server confirmation of the claimed payment. Returns ok only when
// Monnify itself reports the same PAID transaction; transient when Monnify
// could not be reached or answered ambiguously (caller must 500 so Monnify
// retries); definitive mismatch otherwise (caller must acknowledge without
// crediting so poison payloads cannot retry forever).
async function verifyMonnifyTransaction(
  baseUrl: string,
  apiKey: string,
  secretKey: string,
  paymentReference: string,
  expectedTransactionReference: string,
): Promise<VerifyResult> {
  try {
    if (!apiKey || !secretKey) {
      console.error("[monnify-webhook] Monnify API credentials not configured");
      return { transient: true };
    }

    const basicAuth = btoa(`${apiKey}:${secretKey}`);
    const authRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
    });
    const authJson = await authRes.json().catch(() => null);
    const accessToken = authJson?.responseBody?.accessToken;
    if (!authRes.ok || !authJson?.requestSuccessful || typeof accessToken !== "string" || !accessToken) {
      // Auth outage must not drop a real payment — retryable.
      return { transient: true };
    }

    const queryRes = await fetch(
      `${baseUrl}/api/v2/merchant/transactions/query?transactionReference=${encodeURIComponent(expectedTransactionReference)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const queryJson = await queryRes.json().catch(() => null);
    if (!queryRes.ok || !queryJson?.requestSuccessful || !queryJson?.responseBody || typeof queryJson.responseBody !== "object") {
      return { transient: true };
    }

    const v = queryJson.responseBody as Record<string, unknown>;
    const vStatus = String(v.paymentStatus ?? v.status ?? "").toUpperCase();
    const vPayRef = String(v.paymentReference ?? v.payment_reference ?? "");
    const vTrxRef = String(v.transactionReference ?? v.transaction_reference ?? "");
    const vCurrency = String(v.currencyCode ?? v.currency ?? "");
    // amountPaid only: settlementAmount/totalPayable/amount carry different fee
    // semantics and must never substitute for what the customer actually paid.
    const vAmount = toFiniteAmount(v.amountPaid ?? v.amount_paid);

    // ABSENCE of a field is not evidence of a mismatch. If Monnify omits or
    // renames a field we cannot confirm anything, and treating that as
    // "definitive" would answer 200 and drop a genuinely paid transaction
    // forever. So: absent -> transient (retryable, non-2xx). Present AND
    // contradictory -> definitive (audited, then acknowledged).
    if (!vStatus) {
      return { transient: true };
    }
    if (vStatus !== "PAID") {
      return { ok: false, reason: `Verified status ${vStatus} is not PAID` };
    }

    if (!vPayRef || !vTrxRef) {
      // Cannot confirm which transaction this is — retryable, not definitive.
      return { transient: true };
    }
    if (vPayRef !== paymentReference) {
      return { ok: false, reason: "Verified paymentReference mismatch" };
    }
    if (vTrxRef !== expectedTransactionReference) {
      return { ok: false, reason: "Verified transactionReference mismatch" };
    }

    // Currency is the one field treated asymmetrically. Monnify omits it on
    // some reserved-account responses, and 500-ing on an absent value would
    // retry a genuinely paid transaction until Monnify gives up, leaving the
    // customer's money received but never credited. The reference checks above
    // already pin this to the exact NGN transaction created in init-transaction,
    // so a missing field is simply no information — but an explicitly different
    // currency is a real contradiction and is refused outright.
    if (vCurrency && vCurrency.toUpperCase() !== "NGN") {
      return { ok: false, reason: `Verified currency is ${vCurrency}, not NGN` };
    }

    if (vAmount === null) {
      // Cannot confirm what Monnify actually collected — fail closed, retryable.
      return { transient: true };
    }
    return { ok: true, amountPaid: vAmount };
  } catch {
    return { transient: true };
  }
}

// Durable audit for verification disagreements via the atomic
// append_funding_verify_mismatch RPC (row lock, pending-only, single
// transaction — concurrent mismatches cannot overwrite each other).
// Records both amounts, both references, the reason, and verification time on
// the matching funding request WITHOUT crediting, WITHOUT inserting a
// monnify_events row (a later valid delivery must not look like a credited
// duplicate), and WITHOUT changing status (the atomic credit RPC still owns
// settlement and still accepts a later valid webhook normally).
// Returns false when the audit did not durably land (read/write/RPC failure),
// in which case the caller must answer retryable 500 instead of acknowledging
// without evidence; true when audited or when there is no pending request to
// annotate (orphan or already settled — nothing to reconcile).
async function auditVerifyMismatch(
  supabaseAdmin: AdminClient,
  opts: {
    paymentReference: string;
    transactionReference: string;
    webhookAmount: number;
    verifiedAmount: number | null;
    reason: string;
  },
): Promise<boolean> {
  const { data: result, error } = await supabaseAdmin.rpc("append_funding_verify_mismatch", {
    p_payment_reference: opts.paymentReference,
    p_transaction_reference: opts.transactionReference,
    p_webhook_amount: opts.webhookAmount,
    p_verified_amount: opts.verifiedAmount,
    p_reason: opts.reason,
  });

  if (error) {
    console.error("[monnify-webhook] verify-mismatch audit RPC failed", error.message);
    return false;
  }

  if (!result?.success) {
    console.error("[monnify-webhook] verify-mismatch audit rejected", { code: result?.code });
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  // Use service_role for all DB operations (webhook has no user JWT).
  // Typed against VerifyMismatchDatabase so the audit rpc() resolves to the
  // SQL function's actual parameters and return shape.
  const supabaseAdmin: AdminClient = createClient<VerifyMismatchDatabase>(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const monnifySecret = Deno.env.get("MONNIFY_SECRET_KEY") || "";
  const monnifyApiKey = Deno.env.get("MONNIFY_API_KEY") || "";
  const monnifyEnv = resolveMonnifyEnv();
  if (!monnifyEnv) {
    // Fail closed and retryable: without a known environment we can neither
    // enforce the correct signature rule nor verify transactions server-to-server.
    console.error("[monnify-webhook] MONNIFY_ENV missing or invalid (fail closed)");
    return Response.json({ error: "Server misconfigured" }, { status: 500, headers: corsHeaders });
  }
  const baseUrl = monnifyEnv.baseUrl;
  const isLive = monnifyEnv.mode === "live";

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

  // 3. Server-to-server verification: confirm the claimed payment with Monnify
  // before any credit. Never credit on webhook data alone.
  const verified = await verifyMonnifyTransaction(baseUrl, monnifyApiKey, monnifySecret, paymentReference, transactionReference);
  if ("transient" in verified) {
    // Monnify could not be reached or answered ambiguously — 500 so Monnify retries.
    console.error("[monnify-webhook] verify-transaction transient failure", { paymentReference });
    return Response.json({ error: "Verification unavailable" }, { status: 500, headers: corsHeaders });
  }
  if (!verified.ok) {
    // Definitive contradiction — retrying cannot fix it. Persist a durable
    // audit trail, then acknowledge without crediting so poison payloads
    // cannot retry forever. Audit failure is retryable (evidence first).
    const audited = await auditVerifyMismatch(supabaseAdmin, {
      paymentReference,
      transactionReference,
      webhookAmount: amountPaid,
      verifiedAmount: null,
      reason: verified.reason,
    });
    if (!audited) {
      console.error("[monnify-webhook] verify-mismatch audit write failed", { paymentReference });
      return Response.json({ error: "Audit unavailable" }, { status: 500, headers: corsHeaders });
    }
    console.warn("[monnify-webhook] verify-transaction mismatch, ignoring", { paymentReference, reason: verified.reason });
    return Response.json({ received: true, ignored: true, reason: verified.reason }, { headers: corsHeaders });
  }
  if (verified.amountPaid !== amountPaid) {
    // Verified collection differs from the webhook claim — audit durably,
    // never credit. Audit failure is retryable.
    const audited = await auditVerifyMismatch(supabaseAdmin, {
      paymentReference,
      transactionReference,
      webhookAmount: amountPaid,
      verifiedAmount: verified.amountPaid,
      reason: "Verified amount mismatch",
    });
    if (!audited) {
      console.error("[monnify-webhook] verify-mismatch audit write failed", { paymentReference });
      return Response.json({ error: "Audit unavailable" }, { status: 500, headers: corsHeaders });
    }
    console.warn("[monnify-webhook] verified amount differs from webhook amount, ignoring", { paymentReference });
    return Response.json({ received: true, ignored: true, reason: "Verified amount mismatch" }, { headers: corsHeaders });
  }

  // 4. Call atomic Monnify processing RPC (single transaction: funding_request lock + amount/trx validation + monnify_events insert + wallet credit)
  const { data: result, error: rpcError } = await supabaseAdmin.rpc("process_monnify_funding", {
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

  if (result?.orphan) {
    // A verified, genuinely PAID collection that no funding request claims.
    // process_monnify_funding returns here without writing anything, so today
    // this money arrives with zero database trace at all. Record it instead:
    // init-monnify-funding always creates the funding request BEFORE Monnify
    // creates the transaction, so an orphan can never be a race with our own
    // init, and the row cannot block a later legitimate credit for the same
    // request. ignoreDuplicates keeps a Monnify retry a clean no-op.
    const { error: orphanLogError } = await supabaseAdmin
      .from("monnify_events")
      .upsert(
        {
          transaction_reference: transactionReference,
          payment_reference: paymentReference,
          event_type: `ORPHAN_${eventType || "SUCCESSFUL_TRANSACTION"}`,
          payload: body as unknown as Record<string, unknown>,
        },
        { onConflict: "transaction_reference", ignoreDuplicates: true },
      );

    if (orphanLogError) {
      // Evidence first: if the record could not be written, let Monnify retry
      // rather than acknowledging a real collection that exists nowhere.
      console.error("[monnify-webhook] orphan audit write failed", orphanLogError.message);
      return Response.json({ error: "Audit unavailable" }, { status: 500, headers: corsHeaders });
    }

    console.warn("[monnify-webhook] verified payment with no funding request", {
      paymentReference,
      transactionReference,
      amountPaid,
    });
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
