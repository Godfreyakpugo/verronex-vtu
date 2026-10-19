import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createPinSalt,
  createPinVerifier,
  getPinCandidate,
  isPinFailureCode,
  isValidTransactionPin,
  isWeakTransactionPin,
} from "../_shared/transactionPin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function cooldownMessage(value: unknown): string {
  const until = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(until)) return "Too many incorrect attempts. Please try again later.";
  const seconds = Math.max(1, Math.ceil((until - Date.now()) / 1000));
  if (seconds < 60) return `Too many incorrect attempts. Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many incorrect attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

function pinFailure(code: string, cooldownUntil?: unknown): Response {
  const message = code === "pin_required"
    ? "Enter your transaction PIN to continue."
    : code === "pin_invalid"
    ? "That transaction PIN is incorrect."
    : code === "pin_already_set"
    ? "A transaction PIN is already set. Verify your current PIN or use account recovery."
    : cooldownMessage(cooldownUntil);

  return json({
    pinError: true,
    code,
    error: message,
    cooldownUntil: typeof cooldownUntil === "string" ? cooldownUntil : null,
  });
}

function isPinSchemaUnavailable(error: { code?: string } | null): boolean {
  return ["42P01", "42883", "PGRST202", "PGRST205"].includes(error?.code ?? "");
}

function pinDatabaseSetupError(): Response {
  return json({
    code: "pin_database_setup_incomplete",
    error: "Transaction PIN database setup is incomplete. Apply transaction_pin_security.sql, then try again.",
  }, 503);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceRoleKey) {
      return json({ error: "Transaction PIN service is not configured." }, 503);
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(url, serviceRoleKey);
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized." }, 401);

    const body = await req.json();
    const action = body?.action;

    if (action === "status") {
      const { data, error } = await admin
        .from("transaction_pin_security")
        .select("pin_verifier, reminder_after, reminders_disabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        return isPinSchemaUnavailable(error)
          ? pinDatabaseSetupError()
          : json({ error: "Could not load transaction PIN settings." }, 503);
      }

      const reminderAfter = data?.reminder_after ?? null;
      const remindersDisabled = data?.reminders_disabled === true;
      const reminderDue = !data?.pin_verifier && !remindersDisabled &&
        (!reminderAfter || Date.parse(reminderAfter) <= Date.now());

      return json({
        hasPin: Boolean(data?.pin_verifier),
        reminderAfter,
        remindersDisabled,
        reminderDue,
      });
    }

    if (action === "remind_later" || action === "dont_remind") {
      const reminderAction = action === "remind_later" ? "later" : "suppress";
      const { error } = await admin.rpc("transaction_pin_set_reminder", {
        p_user_id: user.id,
        p_action: reminderAction,
      });
      if (error) {
        return isPinSchemaUnavailable(error)
          ? pinDatabaseSetupError()
          : json({ error: "Could not update reminder settings." }, 503);
      }
      return json({ success: true });
    }

    if (!["setup", "change", "recover"].includes(action)) {
      return json({ error: "Unsupported transaction PIN action." }, 400);
    }

    const newPin = body?.newPin;
    if (!isValidTransactionPin(newPin)) {
      return json({ error: "Transaction PIN must contain exactly four digits." }, 400);
    }
    if (isWeakTransactionPin(newPin)) {
      return json({ error: "Choose a less predictable four-digit PIN." }, 400);
    }

    let recoveryVerified = false;
    if (action === "recover") {
      const accountPassword = body?.accountPassword;
      body.accountPassword = null;
      if (typeof accountPassword !== "string" || accountPassword.length === 0 || !user.email) {
        return json({ error: "Enter your account password to verify your identity." }, 401);
      }

      const authVerifier = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
      const { data: verified, error: passwordError } =
        await authVerifier.auth.signInWithPassword({
          email: user.email,
          password: accountPassword,
        });
      recoveryVerified = !passwordError && verified.user?.id === user.id;
      if (!recoveryVerified) {
        return json({
          error: "Account password could not be verified. Your transaction PIN was not changed.",
          code: "account_verification_failed",
        }, 401);
      }
    }

    const pepper = Deno.env.get("TRANSACTION_PIN_PEPPER");
    if (!pepper || pepper.length < 32) {
      return json({ error: "Transaction PIN service is not configured." }, 503);
    }

    const salt = await createPinSalt();
    const verifier = await createPinVerifier(user.id, salt, newPin);
    const currentPin = action === "change" ? body?.currentPin : null;
    const currentVerifier = currentPin
      ? await getPinCandidate(admin, user.id, currentPin)
      : null;

    const { data, error } = await admin.rpc("transaction_pin_set", {
      p_user_id: user.id,
      p_pin_salt: salt,
      p_pin_verifier: verifier,
      p_current_verifier: currentVerifier,
      p_recovery_verified: recoveryVerified,
    });

    if (error) {
      return isPinSchemaUnavailable(error)
        ? pinDatabaseSetupError()
        : json({ error: "Could not update transaction PIN settings." }, 503);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) {
      if (isPinFailureCode(result?.error_code)) {
        return pinFailure(result.error_code, result.cooldown_until);
      }
      return json({ error: "Could not update transaction PIN settings." }, 400);
    }

    return json({ success: true, hasPin: true });
  } catch {
    // Never log request bodies: transaction PINs must not enter function logs.
    return json({ error: "Transaction PIN service is temporarily unavailable." }, 503);
  }
});
