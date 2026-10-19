const encoder = new TextEncoder();

function getPepper(): string {
  const pepper = Deno.env.get("TRANSACTION_PIN_PEPPER");
  if (!pepper || pepper.length < 32) {
    throw new Error("Transaction PIN service is not configured.");
  }
  return pepper;
}

export function isValidTransactionPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export function isWeakTransactionPin(pin: string): boolean {
  if (/^(\d)\1{3}$/.test(pin)) return true;
  if (/^(\d)(\d)\1\2$/.test(pin)) return true;
  if (/^(\d)(\d)\2\1$/.test(pin)) return true;

  const digits = [...pin].map(Number);
  const ascending = digits.every((digit, i) => i === 0 || digit === digits[i - 1] + 1);
  const descending = digits.every((digit, i) => i === 0 || digit === digits[i - 1] - 1);

  return ascending || descending || new Set(["2580", "0852", "1379", "2468"]).has(pin);
}

async function deriveVerifier(userId: string, salt: string, pin: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getPepper()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`verronex-transaction-pin:v1:${userId}:${salt}:${pin}`),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createPinVerifier(
  userId: string,
  salt: string,
  pin: string,
): Promise<string> {
  return deriveVerifier(userId, salt, pin);
}

export async function createPinSalt(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getPinCandidate(
  admin: any,
  userId: string,
  pin: unknown,
): Promise<string | null> {
  if (!isValidTransactionPin(pin)) return null;

  const { data, error } = await admin
    .from("transaction_pin_security")
    .select("pin_salt, pin_verifier")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("Transaction PIN service is temporarily unavailable.");
  if (!data?.pin_verifier || !data.pin_salt) return null;

  return deriveVerifier(userId, data.pin_salt, pin);
}

export function isPinFailureCode(code: unknown): code is string {
  return ["pin_required", "pin_invalid", "pin_locked", "pin_already_set"].includes(
    String(code),
  );
}

