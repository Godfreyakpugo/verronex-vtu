import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const privateHeaders = { ...corsHeaders, "Cache-Control": "no-store" };

type ReservedAccount = {
  user_id: string;
  account_reference: string;
  reservation_reference: string | null;
  account_name: string | null;
  account_number: string | null;
  bank_code: string | null;
  bank_name: string | null;
  status: string;
  kyc_type: string;
  consented_at: string;
};

function resolveMonnifyBaseUrl(): string | null {
  const mode = (Deno.env.get("MONNIFY_ENV") || "").trim().toLowerCase();
  if (mode === "sandbox") return "https://sandbox.monnify.com";
  if (mode === "live") return "https://api.monnify.com";
  return null;
}

function accountFromResponse(body: Record<string, unknown> | null): Omit<ReservedAccount, "user_id" | "kyc_type" | "consented_at"> | null {
  const responseBody = body?.responseBody;
  if (!responseBody || typeof responseBody !== "object") return null;

  const reservation = responseBody as Record<string, unknown>;
  const accounts = Array.isArray(reservation.accounts) ? reservation.accounts : [];
  const firstAccount = accounts[0] && typeof accounts[0] === "object"
    ? accounts[0] as Record<string, unknown>
    : null;

  if (!firstAccount) return null;

  const accountNumber = String(firstAccount.accountNumber || "").trim();
  const status = String(reservation.status || "").trim().toUpperCase();
  if (!accountNumber) return null;

  return {
    account_reference: String(reservation.accountReference || ""),
    reservation_reference: reservation.reservationReference ? String(reservation.reservationReference) : null,
    account_name: String(firstAccount.accountName || reservation.accountName || "").trim() || null,
    account_number: accountNumber,
    bank_code: firstAccount.bankCode ? String(firstAccount.bankCode) : null,
    bank_name: String(firstAccount.bankName || "").trim() || null,
    status: status === "ACTIVE" ? "active" : "pending",
  };
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const value = await response.json().catch(() => null);
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function safeAccountResponse(account: ReservedAccount) {
  return {
    status: account.status,
    account_name: account.account_name,
    account_number: account.account_number,
    bank_code: account.bank_code,
    bank_name: account.bank_name,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }
  if (Deno.env.get("MONNIFY_ENABLED") !== "true") {
    return Response.json({ error: "Monnify reserved accounts are currently unavailable." }, { status: 503, headers: corsHeaders });
  }

  const baseUrl = resolveMonnifyBaseUrl();
  if (!baseUrl) {
    return Response.json({ error: "Payment service is not configured. Please contact support." }, { status: 503, headers: corsHeaders });
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAuthed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await supabaseAuthed.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400, headers: corsHeaders });
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return Response.json({ error: "Invalid request body" }, { status: 400, headers: corsHeaders });
  }
  const body = parsedBody as { identityType?: unknown; identityNumber?: unknown; consentToProcess?: unknown };

  const identityType = String(body.identityType || "").trim().toUpperCase();
  const identityNumber = String(body.identityNumber || "").replace(/\s/g, "");
  if (identityType !== "BVN" && identityType !== "NIN") {
    return Response.json({ error: "Choose BVN or NIN." }, { status: 400, headers: corsHeaders });
  }
  if (!/^\d{11}$/.test(identityNumber)) {
    return Response.json({ error: `${identityType} must contain 11 digits.` }, { status: 400, headers: corsHeaders });
  }
  if (body.consentToProcess !== true) {
    return Response.json({ error: "Consent is required to send your identity number to Monnify for account creation." }, { status: 400, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("MONNIFY_API_KEY") || "";
  const secretKey = Deno.env.get("MONNIFY_SECRET_KEY") || "";
  const contractCode = Deno.env.get("MONNIFY_CONTRACT_CODE") || "";
  if (!apiKey || !secretKey || !contractCode || !serviceRoleKey) {
    console.error("[create-monnify-reserved-account] Monnify or Supabase service credentials are not configured");
    return Response.json({ error: "Payment service is not configured. Please contact support." }, { status: 503, headers: corsHeaders });
  }

  const { data: profile, error: profileError } = await supabaseAuthed
    .from("profiles")
    .select("full_name, username, email")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("[create-monnify-reserved-account] profile lookup failed", profileError.message);
    return Response.json({ error: "Could not load your profile." }, { status: 500, headers: corsHeaders });
  }

  const customerEmail = String(profile?.email || user.email || "").trim().toLowerCase();
  const customerName = String(profile?.full_name || profile?.username || "").trim();
  if (!customerEmail || !customerName) {
    return Response.json({ error: "Add your full name and email to your profile before creating a permanent account." }, { status: 400, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const accountReference = `VTX-${user.id}`;
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("monnify_reserved_accounts")
    .select("user_id, account_reference, reservation_reference, account_name, account_number, bank_code, bank_name, status, kyc_type, consented_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) {
    console.error("[create-monnify-reserved-account] local account lookup failed", lookupError.message);
    return Response.json({ error: "Could not check your account status. Please try again." }, { status: 500, headers: corsHeaders });
  }

  if (existing?.status === "active" && existing.account_number) {
    return Response.json({ success: true, account: safeAccountResponse(existing as ReservedAccount) }, { headers: privateHeaders });
  }

  const basicAuth = btoa(`${apiKey}:${secretKey}`);
  let accessToken = "";
  try {
    const authResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
    });
    const authJson = await readJson(authResponse);
    const token = (authJson?.responseBody as Record<string, unknown> | undefined)?.accessToken;
    if (!authResponse.ok || authJson?.requestSuccessful !== true || typeof token !== "string" || !token) {
      console.error("[create-monnify-reserved-account] Monnify authentication failed", authResponse.status);
      return Response.json({ error: "Could not connect to the payment service. Please try again." }, { status: 502, headers: corsHeaders });
    }
    accessToken = token;
  } catch {
    return Response.json({ error: "Could not connect to the payment service. Please try again." }, { status: 502, headers: corsHeaders });
  }

  // If an earlier request reached Monnify but failed before saving the response,
  // look up our stable reference first so retries recover the existing account.
  const recoverExistingAccount = async () => {
    try {
      const response = await fetch(
        `${baseUrl}/api/v2/bank-transfer/reserved-accounts/${encodeURIComponent(accountReference)}`,
        { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } },
      );
      const json = await readJson(response);
      if (response.ok && json?.requestSuccessful === true) return accountFromResponse(json);
    } catch {
      // A later create with this same reference remains idempotent at Monnify.
    }
    return null;
  };

  const persistAccount = async (
    account: Omit<ReservedAccount, "user_id" | "kyc_type" | "consented_at">,
    updateKyc: boolean,
  ) => {
    if (account.account_reference !== accountReference || !account.account_number) {
      throw new Error("Monnify returned an unexpected account reference.");
    }
    const { data, error } = await supabaseAdmin
      .from("monnify_reserved_accounts")
      .update({
        reservation_reference: account.reservation_reference,
        account_name: account.account_name,
        account_number: account.account_number,
        bank_code: account.bank_code,
        bank_name: account.bank_name,
        status: account.status,
        ...(updateKyc ? { kyc_type: identityType, consented_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select("user_id, account_reference, reservation_reference, account_name, account_number, bank_code, bank_name, status, kyc_type, consented_at")
      .single();
    if (error) {
      console.error("[create-monnify-reserved-account] saving account details failed", error.message);
      throw new Error("The account was created but could not be saved. Please retry so we can recover it safely.");
    }
    return data as ReservedAccount;
  };

  let accountRecord = existing;
  if (!accountRecord) {
    const { data, error } = await supabaseAdmin
      .from("monnify_reserved_accounts")
      .insert({
        user_id: user.id,
        account_reference: accountReference,
        status: "creating",
        kyc_type: identityType,
        consented_at: new Date().toISOString(),
      })
      .select("user_id, account_reference, reservation_reference, account_name, account_number, bank_code, bank_name, status, kyc_type, consented_at")
      .single();
    if (error && error.code !== "23505") {
      console.error("[create-monnify-reserved-account] reservation record creation failed", error.message);
      return Response.json({ error: "Could not start account creation. Please try again." }, { status: 500, headers: corsHeaders });
    }
    if (data) accountRecord = data as ReservedAccount;
    else {
      const { data: raced, error: racedError } = await supabaseAdmin
        .from("monnify_reserved_accounts")
        .select("user_id, account_reference, reservation_reference, account_name, account_number, bank_code, bank_name, status, kyc_type, consented_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (racedError || !raced) {
        console.error("[create-monnify-reserved-account] concurrent reservation lookup failed", racedError?.message);
        return Response.json({ error: "Account creation is already in progress. Please refresh shortly." }, { status: 409, headers: corsHeaders });
      }
      accountRecord = raced as ReservedAccount;
      if (accountRecord.status === "active" && accountRecord.account_number) {
        return Response.json({ success: true, account: safeAccountResponse(accountRecord) }, { headers: privateHeaders });
      }
    }
  }

  if (existing) {
    const recovered = await recoverExistingAccount();
    if (recovered) {
      try {
        const account = await persistAccount(recovered, false);
        return Response.json({ success: true, account: safeAccountResponse(account) }, { headers: privateHeaders });
      } catch (error) {
        return Response.json({ error: (error as Error).message }, { status: 500, headers: corsHeaders });
      }
    }
  }

  const createPayload: Record<string, unknown> = {
    accountReference,
    accountName: customerName,
    currencyCode: "NGN",
    contractCode,
    customerEmail,
    customerName,
    getAllAvailableBanks: false,
    [identityType.toLowerCase()]: identityNumber,
  };

  try {
    const createResponse = await fetch(`${baseUrl}/api/v2/bank-transfer/reserved-accounts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });
    const createJson = await readJson(createResponse);
    let providerAccount = createResponse.ok && createJson?.requestSuccessful === true
      ? accountFromResponse(createJson)
      : null;

    // A timeout, lost response, or duplicate-reference reply may mean Monnify
    // already created the reservation. Recover with our per-user reference.
    if (!providerAccount) providerAccount = await recoverExistingAccount();
    if (!providerAccount) {
      const message = String(createJson?.responseMessage || "");
      const existingEmail = /already.*reserved|more than 1 account|customeremail|customer email/i.test(message);
      if (existingEmail) {
        return Response.json({
          error: "Monnify already has a reserved account for this email. Please contact support to link it to your wallet.",
        }, { status: 409, headers: corsHeaders });
      }
      console.error("[create-monnify-reserved-account] Monnify did not return account details", createResponse.status, createJson?.responseCode || "unknown");
      return Response.json({ error: "Could not create a permanent account. Please try again or contact support." }, { status: 502, headers: corsHeaders });
    }

    const account = await persistAccount(providerAccount, true);
    return Response.json({ success: true, account: safeAccountResponse(account) }, { headers: privateHeaders });
  } catch (error) {
    console.error("[create-monnify-reserved-account] account operation failed", (error as Error)?.message);
    return Response.json({ error: "Could not create or recover your permanent account. Please retry or contact support." }, { status: 502, headers: corsHeaders });
  }
});
