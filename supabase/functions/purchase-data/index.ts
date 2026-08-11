import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    console.log("[2] User authenticated", user.id);

    const { planId, phoneNumber } = await req.json();

    if (!planId || !phoneNumber) {
      return Response.json(
        { error: "Missing fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("[3] Request body validated");

    const reference =
      "DATA-" +
      Date.now() +
      "-" +
      crypto.randomUUID().slice(0, 8);

    console.log("[4] Calling start_data_purchase");

    const { data, error } = await supabase.rpc(
      "start_data_purchase",
      {
        p_user_id: user.id,
        p_plan_id: planId,
        p_reference: reference,
      }
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

    console.log("[5] RPC completed", data);

    const purchase = data[0];

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
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
            mobile_number: phoneNumber,
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

    if (fetchError) {
      provider = {
        Status: "failed",
        api_response:
          fetchError?.name === "AbortError"
            ? "Gladtidings request timed out after 15s"
            : `Gladtidings request failed: ${fetchError?.message || "unknown error"}`,
      };
    } else {
      console.log("[7] Gladtidings HTTP status:", response.status);

      console.log(
        "[7.1] Redirected:",
        response.redirected,
        "Final URL:",
        response.url
      );

      const rawBody = await response.text();

      console.log("[8] Gladtidings raw response:", rawBody);

      try {
        provider = rawBody ? JSON.parse(rawBody) : null;
      } catch (err) {
        console.error("[9] Gladtidings response was not JSON:", err?.message);
        provider = null;
      }

      if (provider) {
        console.log(
          "[9] Gladtidings parsed response:",
          JSON.stringify(provider)
        );
      } else {
        provider = {
          Status: "failed",
          api_response: rawBody || "Invalid provider response",
        };
      }
    }

    if (
      response?.ok &&
      provider.Status?.toLowerCase() === "successful"
    ) {
      console.log("[10] Completing transaction via complete_data_purchase");

      const { data: completed, error: completeError } = await supabase.rpc(
        "complete_data_purchase",
        { p_reference: reference, p_metadata: provider }
      );

      if (completeError) {
        return Response.json(
          { success: false, error: completeError.message },
          { headers: corsHeaders }
        );
      }

      if (!completed) {
        return Response.json(
          { success: false, error: "Transaction could not be completed." },
          { headers: corsHeaders }
        );
      }

      console.log("[13] Purchase completed successfully");

      return Response.json(
        {
          success: true,
          message: "Purchase completed successfully.",
          reference,
          provider,
        },
        { headers: corsHeaders }
      );
    }

    console.log("[11] Calling refund_purchase");

    const { error: refundError } = await supabase.rpc("refund_purchase", {
      p_reference: reference,
      p_reason: provider.api_response || "Provider failed",
    });

    if (refundError) {
      return Response.json(
        {
          success: false,
          error: "Refund failed",
          refundError,
        },
        { headers: corsHeaders }
      );
    }

    console.log("[12] Refund completed");

    return Response.json(
      {
        success: false,
        error: provider.api_response || "Purchase failed",
        provider,
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
