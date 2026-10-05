// Shared Nigerian recipient phone handling for Buy Data and Buy Airtime.
//
// Accepted inputs (all resolve to the same number):
//   08037408580
//   2348037408580
//   +234 803 740 8580
//   00234 803 740 8580
//
// Canonical local form is 08037408580 and is what gets displayed in the
// confirmation and receipt, and what is sent to the provider.

// Validation rule is unchanged from the previous per-page copies and matches
// the server-side guard in the purchase RPCs (^0[7-9][0-9]{9}$).
const NIGERIAN_MOBILE_PATTERN = /^0[7-9]\d{9}$/;
const NIGERIAN_COUNTRY_CODE = "234";

/** All non-digit characters removed. Safe on null/undefined. */
export function phoneDigits(raw) {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Convert any accepted input to the canonical local form (08037408580).
 * This is destructive: a partial "234" becomes "0". Use it for display of an
 * already-settled value, for the request payload, and on blur — not on every
 * keystroke (see normalizeNigerianPhoneOnComplete).
 */
export function normalizeNigerianPhone(raw) {
  let digits = phoneDigits(raw);

  // International dialling prefix, e.g. 002348037408580
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith(NIGERIAN_COUNTRY_CODE)) {
    digits = `0${digits.slice(NIGERIAN_COUNTRY_CODE.length)}`;
  }

  return digits;
}

/** True only for a complete, valid Nigerian mobile number. */
export function isValidNigerianPhone(raw) {
  return NIGERIAN_MOBILE_PATTERN.test(normalizeNigerianPhone(raw));
}

/**
 * Canonicalise while the user is still typing, but ONLY once the value is
 * already a complete valid number. A half-typed international prefix such as
 * "2", "23" or "234" is returned unchanged so the field never rewrites itself
 * to "0" mid-keystroke and the caret never jumps.
 */
export function normalizeNigerianPhoneOnComplete(raw) {
  if (isValidNigerianPhone(raw)) {
    return normalizeNigerianPhone(raw);
  }
  return raw ?? "";
}