import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function naira(value: unknown): string {
  const n = Number(value ?? 0) || 0;
  return "₦" + n.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

    // Authenticate the caller (the admin performing the action)
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
      data: { user: adminUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !adminUser) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Service-role client: bypasses RLS for ledger reads + auth admin delete
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is an admin
    const { data: adminProfile, error: adminProfileError } = await serviceClient
      .from("profiles")
      .select("id, is_admin")
      .eq("id", adminUser.id)
      .maybeSingle();

    if (adminProfileError) {
      return Response.json(
        { error: "Failed to verify admin privileges." },
        { status: 500, headers: corsHeaders }
      );
    }
    if (!adminProfile?.is_admin) {
      return Response.json(
        { error: "Admins only" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Validate the target user id
    const body = await req.json();
    const targetUserId = body?.target_user_id;

    if (!targetUserId || typeof targetUserId !== "string") {
      return Response.json(
        { error: "A target user id is required." },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!UUID_RE.test(targetUserId)) {
      return Response.json(
        { error: "Invalid user id format." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Self-delete protection (server-side, cannot be bypassed from the UI)
    if (targetUserId === adminUser.id) {
      return Response.json(
        { error: "You cannot remove your own account." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Load the target profile
    const { data: target, error: targetError } = await serviceClient
      .from("profiles")
      .select("id, full_name, email, is_admin, deactivated_at")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError) {
      return Response.json(
        { error: "Failed to look up the target user." },
        { status: 500, headers: corsHeaders }
      );
    }
    if (!target) {
      return Response.json(
        { error: "User not found." },
        { status: 404, headers: corsHeaders }
      );
    }
    if (target.deactivated_at) {
      return Response.json(
        { error: "This user has already been removed." },
        { status: 409, headers: corsHeaders }
      );
    }
    if (target.is_admin) {
      return Response.json(
        { error: "Administrator accounts cannot be removed." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Financial safety checks — block removal if the account has unresolved
    // money or pending operations. Ledger rows are preserved, never deleted.
    const problems: string[] = [];

    const { data: wallet, error: walletError } = await serviceClient
      .from("wallets")
      .select("balance")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (walletError) {
      return Response.json(
        { error: "Failed to check the user's wallet." },
        { status: 500, headers: corsHeaders }
      );
    }
    const balance = Number(wallet?.balance ?? 0) || 0;
    if (balance > 0) {
      problems.push(`${naira(balance)} wallet balance`);
    }

    const { count: pendingFunding, error: fundingError } = await serviceClient
      .from("funding_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .eq("status", "pending");

    if (fundingError) {
      return Response.json(
        { error: "Failed to check funding requests." },
        { status: 500, headers: corsHeaders }
      );
    }
    if (pendingFunding > 0) {
      problems.push(
        `${pendingFunding} pending funding request${pendingFunding > 1 ? "s" : ""}`
      );
    }

    const { count: pendingTx, error: txError } = await serviceClient
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .eq("status", "pending");

    if (txError) {
      return Response.json(
        { error: "Failed to check transactions." },
        { status: 500, headers: corsHeaders }
      );
    }
    if (pendingTx > 0) {
      problems.push(
        `${pendingTx} pending transaction${pendingTx > 1 ? "s" : ""}`
      );
    }

    if (problems.length > 0) {
      return Response.json(
        {
          error:
            "Cannot remove this user.\n\n" +
            "This account has:\n" +
            problems.map((p) => `• ${p}`).join("\n") +
            "\n\nResolve these items before removal.",
        },
        { status: 409, headers: corsHeaders }
      );
    }

    // 1. Mark the profile as removed (keeps ledger rows, removes from active list)
    const { error: markError } = await serviceClient
      .from("profiles")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", targetUserId);

    if (markError) {
      return Response.json(
        { error: "Failed to deactivate the user account." },
        { status: 500, headers: corsHeaders }
      );
    }

    // 2. Delete the auth identity so the account can never log in again.
    //    (No FK from profiles to auth.users, so ledger rows stay intact.)
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(
      targetUserId
    );

    if (deleteError) {
      // Roll back the deactivation marker so the user is not left half-removed
      await serviceClient
        .from("profiles")
        .update({ deactivated_at: null })
        .eq("id", targetUserId);
      return Response.json(
        { error: `Failed to delete the user's sign-in. ${deleteError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        message: "User removed.",
        user_id: targetUserId,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: err?.message || "Something went wrong." },
      { status: 500, headers: corsHeaders }
    );
  }
});