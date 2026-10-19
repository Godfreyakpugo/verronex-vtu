import supabase from "./supabaseClient";

const SERVICE_UNAVAILABLE_MESSAGE =
  "Unable to reach the transaction PIN service. Confirm the transaction-pin Edge Function is deployed and the PIN database SQL is applied.";

async function getFunctionErrorMessage(error, fallback) {
  if (error.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (typeof body?.error === "string" && body.error) return body.error;
    } catch {
      // Use the safe deployment hint if the response body is unavailable.
    }
  }

  if (error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError") {
    return SERVICE_UNAVAILABLE_MESSAGE;
  }

  return fallback;
}

export async function getTransactionPinStatus() {
  const { data, error } = await supabase.functions.invoke("transaction-pin", {
    body: { action: "status" },
  });
  if (error) {
    throw new Error(await getFunctionErrorMessage(error, SERVICE_UNAVAILABLE_MESSAGE));
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function invokeTransactionPin(body) {
  const { data, error } = await supabase.functions.invoke("transaction-pin", { body });
  if (error) {
    throw new Error(await getFunctionErrorMessage(error, SERVICE_UNAVAILABLE_MESSAGE));
  }
  return data;
}
