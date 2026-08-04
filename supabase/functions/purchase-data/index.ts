import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const networkMap: Record<string, number> = {
  MTN: 1,
  GLO: 2,
  "9MOBILE": 3,
  AIRTEL: 4,
};

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

    const { planId, phoneNumber } = await req.json();

    if (!planId || !phoneNumber) {
      return Response.json(
        { error: "Missing fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    const reference =
      "DATA-" +
      Date.now() +
      "-" +
      crypto.randomUUID().slice(0, 8);

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

    const purchase = data[0];

    const response = await fetch(
      `${Deno.env.get("GLADTIDINGS_BASE_URL")}/api/data/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${Deno.env.get("GLADTIDINGS_API_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network: networkMap[purchase.network],
          mobile_number: phoneNumber,
          plan: Number(purchase.api_plan_id),
          Ported_number: true,
          ident: reference,
        }),
      }
    );

    const provider = await response.json();

    if (
      response.ok &&
      provider.Status?.toLowerCase() === "successful"
    ) {
      await supabase
        .from("transactions")
        .update({
          status: "successful",
          metadata: provider,
        })
        .eq("reference", reference);

      return Response.json(
        {
          success: true,
          reference,
          provider,
        },
        { headers: corsHeaders }
      );
    }

    await supabase.rpc("refund_purchase", {
      p_reference: reference,
      p_reason: provider.api_response || "Provider failed",
    });

    return Response.json(
      {
        success: false,
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