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

    const response = await fetch(
      `${Deno.env.get("GLADTIDINGS_BASE_URL")}/api/data/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${Deno.env.get("GLADTIDINGS_API_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network: purchase.network_id,
          mobile_number: phoneNumber,
          plan: Number(purchase.api_plan_id),
          Ported_number: true,
          ident: reference,
        }),
      }
    );

    console.log("[7] Provider HTTP Status", response.status);

    let provider;

    try {
      provider = await response.json();
    } catch (err) {
      console.error("Provider JSON parse failed", err);
      provider = {
        Status: "failed",
        api_response: "Invalid provider response",
      };
    }

    console.log("[8] Provider response", provider);

    if (
      response.ok &&
      provider.Status?.toLowerCase() === "successful"
    ) {
      console.log("[9] Completing transaction via complete_data_purchase");

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

      console.log("[12] Purchase completed successfully");

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

    console.log("[10] Calling refund_purchase");

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

    console.log("[11] Refund completed");

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
