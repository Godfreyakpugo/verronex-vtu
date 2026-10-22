export const MANUAL_FUNDING_SETTINGS_COLUMNS =
  "configured, bank_name, account_name, account_number, payment_instructions, whatsapp_number";

export function normalizeWhatsappNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

export function getFallbackManualFundingSettings() {
  return {
    bank_name: import.meta.env.VITE_BANK_NAME || "",
    account_name: import.meta.env.VITE_ACCOUNT_NAME || "",
    account_number: import.meta.env.VITE_ACCOUNT_NUMBER || "",
    payment_instructions: "",
    whatsapp_number: normalizeWhatsappNumber(
      import.meta.env.VITE_WHATSAPP_NUMBER || "",
    ),
  };
}

export function mapManualFundingSettings(row) {
  return {
    bank_name: row?.bank_name || "",
    account_name: row?.account_name || "",
    account_number: row?.account_number || "",
    payment_instructions: row?.payment_instructions || "",
    whatsapp_number: normalizeWhatsappNumber(row?.whatsapp_number || ""),
  };
}
