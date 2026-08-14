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

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) {
      return Response.json(
        { error: "Admins only" },
        { status: 403, headers: corsHeaders }
      );
    }

    const baseUrl = Deno.env.get("GLADTIDINGS_BASE_URL");
    const token = Deno.env.get("GLADTIDINGS_API_TOKEN");

    if (!baseUrl || !token) {
      return Response.json(
        { error: "Gladtidings credentials are not configured." },
        { status: 500, headers: corsHeaders }
      );
    }

    const productsEndpoint =
      Deno.env.get("GLADTIDINGS_PRODUCTS_ENDPOINT") || "/api/datalist";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(`${baseUrl}${productsEndpoint}`, {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      return Response.json(
        {
          error: `Failed to reach Gladtidings: ${err?.message || "unknown error"}`,
        },
        { status: 502, headers: corsHeaders }
      );
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      return Response.json(
        {
          error: `Gladtidings returned HTTP ${response.status}. Verify the GLADTIDINGS_PRODUCTS_ENDPOINT secret (currently "${productsEndpoint}").`,
        },
        { status: 502, headers: corsHeaders }
      );
    }

    const body = await response.json();

    const raw = body?.Dataplans ?? body?.data?.Dataplans ?? body?.data ?? null;
    if (!raw) {
      return Response.json(
        { error: "Unexpected Gladtidings response shape." },
        { status: 502, headers: corsHeaders }
      );
    }

    const plans = [];
    const seen = new Set();

    const addPlan = (plan) => {
      if (!plan || plan.dataplan_id == null) return;
      const key = String(plan.dataplan_id);
      if (seen.has(key)) return;
      seen.add(key);

      const cost = Number(plan.api_price ?? plan.price ?? plan.amount ?? 0);

      plans.push({
        provider: "gladtidings",
        network_id: Number(plan.network) || null,
        network: plan.plan_network || plan.network_name || plan.network,
        plan_name: `${plan.plan} (${plan.plan_type})`,
        api_plan_id: String(plan.dataplan_id),
        cost_price: cost,
        plan_type: plan.plan_type ?? "",
        validity: plan.month_validate ?? plan.validity ?? "",
      });
    };

    if (Array.isArray(raw)) {
      raw.forEach(addPlan);
    } else {
      for (const networkKey of Object.keys(raw)) {
        const groups = raw[networkKey];
        if (Array.isArray(groups)) {
          groups.forEach(addPlan);
          continue;
        }
        if (groups && typeof groups === "object") {
          for (const groupKey of Object.keys(groups)) {
            const list = groups[groupKey];
            if (Array.isArray(list)) list.forEach(addPlan);
            else if (list) addPlan(list);
          }
        }
      }
    }

    if (plans.length === 0) {
      return Response.json(
        { error: "No plans found in the Gladtidings response." },
        { status: 502, headers: corsHeaders }
      );
    }

    return Response.json({ plans }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
});
