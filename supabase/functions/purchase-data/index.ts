import { createClient } from "npm:@supabase/supabase-js@2";
import { getPinCandidate, isPinFailureCode } from "../_shared/transactionPin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeNigerianPhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const normalized = digits.startsWith("234") ? "0" + digits.slice(3) : digits;
  return /^0[7-9]\d{9}$/.test(normalized) ? normalized : null;
}

function getProviderStatus(provider: unknown): string | null {
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
    return null;
  }

  const body = provider as Record<string, unknown>;
  const data = body.data;
  const result = body.result;
  const candidates = [
    body.Status,
    body.status,
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).Status ??
          (data as Record<string, unknown>).status
      : null,
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>).Status ??
          (result as Record<string, unknown>).status
      : null,
  ];

  const status = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );

  return status?.trim().toLowerCase().replace(/[\s_-]+/g, " ") ?? null;
}

function collectProviderText(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectProviderText(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      collectProviderText(item, depth + 1),
    );
  }
  return [];
}

function getInsufficientFundsReason(
  provider: unknown,
  rawBody: string,
): string | null {
  const texts = [...collectProviderText(provider), rawBody];
  const insufficientFundsPattern =
    /(?:insufficient|not enough)\b.{0,50}\b(?:funds?|balance|credit)|\b(?:funds?|balance|credit)\b.{0,50}\b(?:insufficient|not enough)/i;

  return (
    texts.find((text) => insufficientFundsPattern.test(text))?.trim().slice(0, 500) ??
    null
  );
}

function getProviderFailureReason(provider: unknown): string {
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
    return "Provider failed";
  }

  const body = provider as Record<string, unknown>;
  for (const key of ["api_response", "message", "error", "detail"]) {
    if (typeof body[key] === "string" && body[key].trim()) {
      return body[key].trim().slice(0, 500);
    }
  }

  return "Provider failed";
}

const DEFINITIVE_FAILURE_STATUSES = new Set([
  "failed",
  "fail",
  "failure",
  "error",
  "rejected",
  "declined",
  "unsuccessful",
  "not successful",
]);

const NONFINAL_PROVIDER_STATUSES = new Set([
  "pending",
  "processing",
  "in progress",
  "queued",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[1] Purchase request received");

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    // Server-only client for the protected debit, purchase completion, and
    // provider-authorized refund RPCs. The service role key is never returned
    // to the browser.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    if (
      req.headers.get("x-test-provider-failure") === "true" ||
      req.headers.get("x-test-refund-failure") === "true"
    ) {
      return Response.json(
        { error: "Test hooks are not allowed in production." },
        { status: 403, headers: corsHeaders }
      );
    }

    console.log("[2] User authenticated", user.id);

    const requestBody = await req.json();
    const { planId, phoneNumber } = requestBody;

    if (!planId || !phoneNumber) {
      return Response.json(
        { error: "Missing fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedPhone = normalizeNigerianPhone(phoneNumber);
    if (!normalizedPhone) {
      return Response.json(
        { error: "Invalid Nigerian phone number" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("[3] Request body validated");

    const reference =
      "DATA-" +
      Date.now() +
      "-" +
      crypto.randomUUID().slice(0, 8);

    console.log("[4] Calling start_data_purchase_with_pin");

    const candidateVerifier = await getPinCandidate(
      supabaseAdmin,
      user.id,
      requestBody?.transactionPin,
    );

    const { data, error } = await supabaseAdmin.rpc(
      "start_data_purchase_with_pin",
      {
        p_user_id: user.id,
        p_plan_id: planId,
        p_reference: reference,
        p_candidate_verifier: candidateVerifier,
      },
    );

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!data || data.length === 0) {
      return Response.json(
        { error: "Purchase initialization failed." },
        { status: 400, headers: corsHeaders }
      );
    }

    const purchase = data[0];

    if (!purchase.ok) {
      if (isPinFailureCode(purchase.error_code)) {
        const seconds = purchase.cooldown_until
          ? Math.max(1, Math.ceil((Date.parse(purchase.cooldown_until) - Date.now()) / 1000))
          : null;
        const message = purchase.error_code === "pin_required"
          ? "Enter your transaction PIN to continue."
          : purchase.error_code === "pin_invalid"
          ? "That transaction PIN is incorrect."
          : purchase.error_code === "pin_already_set"
          ? "A transaction PIN is already set."
          : seconds !== null && seconds < 60
          ? `Too many incorrect attempts. Try again in ${seconds} seconds.`
          : `Too many incorrect attempts. Try again in ${Math.ceil((seconds ?? 60) / 60)} minutes.`;
        return Response.json(
          {
            pinError: true,
            code: purchase.error_code,
            error: message,
            cooldownUntil: purchase.cooldown_until ?? null,
          },
          { headers: corsHeaders },
        );
      }
      return Response.json(
        { error: "Purchase initialization failed." },
        { status: 400, headers: corsHeaders },
      );
    }

    console.log("[6] Sending request to Gladtidings");

    console.log(
      "[6.1] GLADTIDINGS_API_TOKEN:",
      Deno.env.get("GLADTIDINGS_API_TOKEN")
        ? `exists, length=${Deno.env.get("GLADTIDINGS_API_TOKEN").length}`
        : "MISSING"
    );

    const gladtidingsToken = Deno.env.get("GLADTIDINGS_API_TOKEN");

    const gladtidingsHeaders = {
      Authorization: `Token ${gladtidingsToken}`,
      "Content-Type": "application/json",
    };

    console.log(
      "[6.2] Authorization header diagnostic:",
      gladtidingsToken
        ? `constructed as "Token <redacted>", length=${gladtidingsToken.length}`
        : "MISSING TOKEN"
    );

    console.log(
      "[6.3] Request headers diagnostic:",
      JSON.stringify({
        authorization_present: Boolean(gladtidingsHeaders.Authorization),
        authorization_prefix: gladtidingsHeaders.Authorization
          ? gladtidingsHeaders.Authorization.split(" ")[0]
          : null,
        authorization_value_length: gladtidingsHeaders.Authorization
          ? gladtidingsHeaders.Authorization.length
          : 0,
        content_type: gladtidingsHeaders["Content-Type"],
      })
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 32000);

    let response = null;
    let fetchError = null;

    try {
      response = await fetch(
        `${Deno.env.get("GLADTIDINGS_BASE_URL")}/api/data/`,
        {
          method: "POST",
          headers: gladtidingsHeaders,
          body: JSON.stringify({
            network: purchase.network_id,
            mobile_number: normalizedPhone,
            plan: Number(purchase.api_plan_id),
            Ported_number: true,
            ident: reference,
          }),
          signal: controller.signal,
        }
      );
    } catch (err) {
      fetchError = err;
      console.error(
        "[7] Gladtidings request failed:",
        err?.name,
        err?.message
      );
    } finally {
      clearTimeout(timeoutId);
    }

    let provider = null;
    let rawBody = "";

    if (fetchError) {
      if (fetchError?.name === "AbortError") {
        console.log("[7] Gladtidings request aborted at 32s (timeout)");
      }
      // No fabricated failure here: an aborted/dropped request may still be
      // processed by Gladtidings server-side, so the outcome is UNKNOWN.
    } else {
      console.log("[7] Gladtidings HTTP status:", response.status);

      console.log(
        "[7.1] Redirected:",
        response.redirected,
        "Final URL:",
        response.url
      );

      rawBody = await response.text();

      // Provider responses may echo the recipient phone or other private data.
      // Keep the body in memory for status parsing; do not write it to logs.
      console.log("[8] Gladtidings response received.");

      try {
        provider = rawBody ? JSON.parse(rawBody) : null;
      } catch (err) {
        console.error("[9] Gladtidings response was not JSON:", err?.message);
        provider = null;
      }
    }

    // ── Definitive success ────────────────────────────────────────────────
    const providerStatus = getProviderStatus(provider);

    if (response?.ok && providerStatus === "successful") {
      console.log("[10] Completing transaction via complete_data_purchase_server");

      // Server-only RPC: the caller is trusted because the provider has just
      // confirmed success AND the request authenticated the user at line ~49.
      // Requires complete_data_purchase_server.sql to be applied.
      const { data: completed, error: completeError } =
        await supabaseAdmin.rpc("complete_data_purchase_server", {
          p_reference: reference,
          p_metadata: provider,
        });

      if (completeError) {
        console.error(
          "[10.1] Completion RPC error:",
          completeError.message,
        );
        return Response.json(
          { success: false, error: completeError.message },
          { headers: corsHeaders },
        );
      }

      if (!completed) {
        // False means the reference is unknown or no longer pending — for
        // example a refund already settled it. Never report success.
        console.error("[10.2] Completion returned false", reference);
        return Response.json(
          {
            success: false,
            error:
              "Your data was delivered but this transaction could not be finalised automatically. Please contact support with your reference — do not pay again.",
            reference,
          },
          { headers: corsHeaders },
        );
      }

      console.log("[13] Purchase completed successfully");

      return Response.json(
        {
          success: true,
          message: "Purchase completed successfully.",
          reference,
          // Returned to the authenticated customer for their own receipt.
          // BuyData.jsx reads provider.api_response and the provider reference
          // from this. Privacy of *stored* metadata is enforced separately by
          // public.data_provider_allowlist(); this is a transient echo of the
          // customer's own purchase, not a persistence decision.
          provider,
        },
        { headers: corsHeaders },
      );
    }

    // ── Definitive provider rejection ─────────────────────────────────────
    // Refund only an explicit provider rejection. Insufficient-funds errors
    // are recognized in response text too, since some error responses omit
    // the `Status` field used by successful purchase responses.
    const insufficientFundsReason = getInsufficientFundsReason(
      provider,
      rawBody,
    );
    const providerRejected =
      !NONFINAL_PROVIDER_STATUSES.has(providerStatus ?? "") &&
      providerStatus !== "successful" &&
      (DEFINITIVE_FAILURE_STATUSES.has(providerStatus ?? "") ||
        insufficientFundsReason !== null ||
        response?.status === 402);

    if (providerRejected) {
      console.log("[11] Calling refund_purchase");

      const { data: refunded, error: refundError } = await supabaseAdmin.rpc(
        "refund_purchase_server",
        {
          p_reference: reference,
          p_reason:
            insufficientFundsReason || getProviderFailureReason(provider),
        },
      );

      // Both conditions matter: an RPC error means the call did not complete,
      // and a falsy return means the function ran but refunded nothing (for
      // example the transaction was no longer pending). Only an explicit true
      // means the wallet was actually credited back.
      if (refundError || refunded !== true) {
        console.error("[11.1] Refund not confirmed", {
          reference,
          refundErrorMessage: refundError?.message ?? null,
          returned: refunded ?? null,
        });
        return Response.json(
          {
            success: false,
            error:
              "Data purchase failed and we could not confirm an automatic refund. Please contact support with your reference — your wallet has not been double-charged and will be reconciled.",
            reference,
          },
          { status: 500, headers: corsHeaders },
        );
      }

      console.log("[12] Refund confirmed");

      return Response.json(
        {
          success: false,
          refunded: true,
          error:
            insufficientFundsReason ||
            getProviderFailureReason(provider) ||
            "Purchase failed",
        },
        { headers: corsHeaders },
      );
    }

    // Unknown outcome (timeout, dropped connection, malformed/unrecognized
    // response, or an unexpected HTTP status): Gladtidings may still complete
    // the order, so keep the transaction pending rather than risk a duplicate
    // delivery and an incorrect refund.
    console.log(
      "[14] Unknown provider result — transaction left pending",
      reference
    );
    return Response.json(
      {
        success: false,
        pending: true,
        message:
          "Your data purchase is being verified and will be confirmed shortly.",
        reference,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      {
        error: err.message,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
