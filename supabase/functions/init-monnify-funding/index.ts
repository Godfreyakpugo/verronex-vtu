import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_AMOUNT = 5000000;

function isValidAmount(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_AMOUNT;
}

function generatePaymentReference(): string {
  // FUND-<32 hex chars without dashes>, e.g. FUND-a1b2c3d4e5f67890abcdef1234567890
  // Monnify paymentReference max 50, alphanumeric + -_ are safe. Use FUND- prefix.
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `FUND-${raw}`.toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Require authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const supabaseAuthed = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: authError,
  } = await supabaseAuthed.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  // 2. Read and validate amount server-side
  let body: { amount?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400, headers: corsHeaders });
  }

  const amount = typeof body.amount === "string" ? Number(body.amount) : body.amount;

  if (!isValidAmount(amount as number)) {
    return Response.json({ error: `Amount must be an integer between 1 and ${MAX_AMOUNT}` }, { status: 400, headers: corsHeaders });
  }

  const validAmount = amount as number;

  // 3. Check Monnify config (server-side only)
  const monnifyApiKey = Deno.env.get("MONNIFY_API_KEY");
  const monnifySecretKey = Deno.env.get("MONNIFY_SECRET_KEY");
  const monnifyContractCode = Deno.env.get("MONNIFY_CONTRACT_CODE");
  const monnifyEnv = (Deno.env.get("MONNIFY_ENV") || "sandbox").toLowerCase();
  const baseUrl = monnifyEnv === "live" || monnifyEnv === "production"
    ? "https://api.monnify.com"
    : "https://sandbox.monnify.com";

  if (!monnifyApiKey || !monnifySecretKey || !monnifyContractCode) {
    console.error("[init-monnify-funding] Monnify credentials not configured");
    return Response.json({ error: "Payment service is not configured. Please contact support." }, { status: 503, headers: corsHeaders });
  }

  // 4. Fetch profile for customer info (source of truth)
  const { data: profile, error: profileError } = await supabaseAuthed
    .from("profiles")
    .select("full_name, email, username, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[init-monnify-funding] profile fetch error", profileError.message);
    return Response.json({ error: "Could not load profile" }, { status: 500, headers: corsHeaders });
  }

  const customerName = (profile?.full_name || profile?.username || user.email || "Verronex User").toString().trim();
  const customerEmail = (profile?.email || user.email || "").toString().trim();

  if (!customerEmail) {
    return Response.json({ error: "Customer email is required" }, { status: 400, headers: corsHeaders });
  }

  // 5. Generate unique payment_reference server-side and insert funding_requests
  // Use service_role for cleanup if Monnify fails (user RLS cannot delete)
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let paymentReference = generatePaymentReference();
  let fundingRequest: { id: string; amount: number; payment_reference: string } | null = null;
  let lastInsertError: unknown = null;

  // Retry up to 3 times on unique violation (extremely unlikely)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabaseAuthed
      .from("funding_requests")
      .insert({
        user_id: user.id,
        amount: validAmount,
        payment_reference: paymentReference,
        status: "pending",
      })
      .select("id, amount, payment_reference")
      .single();

    if (!error && data) {
      fundingRequest = data as typeof fundingRequest;
      break;
    }

    // If duplicate payment_reference, generate new and retry
    if ((error as { code?: string })?.code === "23505" && error?.message?.includes("payment_reference")) {
      console.warn("[init-monnify-funding] duplicate payment_reference, retrying", paymentReference);
      paymentReference = generatePaymentReference();
      lastInsertError = error;
      continue;
    }

    lastInsertError = error;
    break;
  }

  if (!fundingRequest) {
    console.error("[init-monnify-funding] funding_requests insert failed", lastInsertError);
    return Response.json({ error: "Could not create funding request" }, { status: 500, headers: corsHeaders });
  }

  // Helper to clean up orphaned funding_request if Monnify fails
  const cleanupFundingRequest = async () => {
    const { error } = await serviceClient.from("funding_requests").delete().eq("id", fundingRequest!.id);
    if (error) console.error("[init-monnify-funding] cleanup failed", error.message);
  };

  try {
    // 6. Monnify authentication
    const basicAuth = btoa(`${monnifyApiKey}:${monnifySecretKey}`);
    const authRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
    });

    const authJson = await authRes.json().catch(() => null);

    if (!authRes.ok || !authJson?.requestSuccessful || !authJson?.responseBody?.accessToken) {
      console.error("[init-monnify-funding] Monnify auth failed", authRes.status, authJson);
      await cleanupFundingRequest();
      return Response.json({ error: "Payment service authentication failed" }, { status: 502, headers: corsHeaders });
    }

    const accessToken: string = authJson.responseBody.accessToken;

    // 7. Initialize transaction
    const redirectUrl = "https://verronex.com/fund-wallet";
    const initPayload = {
      amount: validAmount,
      customerName,
      customerEmail,
      paymentReference,
      paymentDescription: "Verronex wallet funding",
      currencyCode: "NGN",
      contractCode: monnifyContractCode,
      redirectUrl,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
    };

    const initRes = await fetch(`${baseUrl}/api/v1/merchant/transactions/init-transaction`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initPayload),
    });

    const initJson = await initRes.json().catch(() => null);

    if (!initRes.ok || !initJson?.requestSuccessful || !initJson?.responseBody?.transactionReference) {
      console.error("[init-monnify-funding] init-transaction failed", initRes.status, initJson);
      await cleanupFundingRequest();
      // Do not leak provider payload
      return Response.json({ error: "Could not initialize payment. Please try again." }, { status: 502, headers: corsHeaders });
    }

    const transactionReference: string = initJson.responseBody.transactionReference;
    const checkoutUrl: string | null = initJson.responseBody.checkoutUrl || null;

    // 8. Initialize bank transfer (dynamic account)
    const bankRes = await fetch(`${baseUrl}/api/v1/merchant/bank-transfer/init-payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionReference }),
    });

    const bankJson = await bankRes.json().catch(() => null);

    // Monnify may return account details even if bankRes not ok, but we treat non-success as failure
    // The bank transfer response shape varies; we extract safely.
    const accountDetails = bankJson?.responseBody || bankJson?.responseBody?.accountDetails || bankJson;
    // Fallback: some Monnify versions return accountNumber directly in responseBody
    const accountNumber = accountDetails?.accountNumber || accountDetails?.accountDetails?.accountNumber || null;
    const accountName = accountDetails?.accountName || accountDetails?.accountDetails?.accountName || null;
    const bankName = accountDetails?.bankName || accountDetails?.accountDetails?.bankName || accountDetails?.bank || null;
    const accountDurationSeconds = accountDetails?.accountDurationSeconds || accountDetails?.expiryDate ? null : null;
    // Try to get duration/expiry
    let expiresAt: string | null = null;
    let durationSeconds: number | null = null;
    if (bankJson?.responseBody?.accountDurationSeconds) durationSeconds = Number(bankJson.responseBody.accountDurationSeconds);
    else if (accountDetails?.accountDurationSeconds) durationSeconds = Number(accountDetails.accountDurationSeconds);
    // Some responses provide expiresOn (ISO)
    if (bankJson?.responseBody?.expiresOn) expiresAt = bankJson.responseBody.expiresOn;
    else if (accountDetails?.expiresOn) expiresAt = accountDetails.expiresOn;

    if (!accountNumber) {
      console.error("[init-monnify-funding] bank-transfer init failed or missing accountNumber", bankRes.status, bankJson);
      await cleanupFundingRequest();
      return Response.json({ error: "Could not create payment account. Please try again." }, { status: 502, headers: corsHeaders });
    }

    // 9. Save transaction_reference to funding request (service_role to bypass RLS if needed, but authenticated should be able to update own? Use service to be safe)
    const { error: updateError } = await serviceClient
      .from("funding_requests")
      .update({
        transaction_reference: transactionReference,
        webhook_payload: bankJson,
      })
      .eq("id", fundingRequest.id);

    if (updateError) {
      console.error("[init-monnify-funding] update transaction_reference failed", updateError.message);
      // Not fatal — we have created Monnify transaction, but DB not updated. We should not delete funding request now because Monnify transaction exists.
      // We will return success but log; webhook will still have paymentReference to find request via payment_reference.
    }

    // 10. Return only safe info
    return Response.json({
      success: true,
      fundingRequestId: fundingRequest.id,
      paymentReference,
      transactionReference,
      amount: validAmount,
      accountNumber,
      accountName,
      bankName,
      accountDurationSeconds: durationSeconds,
      expiresAt,
      checkoutUrl,
    }, { headers: corsHeaders });

  } catch (err) {
    console.error("[init-monnify-funding] unexpected error", (err as Error)?.message);
    // Attempt cleanup if we haven't saved transactionReference yet (i.e., funding request still without transactionReference)
    try {
      const { data: existing } = await serviceClient.from("funding_requests").select("transaction_reference").eq("id", fundingRequest.id).maybeSingle();
      if (!existing?.transaction_reference) {
        await cleanupFundingRequest();
      }
    } catch {
      // ignore
    }
    return Response.json({ error: "An unexpected error occurred" }, { status: 500, headers: corsHeaders });
  }
});
