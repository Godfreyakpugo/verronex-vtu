import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_NETWORKS = ["MTN", "GLO", "AIRTEL", "9MOBILE"];

function normalizeNigerianPhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const normalized = digits.startsWith("234") ? "0" + digits.slice(3) : digits;
  return /^0[7-9]\d{9}$/.test(normalized) ? normalized : null;
}

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function extractProviderId(
  provider: Record<string, unknown> | null,
): number | null {
  if (!provider) return null;
  const candidates = ["id", "topup_id", "transaction_id", "order_id"];
  for (const key of candidates) {
    const value = provider[key];
    if (value !== undefined && value !== null && value !== "") {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
          headers: { Authorization: authHeader },
        },
      }
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

    const body = await req.json();

    const network = body?.network ?? null;
    const phoneNumber = body?.phoneNumber ?? null;
    const amount = body?.amount ?? null;

    if (!VALID_NETWORKS.includes(network)) {
      return Response.json(
        { error: "Invalid network." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isValidAmount(amount)) {
      return Response.json(
        { error: "Amount must be a positive whole-number Naira amount." },
        { status: 400, headers: corsHeaders }
      );
    }

    const phone = normalizeNigerianPhone(phoneNumber);
    if (!phone) {
      return Response.json(
        { error: "Invalid Nigerian phone number (expected 0xxxxxxxxxx)." },
        { status: 400, headers: corsHeaders }
      );
    }

    const reference = `AIRTIME-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    console.log("[1] Calling start_airtime_purchase", {
      reference,
      network,
      amount,
      phone,
    });

    const { data, error } = await supabase.rpc("start_airtime_purchase", {
      p_user_id: user.id,
      p_network: network,
      p_amount: amount,
      p_phone: phone,
      p_reference: reference,
    });

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
    console.log("[2] Wallet debited", purchase);

    const token = Deno.env.get("GLADTIDINGS_API_TOKEN");
    const baseUrl = Deno.env.get("GLADTIDINGS_BASE_URL");

    if (!token || !baseUrl) {
      const { error: refundError } = await supabase.rpc("refund_purchase", {
        p_reference: reference,
        p_reason: "Gladtidings credentials are not configured",
      });
      console.error("[3] Refund after missing config:", refundError?.message);
      return Response.json(
        {
          error:
            "Airtime service is not configured. Your wallet has been refunded.",
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 32000);

    let response: Response | null = null;
    let fetchError: Error | null = null;

    try {
      response = await fetch(`${baseUrl}/api/topup/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network: purchase.network_id,
          amount: purchase.amount,
          mobile_number: phone,
          Ported_number: true,
          airtime_type: "VTU",
        }),
        signal: controller.signal,
      });
    } catch (err) {
      fetchError = err as Error;
    } finally {
      clearTimeout(timeoutId);
    }

    console.log(
      "[4] Provider response status:",
      response?.status,
      "error:",
      fetchError?.message
    );

    let provider: Record<string, unknown> | null = null;

    if (response) {
      const raw = await response.text();
      try {
        provider = raw ? JSON.parse(raw) : null;
      } catch {
        provider = null;
      }
    }

    const http201 = response?.status === 201;
    const statusSuccessful =
      typeof provider?.Status === "string" &&
      provider.Status.toLowerCase() === "successful";
    const statusFailed =
      typeof provider?.Status === "string" &&
      provider.Status.toLowerCase() !== "successful";

    // Definitive failure reported by the provider.
    if (provider && statusFailed) {
      const reason =
        (provider.api_response as string) ||
        (provider.message as string) ||
        "Airtime provider rejected the request";
      const { error: refundError } = await supabase.rpc("refund_purchase", {
        p_reference: reference,
        p_reason: reason,
      });
      console.error("[5] Refund after provider failure:", refundError?.message);
      return Response.json(
        {
          success: false,
          error: "Airtime purchase failed. Your wallet has been refunded.",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Confirmed success: HTTP 201 + Status == "successful".
    if (http201 && statusSuccessful) {
      const providerId = extractProviderId(provider);
      const metadata = {
        provider: "gladtidings",
        provider_transaction_id: providerId,
        provider_ident: provider?.ident ?? null,
        provider_response: provider,
      };

      const { error: completeError } = await supabase.rpc(
        "complete_airtime_purchase",
        { p_reference: reference, p_metadata: metadata }
      );

      if (completeError) {
        console.error("[6] Completion failed:", completeError.message);
        return Response.json(
          {
            success: false,
            error:
              "Airtime was delivered but your transaction could not be finalized. Please contact support.",
            reference,
          },
          { status: 502, headers: corsHeaders }
        );
      }

      console.log("[7] Airtime purchase completed", reference);
      return Response.json(
        {
          success: true,
          message: "Airtime purchase successful",
          reference,
          providerReference: providerId,
          provider: "gladtidings",
        },
        { headers: corsHeaders }
      );
    }

    // Unknown result (timeout, malformed body, or an unexpected status code):
    // keep the transaction pending and report that it is being verified —
    // never claim success and never auto-refund a purchase that may have
    // already gone through, and never retry the provider call.
    console.log("[8] Unknown provider result — transaction left pending", reference);
    return Response.json(
      {
        success: false,
        pending: true,
        message:
          "Your airtime purchase is being verified and will be confirmed shortly.",
        reference,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
});
